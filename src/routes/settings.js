const express = require('express');
const router = express.Router();
const settings = require('../services/settings');

router.get('/', async (req, res) => {
  try {
    const data = settings.get();
    res.json({ ok: true, data });
  } catch (err) {
    console.error(`[settings:get]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/diagnostics', async (req, res) => {
  try {
    const anicli = require('../services/anicli');
    const stream = require('../services/stream');
    const pkg = require('../../package.json');
    
    const deps = await anicli.checkDependencies();
    const browser = stream.checkBrowserStatus();
    
    res.json({
      ok: true,
      version: pkg.version || '1.0.0',
      dependencies: deps,
      browser: browser
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    // Basic validation of types could be added here
    settings.set(req.body);
    res.json({ ok: true, data: settings.get() });
  } catch (err) {
    console.error(`[settings:update]`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
