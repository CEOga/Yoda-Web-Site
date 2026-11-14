import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/+esm";

const element = (id) => document.getElementById(id);
const status = element("status");
const support = element("club-support");
const login = element("login");
const password = element("password");
const account = element("account");
const video = element("video");
const playlistPlayer = element("playlist-player");
const library = element("library");
const practiceVideo = element("practice-video");
const libraryUrl = "/club-library";
const clubUrl = location.origin + "/club.html";
const callback = new URLSearchParams(location.hash.slice(1));
let settingPassword = false;
let client;

function showStatus(message, isError = false) {
  status.textContent = message;
  support.hidden = !isError && (!account || account.hidden);
}

function show(screen, message = "", isError = false) {
  for (const panel of [login, password, account].filter(Boolean)) panel.hidden = panel !== screen;
  if (library && screen !== account) {
    library.hidden = true;
    clearVideo();
  }
  showStatus(message, isError);
}

let youtubePlayer;
let youtubeApi;
const unavailablePlaylists = new Set();

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  youtubeApi ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    script.onerror = () => {
      youtubeApi = undefined;
      script.remove();
      reject(new Error("YouTube player API unavailable"));
    };
    document.head.append(script);
  });
  return youtubeApi;
}

function clearVideo() {
  if (youtubePlayer) {
    youtubePlayer.destroy();
    youtubePlayer = undefined;
  }
  playlistPlayer.replaceChildren();
  playlistPlayer.hidden = true;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.hidden = true;
}

async function clubRequest(session, action = "status", videoIndex = "") {
  const response = await fetch("/api/club?" + new URLSearchParams({ action, video: videoIndex }), {
    method: "POST",
    headers: { Authorization: "Bearer " + session.access_token },
  });
  return { ok: response.ok, ...await response.json() };
}

async function refreshAccount() {
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session) {
    if (account) return location.replace(clubUrl);
    return show(login);
  }
  if (!account) return location.replace(libraryUrl);
  const result = await clubRequest(session);
  if (result.error === "login_required") {
    await client.auth.signOut({ scope: "local" });
    return location.replace(clubUrl);
  }
  if (!result.ok) throw new Error("Membership unavailable");
  library.hidden = !result.active;
  if (!result.active) clearVideo();
  practiceVideo.replaceChildren(...(result.videos ?? []).map((title, index) => new Option(title, index)).filter(option => !unavailablePlaylists.has(option.value)));
  element("logout").hidden = false;
  element("subscription-toggle").hidden = false;
  practiceVideo.disabled = !practiceVideo.options.length;
  element("subscription-check").hidden = !result.active;
  element("expiry").textContent = result.active
    ? "Доступ действует до " + new Date(result.expiresAt).toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })
    : "Сейчас у вас нет активной подписки.";
  show(account);
  if (result.active) await loadPlaylist(session);
}

function bind(id, event, action) {
  element(id)?.addEventListener(event, async (e) => {
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

const practiceMinutes = {"tk264qJxWEA":20,"6Ja_pWyun_k":25,"sOuvkqGpQIA":20};

let playlistRequest = 0;
async function loadPlaylist(session) {
  const request = ++playlistRequest;
  const cards = element("video-cards");
  cards.replaceChildren();
  clearVideo();
  if (!practiceVideo.options.length) return showStatus("Нет доступных плейлистов.");
  const option = practiceVideo.selectedOptions[0];
  const result = await clubRequest(session, "play", option.value);
  if (request !== playlistRequest) return;
  if (result.error === "inactive" || result.error === "login_required") return refreshAccount();
  if (!result.ok) return showStatus("Не удалось открыть плейлист.", true);
  showStatus("");

  let playback = 0;
  async function play(entry) {
    const attempt = ++playback;
    clearVideo();
    if (entry.id || result.playlistId) {
      const url = new URL(entry.id
        ? "https://www.youtube.com/embed/" + entry.id
        : "https://www.youtube.com/embed/videoseries?list=" + result.playlistId);
      const frame = document.createElement("iframe");
      frame.title = "Плеер YouTube";
      frame.allowFullscreen = true;
      frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
      if (entry.id) url.searchParams.set("autoplay", "1");
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      if (await loadYouTubeApi().catch(() => null)) {
        url.searchParams.set("enablejsapi", "1");
        url.searchParams.set("origin", location.origin);
      }
      if (request !== playlistRequest || attempt !== playback || library.hidden) return;
      frame.src = url.href;
      playlistPlayer.replaceChildren(frame);
      playlistPlayer.hidden = false;
      if (url.searchParams.has("enablejsapi")) {
        youtubePlayer = new window.YT.Player(frame, {
          events: {
            onError({ data }) {
              if (request !== playlistRequest || attempt !== playback || !option.isConnected) return;
              if (![100, 101, 150].includes(data)) return;
              unavailablePlaylists.add(option.value);
              option.remove();
              practiceVideo.disabled = !practiceVideo.options.length;
              loadPlaylist(session).catch(() => showStatus("Не удалось загрузить плейлист.", true));
            },
          },
        });
      }
      if (entry.id) playlistPlayer.scrollIntoView({ block: "nearest" });
    } else {
      video.src = result.url;
      video.hidden = false;
      video.play().catch(() => {});
    }
  }

  for (const entry of result.entries?.length ? result.entries : [{ title: practiceVideo.selectedOptions[0].text }]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "library-card";
    if (entry.id) {
      const thumbnail = document.createElement("img");
      const thumbnailBase = "https://i.ytimg.com/vi/" + entry.id + "/";
      const thumbnailFiles = ["maxresdefault.jpg", "hqdefault.jpg", "2.jpg"];
      let thumbnailIndex = 0;
      const useNextThumbnail = () => {
        if (thumbnailIndex < thumbnailFiles.length - 1) {
          thumbnail.src = thumbnailBase + thumbnailFiles[++thumbnailIndex];
        }
      };
      thumbnail.addEventListener("error", useNextThumbnail);
      thumbnail.addEventListener("load", () => {
        if (thumbnail.naturalWidth < 320) useNextThumbnail();
      });
      thumbnail.decoding = "async";
      thumbnail.src = thumbnailBase + thumbnailFiles[0];
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      button.append(thumbnail);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "library-placeholder";
      button.append(placeholder);
    }
    const title = document.createElement("span");
    title.className = "library-card-title";
    title.textContent = entry.title;
    button.title = entry.title;
    button.append(title);
    let durationLabel;
    {
      const duration = document.createElement("small");
      duration.className = "library-duration";
      const clock = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      clock.setAttribute("viewBox", "0 0 20 20");
      clock.setAttribute("aria-hidden", "true");
      clock.setAttribute("width", "20");
      clock.setAttribute("height", "20");
      clock.setAttribute("fill", "none");
      clock.setAttribute("stroke", "currentColor");
      clock.setAttribute("stroke-width", "1.6");
      clock.setAttribute("stroke-linecap", "round");
      clock.setAttribute("stroke-linejoin", "round");
      clock.classList.add("duration-clock");
      const clockFace = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      clockFace.setAttribute("cx", "10");
      clockFace.setAttribute("cy", "10");
      clockFace.setAttribute("r", "7");
      const clockHands = document.createElementNS("http://www.w3.org/2000/svg", "path");
      clockHands.setAttribute("d", "M10 6v4l2.5 1.5");
      clock.append(clockFace, clockHands);
      durationLabel = document.createElement("span");
      durationLabel.textContent = practiceMinutes[entry.id] ? practiceMinutes[entry.id] + " мин" : "Время не указано";
      const playIcon = document.createElement("span");
      playIcon.className = "library-play-icon";
      playIcon.setAttribute("aria-hidden", "true");
      playIcon.textContent = "Смотреть →";
      duration.append(clock, durationLabel, playIcon);
      button.append(duration);
    }
    button.setAttribute("aria-label", "Смотреть: " + entry.title);
    button.addEventListener("click", () => play(entry));
    cards.append(button);
  }
  if (result.playlistId && !result.entries?.length) await play({});
}

async function start() {
  const config = await fetch("/api/club");
  if (!config.ok) return show(null, "Вход в клуб пока недоступен.", true);
  const { url, key, googleEnabled } = await config.json();
  client = createClient(url, key);

  if (login) element("google").hidden = !googleEnabled;
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
    location.replace(clubUrl);
  });
  bind("subscription-toggle", "click", async () => {
    const panel = element("subscription-panel");
    panel.hidden = !panel.hidden;
    element("subscription-toggle").setAttribute("aria-expanded", String(!panel.hidden));
  });
  practiceVideo?.addEventListener("change", async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return refreshAccount();
    await loadPlaylist(session).catch(() => showStatus("Не удалось загрузить плейлист.", true));
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
      if (library) clearVideo();
      refreshAccount().catch(() => show(null, "Не удалось проверить доступ. Обновите страницу.", true));
    }
  });
}

start().catch(() => show(null, "Не удалось открыть кабинет. Обновите страницу.", true));

addEventListener("hashchange", () => {
  if (location.hash === "#videoteka" && library && !library.hidden) element("videoteka").focus();
});
