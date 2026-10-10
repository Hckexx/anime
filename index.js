
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const ANILIST_URL = "https://graphql.anilist.co";
const REQUEST_TIMEOUT_MS = 20000;

async function anilistRequest(query, variables) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok || data.errors) {
      const message =
        data.errors?.map((error) => error.message).join("; ") ||
        "AniList request failed with status " + response.status;

      throw new Error(message);
    }

    return data.data;
  } finally {
    clearTimeout(timer);
  }
}

function cleanDescription(description) {
  return (description || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function mapAnime(media) {
  return {
    id: String(media.id),
    title:
      media.title?.english ||
      media.title?.romaji ||
      media.title?.native ||
      "Unknown anime",
    image:
      media.coverImage?.extraLarge ||
      media.coverImage?.large ||
      "",
    releaseDate: media.startDate?.year
      ? String(media.startDate.year)
      : undefined,
    type: media.format || "UNKNOWN",
  };
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Anime metadata backend is running!",
    provider: "AniList",
    playbackAvailable: false,
  });
});

app.get("/anime/search/:query", async (req, res) => {
  const search = String(req.params.query || "").trim();

  if (!search) {
    return res.status(400).json({
      error: "Search query cannot be empty.",
    });
  }

  const requestedFormat = String(
    req.query.format || ""
  ).toUpperCase();

  const allowedFormats = [
    "TV",
    "TV_SHORT",
    "MOVIE",
    "SPECIAL",
    "OVA",
    "ONA",
    "MUSIC",
  ];

  if (
    requestedFormat &&
    !allowedFormats.includes(requestedFormat)
  ) {
    return res.status(400).json({
      error: "Invalid anime format.",
      allowedFormats,
    });
  }

  const query = `
    query (
      $search: String!
      $page: Int!
      $perPage: Int!
      $format: [MediaFormat]
    ) {
      Page(page: $page, perPage: $perPage) {
        media(
          search: $search
          type: ANIME
          format: $format
          sort: SEARCH_MATCH
        ) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
            large
          }
          startDate {
            year
          }
          format
        }
      }
    }
  `;

  try {
    const data = await anilistRequest(query, {
      search,
      page: 1,
      perPage: 20,
      format: requestedFormat ? [requestedFormat] : null,
    });

    return res.json({
      results: (data.Page.media || []).map(mapAnime),
    });
  } catch (error) {
    console.error("[SEARCH] AniList error:", error.message);

    return res.status(502).json({
      error: "Anime search failed.",
      details: error.message,
    });
  }
});

app.get("/anime/info/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "Anime ID must be a positive integer.",
    });
  }

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        description(asHtml: false)
        coverImage {
          extraLarge
          large
        }
        startDate {
          year
        }
        format
        episodes
      }
    }
  `;

  try {
    const data = await anilistRequest(query, { id });
    const media = data.Media;

    if (!media) {
      return res.status(404).json({
        error: "Anime not found.",
      });
    }

    return res.json({
      ...mapAnime(media),
      description: cleanDescription(media.description),
      totalEpisodes: media.episodes ?? undefined,

      // AniList provides metadata, not episode playback links.
      episodes: [],
    });
  } catch (error) {
    console.error("[INFO] AniList error:", error.message);

    return res.status(502).json({
      error: "Failed to fetch anime details.",
      details: error.message,
    });
  }
});

app.get("/anime/watch/:episodeId", (req, res) => {
  return res.status(501).json({
    error: "Episode playback is not configured yet.",
    message:
      "Anime metadata is available, but a legitimate video source must be connected for playback.",
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Anime metadata backend listening on port " + PORT);
});
