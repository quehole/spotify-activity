const DISCORD_USER_ID =
  process.env.DISCORD_USER_ID || "794143054117601310";

const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  }[char]));

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

function renderCard(spotify) {
  const width = 460;
  const height = 150;

  const active = Boolean(spotify);

  const title = active
    ? spotify.song || "Unknown track"
    : "Not listening right now";

  const artist = active
    ? spotify.artist || "Unknown artist"
    : "Spotify activity will appear here";

  const album = active
    ? spotify.album || ""
    : "Connect Spotify to Discord";

  const image = active && spotify.album_art_url
    ? `
      <image
        href="${esc(spotify.album_art_url)}"
        xlink:href="${esc(spotify.album_art_url)}"
        x="22"
        y="22"
        width="106"
        height="106"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#coverClip)"
      />
    `
    : `
      <rect
        x="22"
        y="22"
        width="106"
        height="106"
        rx="12"
        fill="#202020"
      />
      <g transform="translate(48 49) scale(0.055)">
        <path
          fill="#1ed760"
          d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm234.6 738.4a31.8 31.8 0 0 1-43.8 10.6c-120-73.4-271-90-449.4-49.4a31.9 31.9 0 1 1-14.2-62.2c195-44.6 362.2-25.2 496.8 57.2a31.9 31.9 0 0 1 10.6 43.8zm62.4-138.8a39.8 39.8 0 0 1-54.8 13.2c-137.4-84.4-347-108.8-509.6-59.6a39.9 39.9 0 1 1-23.2-76.4c185.8-56.4 416.8-29.2 574.4 67.6a39.9 39.9 0 0 1 13.2 55.2zm5.4-144.4c-164.8-97.8-436.8-107-594.2-59.2a47.9 47.9 0 1 1-27.8-91.6c180.8-54.8 481.4-44.2 671.4 68.6a47.9 47.9 0 0 1-49.4 82.2z"
        />
      </g>
    `;

  let progress = 0;

  if (
    active &&
    spotify.timestamps?.start &&
    spotify.timestamps?.end
  ) {
    const now = Date.now();

    const duration =
      spotify.timestamps.end - spotify.timestamps.start;

    if (duration > 0) {
      progress = clamp(
        (now - spotify.timestamps.start) / duration,
        0,
        1
      );
    }
  }

  const progressWidth = 376 * progress;

  const trackId = active ? spotify.track_id : "";

  const spotifyUrl = trackId
    ? `https://open.spotify.com/track/${encodeURIComponent(trackId)}`
    : "https://open.spotify.com/";

  const progressMarkup = `
    <rect
      x="22"
      y="132"
      width="376"
      height="3"
      rx="1.5"
      fill="#343434"
    />
    ${
      active
        ? `<rect
            x="22"
            y="132"
            width="${progressWidth.toFixed(2)}"
            height="3"
            rx="1.5"
            fill="#1ed760"
          />`
        : ""
    }
  `;

  const truncate = (value, max) =>
    value.length > max
      ? value.slice(0, max - 3) + "..."
      : value;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  role="img"
  aria-label="${esc(
    active
      ? `Listening to ${title} by ${artist}`
      : "Spotify activity is offline"
  )}"
>
  <defs>
    <clipPath id="coverClip">
      <rect x="22" y="22" width="106" height="106" rx="12"/>
    </clipPath>

    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#191b1d"/>
      <stop offset="1" stop-color="#101112"/>
    </linearGradient>
  </defs>

  <a href="${esc(spotifyUrl)}" target="_blank">

    <rect
      x="0.5"
      y="0.5"
      width="459"
      height="149"
      rx="16"
      fill="url(#bg)"
      stroke="#303438"
    />

    <circle
      cx="421"
      cy="31"
      r="5"
      fill="${active ? "#1ed760" : "#777777"}"
    />

    <text
      x="22"
      y="16"
      font-family="Arial, Helvetica, sans-serif"
      font-size="9"
      font-weight="700"
      letter-spacing="1.5"
      fill="#1ed760"
    >SPOTIFY ${active ? "NOW PLAYING" : "ACTIVITY"}</text>

    ${image}

    <text
      x="148"
      y="54"
      font-family="Arial, Helvetica, sans-serif"
      font-size="16"
      font-weight="700"
      fill="#f5f5f5"
    >${esc(truncate(title, 34))}</text>

    <text
      x="148"
      y="78"
      font-family="Arial, Helvetica, sans-serif"
      font-size="12"
      fill="#b7b9bb"
    >${esc(truncate(artist, 42))}</text>

    <text
      x="148"
      y="99"
      font-family="Arial, Helvetica, sans-serif"
      font-size="10"
      fill="#777d80"
    >${esc(truncate(album, 45))}</text>

    <text
      x="148"
      y="119"
      font-family="Arial, Helvetica, sans-serif"
      font-size="9"
      font-weight="700"
      letter-spacing="1"
      fill="${active ? "#1ed760" : "#929292"}"
    >${active ? "LISTENING ON SPOTIFY" : "NOT LISTENING"}</text>

    ${progressMarkup}

  </a>
</svg>`;
}

module.exports = async (req, res) => {
  // Prevent browser and intermediary caching.
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0"
  );

  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");

  try {
    const response = await fetch(
      `https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`,
      {
        headers: {
          accept: "application/json",
          "cache-control": "no-cache"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`Lanyard returned ${response.status}`);
    }

    const payload = await response.json();

    if (!payload.success || !payload.data) {
      throw new Error("No Lanyard presence data");
    }

    const spotify = payload.data.listening_to_spotify
      ? payload.data.spotify
      : null;

    return res.status(200).send(renderCard(spotify));

  } catch (error) {
    console.error("Spotify activity error:", error);

    return res.status(200).send(renderCard(null));
  }
};
