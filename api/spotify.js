
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

// Fetch and convert album artwork.
async function fetchAlbumArtwork(url) {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: { accept: "image/*" },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return null;

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      return null;
    }

    const png = await sharp(buffer)
      .resize(112, 112, {
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

// Wrap text into lines.
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

// Generate the Spotify card.
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

  // Larger typography with more readable line spacing.
  const titleLines = wrapText(title, 25);
  const artistLines = wrapText(artist, 34);
  const albumLines = album
    ? wrapText(album, 39)
    : [];

  const titleSize = 21;
  const artistSize = 16;
  const albumSize = 14;
  const statusSize = 10;

  const titleLineHeight = 27;
  const artistLineHeight = 22;
  const albumLineHeight = 19;

  // Calculate the complete text block height.
  const titleHeight =
    titleLines.length * titleLineHeight;

  const artistHeight =
    artistLines.length * artistLineHeight;

  const albumHeight =
    albumLines.length * albumLineHeight;

  const gapTitleArtist = 7;
  const gapArtistAlbum = 5;
  const gapAlbumStatus = 13;
  const statusHeight = 14;

  const textContentHeight =
    titleHeight +
    gapTitleArtist +
    artistHeight +
    gapArtistAlbum +
    albumHeight +
    gapAlbumStatus +
    statusHeight;

  // Height adjusts automatically to the content.
const height = Math.max(
  250,
  textContentHeight + 110
);

  // Artwork positioning.
  const artworkSize = 112;
  const artworkX = 22;
  const artworkY = Math.round(
    (height - artworkSize) / 2
  );

  // Text positioning.
  const textX = 154;

  // Center the entire text block in the available space.
  const contentTop = 48;
  const contentBottom = height - 38;
  const contentAreaHeight = contentBottom - contentTop;

  let textY =
    contentTop +
    Math.max(
      0,
      (contentAreaHeight - textContentHeight) / 2
    );

  // Generate SVG text elements.
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
    "#D1D5D8",
    500
  );

  textY += gapArtistAlbum;

  const albumMarkup = albumLines.length
    ? makeText(
        albumLines,
        albumSize,
        albumLineHeight,
        "#AEB5BA",
        400
      )
    : "";

  textY += gapAlbumStatus;

  const statusY = textY + statusHeight - 2;

  // Spotify playback progress.
  let progress = 0;

  if (
    active &&
    spotify.timestamps?.start &&
    spotify.timestamps?.end
  ) {
    const duration =
      spotify.timestamps.end -
      spotify.timestamps.start;

    if (duration > 0) {
      progress = clamp(
        (Date.now() - spotify.timestamps.start) /
          duration,
        0,
        1
      );
    }
  }

  // Full-width progress bar.
  const progressX = 22;
  const progressBarWidth = 416;
  const progressY = height - 21;
  const progressWidth = progressBarWidth * progress;

  // Spotify track link.
  const spotifyUrl =
    active && spotify.track_id
      ? `https://open.spotify.com/track/${encodeURIComponent(
          spotify.track_id
        )}`
      : "https://open.spotify.com/";

  // Album artwork or fallback.
  const image = active && albumArtDataUri
    ? `
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
        rx="13"
        fill="#202326"
      />

      <g transform="translate(${artworkX + 28} ${artworkY + 30}) scale(0.055)">
        <path
          fill="#1ed760"
          d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm234.6 738.4a31.8 31.8 0 0 1-43.8 10.6c-120-73.4-271-90-449.4-49.4a31.9 31.9 0 1 1-14.2-62.2c195-44.6 362.2-25.2 496.8 57.2a31.9 31.9 0 0 1 10.6 43.8zm62.4-138.8a39.8 39.8 0 0 1-54.8 13.2c-137.4-84.4-347-108.8-509.6-59.6a39.9 39.9 0 1 1-23.2-76.4c185.8-56.4 416.8-29.2 574.4 67.6a39.9 39.9 0 0 1 13.2 55.2zm5.4-144.4c-164.8-97.8-436.8-107-594.2-59.2a47.9 47.9 0 1 1-27.8-91.6c180.8-54.8 481.4-44.2 671.4 68.6a47.9 47.9 0 0 1-49.4 82.2z"
        />
      </g>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <defs>
    <clipPath id="coverClip">
      <rect
        x="${artworkX}"
        y="${artworkY}"
        width="${artworkSize}"
        height="${artworkSize}"
        rx="13"
      />
    </clipPath>

    <linearGradient
      id="bg"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop offset="0" stop-color="#1B1E20"/>
      <stop offset="1" stop-color="#111314"/>
    </linearGradient>
  </defs>

  <a href="${esc(spotifyUrl)}">

    <rect
      x="0.5"
      y="0.5"
      width="459"
      height="${height - 1}"
      rx="17"
      fill="url(#bg)"
      stroke="#34393C"
    />

    <text
      x="22"
      y="24"
      font-family="Roboto"
      font-size="10"
      font-weight="700"
      letter-spacing="1.5"
      fill="#1ED760"
    >SPOTIFY ${active ? "NOW PLAYING" : "ACTIVITY"}</text>

    <circle
      cx="421"
      cy="20"
      r="5"
      fill="${active ? "#1ED760" : "#777777"}"
    />

    ${image}

    ${titleMarkup}
    ${artistMarkup}
    ${albumMarkup}

    <text
      x="${textX}"
      y="${statusY}"
      font-family="Roboto"
      font-size="${statusSize}"
      font-weight="700"
      letter-spacing="1"
      fill="${active ? "#1ED760" : "#AEB5BA"}"
    >${active ? "LISTENING ON SPOTIFY" : "NOT LISTENING"}</text>

    <rect
      x="${progressX}"
      y="${progressY}"
      width="${progressBarWidth}"
      height="4"
      rx="2"
      fill="#343A3C"
    />

    ${
      active
        ? `<rect
            x="${progressX}"
            y="${progressY}"
            width="${progressWidth.toFixed(2)}"
            height="4"
            rx="2"
            fill="#1ED760"
          />`
        : ""
    }

  </a>
</svg>`;
}

// Render SVG into PNG using Roboto.
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

    // Get Discord presence from Lanyard.
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

    // Generate and render card.
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
