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
  const subscription = element("subscription-panel");
  if (subscription) subscription.hidden = screen !== account;
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

const practiceMinutes = {
  "tk264qJxWEA": 22,
  "6Ja_pWyun_k": 24,
  "sOuvkqGpQIA": 22,
  "La4TZpinM4c": 22,
  "wiOjO6O3AS4": 21,
  "XwrF8AMKGR4": 28,
  "QvqTdqCXPU8": 26,
  "1sZu7k9n7K8": 30,
  "NWKQfff4r4Y": 23,
  "1P_x2uhjDW8": 22,
  "nM-UIH606rg": 25,
  "sQSgeUACzMI": 26,
  "zMfUcw4qJEs": 23,
  "cQBxBNYg-jY": 23,
  "CzNNHFvS1N8": 18,
  "b2G_FnYzSUg": 23,
  "HjFds6Bvgxk": 22,
  "dchJrbxaMu8": 19,
  "TWznqwAq95k": 24,
  "N8S8Vz_51wk": 20,
  "eofzUB4hy2I": 29,
  "JSYaMMNlGRU": 30,
  "3kNIhXDOJA0": 24,
  "tob9Y7jmhjg": 4,
  "4i5lwn6NJuo": 6,
  "TUKJFQhgxUg": 8,
  "CZ2aUBSkLpc": 33,
  "xiacnUCtaxc": 21,
  "FR-AUE4Jku0": 28,
  "8sG3kcSVmiw": 25,
  "47mgkejPDwY": 25,
  "rpVm0Hw32z0": 23,
  "FM9_VgD-7vA": 27,
  "ZVedHf5P-Zs": 27,
  "3ABzGi2mXsM": 26,
  "gv8T4aKEPAE": 49,
  "NhvbzvPwrVg": 28,
  "m6ktTvrZUfs": 26,
  "8SZYHKSVHmM": 23,
  "868yD5Gv0EA": 23,
  "gtTJeP-sGgM": 32,
  "bqTAAfcP4Tg": 27,
  "BQtc9BTMmHY": 5,
  "jn5vwaIA6Eg": 8,
  "t2pAfdzvLIk": 10,
  "8Y2RD12yqt0": 10,
  "uUPoltdCMYA": 11,
  "S7gkZepLjW8": 8,
  "k2P0rju8JNI": 10,
  "-MiHe74s0R0": 6,
  "4ooShVP9MJ0": 10,
  "t7uSB8lKN8w": 31,
  "N1pCd_3vQkc": 26,
  "Yo4_fqrHIHg": 22,
  "3MQFBsN0Ei0": 26,
  "wpBvbt_0TZw": 21,
  "LCVM4_5gM-A": 31,
  "ZDukU6omLDo": 47,
  "3k9FNJW2-MY": 19,
  "O3ZM4ZEXn3I": 27,
  "MUAF0peGDyU": 20,
  "OfO9iOrq9Wc": 31,
  "2LOIRZYx6k4": 24,
  "WWXq3Vm5vUw": 17,
  "P2OAsmbg7A0": 24,
  "b2l0OsJamPA": 20,
  "FLm08IxBY6A": 16,
  "UVQNhlrKjJk": 26,
  "2KntpZ2Ud9U": 35,
  "rZOuXiJbPyw": 33,
  "Q_enwVVo3FE": 19,
  "2TeIieRqfSM": 21,
  "aWCjeazDZaA": 8,
  "a4IdYovXF94": 13,
  "Ejzw152mqsc": 8,
  "41Kc4iRF9ls": 14,
  "10AemLbIiL0": 11,
  "cDk179O-qqU": 35,
  "LzBFgnWphYA": 33,
};

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
    const card = document.createElement("article");
    card.className = "library-card";
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
      card.append(thumbnail);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "library-placeholder";
      card.append(placeholder);
    }
    const title = document.createElement("span");
    title.className = "library-card-title";
    title.textContent = entry.title;
    card.title = entry.title;
    card.append(title);
    let durationLabel;
    {
      const duration = document.createElement("div");
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
      const playIcon = document.createElement("button");
      playIcon.type = "button";
      playIcon.className = "library-play-icon";
      playIcon.setAttribute("aria-label", "Смотреть: " + entry.title);
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      playIcon.append("Смотреть", arrow);
      playIcon.addEventListener("click", () => play(entry));
      duration.append(clock, durationLabel, playIcon);
      card.append(duration);
    }
    cards.append(card);
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
