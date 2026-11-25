
const sharp = require("sharp");
const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const DISCORD_USER_ID =
  process.env.DISCORD_USER_ID || "794143054117601310";

const FONT_PATH = path.join(
  process.cwd(),
  "fonts",
  "Roboto.ttf"
);

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

function wrapText(value, maxChars) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }

      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }

      continue;
    }

    const candidate = line
      ? `${line} ${word}`
      : word;

    if (candidate.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines.length ? lines : [""];
}

function formatTime(milliseconds) {
  const seconds = Math.max(
    0,
    Math.floor(milliseconds / 1000)
  );

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

async function fetchAlbumArtwork(url) {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: {
        accept: "image/*"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return null;

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      return null;
    }

    const png = await sharp(buffer)
      .resize(132, 132, {
        fit: "cover",
        position: "centre"
      })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString("base64")}`;

  } catch (error) {
    console.error("Album artwork error:", error);
    return null;
  }
}

function renderCard(spotify, albumArtDataUri = null) {
  const width = 460;
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

  // Typography and text wrapping.
  const titleLines = wrapText(title, 22);
  const artistLines = wrapText(artist, 30);
  const albumLines = album
    ? wrapText(album, 34)
    : [];

  const titleSize = 23;
  const artistSize = 16;
  const albumSize = 13;

  const titleLineHeight = 29;
  const artistLineHeight = 23;
  const albumLineHeight = 19;

  const gapTitleArtist = 10;
  const gapArtistAlbum = 7;

  const titleHeight =
    titleLines.length * titleLineHeight;

  const artistHeight =
    artistLines.length * artistLineHeight;

  const albumHeight =
    albumLines.length * albumLineHeight;

  const textContentHeight =
    titleHeight +
    gapTitleArtist +
    artistHeight +
    gapArtistAlbum +
    albumHeight;

  // Fixed minimum height, dynamically expanded for long text.
  const height = Math.max(
    240,
    textContentHeight + 150
  );

  // Main layout.
  const artworkSize = 132;
  const artworkX = 24;
  const artworkY = Math.round(
    (height - artworkSize) / 2
  );

  const textX = 182;
  const textTop = 66;
  const textBottom = height - 64;
  const availableTextHeight = textBottom - textTop;

  let textY =
    textTop +
    Math.max(
      0,
      (availableTextHeight - textContentHeight) / 2
    );

  // Text generation.
  function makeText(
    lines,
    fontSize,
    lineHeight,
    color,
    weight = 400
  ) {
    const markup = lines.map((line, index) => {
      const y = textY + index * lineHeight;

      return `
        <tspan x="${textX}" y="${y}">
          ${esc(line)}
        </tspan>
      `;
    }).join("");

    textY += lines.length * lineHeight;

    return `
      <text
        font-family="Roboto"
        font-size="${fontSize}"
        font-weight="${weight}"
        fill="${color}"
      >${markup}</text>
    `;
  }

  const titleMarkup = makeText(
    titleLines,
    titleSize,
    titleLineHeight,
    "#FFFFFF",
    700
  );

  textY += gapTitleArtist;

  const artistMarkup = makeText(
    artistLines,
    artistSize,
    artistLineHeight,
    "#D7DADD",
    500
  );

  textY += gapArtistAlbum;

  const albumMarkup = albumLines.length
    ? makeText(
        albumLines,
        albumSize,
        albumLineHeight,
        "#92999E",
        400
      )
    : "";

  // Playback information.
  let progress = 0;
  let elapsed = 0;
  let duration = 0;

  if (
    active &&
    spotify.timestamps?.start &&
    spotify.timestamps?.end
  ) {
    const start = spotify.timestamps.start;
    const end = spotify.timestamps.end;

    duration = Math.max(0, end - start);
    elapsed = clamp(Date.now() - start, 0, duration);

    if (duration > 0) {
      progress = elapsed / duration;
    }
  }

  const progressX = 24;
  const progressWidth = 412;
  const progressY = height - 39;

  const filledWidth = progressWidth * progress;

  const elapsedText = active
    ? formatTime(elapsed)
    : "0:00";

  const durationText = active
    ? formatTime(duration)
    : "0:00";

  // Spotify link.
  const spotifyUrl =
    active && spotify.track_id
      ? `https://open.spotify.com/track/${encodeURIComponent(
          spotify.track_id
        )}`
      : "https://open.spotify.com/";

  // Album artwork.
  const image = active && albumArtDataUri
    ? `
      <rect
        x="${artworkX - 1}"
        y="${artworkY - 1}"
        width="${artworkSize + 2}"
        height="${artworkSize + 2}"
        rx="17"
        fill="#343A3D"
      />

      <image
        href="${albumArtDataUri}"
        x="${artworkX}"
        y="${artworkY}"
        width="${artworkSize}"
        height="${artworkSize}"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#coverClip)"
      />
    `
    : `
      <rect
        x="${artworkX}"
        y="${artworkY}"
        width="${artworkSize}"
        height="${artworkSize}"
        rx="16"
        fill="#222729"
      />

      <text
        x="${artworkX + artworkSize / 2}"
        y="${artworkY + 78}"
        font-family="Roboto"
        font-size="46"
        font-weight="700"
        fill="#1ED760"
        text-anchor="middle"
      >♫</text>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <defs>
    <linearGradient
      id="background"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop offset="0%" stop-color="#1C2022"/>
      <stop offset="100%" stop-color="#111415"/>
    </linearGradient>

    <linearGradient
      id="progress"
      x1="0"
      y1="0"
      x2="1"
      y2="0"
    >
      <stop offset="0%" stop-color="#1ED760"/>
      <stop offset="100%" stop-color="#39E982"/>
    </linearGradient>

    <clipPath id="coverClip">
      <rect
        x="${artworkX}"
        y="${artworkY}"
        width="${artworkSize}"
        height="${artworkSize}"
        rx="16"
      />
    </clipPath>
  </defs>

  <!-- Card background -->
  <rect
    x="0.5"
    y="0.5"
    width="459"
    height="${height - 1}"
    rx="20"
    fill="url(#background)"
    stroke="#343A3D"
    stroke-width="1"
  />

  <!-- Header -->
  <circle
    cx="27"
    cy="29"
    r="4"
    fill="#1ED760"
  />

  <text
    x="39"
    y="33"
    font-family="Roboto"
    font-size="10"
    font-weight="700"
    letter-spacing="1.6"
    fill="#E0E4E6"
  >NOW PLAYING</text>

  <text
    x="414"
    y="33"
    font-family="Roboto"
    font-size="10"
    font-weight="700"
    letter-spacing="1.3"
    fill="#777F83"
    text-anchor="end"
  >SPOTIFY</text>

  <!-- Header separator -->
  <line
    x1="24"
    y1="49"
    x2="436"
    y2="49"
    stroke="#303638"
    stroke-width="1"
  />

  <!-- Album artwork -->
  ${image}

  <!-- Song information -->
  ${titleMarkup}
  ${artistMarkup}
  ${albumMarkup}

  <!-- Playback section -->
  <line
    x1="24"
    y1="${height - 57}"
    x2="436"
    y2="${height - 57}"
    stroke="#2A3032"
    stroke-width="1"
  />

  <!-- Progress track -->
  <rect
    x="${progressX}"
    y="${progressY}"
    width="${progressWidth}"
    height="4"
    rx="2"
    fill="#343B3D"
  />

  <!-- Progress fill -->
  ${
    active
      ? `<rect
          x="${progressX}"
          y="${progressY}"
          width="${filledWidth.toFixed(2)}"
          height="4"
          rx="2"
          fill="url(#progress)"
        />`
      : ""
  }

  <!-- Playback timestamps -->
  <text
    x="${progressX}"
    y="${height - 17}"
    font-family="Roboto"
    font-size="10"
    font-weight="500"
    fill="#92999E"
  >${elapsedText}</text>

  <text
    x="${progressX + progressWidth}"
    y="${height - 17}"
    font-family="Roboto"
    font-size="10"
    font-weight="500"
    fill="#92999E"
    text-anchor="end"
  >${durationText}</text>

  <!-- Clickable Spotify area -->
  <a href="${esc(spotifyUrl)}">
    <rect
      x="1"
      y="1"
      width="458"
      height="${height - 2}"
      rx="20"
      fill="transparent"
    />
  </a>
</svg>`;
}

// Render SVG into PNG with Roboto.
function renderPNG(svg) {
  const renderer = new Resvg(svg, {
    fitTo: {
      mode: "original"
    },
    font: {
      fontFiles: [FONT_PATH],
      loadSystemFonts: false,
      defaultFontFamily: "Roboto"
    }
  });

  return renderer.render().asPng();
}

// API endpoint.
module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0"
  );

  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "image/png");

  try {
    if (!fs.existsSync(FONT_PATH)) {
      throw new Error(
        `Roboto font not found: ${FONT_PATH}`
      );
    }

    // Fetch Discord presence.
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
      throw new Error(
        `Lanyard returned ${response.status}`
      );
    }

    const payload = await response.json();

    if (!payload.success || !payload.data) {
      throw new Error("No Lanyard presence data");
    }

    const spotify =
      payload.data.listening_to_spotify
        ? payload.data.spotify
        : null;

    // Fetch album artwork.
    const albumArtDataUri =
      spotify?.album_art_url
        ? await fetchAlbumArtwork(
            spotify.album_art_url
          )
        : null;

    // Generate PNG.
    const svg = renderCard(
      spotify,
      albumArtDataUri
    );

    const png = renderPNG(svg);

    return res.status(200).send(png);

  } catch (error) {
    console.error("Spotify activity error:", error);

    try {
      const fallbackSvg = renderCard(null);
      const fallbackPng = renderPNG(fallbackSvg);

      return res.status(200).send(fallbackPng);

    } catch (fallbackError) {
      console.error(
        "Fallback image error:",
        fallbackError
      );

      return res.status(500).send(
        "Unable to generate Spotify card"
      );
    }
  }
};
