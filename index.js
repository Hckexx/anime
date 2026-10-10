```javascript
const express = require("express");
const cors = require("cors");
const consumet = require("@consumet/extensions");

const app = express();

app.use(cors());
app.use(express.json());

const ANIME = consumet.ANIME || consumet.default?.ANIME;

if (!ANIME) {
  throw new Error(
    "Consumet ANIME providers were not found. Check @consumet/extensions."
  );
}

console.log("Available anime providers:", Object.keys(ANIME));

const providerName = process.env.ANIME_PROVIDER || "AnimeKai";
const ProviderClass = ANIME[providerName];

if (typeof ProviderClass !== "function") {
  throw new Error(
    `Provider "${providerName}" is unavailable. Available providers: ${Object.keys(
      ANIME
    ).join(", ")}`
  );
}

const animeProvider = new ProviderClass();

console.log("Selected provider:", providerName);
console.log("Initialized provider:", animeProvider.name);

const REQUEST_TIMEOUT_MS = 25000;

async function runWithTimeout(operation, label) {
  let timer;

  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} timed out after ${REQUEST_TIMEOUT_MS}ms`
            )
          );
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sendProviderError(res, label, error) {
  console.error(
    `[${label}] Provider failed:`,
    error?.stack || error
  );

  return res.status(502).json({
    error: `${label} provider request failed.`,
    details: error?.message || "Unknown provider error",
    provider: animeProvider.name || providerName,
  });
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Anime Scraper Backend is running!",
    provider: animeProvider.name || providerName,
    availableProviders: Object.keys(ANIME),
  });
});

// Search anime
app.get("/anime/search/:query", async (req, res) => {
  const query = req.params.query?.trim();

  if (!query) {
    return res.status(400).json({
      error: "Search query cannot be empty.",
    });
  }

  console.log(`[SEARCH] Started: ${query}`);

  try {
    const results = await runWithTimeout(
      () => animeProvider.search(query),
      `Search "${query}"`
    );

    console.log(`[SEARCH] Successful: ${query}`);

    return res.json(results);
  } catch (error) {
    return sendProviderError(res, "SEARCH", error);
  }
});

// Fetch anime details and episodes
app.get("/anime/info/:id", async (req, res) => {
  const id = req.params.id;

  console.log(`[INFO] Started: ${id}`);

  try {
    const info = await runWithTimeout(
      () => animeProvider.fetchAnimeInfo(id),
      `Fetch anime info "${id}"`
    );

    console.log(`[INFO] Successful: ${id}`);

    return res.json(info);
  } catch (error) {
    return sendProviderError(res, "INFO", error);
  }
});

// Fetch episode stream sources
app.get("/anime/watch/:episodeId", async (req, res) => {
  const episodeId = req.params.episodeId;

  console.log(`[WATCH] Started: ${episodeId}`);

  try {
    const streamInfo = await runWithTimeout(
      () => animeProvider.fetchEpisodeSources(episodeId),
      `Fetch episode sources "${episodeId}"`
    );

    console.log(`[WATCH] Successful: ${episodeId}`);

    return res.json(streamInfo);
  } catch (error) {
    return sendProviderError(res, "WATCH", error);
  }
});

// Unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
    path: req.originalUrl,
  });
});

// General error handler
app.use((error, req, res, next) => {
  console.error("[SERVER] Unexpected error:", error?.stack || error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    error: "Internal server error.",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
```
