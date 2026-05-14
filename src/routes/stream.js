const express = require('express');
const router = express.Router();
const streamService = require('../services/stream');
const anicli = require('../services/anicli'); // Still needed for launching

router.get('/', async (req, res) => {
  try {
    const { q, index, ep, quality, dub, malId } = req.query;
    
    if (!q || !ep) {
      return res.status(400).json({ ok: false, error: 'Query and episode are required' });
    }

    const result = await streamService.resolveStream({
      malId: parseInt(malId),
      title: q,
      episode: parseInt(ep),
      quality: quality || '1080',
      isDub: dub === 'true'
    });

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error(`[stream]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/launch', async (req, res) => {
  try {
    const { url, title, startSeconds, malId, ep, animeData, headers } = req.body;
    
    if (!url || !title) {
      return res.status(400).json({ ok: false, error: 'URL and title are required' });
    }

    const settings = require('../services/settings');
    
    // We only support MPV now.
    anicli.launchInMpv(url, title, startSeconds || 0, headers);
    
    // Auto-update history on external player launch
    if (malId && ep && animeData) {
      const history = require('../services/history');
      const isComplete = settings.get('autoMarkComplete') ? 100 : 1;
      history.updateProgress(malId, animeData, ep, isComplete, 100);
    }
    
    res.json({ ok: true });
  } catch (err) {
    console.error(`[stream:launch]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Dependency check endpoint
router.get('/check', async (req, res) => {
  try {
    const deps = await anicli.checkDependencies();
    res.json({ ok: true, data: deps });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
