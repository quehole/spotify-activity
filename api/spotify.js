const DISCORD_USER_ID = process.env.DISCORD_USER_ID || "794143054117601310";

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[char]));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function renderCard(spotify) {
  const width = 460;
  const height = 150;
  const active = Boolean(spotify);
  const title = active ? spotify.song || "Unknown track" : "Not listening right now";
  const artist = active ? spotify.artist || "Unknown artist" : "Spotify activity will appear here";
  const album = active ? spotify.album || "" : "Connect Spotify to Discord";
  const image = active && spotify.album_art_url
    ? `<image href="${esc(spotify.album_art_url)}" x="22" y="22" width="106" height="106" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverClip)"/>`
    : `<rect x="22" y="22" width="106" height="106" rx="12" fill="#202020"/>
       <text x="75" y="88" text-anchor="middle" font-size="30" fill="#1ed760">♫</text>`;

  let progress = 0;
  if (active && spotify.timestamps?.start && spotify.timestamps?.end) {
    const now = Date.now();
    progress = clamp((now - spotify.timestamps.start) /
      (spotify.timestamps.end - spotify.timestamps.start), 0, 1);
  }

  const progressWidth = Math.round(376 * progress);
  const trackId = active ? spotify.track_id : "";
  const spotifyUrl = trackId
    ? `https://open.spotify.com/track/${encodeURIComponent(trackId)}`
    : "https://open.spotify.com/";

  const progressMarkup = active && spotify.timestamps?.start && spotify.timestamps?.end
    ? `<rect x="22" y="132" width="376" height="3" rx="1.5" fill="#343434"/>
       <rect x="22" y="132" width="${progressWidth}" height="3" rx="1.5" fill="#1ed760"/>`
    : `<rect x="22" y="132" width="376" height="3" rx="1.5" fill="#343434"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"
     aria-label="${esc(active ? `Listening to ${title} by ${artist}` : "Spotify activity is offline")}">
  <defs>
    <clipPath id="coverClip"><rect x="22" y="22" width="106" height="106" rx="12"/></clipPath>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#191b1d"/>
      <stop offset="1" stop-color="#101112"/>
    </linearGradient>
  </defs>
  <a href="${esc(spotifyUrl)}" target="_blank">
    <rect x="0.5" y="0.5" width="459" height="149" rx="16" fill="url(#bg)" stroke="#303438"/>
    <circle cx="421" cy="31" r="5" fill="${active ? "#1ed760" : "#777777"}"/>
    <text x="22" y="16" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700"
          letter-spacing="1.5" fill="#1ed760">SPOTIFY ${active ? "NOW PLAYING" : "ACTIVITY"}</text>
    ${image}
    <text x="148" y="54" font-family="Arial, Helvetica, sans-serif" font-size="16"
          font-weight="700" fill="#f5f5f5">${esc(title.length > 34 ? title.slice(0, 31) + "…" : title)}</text>
    <text x="148" y="78" font-family="Arial, Helvetica, sans-serif" font-size="12"
          fill="#b7b9bb">${esc(artist.length > 42 ? artist.slice(0, 39) + "…" : artist)}</text>
    <text x="148" y="99" font-family="Arial, Helvetica, sans-serif" font-size="10"
          fill="#777d80">${esc(album.length > 45 ? album.slice(0, 42) + "…" : album)}</text>
    <text x="148" y="119" font-family="Arial, Helvetica, sans-serif" font-size="9"
          font-weight="700" letter-spacing="1" fill="${active ? "#1ed760" : "#929292"}">
      ${active ? "LISTENING ON SPOTIFY" : "NOT LISTENING"}
    </text>
    ${progressMarkup}
  </a>
</svg>`;
}

module.exports = async (req, res) => {
  try {
    const response = await fetch(
      `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`,
      { headers: { accept: "application/json" } }
    );

    if (!response.ok) throw new Error(`Lanyard returned ${response.status}`);
    const payload = await response.json();
    if (!payload.success || !payload.data) throw new Error("No Lanyard presence data");

    const spotify = payload.data.listening_to_spotify ? payload.data.spotify : null;

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(renderCard(spotify));
  } catch (error) {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(renderCard(null));
  }
};
