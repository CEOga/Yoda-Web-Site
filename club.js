import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/+esm";

const element = (id) => document.getElementById(id);
const status = element("status");
const support = element("club-support");
const login = element("login");
const password = element("password");
const account = element("account");
const video = element("video");
const playlist = element("playlist");
const clubUrl = location.origin + "/club.html";
const callback = new URLSearchParams(location.hash.slice(1));
let settingPassword = false;
let client;

function showStatus(message, isError = false) {
  status.textContent = message;
  support.hidden = !isError;
}

function show(screen, message = "", isError = false) {
  for (const panel of [login, password, account]) panel.hidden = panel !== screen;
  showStatus(message, isError);
}

function clearVideo() {
  playlist.removeAttribute("href");
  playlist.hidden = true;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.hidden = true;
}

async function clubRequest(session, action = "status") {
  const response = await fetch("/api/club?action=" + action, {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token },
  });
  return { ok: response.ok, ...await response.json() };
}

async function refreshAccount() {
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session) return show(login);
  const result = await clubRequest(session);
  if (result.error === "login_required") {
    await client.auth.signOut({ scope: "local" });
    return show(login, "Сеанс завершён. Войдите снова.", true);
  }
  if (!result.ok) throw new Error("Membership unavailable");
  element("library").hidden = !result.active;
  element("play").textContent = result.playlistPreview ? "Показать плейлист" : "Открыть практику";
  element("renew").hidden = result.active;
  element("expiry").textContent = result.active
    ? "Доступ действует до " + new Date(result.expiresAt).toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })
    : "Сейчас у вас нет активной подписки.";
  show(account);
}

function bind(id, event, action) {
  element(id).addEventListener(event, async (e) => {
    e.preventDefault();
    const button = e.submitter ?? e.currentTarget;
    button.disabled = true;
    try {
      await action();
    } catch {
      showStatus("Что-то пошло не так. Попробуйте ещё раз.", true);
    } finally {
      button.disabled = false;
    }
  });
}

async function start() {
  const config = await fetch("/api/club");
  if (!config.ok) return show(null, "Вход в клуб пока недоступен.", true);
  const { url, key, googleEnabled } = await config.json();
  client = createClient(url, key);

  element("google").hidden = !googleEnabled;
  bind("google", "click", async () => {
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: clubUrl },
    });
    if (error) throw error;
  });

  bind("login", "submit", async () => {
    const { error } = await client.auth.signInWithPassword({
      email: login.elements.email.value.trim(),
      password: login.elements.password.value,
    });
    if (error) return show(login, "Не удалось войти. Проверьте почту и пароль.", true);
    HTMLFormElement.prototype.reset.call(login);
    await refreshAccount();
  });
  bind("reset", "click", async () => {
    const email = login.elements.email;
    if (!email.reportValidity()) return;
    const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: clubUrl,
    });
    showStatus(
      error ? "Не удалось запросить письмо. Попробуйте позже." : "Если эта почта есть в клубе, на неё придёт ссылка для восстановления.",
      Boolean(error),
    );
  });
  bind("password", "submit", async () => {
    const { error } = await client.auth.updateUser({ password: password.elements.password.value });
    if (error) return show(password, "Не удалось сохранить пароль. Проверьте требования к паролю или запросите новую ссылку.", true);
    settingPassword = false;
    password.reset();
    await refreshAccount();
  });
  bind("logout", "click", async () => {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    clearVideo();
    show(login, "Вы вышли из клуба.");
  });
  bind("play", "click", async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return refreshAccount();
    const result = await clubRequest(session, "play");
    if (result.error === "inactive" || result.error === "login_required") {
      clearVideo();
      return refreshAccount();
    }
    if (!result.ok) {
      return showStatus("Не удалось открыть видео. Попробуйте ещё раз.", true);
    }
    showStatus("");
    if (result.kind === "youtube_playlist") {
      playlist.href = result.url;
      playlist.hidden = false;
      playlist.focus();
      return;
    }
    video.src = result.url;
    video.hidden = false;
    await video.play().catch(() => {});
  });

  const { data: { session }, error } = await client.auth.getSession();
  if (callback.has("error") || (callback.has("access_token") && (!session || error))) {
    history.replaceState(null, "", location.pathname);
    return show(login, "Не удалось завершить вход. Попробуйте снова или запросите новую ссылку.", true);
  }
  if (session && ["invite", "recovery"].includes(callback.get("type"))) {
    settingPassword = true;
    return show(password, "Задайте пароль для входа в клуб.");
  }
  await refreshAccount();
  addEventListener("pageshow", (event) => {
    if (event.persisted && !settingPassword) {
      clearVideo();
      refreshAccount().catch(() => show(null, "Не удалось проверить доступ. Обновите страницу.", true));
    }
  });
}

start().catch(() => show(null, "Не удалось открыть кабинет. Обновите страницу.", true));
