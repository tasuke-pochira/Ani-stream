const settings = require('./settings');

const HISTORY_FILE = 'history.json';
const DEFAULT_HISTORY = { version: 1, entries: {} };

/**
 * Get all history entries sorted by lastWatched descending.
 */
function getHistory() {
  const db = settings.loadFile(HISTORY_FILE, DEFAULT_HISTORY);
  return Object.values(db.entries).sort((a, b) => 
    new Date(b.lastWatched) - new Date(a.lastWatched)
  );
}

/**
 * Get entries for the "Continue Watching" section.
 * Returns incomplete anime or those with a next episode.
 */
function getContinueWatching(limit = 10) {
  const history = getHistory();
  return history
    .filter(entry => {
      // Find if there's any episode not completed
      const eps = Object.values(entry.episodes);
      const hasIncomplete = eps.some(e => !e.completed);
      const hasNext = entry.nextEpisode !== null && entry.totalEpisodes && entry.nextEpisode <= entry.totalEpisodes;
      return hasIncomplete || hasNext;
    })
    .slice(0, limit);
}

function getAnimeHistory(malId) {
  const db = settings.loadFile(HISTORY_FILE, DEFAULT_HISTORY);
  return db.entries[`mal_${malId}`] || null;
}

/**
 * Update playback progress for an episode.
 */
function updateProgress(malId, animeData, episode, seconds, duration) {
  const db = settings.loadFile(HISTORY_FILE, DEFAULT_HISTORY);
  const key = `mal_${malId}`;
  
  if (!db.entries[key]) {
    db.entries[key] = {
      malId,
      title: animeData.title,
      titleEn: animeData.titleEn,
      posterUrl: animeData.posterUrl,
      totalEpisodes: animeData.totalEpisodes,
      lastWatched: new Date().toISOString(),
      isDub: animeData.isDub || false,
      quality: animeData.quality || '1080',
      source: 'anicli',
      episodes: {},
      nextEpisode: 1,
      progressPercent: 0
    };
  }
  
  const entry = db.entries[key];
  entry.lastWatched = new Date().toISOString();
  
  const epKey = String(episode);
  const completed = seconds / duration > 0.9;
  
  entry.episodes[epKey] = {
    watchedAt: new Date().toISOString(),
    progressSeconds: seconds,
    durationSeconds: duration,
    completed: entry.episodes[epKey]?.completed || completed
  };
  
  // Update next episode if this one was completed
  if (completed && parseInt(epKey) === entry.nextEpisode) {
    entry.nextEpisode = parseInt(epKey) + 1;
  }
  
  // Calculate total progress
  if (entry.totalEpisodes) {
    const completedCount = Object.values(entry.episodes).filter(e => e.completed).length;
    entry.progressPercent = Math.round((completedCount / entry.totalEpisodes) * 100);
  }
  
  settings.saveFile(HISTORY_FILE, db);
  
  // Auto-sync with local MAL list
  try {
    const mal = require('./mal');
    const malList = mal.getMalList();
    const existingEntry = malList.anime[String(malId)];
    
    let newStatus = existingEntry ? existingEntry.myStatus : 'watching';
    let newWatched = existingEntry ? existingEntry.myWatchedEpisodes : 0;
    
    if (completed) {
      newWatched = Math.max(newWatched, episode);
      if (entry.totalEpisodes && newWatched >= entry.totalEpisodes) {
        newStatus = 'completed';
      } else if (!existingEntry) {
        newStatus = 'watching';
      }
    } else if (!existingEntry) {
      newStatus = 'watching';
    }

    mal.updateMalEntry(malId, {
      title: animeData.title,
      posterUrl: animeData.posterUrl,
      episodes: animeData.totalEpisodes,
      myStatus: newStatus,
      myWatchedEpisodes: newWatched
    });
  } catch (err) {
    console.error('[history] Failed to sync to MAL list:', err);
  }

  return entry;
}

function removeHistory(malId) {
  const db = settings.loadFile(HISTORY_FILE, DEFAULT_HISTORY);
  delete db.entries[`mal_${malId}`];
  settings.saveFile(HISTORY_FILE, db);
}

module.exports = {
  getHistory,
  getContinueWatching,
  getAnimeHistory,
  updateProgress,
  removeHistory
};
