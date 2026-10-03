/**
 * Typed wrappers around the JinFlix backend routes.
 *
 * Every card returned by these helpers has the same shape:
 *   { id, tmdb_id, media_type, title, year, release_date, poster, backdrop,
 *     rating, vote_average, vote_count, overview, genres, original_language }
 *
 * Consumers read those fields directly; there is no per-page normalization.
 */

import { getJson } from './client';

export const CATALOG_ROWS = [
  'trending_movies',
  'trending_series',
  'popular_movies',
  'popular_series',
  'upcoming_movies',
  'upcoming_series',
  'top_rated_movies',
  'top_rated_series',
  'airing_today_series',
  'cutie_movies',
  'anime_movies',
];

/** TMDb ids are unique per media type, so route paths must be unambiguous. */
export function toApiMediaType(mediaType) {
  return mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
}

/** Route segment for a card: TV detail pages live under /series/:id. */
export function toRouteSegment(mediaType) {
  return toApiMediaType(mediaType) === 'tv' ? 'series' : 'movie';
}

export function getProviders(options) {
  return getJson('/api/providers', undefined, options);
}

export function getStreamUrl({ tmdbId, providerId, mediaType, season, episode }, options) {
  return getJson(
    '/api/stream-url',
    {
      tmdb_id: tmdbId,
      provider_id: providerId,
      media_type: toApiMediaType(mediaType),
      season,
      episode,
    },
    options,
  );
}

/**
 * Several catalog rows in one request. Resolves to
 * `{ trending_movies: [...], popular_series: [...], ... }` — every requested
 * key is always present, empty if that row failed upstream.
 */
export function getCatalogRows(rows = CATALOG_ROWS, options) {
  return getJson('/api/catalog', { rows: rows.join(',') }, options);
}

export function getGenres(mediaType = 'movie', options) {
  return getJson(`/api/genres/${toApiMediaType(mediaType)}`, undefined, options);
}

export function discoverSeries({ genreId, year, sortBy, page = 1 } = {}, options) {
  return getJson(
    '/api/discover/tv',
    { genre_id: genreId, year, sort_by: sortBy, page },
    options,
  );
}

export function searchMedia(query, { mediaType = 'all', page = 1 } = {}, options) {
  return getJson('/api/search', { query, media_type: mediaType, page }, options);
}

export function getMediaDetails(mediaType, tmdbId, options) {
  return getJson(`/api/media/${toApiMediaType(mediaType)}/${tmdbId}`, undefined, options);
}

export function getRecommendations(mediaType, tmdbId, options) {
  return getJson(
    `/api/media/${toApiMediaType(mediaType)}/${tmdbId}/recommendations`,
    undefined,
    options,
  );
}

export function getSeasonEpisodes(seriesId, seasonNumber, options) {
  return getJson(
    `/api/media/tv/${seriesId}/season/${seasonNumber}`,
    undefined,
    options,
  );
}