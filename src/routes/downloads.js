const express = require('express');
const router = express.Router();
const downloads = require('../services/downloads');

router.get('/', async (req, res) => {
  try {
    const data = downloads.getDownloads();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[downloads:list]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { malId, title, animeQuery, animeIndex, episode, quality, isDub } = req.body;
    
    if (!malId || !title || !animeQuery || !animeIndex || !episode) {
      return res.status(400).json({ ok: false, error: 'Missing required download data' });
    }

    const item = downloads.queueDownload({
      malId, title, animeQuery, animeIndex, episode, quality, isDub
    });
    res.json({ ok: true, data: item });
  } catch (err) {
    console.error(`[downloads:queue]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    downloads.cancelDownload(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[downloads:cancel]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
