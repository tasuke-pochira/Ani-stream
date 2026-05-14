const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get the application data directory.
 * On Windows: %APPDATA%\AniStream
 * On others: ~/.config/anistream
 */
function getDataDir() {
  const baseDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
  const dir = path.join(baseDir, 'data');
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Load a JSON file from the data directory.
 * Creates the file with defaults if it doesn't exist.
 */
function loadFile(filename, defaults = {}) {
  const fp = path.join(getDataDir(), filename);
  if (!fs.existsSync(fp)) {
    saveFile(filename, defaults);
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (err) {
    console.error(`[settings] Error reading ${filename}, using defaults`, err.message);
    return defaults;
  }
}

/**
 * Save a JSON file to the data directory using an atomic write pattern.
 */
function saveFile(filename, data) {
  const fp = path.join(getDataDir(), filename);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, fp);
}

const DEFAULTS = {
  version: 1,
  firstRun: true,
  port: 6969,
  theme: 'dark',
  defaultPlayer: 'mpv',
  defaultScraper: 'anicli',
  mpvBinPath: 'mpv',
  aniBinPath: 'ani-cli',
  defaultQuality: '1080',
  defaultAudioType: 'sub',
  downloadDir: path.join(process.pkg ? path.dirname(process.execPath) : process.cwd(), 'downloads'),
  autoMarkComplete: true,
  autoNextEpisode: true,
  autoNextDelay: 5,
  skipIntro: true,
  malOAuth: {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  },
  ui: {
    cardsPerRow: 6,
    showDubBadge: true,
    continueWatchingLimit: 10
  },
  notifications: {
    downloadComplete: true
  }
};

let _settings = null;

function get(key) {
  if (!_settings) {
    _settings = loadFile('settings.json', DEFAULTS);
  }
  return key ? _settings[key] : _settings;
}

function set(key, value) {
  if (!_settings) {
    _settings = loadFile('settings.json', DEFAULTS);
  }
  
  if (typeof key === 'object') {
    Object.assign(_settings, key);
  } else {
    _settings[key] = value;
  }
  
  saveFile('settings.json', _settings);
}

module.exports = {
  get,
  set,
  getDataDir,
  loadFile,
  saveFile
};
