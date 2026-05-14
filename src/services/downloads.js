const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const settings = require('./settings');
const anicli = require('./anicli');

const DOWNLOADS_FILE = 'downloads.json';
const DEFAULT_DOWNLOADS = { version: 1, active: null, queue: [], completed: [] };

let broadcastFn = null;

/**
 * Initialize the download manager.
 * Resets any stuck 'active' download on boot.
 */
function init(wsBroadcast) {
  broadcastFn = wsBroadcast;
  const db = settings.loadFile(DOWNLOADS_FILE, DEFAULT_DOWNLOADS);
  
  if (db.active) {
    // Move stuck active download back to front of queue
    const item = { ...db.active, status: 'queued' };
    db.queue.unshift(item);
    db.active = null;
    settings.saveFile(DOWNLOADS_FILE, db);
  }
  
  processQueue();
}

function getDownloads() {
  return settings.loadFile(DOWNLOADS_FILE, DEFAULT_DOWNLOADS);
}

function queueDownload(data) {
  const db = getDownloads();
  const item = {
    id: uuidv4(),
    malId: data.malId,
    title: data.title,
    animeQuery: data.animeQuery,
    animeIndex: data.animeIndex,
    episode: data.episode,
    quality: data.quality || '1080',
    isDub: data.isDub || false,
    outputDir: settings.get('downloadDir'),
    status: 'queued',
    addedAt: new Date().toISOString(),
    error: null
  };
  
  db.queue.push(item);
  settings.saveFile(DOWNLOADS_FILE, db);
  
  processQueue();
  return item;
}

async function processQueue() {
  const db = getDownloads();
  if (db.active || db.queue.length === 0) return;
  
  const item = db.queue.shift();
  item.status = 'active';
  db.active = item;
  settings.saveFile(DOWNLOADS_FILE, db);
  
  console.log(`[downloads] Starting: ${item.title} E${item.episode}`);
  
  try {
    const proc = anicli.downloadEpisode(
      item.animeQuery,
      item.animeIndex,
      item.episode,
      item.outputDir,
      item.quality,
      item.isDub
    );
    
    proc.stdout.on('data', d => {
      const line = d.toString();
      // Simple progress parsing (varies by ani-cli version/backend)
      // Usually looks like: [download] 45.2% of ...
      const match = line.match(/(\d+\.?\d*)%/);
      if (match && broadcastFn) {
        broadcastFn({
          type: 'download:progress',
          id: item.id,
          percent: parseFloat(match[1])
        });
      }
    });
    
    proc.stderr.on('data', d => {
      // ffmpeg/aria2 progress often on stderr
      const line = d.toString();
      const match = line.match(/(\d+\.?\d*)%/);
      if (match && broadcastFn) {
        broadcastFn({
          type: 'download:progress',
          id: item.id,
          percent: parseFloat(match[1])
        });
      }
    });
    
    proc.on('close', (code) => {
      handleComplete(item.id, code === 0 ? null : `Exit code ${code}`);
    });
    
  } catch (err) {
    handleComplete(item.id, err.message);
  }
}

function handleComplete(id, error = null) {
  const db = getDownloads();
  if (!db.active || db.active.id !== id) return;
  
  const item = db.active;
  item.status = error ? 'failed' : 'completed';
  item.error = error;
  item.downloadedAt = new Date().toISOString();
  
  db.completed.unshift(item);
  db.active = null;
  settings.saveFile(DOWNLOADS_FILE, db);
  
  if (broadcastFn) {
    broadcastFn({
      type: error ? 'download:error' : 'download:complete',
      id: item.id,
      message: error
    });
  }
  
  processQueue();
}

function cancelDownload(id) {
  const db = getDownloads();
  
  // If active, we might need to kill the process (not implemented here for simplicity)
  // but we can at least remove it from the state.
  if (db.active && db.active.id === id) {
    db.active.status = 'cancelled';
    db.completed.unshift(db.active);
    db.active = null;
  } else {
    db.queue = db.queue.filter(q => q.id !== id);
  }
  
  settings.saveFile(DOWNLOADS_FILE, db);
  processQueue();
}

module.exports = {
  init,
  getDownloads,
  queueDownload,
  cancelDownload
};
