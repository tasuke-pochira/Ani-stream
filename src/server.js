const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('ws');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

// Services that need WebSocket
const downloads = require('./services/downloads');
const history = require('./services/history');

// Middlewares
app.use(cors({ origin: '*' })); // Local only anyway
app.use(express.json());
// Resolve the base directory for assets
// When bundled, __dirname is in dist-bundle/, so assets are in ../src/frontend
const assetDir = process.pkg 
  ? path.join(__dirname, '..', 'src', 'frontend') 
  : path.join(__dirname, 'frontend');

app.use(express.static(assetDir));

// Handle favicon.ico
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Rate limiting for sensitive endpoints
const streamLimiter = rateLimit({ windowMs: 1000, max: 10 });
app.use('/api/stream', streamLimiter);

// Register routes
app.use('/api/search',    require('./routes/search'));
app.use('/api/anime',     require('./routes/anime'));
app.use('/api/stream',    require('./routes/stream'));
app.use('/api/history',   require('./routes/history'));
app.use('/api/mal',       require('./routes/mallist'));
app.use('/api/downloads', require('./routes/downloads'));
app.use('/api/settings',  require('./routes/settings'));

// WebSocket broadcast helper
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Initialize download manager with broadcast capability
downloads.init(broadcast);

// WebSocket message handling
wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'player:progress') {
        const { malId, animeData, episode, seconds, duration } = data;
        history.updateProgress(malId, animeData, episode, seconds, duration);
      }
      
      if (data.type === 'player:complete') {
        const { malId, animeData, episode } = data;
        // In this implementation, updateProgress handles completion if seconds/duration > 0.9
        // but we can explicitly call it here if needed.
        history.updateProgress(malId, animeData, episode, 100, 100);
      }
    } catch (err) {
      console.error('[ws] Error handling message:', err.message);
    }
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(assetDir, 'index.html'));
  } else {
    res.status(404).json({ ok: false, error: 'API endpoint not found' });
  }
});

module.exports = { app, server, broadcast };
