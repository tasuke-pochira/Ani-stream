const express = require('express');
const router = express.Router();
const jikan = require('../services/jikan');

router.get('/seasonal', async (req, res) => {
  try {
    const data = await jikan.getSeasonalAnime();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[anime:seasonal]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/top', async (req, res) => {
  try {
    const data = await jikan.getTopAnime();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[anime:top]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/:malId', async (req, res) => {
  try {
    const malId = parseInt(req.params.malId);
    if (isNaN(malId) || malId <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid MAL ID' });
    }

    const data = await jikan.getAnimeById(malId);
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[anime:detail]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/:malId/episodes', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const data = await jikan.getAnimeEpisodes(req.params.malId, page);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:malId/refresh', async (req, res) => {
  try {
    const malId = req.params.malId;
    jikan.clearCache(`anime:${malId}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
