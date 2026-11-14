import playlistCatalog from "../../lib/playlist-catalog.js";

const defaultPlaylists = [
  "PLHT5h37YL57A",
  "PLZWOVGEhE2Ao",
  "PLZ8QVZi6vCeU",
  "PLEWtMtnshuiQ",
  "PLIMMV_Tf5-WA",
  "PLHdyZiCozWFc",
  "PLayeb9nGBD0Q",
  "PLZ7CxKISkDzM",
  "PLDpYNawuUmNs",
  "PLTxiT76g58LY",
  "PLaPJMhvwUTz0",
  "PLEP7UIFs0_e8",
  "PLYeGsDPztRHY",
  "PLJJGzv_t9Jb0",
  "PLQvxqe6HvQO0",
  "PLPma0pTH6rNA",
  "PLWkNyS2_fYko",
  "PLbdcq9hvleR0",
  "PLeBe0AYLw-TY",
  "PLGboohLX7qV8",
  "PLOsnW64gRtB8",
  "PLZK5iY3-WEWM",
].map((playlistId, index) => ({ title: "Плейлист " + (index + 1), playlistId }));

const headers = { "Cache-Control": "no-store" };
const reply = (data, status = 200) => Response.json(data, { status, headers });

export async function onRequestGet({ env }) {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = env;
  if (!url || !key) return reply({ error: "not_configured" }, 503);
  return reply({ url, key, googleEnabled: env.CLUB_GOOGLE_ENABLED === "true" });
}

export async function onRequestPost({ env, request }) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, CLUB_VIDEO_PATH } = env;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return reply({ error: "not_configured" }, 503);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return reply({ error: "origin" }, 403);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ error: "login_required" }, 401);
  const url = SUPABASE_URL.replace(/\/$/, "");
  const authHeaders = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization };

  try {
    const userResponse = await fetch(url + "/auth/v1/user", { headers: authHeaders });
    if (userResponse.status === 401 || userResponse.status === 403) return reply({ error: "login_required" }, 401);
    if (!userResponse.ok) return reply({ error: "unavailable" }, 502);
    const { id } = await userResponse.json();
    const query = new URLSearchParams({ select: "expires_at", user_id: "eq." + id });
    const membership = await fetch(url + "/rest/v1/club_memberships?" + query, { headers: authHeaders });
    if (!membership.ok) return reply({ error: "unavailable" }, 502);
    const [record] = await membership.json();
    const expiresAt = record?.expires_at ?? null;
    const remainingSeconds = Math.floor((Date.parse(expiresAt) - Date.now()) / 1000);
    const active = remainingSeconds > 0;

    const catalog = env.CLUB_YOUTUBE_PLAYLISTS
      ? JSON.parse(env.CLUB_YOUTUBE_PLAYLISTS)
      : env.CLUB_VIDEOS
      ? JSON.parse(env.CLUB_VIDEOS)
      : CLUB_VIDEO_PATH ? [{ title: "Практика", path: CLUB_VIDEO_PATH }] : defaultPlaylists;
    const action = new URL(request.url).searchParams;
    if (action.get("action") !== "play") {
      return reply({ active, expiresAt, videos: active ? catalog.map(({ title, playlistId }) => playlistCatalog[playlistId]?.title ?? title) : [] });
    }
    if (!active) return reply({ error: "inactive" }, 403);
    const index = action.get("video") ?? "0";
    const entry = /^\d+$/.test(index) ? catalog[Number(index)] : undefined;
    if (entry?.playlistId && /^PL[A-Za-z0-9_-]+$/.test(entry.playlistId)) {
      return reply({ playlistId: entry.playlistId, entries: playlistCatalog[entry.playlistId]?.videos ?? [] });
    }
    if (!entry?.path || !SUPABASE_SECRET_KEY) return reply({ error: "video_unavailable" }, 503);

    const path = entry.path.split("/").map(encodeURIComponent).join("/");
    const signed = await fetch(url + "/storage/v1/object/sign/club-videos/" + path, {
      method: "POST",
      headers: { apikey: SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: Math.min(3600, remainingSeconds) }),
    });
    if (!signed.ok) return reply({ error: "video_unavailable" }, 502);
    const { signedURL } = await signed.json();
    if (!signedURL?.startsWith("/object/sign/")) return reply({ error: "video_unavailable" }, 502);
    return reply({ url: url + "/storage/v1" + signedURL });
  } catch {
    return reply({ error: "unavailable" }, 502);
  }
}
