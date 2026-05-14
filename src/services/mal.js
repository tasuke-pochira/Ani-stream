const settings = require('./settings');

const MALLIST_FILE = 'mallist.json';
const DEFAULT_MALLIST = { version: 1, lastSync: null, malUserId: null, malUsername: null, anime: {} };

const STATUS_MAP = {
  watching: 'Watching',
  completed: 'Completed',
  on_hold: 'On-Hold',
  dropped: 'Dropped',
  plan_to_watch: 'Plan to Watch'
};

const STATUS_MAP_REV = {
  'Watching': 'watching',
  'Completed': 'completed',
  'On-Hold': 'on_hold',
  'Dropped': 'dropped',
  'Plan to Watch': 'plan_to_watch'
};

function getMalList() {
  return settings.loadFile(MALLIST_FILE, DEFAULT_MALLIST);
}

function updateMalEntry(malId, data) {
  const db = getMalList();
  const idStr = String(malId);
  const now = new Date().toISOString();
  
  if (!db.anime[idStr]) {
    db.anime[idStr] = {
      malId: parseInt(malId),
      addedAt: now,
      myWatchedEpisodes: 0,
      myScore: 0,
      myStatus: 'plan_to_watch',
      myRewatching: false,
      myRewatchCount: 0,
      myNotes: ''
    };
  }
  
  Object.assign(db.anime[idStr], data);
  db.anime[idStr].updatedAt = now;
  
  settings.saveFile(MALLIST_FILE, db);

  // Sync with official MAL API if authenticated
  syncToMalApi(malId, db.anime[idStr]);

  return db.anime[idStr];
}

async function syncToMalApi(malId, entryData) {
  let oauth = settings.get('malOAuth');
  if (!oauth || !oauth.accessToken) return;

  const axios = require('axios');
  
  // Check if token is expired (or expires in the next 5 minutes)
  if (oauth.expiresAt && Date.now() > oauth.expiresAt - 300000) {
    try {
      console.log('[mal:api] Refreshing MAL access token...');
      const clientId = settings.get('malClientId');
      const resp = await axios.post('https://myanimelist.net/v1/oauth2/token', new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: oauth.refreshToken
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      oauth = {
        accessToken: resp.data.access_token,
        refreshToken: resp.data.refresh_token,
        expiresAt: Date.now() + (resp.data.expires_in * 1000)
      };
      settings.set('malOAuth', oauth);
    } catch (err) {
      console.error('[mal:api] Failed to refresh token. User must log in again.', err.response?.data || err.message);
      return;
    }
  }

  const statusMap = {
    watching: 'watching',
    completed: 'completed',
    on_hold: 'on_hold',
    dropped: 'dropped',
    plan_to_watch: 'plan_to_watch'
  };

  try {
    await axios.patch(
      `https://api.myanimelist.net/v2/anime/${malId}/my_list_status`,
      new URLSearchParams({
        status: statusMap[entryData.myStatus] || 'watching',
        num_watched_episodes: entryData.myWatchedEpisodes || 0,
        score: entryData.myScore || 0
      }).toString(),
      {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
  } catch (err) {
    console.error('[mal:api] Failed to sync with official MAL list:', err.response?.data || err.message);
  }
}

function removeMalEntry(malId) {
  const db = getMalList();
  delete db.anime[String(malId)];
  settings.saveFile(MALLIST_FILE, db);
}

/**
 * Export to MAL-compatible XML.
 */
function exportToMalXml() {
  const db = getMalList();
  const entries = Object.values(db.anime);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<myanimelist>
  <myinfo>
    <user_export_type>1</user_export_type>
  </myinfo>`;

  entries.forEach(e => {
    xml += `
  <anime>
    <series_animedb_id>${e.malId}</series_animedb_id>
    <series_title><![CDATA[${e.title || ''}]]></series_title>
    <series_type>${e.type || 'TV'}</series_type>
    <series_episodes>${e.episodes || 0}</series_episodes>
    <my_id>0</my_id>
    <my_watched_episodes>${e.myWatchedEpisodes || 0}</my_watched_episodes>
    <my_start_date>${e.myStartDate || '0000-00-00'}</my_start_date>
    <my_finish_date>${e.myFinishDate || '0000-00-00'}</my_finish_date>
    <my_score>${e.myScore || 0}</my_score>
    <my_status>${STATUS_MAP[e.myStatus] || 'Plan to Watch'}</my_status>
    <my_rewatching>${e.myRewatching ? 1 : 0}</my_rewatching>
    <my_rewatching_ep>${e.myRewatchCount || 0}</my_rewatching_ep>
    <my_comments><![CDATA[${e.myNotes || ''}]]></my_comments>
    <update_on_import>1</update_on_import>
  </anime>`;
  });

  xml += '\n</myanimelist>';
  return xml;
}

/**
 * Import from MAL XML using regex.
 */
function importFromMalXml(xml) {
  const db = getMalList();
  let imported = 0;
  let skipped = 0;
  
  const animeBlocks = xml.match(/<anime>([\s\S]*?)<\/anime>/g);
  if (!animeBlocks) return { imported, skipped };
  
  animeBlocks.forEach(block => {
    const getField = (tag) => {
      const match = block.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`)) ||
                    block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return match ? match[1].trim() : null;
    };
    
    const malId = parseInt(getField('series_animedb_id'));
    if (!malId) { skipped++; return; }
    
    const entry = {
      malId,
      title: getField('series_title'),
      type: getField('series_type'),
      episodes: parseInt(getField('series_episodes')) || 0,
      myWatchedEpisodes: parseInt(getField('my_watched_episodes')) || 0,
      myStartDate: getField('my_start_date') === '0000-00-00' ? null : getField('my_start_date'),
      myFinishDate: getField('my_finish_date') === '0000-00-00' ? null : getField('my_finish_date'),
      myScore: parseInt(getField('my_score')) || 0,
      myStatus: STATUS_MAP_REV[getField('my_status')] || 'plan_to_watch',
      myRewatching: getField('my_rewatching') === '1',
      myRewatchCount: parseInt(getField('my_rewatching_ep')) || 0,
      myNotes: getField('my_comments') || '',
      updatedAt: new Date().toISOString()
    };
    
    if (!db.anime[malId]) {
      entry.addedAt = new Date().toISOString();
      db.anime[malId] = entry;
      imported++;
    } else {
      // Merge: only update if newer or keep local if needed? 
      // Simple merge: overwrite existing with XML data
      Object.assign(db.anime[malId], entry);
      imported++;
    }
  });
  
  settings.saveFile(MALLIST_FILE, db);
  return { imported, skipped };
}

async function syncAllToMalApi() {
  const db = getMalList();
  const entries = Object.values(db.anime);
  let synced = 0;
  
  for (const entry of entries) {
    // Only sync if there's something to sync (not just plan_to_watch with 0 episodes)
    if (entry.myWatchedEpisodes > 0 || entry.myStatus !== 'plan_to_watch' || entry.myScore > 0) {
      await syncToMalApi(entry.malId, entry);
      synced++;
      // Wait 500ms to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return { synced, total: entries.length };
}

module.exports = {
  getMalList,
  updateMalEntry,
  removeMalEntry,
  exportToMalXml,
  importFromMalXml,
  syncAllToMalApi
};
