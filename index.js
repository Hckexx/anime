
const express = require("express");
const cors = require("cors");
const consumet = require("@consumet/extensions");

const app = express();
app.use(cors());
app.use(express.json());

const ANIME = consumet.ANIME || consumet.default?.ANIME;

if (!ANIME) {
  throw new Error("Consumet did not expose its ANIME providers.");
}

console.log("Available anime providers:", Object.keys(ANIME));

const providerName = process.env.ANIME_PROVIDER || "AnimePahe";
const ProviderClass =
  ANIME[providerName] ||
  ANIME.AnimePahe ||
  ANIME.Gogoanime ||
  Object.values(ANIME).find((provider) => typeof provider === "function");

if (!ProviderClass) {
  throw new Error("No usable anime provider was found.");
}

const animeProvider = new ProviderClass();

console.log("Selected anime provider:", providerName);
console.log("Initialized provider:", animeProvider.name);

async function runWithTimeout(promise, label, ms = 25000) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Anime Scraper Backend is running!",
    provider: animeProvider.name,
  });
});

app.get("/anime/search/:query", async (req, res) => {
  const query = req.params.query;
  console.log(`[SEARCH] Started: ${query}`);

  try {
    const results = await runWithTimeout(
      animeProvider.search(query),
      `Search "${query}"`
    );

    console.log(
      `[SEARCH] Success: ${query}; result count: ${
        Array.isArray(results?.results)
          ? results.results.length
          : Array.isArray(results)
            ? results.length
            : "unknown"
      }`
    );

    res.json(results);
  } catch (error) {
    console.error("[SEARCH] Provider failed:", error?.stack || error);

    res.status(502).json({
      error: "Anime search provider failed.",
      details: error?.message || "Unknown provider error",
      provider: animeProvider.name || providerName,
    });
  }
});

app.get("/anime/info/:id", async (req, res) => {
  try {
    const info = await runWithTimeout(
      animeProvider.fetchAnimeInfo(req.params.id),
      "Fetch anime info"
    );

    res.json(info);
  } catch (error) {
    console.error("[INFO] Provider failed:", error?.stack || error);

    res.status(502).json({
      error: "Failed to fetch anime info.",
      details: error?.message || "Unknown provider error",
    });
  }
});

app.get("/anime/watch/:episodeId", async (req, res) => {
  try {
    const streamInfo = await runWithTimeout(
      animeProvider.fetchEpisodeSources(req.params.episodeId),
      "Fetch episode sources"
    );

    console.log("[WATCH] Stream sources fetched.");
    res.json(streamInfo);
  } catch (error) {
    console.error("[WATCH] Provider failed:", error?.stack || error);

    res.status(502).json({
      error: "Failed to extract video stream.",
      details: error?.message || "Unknown provider error",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
