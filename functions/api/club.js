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

    const playlistId = env.CLUB_PREVIEW_YOUTUBE_PLAYLIST_ID ?? "";
    const playlistPreview = env.CLUB_ENABLE_YOUTUBE_PREVIEW === "true"
      && /^PL[A-Za-z0-9_-]{8,64}$/.test(playlistId);
    if (new URL(request.url).searchParams.get("action") !== "play") {
      return reply({ active, expiresAt, playlistPreview: active && playlistPreview });
    }
    if (!active) return reply({ error: "inactive" }, 403);
    if (playlistPreview) {
      const playlist = new URL("https://www.youtube.com/playlist");
      playlist.searchParams.set("list", playlistId);
      return reply({ kind: "youtube_playlist", url: playlist.href });
    }
    if (!CLUB_VIDEO_PATH || !SUPABASE_SECRET_KEY) return reply({ error: "video_unavailable" }, 503);

    const path = CLUB_VIDEO_PATH.split("/").map(encodeURIComponent).join("/");
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
