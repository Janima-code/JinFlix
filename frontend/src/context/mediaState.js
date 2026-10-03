import { createContext, useContext } from 'react';

/**
 * Context object and key helpers live apart from the provider component so the
 * provider file exports only components, which keeps Vite fast refresh working.
 */
export const MediaStateContext = createContext(null);

/**
 * TMDb ids are only unique per media type, so movie 550 and TV series 550 are
 * different titles. Bookmarks are keyed on both to keep them apart.
 */
export function getBookmarkKey(item) {
  if (!item) return null;
  const type = item.type === 'tv' || item.type === 'series' ? 'tv' : 'movie';
  return `${type}:${item.id}`;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Legacy bookmarks stored a bare TMDb path under `poster_path` (sometimes a
 * full URL, because some call sites had already expanded it) and used
 * capitalised `Title`/`Poster` keys. Only the legacy path needs expanding;
 * anything already absolute is passed through untouched.
 */
function resolvePoster(item) {
  if (item.poster) return item.poster;
  const raw = item.poster_path || item.Poster || item.posterPath;
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${TMDB_IMAGE_BASE}/w500${raw.startsWith('/') ? raw : `/${raw}`}`;
}

/**
 * Folds every historical bookmark shape onto the current card-like shape:
 * `{ id, type, title, poster, year, rating }`. Applied on read so saved My
 * Lists keep rendering after the data-layer change, and again on write so
 * newly added entries are stored canonically.
 */
export function normalizeBookmark(item) {
  if (!item || item.id === undefined || item.id === null) return null;

  const id = Number(item.id);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    type: item.type === 'tv' || item.type === 'series' ? 'tv' : 'movie',
    title: item.title || item.Title || item.name || 'Untitled',
    poster: resolvePoster(item),
    year: item.year || item.Year || item.releaseYear || undefined,
    rating: Number(item.rating) || undefined,
  };
}

/**
 * Normalizes a stored list and drops duplicates that the old id-only keying
 * could produce.
 */
export function normalizeBookmarks(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const bookmark = normalizeBookmark(item);
    if (!bookmark) continue;
    const key = getBookmarkKey(bookmark);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(bookmark);
  }
  return result;
}

export function getEpisodeProgressId(seriesId, seasonNumber, episodeNumber) {
  return `${seriesId}_s${seasonNumber}_e${episodeNumber}`;
}

export function useMediaState() {
  const context = useContext(MediaStateContext);
  if (!context) {
    throw new Error('useMediaState must be used within a MediaStateProvider');
  }
  return context;
}