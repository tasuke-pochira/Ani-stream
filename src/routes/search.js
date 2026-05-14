const express = require('express');
const router = express.Router();
const jikan = require('../services/jikan');

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = parseInt(req.query.page) || 1;

    if (!q) {
      return res.status(400).json({ ok: false, error: 'Search query is required' });
    }
    if (q.length > 100) {
      return res.status(400).json({ ok: false, error: 'Search query too long' });
    }
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ ok: false, error: 'Invalid page number' });
    }

    const data = await jikan.searchAnime(q, page);
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[search]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
