const express = require('express');
const router = express.Router();
const history = require('../services/history');

router.get('/', async (req, res) => {
  try {
    const data = history.getHistory();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[history:list]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/continue', async (req, res) => {
  try {
    const data = history.getContinueWatching();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[history:continue]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/:malId', async (req, res) => {
  try {
    const malId = parseInt(req.params.malId);
    if (isNaN(malId)) return res.status(400).json({ ok: false, error: 'Invalid ID' });
    
    const data = history.getAnimeHistory(malId);
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[history:detail]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/:malId/progress', async (req, res) => {
  try {
    const malId = parseInt(req.params.malId);
    const { animeData, episode, seconds, duration } = req.body;
    
    if (isNaN(malId) || !episode || seconds === undefined || !duration) {
      return res.status(400).json({ ok: false, error: 'Missing required progress data' });
    }

    const data = history.updateProgress(malId, animeData, episode, seconds, duration);
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[history:progress]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/:malId', async (req, res) => {
  try {
    const malId = parseInt(req.params.malId);
    if (isNaN(malId)) return res.status(400).json({ ok: false, error: 'Invalid ID' });
    
    history.removeHistory(malId);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[history:delete]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
