const express = require('express');
const cors = require('cors');
const { ANIME } = require('@consumet/extensions');

const app = express();

// Allow your React Native app to make requests to this server
app.use(cors());

// Initialize the Gogoanime scraper
// (Note: If Gogoanime ever acts up in the future, you can simply change this to "new ANIME.Zoro()")
const animeProvider = new ANIME.Gogoanime();

// 1. Search Route (e.g., /anime/search/one%20piece)
app.get('/anime/search/:query', async (req, res) => {
    try {
        const results = await animeProvider.search(req.params.query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search anime.' });
    }
});

// 2. Info & Episodes Route (Gets all episodes for a specific anime ID)
app.get('/anime/info/:id', async (req, res) => {
    try {
        const info = await animeProvider.fetchAnimeInfo(req.params.id);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch anime info.' });
    }
});

// 3. Watch Route (Extracts the direct .m3u8 stream link by episode ID)
app.get('/anime/watch/:episodeId', async (req, res) => {
    try {
        const streamInfo = await animeProvider.fetchEpisodeSources(req.params.episodeId);
        res.json(streamInfo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to extract video stream.' });
    }
});

// Health check to ensure the server is awake
app.get('/', (req, res) => {
    res.send('Anime Scraper Backend is running and ready!');
});

// Render dynamically assigns a port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
