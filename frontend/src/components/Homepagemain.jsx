import './Homepagemain.css';
import { useEffect, useState, useLayoutEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MediaRow from './MediaRow';
import HeroBanner from './HeroBanner';
import { useMediaState } from '../context/mediaState';
import { createRequestGuard, isAbortError } from '../api/requestGuard';
import {
  getCatalogRows,
  getGenres,
  discoverSeries,
  searchMedia,
  toRouteSegment,
} from '../api/media';
import staticFallbackMovies from '../Movies.json';

const CATEGORIES = [
  'All', 'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'
];

// TMDb renamed some genres; treat the modern and legacy labels as one category.
const CATEGORY_GENRE_ALIASES = {
  Action: ['Action', 'Action & Adventure'],
  Adventure: ['Adventure', 'Action & Adventure'],
  Fantasy: ['Fantasy', 'Sci-Fi & Fantasy'],
  'Sci-Fi': ['Science Fiction', 'Sci-Fi & Fantasy']
};

const FALLBACK_POSTER = 'https://placehold.co/300x450/17171d/ffffff?text=No+Poster';

const MOVIE_ROWS = ['trending_movies', 'upcoming_movies', 'cutie_movies', 'anime_movies'];
const SERIES_ROWS = ['popular_series', 'trending_series', 'top_rated_series', 'airing_today_series'];
const ALL_ROWS = [...MOVIE_ROWS, ...SERIES_ROWS];

// Rows are requested in small batches rather than one big call. A cold start on
// a free-tier host can push a wide request past the proxy's timeout, and a
// single failed call used to blank every row at once — the page fell back to
// the bundled catalog and only Trending/Upcoming Movies survived. Independent
// batches limit that blast radius to the batch that actually failed.
const ROW_BATCH_SIZE = 2;

function rowBatches(rows) {
  const batches = [];
  for (let i = 0; i < rows.length; i += ROW_BATCH_SIZE) {
    batches.push(rows.slice(i, i + ROW_BATCH_SIZE));
  }
  return batches;
}

const SORT_OPTIONS = [
  ['popularity.desc', 'Most Popular'],
  ['vote_average.desc', 'Top Rated'],
  ['first_air_date.desc', 'Newest First'],
];

function rowsForMediaType(mediaType) {
  if (mediaType === 'movie') return MOVIE_ROWS;
  if (mediaType === 'tv') return SERIES_ROWS;
  return ALL_ROWS;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.media_type}:${item.id}`;
    if (!item.id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByRating(items) {
  return [...items].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
}

/**
 * The backend already returns a uniform card shape, so the only job here is
 * filling in the poster fallback.
 */
function withPoster(card) {
  return { ...card, poster: card.poster || FALLBACK_POSTER };
}

function Main({ mediaType = 'all' }) {
  const { toggleBookmark, episodeProgress } = useMediaState();

  const [rows, setRows] = useState({});
  const [searchResults, setSearchResults] = useState({ movies: [], series: [] });
  const [tvGenres, setTvGenres] = useState([]);
  const [discoveredSeries, setDiscoveredSeries] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedSeriesGenre, setSelectedSeriesGenre] = useState('');
  const [selectedSeriesYear, setSelectedSeriesYear] = useState('');
  const [selectedSeriesSort, setSelectedSeriesSort] = useState('popularity.desc');

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('cat') || 'All');
  const [selectedGenre, setSelectedGenre] = useState(() => searchParams.get('genre') || 'All');
  const [selectedLanguage, setSelectedLanguage] = useState(() => searchParams.get('lang') || 'All');
  const [minRating, setMinRating] = useState(() => searchParams.get('rating') || '0');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(true);

  // Filters live in the URL so back-navigation restores them.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchTerm) next.set('q', searchTerm);
    if (selectedCategory !== 'All') next.set('cat', selectedCategory);
    if (selectedGenre !== 'All') next.set('genre', selectedGenre);
    if (selectedLanguage !== 'All') next.set('lang', selectedLanguage);
    if (minRating !== '0') next.set('rating', minRating);

    // Skip the write when nothing changed. A redundant replace is still a
    // navigation, which re-runs the restore effect below and would reset the
    // search box mid-typing.
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [
    searchTerm,
    selectedCategory,
    selectedGenre,
    selectedLanguage,
    minRating,
    searchParams,
    setSearchParams,
  ]);

  // Restore URL filters when the query string changes via navigation.
  useEffect(() => {
    setSearchInput(searchParams.get('q') || '');
    setSearchTerm(searchParams.get('q') || '');
    setSelectedCategory(searchParams.get('cat') || 'All');
    setSelectedGenre(searchParams.get('genre') || 'All');
    setSelectedLanguage(searchParams.get('lang') || 'All');
    setMinRating(searchParams.get('rating') || '0');
  }, [searchParams]);

  const searchInputRef = useRef(null);
  const cursorPosRef = useRef(null);

  const handleSearchChange = (event) => {
    cursorPosRef.current = event.target.selectionStart;
    setSearchInput(event.target.value);
  };

  // Typing re-renders on every keystroke; put the caret back afterwards.
  useLayoutEffect(() => {
    const el = searchInputRef.current;
    if (el && cursorPosRef.current !== null && document.activeElement === el) {
      el.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
    }
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 700);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const catalogGuard = useMemo(() => createRequestGuard(), []);
  useEffect(() => () => catalogGuard.abort(), [catalogGuard]);

  // A few small batched requests per load, so one slow or failing batch cannot
  // take the whole catalog down with it.
  useEffect(() => {
    const signal = catalogGuard.start();
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const query = searchTerm.trim();
        if (query) {
          const [movies, series] = await Promise.all([
            mediaType !== 'tv' ? searchMedia(query, { mediaType: 'movie' }, { signal }) : [],
            mediaType !== 'movie' ? searchMedia(query, { mediaType: 'tv' }, { signal }) : [],
          ]);
          if (!active) return;
          setSearchResults({ movies, series });
          setRows({});
          return;
        }

        setSearchResults({ movies: [], series: [] });

        const batches = rowBatches(rowsForMediaType(mediaType));
        const settled = await Promise.allSettled(
          batches.map((batch) => getCatalogRows(batch, { signal })),
        );
        if (!active) return;

        // A batch that failed leaves its rows absent, which the row renderers
        // treat as empty. Only a total failure means the API is unreachable.
        if (settled.every((outcome) => outcome.status === 'rejected')) {
          throw settled[0].reason;
        }

        const data = {};
        for (const outcome of settled) {
          if (outcome.status === 'fulfilled') Object.assign(data, outcome.value);
        }
        setRows(withFallback(data));
      } catch (err) {
        if (!active || isAbortError(err)) return;
        // The backend is unreachable. Seed the bundled catalog so the rows still
        // render cards instead of collapsing to empty states.
        setRows(withFallback({}));
        setError('Could not reach the catalog service. Showing the bundled catalog.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [searchTerm, mediaType, catalogGuard]);

  const discoverGuard = useMemo(() => createRequestGuard(), []);
  useEffect(() => () => discoverGuard.abort(), [discoverGuard]);

  useEffect(() => {
    if (mediaType !== 'tv' || tvGenres.length === 0) return undefined;

    const signal = discoverGuard.start();
    let active = true;

    setDiscoverLoading(true);
    setDiscoverError('');

    discoverSeries(
      {
        genreId: selectedSeriesGenre,
        year: selectedSeriesYear,
        sortBy: selectedSeriesSort,
      },
      { signal }
    )
      .then((items) => {
        if (active) setDiscoveredSeries(items);
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setDiscoveredSeries([]);
        setDiscoverError('Could not load series for these filters.');
      })
      .finally(() => {
        if (active) setDiscoverLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    mediaType,
    tvGenres,
    selectedSeriesGenre,
    selectedSeriesYear,
    selectedSeriesSort,
    discoverGuard,
  ]);

  // Genre list for the series filter; fetched once and cached by the client.
  useEffect(() => {
    if (mediaType !== 'tv') return undefined;

    const controller = new AbortController();
    let active = true;

    getGenres('tv', { signal: controller.signal })
      .then((genres) => {
        if (active) setTvGenres(genres);
      })
      .catch((err) => {
        if (active && !isAbortError(err)) setDiscoverError('Genres are unavailable.');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [mediaType]);

  const catalogItems = useMemo(() => {
    if (searchTerm.trim()) return uniqueById([...searchResults.movies, ...searchResults.series]);
    return uniqueById(Object.values(rows).flat());
  }, [rows, searchResults, searchTerm]);

  const genreOptions = useMemo(
    () => ['All', ...new Set(catalogItems.flatMap((item) => item.genres || []))],
    [catalogItems]
  );

  const languageOptions = useMemo(
    () => ['All', ...new Set(catalogItems.map((item) => item.original_language).filter(Boolean))],
    [catalogItems]
  );

  // Active filters are AND-combined.
  const applyFilters = (items) => {
    const query = searchTerm.trim().toLowerCase();
    const wantedGenres = CATEGORY_GENRE_ALIASES[selectedCategory] || [selectedCategory];

    return items.filter((item) => {
      const title = (item.title || '').toLowerCase();
      if (query && !title.includes(query)) return false;

      const itemGenres = item.genres || [];
      if (selectedCategory !== 'All' && !wantedGenres.some((g) => itemGenres.includes(g))) return false;
      if (selectedGenre !== 'All' && !itemGenres.includes(selectedGenre)) return false;
      if (Number(item.rating || 0) < Number(minRating || 0)) return false;

      const language = item.original_language;
      if (selectedLanguage !== 'All' && language !== selectedLanguage.toUpperCase()) return false;

      return true;
    });
  };

  const continueWatching = useMemo(() => {
    const latestBySeries = new Map();

    for (const progress of Object.values(episodeProgress).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    )) {
      if (!latestBySeries.has(progress.seriesId)) {
        latestBySeries.set(progress.seriesId, progress);
      }
    }

    const cards = [];
    for (const progress of latestBySeries.values()) {
      let resumeSeason = progress.seasonNumber;
      let resumeEpisode = progress.episodeNumber + 1;

      if (resumeEpisode > progress.episodeCountInSeason) {
        const seasons = progress.seasonNumbers || [];
        const nextSeason = seasons[seasons.indexOf(progress.seasonNumber) + 1];
        if (nextSeason === undefined) continue;
        resumeSeason = nextSeason;
        resumeEpisode = 1;
      }

      cards.push({
        id: progress.seriesId,
        media_type: 'tv',
        title: progress.seriesTitle,
        year: progress.year,
        poster: progress.poster || FALLBACK_POSTER,
        rating: progress.vote_average || 0,
        genres: [progress.genre].filter(Boolean),
        resumeSeason,
        resumeEpisode,
      });
    }

    return cards;
  }, [episodeProgress]);

  const featuredItems = useMemo(() => {
    const withBackdrop = (items) => items.filter((item) => item.backdrop).slice(0, 6);

    if (mediaType === 'tv') return withBackdrop(rows.trending_series || []);
    if (mediaType === 'movie') return withBackdrop(rows.trending_movies || []);

    const blended = [];
    const movies = rows.trending_movies || [];
    const series = rows.trending_series || [];
    const length = Math.max(movies.length, series.length);

    for (let i = 0; i < length && blended.length < 6; i += 1) {
      if (movies[i]?.backdrop) blended.push(movies[i]);
      if (series[i]?.backdrop && blended.length < 6) blended.push(series[i]);
    }

    return blended;
  }, [mediaType, rows]);

  // Keyword-driven rows (Cutie, Anime) come from TMDb keyword lookups, so they
  // are empty whenever TMDb has no matches — that is how the row hides itself
  // instead of leaving an empty heading behind.
  const cutieItems = applyFilters(rows.cutie_movies || []);
  const animeItems = applyFilters(rows.anime_movies || []);

  const keywordRow = (id, title, items) =>
    items.length > 0 ? <MediaRow id={id} title={title} items={items} /> : null;

  const handleToggleHeroWatchlist = (item) => {
    toggleBookmark({
      id: item.id,
      type: item.media_type,
      title: item.title,
      poster: item.poster,
      year: item.year,
      rating: item.rating,
    });
  };

  if (mediaType === 'tv') {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 70 }, (_, i) => String(currentYear - i));

    return (
      <div className="main-section series-page">
        {featuredItems.length > 0 && (
          <HeroBanner
            movies={featuredItems}
            onToggleWatchlist={handleToggleHeroWatchlist}
            autoPlayInterval={5500}
          />
        )}

        <section className="series-filter-section">
          <label>
            Genre
            <select value={selectedSeriesGenre} onChange={(e) => setSelectedSeriesGenre(e.target.value)}>
              <option value="">All Genres</option>
              {tvGenres.map((genre) => (
                <option key={genre.id} value={genre.id}>{genre.name}</option>
              ))}
            </select>
          </label>
          <label>
            Air Year
            <select value={selectedSeriesYear} onChange={(e) => setSelectedSeriesYear(e.target.value)}>
              <option value="">Any Year</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label>
            Sort By
            <select value={selectedSeriesSort} onChange={(e) => setSelectedSeriesSort(e.target.value)}>
              {SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </section>

        {discoverError ? <p className="empty-state">{discoverError}</p> : null}

        <MediaRow id="series-discover" title="Browse Series" items={discoveredSeries} loading={discoverLoading} />
        <MediaRow id="series-trending" title="Trending Series" items={rows.trending_series || []} loading={loading} />
        <MediaRow id="series-popular" title="Popular Series" items={rows.popular_series || []} loading={loading} />
        <MediaRow id="series-top-rated" title="Top Rated Series" items={rows.top_rated_series || []} loading={loading} />
        <MediaRow id="series-airing-today" title="Airing Today" items={rows.airing_today_series || []} loading={loading} />
      </div>
    );
  }

  if (loading && catalogItems.length === 0) {
    return (
      <div className="loading-shell">
        <div className="spinner" />
        <p>Loading Catalog...</p>
      </div>
    );
  }

  const searchMovies = sortByRating(searchResults.movies).map(withPoster);
  const searchSeries = sortByRating(searchResults.series).map(withPoster);

  return (
    <div className="main-section">
      {!searchTerm && featuredItems.length > 0 && (
        <HeroBanner
          movies={featuredItems}
          onToggleWatchlist={handleToggleHeroWatchlist}
          autoPlayInterval={5500}
        />
      )}

      <div className="search-panel">
        <div className="search-input-wrap">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search movies or TV shows by title..."
            value={searchInput}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setShowSuggestions(false)}
          />

          {showSuggestions && searchInput.trim() && (
            <ul className="search-suggestions">
              {catalogItems
                .filter((item) => item.title.toLowerCase().includes(searchInput.toLowerCase()))
                .slice(0, 5)
                .map((item) => (
                  <li key={`${item.media_type}-${item.id}`}>
                    <Link
                      to={`/${toRouteSegment(item.media_type)}/${item.id}`}
                      onClick={() => setShowSuggestions(false)}
                    >
                      <span>{item.title}</span>
                      <small>{item.media_type === 'tv' ? 'TV' : 'Movie'}</small>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setFilterDrawerOpen((prev) => !prev)}
        >
          {filterDrawerOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      <div className={`filter-panel ${filterDrawerOpen ? '' : 'closed'}`}>
        <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
          {genreOptions.map((genre) => (
            <option key={genre} value={genre}>{genre === 'All' ? 'All Genres' : genre}</option>
          ))}
        </select>

        <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
          {languageOptions.map((language) => (
            <option key={language} value={language}>{language === 'All' ? 'All Languages' : language}</option>
          ))}
        </select>

        <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
          <option value="0">All Ratings</option>
          <option value="7">7.0+ Score</option>
          <option value="8">8.0+ Score</option>
        </select>
      </div>

      <div className="category-chip-group">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={selectedCategory === category ? 'category-chip active' : 'category-chip'}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {error ? <p className="empty-state">{error}</p> : null}

      {continueWatching.length > 0 && (
        <MediaRow id="continue-watching" title="Continue Watching" items={continueWatching} />
      )}

      {searchTerm.trim() ? (
        <>
          {mediaType !== 'tv' && (
            <MediaRow id="search-movies" title={`Movies matching "${searchTerm.trim()}"`} items={searchMovies} loading={loading} />
          )}
          {mediaType !== 'movie' && (
            <MediaRow id="search-series" title={`Series matching "${searchTerm.trim()}"`} items={searchSeries} loading={loading} />
          )}
          {!loading && catalogItems.length === 0 && (
            <p className="empty-state">No titles matched your search.</p>
          )}
        </>
      ) : (
        <>
          {mediaType !== 'tv' && (
            <>
              <MediaRow id="trending-movies" title="Trending Movies" items={applyFilters(rows.trending_movies || [])} loading={loading} />
              <MediaRow id="upcoming-movies" title="Upcoming Movies" items={applyFilters(rows.upcoming_movies || [])} loading={loading} />
              {keywordRow('cutie-movies', 'Cutie', cutieItems)}
              {keywordRow('anime-movies', 'Anime', animeItems)}
            </>
          )}
          {mediaType !== 'movie' && (
            <MediaRow id="popular-series" title="Popular TV Shows" items={applyFilters(rows.popular_series || [])} loading={loading} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * The static Movies.json ships with the app so the catalog still renders if the
 * backend is unreachable. It only fills gaps; live data always wins.
 */
function withFallback(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = Array.isArray(value) && value.length ? value : [];
  }

  if (!result.trending_movies?.length && Array.isArray(staticFallbackMovies) && staticFallbackMovies.length) {
    const fallback = staticFallbackMovies.map((item) =>
      withPoster({
        id: item.id,
        media_type: 'movie',
        title: item.title || item.Title || 'Untitled',
        year: item.year || item.Year || 'N/A',
        poster: item.poster || item.Poster,
        backdrop: item.backdrop || item.poster || item.Poster,
        rating: item.rating || 0,
        genres: item.genres || (item.Genre ? [item.Genre] : []),
      })
    );
    result.trending_movies = fallback;
    if (!result.upcoming_movies?.length) result.upcoming_movies = fallback;
  }

  return result;
}

export default Main;