const axios = require('axios');

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const cache = new Map();

/**
 * Cache wrapper with TTL.
 */
async function cached(key, fn, ttlMs = 300000) {
  if (cache.has(key)) {
    const { data, exp } = cache.get(key);
    if (Date.now() < exp) return data;
  }
  
  try {
    const data = await fn();
    cache.set(key, { data, exp: Date.now() + ttlMs });
    return data;
  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn('[jikan] Rate limit hit (429)');
      // If we have stale data, return it instead of failing
      if (cache.has(key)) return cache.get(key).data;
    }
    throw err;
  }
}

/**
 * Map Jikan anime object to internal schema.
 */
function mapAnime(a) {
  return {
    malId: a.mal_id,
    title: a.title,
    titleEn: a.title_english || a.title,
    titleJp: a.title_japanese,
    type: a.type,
    episodes: a.episodes,
    score: a.score,
    status: a.status,
    year: a.year,
    season: a.season,
    synopsis: a.synopsis,
    genres: a.genres ? a.genres.map(g => g.name) : [],
    studios: a.studios ? a.studios.map(s => s.name) : [],
    poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    trailer: a.trailer?.url || null,
    rating: a.rating,
    popularity: a.popularity,
    rank: a.rank,
    members: a.members,
    aired: a.aired?.string || null,
    duration: a.duration,
    source: a.source
  };
}

async function searchAnime(query, page = 1) {
  return cached(`search:${query}:${page}`, async () => {
    const res = await axios.get(`${JIKAN_BASE}/anime`, {
      params: { q: query, page, limit: 20, sfw: false }
    });
    return res.data.data.map(mapAnime);
  }, 300000); // 5 min
}

async function getAnimeById(malId) {
  return cached(`anime:${malId}`, async () => {
    // We use /full to get more info in one go
    const res = await axios.get(`${JIKAN_BASE}/anime/${malId}/full`);
    const main = mapAnime(res.data.data);
    
    // Get characters and relations
    try {
      const [charRes, relRes] = await Promise.all([
        axios.get(`${JIKAN_BASE}/anime/${malId}/characters`),
        axios.get(`${JIKAN_BASE}/anime/${malId}/relations`)
      ]);
      
      main.characters = charRes.data.data.slice(0, 12).map(c => ({
        name: c.character.name,
        image: c.character.images?.jpg?.image_url,
        role: c.role,
        voiceActor: c.voice_actors?.[0]?.person?.name || null
      }));

      main.relations = relRes.data.data.map(r => ({
        relation: r.relation,
        entry: r.entry.map(e => ({
          malId: e.mal_id,
          type: e.type,
          name: e.name
        }))
      }));
    } catch (e) {
      main.characters = main.characters || [];
      main.relations = main.relations || [];
    }
    
    return main;
  }, 1800000); // 30 min
}

async function getSeasonalAnime() {
  return cached('seasonal', async () => {
    const res = await axios.get(`${JIKAN_BASE}/seasons/now`, { params: { limit: 24 } });
    return res.data.data.map(mapAnime);
  }, 3600000); // 1 hour
}

async function getTopAnime() {
  return cached('top', async () => {
    const res = await axios.get(`${JIKAN_BASE}/top/anime`, { params: { limit: 24, type: 'tv' } });
    return res.data.data.map(mapAnime);
  }, 3600000); // 1 hour
}

async function getAnimeEpisodes(malId, page = 1) {
  return cached(`anime:${malId}:episodes:${page}`, async () => {
    const res = await axios.get(`${JIKAN_BASE}/anime/${malId}/episodes?page=${page}`);
    return {
      episodes: res.data.data.map(ep => ({
        malId: ep.mal_id,
        title: ep.title,
        aired: ep.aired
      })),
      pagination: res.data.pagination
    };
  }, 1800000); // 30 min
}

module.exports = {
  searchAnime,
  getAnimeById,
  getSeasonalAnime,
  getTopAnime,
  getAnimeEpisodes,
  clearCache: (pattern) => {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) cache.delete(key);
    }
  }
};
