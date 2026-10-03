import './Homepagemain.css';
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import MediaRow from './MediaRow';
import HeroBanner from './HeroBanner';
import { useMediaState } from '../context/MediaStateContext';
import staticFallbackMovies from '../Movies.json';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY 
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_POSTER = 'https://placehold.co/300x450/17171d/ffffff?text=No+Poster';

const CATEGORIES = [
  'All', 'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'
];

const CATEGORY_GENRE_ALIASES = {
  Action: ['Action', 'Action & Adventure'],
  Adventure: ['Adventure', 'Action & Adventure'],
  Fantasy: ['Fantasy', 'Sci-Fi & Fantasy'],
  'Sci-Fi': ['Science Fiction', 'Sci-Fi & Fantasy']
};

const uniqueById = (items) => Array.from(new Map(items.map((item) => [item.id, item])).values());

const buildPosterUrl = (path) => (path ? `${IMAGE_BASE_URL}${path}` : FALLBACK_POSTER);

const sortByRating = (items) =>
  [...items].sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));

const normalizeItem = (item, genreMap, type) => {
  const title = item.title || item.name || 'Untitled';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4) || 'N/A';
  const genreNames = (item.genre_ids || [])
    .map((id) => genreMap[id])
    .filter(Boolean)
    .join(', ');

  const genreArray = genreNames ? genreNames.split(', ').filter(Boolean) : ['Featured'];

  return {
    ...item,
    id: item.id,
    mediaType: type === 'series' ? 'tv' : type, // Normalized to 'tv' or 'movie'
    Title: title,
    title: title,
    Year: year,
    releaseYear: year,
    Genre: genreNames || 'General',
    genres: genreArray,
    Poster: buildPosterUrl(item.poster_path),
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : buildPosterUrl(item.poster_path),
    vote_average: item.vote_average || 0,
    rating: item.vote_average ? `${item.vote_average.toFixed(1)} ★` : 'PG-13',
    Plot: item.overview || 'No overview available.',
    description: item.overview || 'No overview available.'
  };
};

function Main({ mediaType = 'all' }) {
  const { bookmarks, toggleBookmark, episodeProgress } = useMediaState();

  // Media datasets
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularSeries, setPopularSeries] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [upcomingSeries, setUpcomingSeries] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [topRatedSeries, setTopRatedSeries] = useState([]);
  const [airingTodaySeries, setAiringTodaySeries] = useState([]);

  // TV Discover State
  const [tvGenres, setTvGenres] = useState([]);
  const [selectedSeriesGenre, setSelectedSeriesGenre] = useState('');
  const [selectedSeriesYear, setSelectedSeriesYear] = useState('');
  const [selectedSeriesSort, setSelectedSeriesSort] = useState('popularity.desc');
  const [discoveredSeries, setDiscoveredSeries] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');

  // UI & Filter States — stored in URL so they survive back-navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Read initial values from URL (or fallback defaults)
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('cat') || 'All');
  const [selectedGenre, setSelectedGenre] = useState(() => searchParams.get('genre') || 'All');
  const [selectedLanguage, setSelectedLanguage] = useState(() => searchParams.get('lang') || 'All');
  const [minRating, setMinRating] = useState(() => searchParams.get('rating') || '0');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(true);

  // Keep URL in sync whenever filters change
  useEffect(() => {
    const params = {};
    if (searchTerm) params.q = searchTerm;
    if (selectedCategory !== 'All') params.cat = selectedCategory;
    if (selectedGenre !== 'All') params.genre = selectedGenre;
    if (selectedLanguage !== 'All') params.lang = selectedLanguage;
    if (minRating !== '0') params.rating = minRating;
    setSearchParams(params, { replace: true });
  }, [searchTerm, selectedCategory, selectedGenre, selectedLanguage, minRating]);

  // Cursor position preservation for the search input
  const searchInputRef = useRef(null);
  const cursorPosRef = useRef(null);

  // Capture cursor before each render caused by searchInput changes
  const handleSearchChange = (e) => {
    cursorPosRef.current = e.target.selectionStart;
    setSearchInput(e.target.value);
  };

  // Restore cursor synchronously after React reconciles the DOM
  useLayoutEffect(() => {
    const el = searchInputRef.current;
    if (el && cursorPosRef.current !== null && document.activeElement === el) {
      el.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
    }
  }, [searchInput]);

  // Debounce: wait 700ms after the user stops typing before firing the search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 700);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Main catalog fetch effect
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoading(true);
        setError(null);

        const query = searchTerm.trim();

        const safeGet = (endpoint, extraParams = {}) =>
          axios
            .get(`${TMDB_BASE_URL}${endpoint}`, {
              params: { api_key: TMDB_API_KEY, ...extraParams }
            })
            .catch((err) => {
              console.warn(`TMDb request to ${endpoint} failed:`, err?.message || err);
              return { data: { results: [], genres: [] } };
            });

        // 1. Fetch genre mappings first
        const [movieGenreRes, tvGenreRes] = await Promise.all([
          safeGet('/genre/movie/list'),
          safeGet('/genre/tv/list')
        ]);

        const genreMap = {
          ...(movieGenreRes.data.genres || []).reduce((acc, g) => ({ ...acc, [g.id]: g.name }), {}),
          ...(tvGenreRes.data.genres || []).reduce((acc, g) => ({ ...acc, [g.id]: g.name }), {})
        };
        setTvGenres(tvGenreRes.data.genres || []);

        // 2. Fetch media endpoints (1 page per endpoint for optimal speed)
        if (query) {
          const [movieSearch, tvSearch] = await Promise.all([
            safeGet('/search/movie', { query }),
            safeGet('/search/tv', { query })
          ]);

          const normMovies = sortByRating((movieSearch.data.results || []).map((i) => normalizeItem(i, genreMap, 'movie')));
          const normSeries = sortByRating((tvSearch.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv')));

          setMovies(normMovies);
          setSeries(normSeries);
          setPopularMovies(normMovies);
          setPopularSeries(normSeries);
          setUpcomingMovies(normMovies);
          setTopRatedMovies(normMovies);
        } else {
          const [
            trendingM, trendingT,
            popularM, popularT,
            upcomingM, upcomingT,
            topM, topT,
            airingT
          ] = await Promise.all([
            safeGet('/trending/movie/week'),
            safeGet('/trending/tv/week'),
            safeGet('/movie/popular'),
            safeGet('/tv/popular'),
            safeGet('/movie/upcoming'),
            safeGet('/tv/on_the_air'),
            safeGet('/movie/top_rated'),
            safeGet('/tv/top_rated'),
            safeGet('/tv/airing_today')
          ]);

          const normTrendingM = sortByRating((trendingM.data.results || []).map((i) => normalizeItem(i, genreMap, 'movie')));
          const normTrendingT = sortByRating((trendingT.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv')));
          const normPopularM = sortByRating((popularM.data.results || []).map((i) => normalizeItem(i, genreMap, 'movie')));
          const normPopularT = sortByRating((popularT.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv')));
          const normUpcomingM = sortByRating((upcomingM.data.results || []).map((i) => normalizeItem(i, genreMap, 'movie')));
          const normUpcomingT = sortByRating((upcomingT.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv')));
          const normTopM = sortByRating((topM.data.results || []).map((i) => normalizeItem(i, genreMap, 'movie')));
          const normTopT = sortByRating((topT.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv')));
          const normAiringT = sortByRating((airingT.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv')));

          // If online endpoints returned empty, gracefully fallback to seeded data
          if (normTrendingM.length === 0 && Array.isArray(staticFallbackMovies) && staticFallbackMovies.length > 0) {
            setMovies(staticFallbackMovies);
            setPopularMovies(staticFallbackMovies);
          } else {
            setMovies(normTrendingM);
            setPopularMovies(normPopularM.length > 0 ? normPopularM : normTrendingM);
          }

          setSeries(normTrendingT);
          setPopularSeries(normPopularT.length > 0 ? normPopularT : normTrendingT);
          setUpcomingMovies(normUpcomingM.length > 0 ? normUpcomingM : normTrendingM);
          setUpcomingSeries(normUpcomingT.length > 0 ? normUpcomingT : normTrendingT);
          setTopRatedMovies(normTopM.length > 0 ? normTopM : normTrendingM);
          setTopRatedSeries(normTopT.length > 0 ? normTopT : normTrendingT);
          setAiringTodaySeries(normAiringT.length > 0 ? normAiringT : normTrendingT);
        }
      } catch (err) {
        console.error('Error loading media catalog:', err);
        setError('Could not load catalog right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [searchTerm]);

  // TV Discover effect
  useEffect(() => {
    if (mediaType !== 'tv' || tvGenres.length === 0) return;

    const controller = new AbortController();
    const params = {
      api_key: TMDB_API_KEY,
      language: 'en-US',
      sort_by: selectedSeriesSort,
      page: 1
    };

    if (selectedSeriesGenre) params.with_genres = selectedSeriesGenre;
    if (selectedSeriesYear) params.first_air_date_year = selectedSeriesYear;

    setDiscoverLoading(true);
    setDiscoverError('');

    axios.get(`${TMDB_BASE_URL}/discover/tv`, { params, signal: controller.signal })
      .then((res) => {
        const genreMap = tvGenres.reduce((acc, g) => ({ ...acc, [g.id]: g.name }), {});
        const items = (res.data.results || []).map((i) => normalizeItem(i, genreMap, 'tv'));
        if (!controller.signal.aborted) setDiscoveredSeries(items);
      })
      .catch((err) => {
        if (!controller.signal.aborted && axios.isCancel(err) === false) {
          setDiscoveredSeries([]);
          setDiscoverError('Could not load series for these filters.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiscoverLoading(false);
      });

    return () => controller.abort();
  }, [mediaType, tvGenres, selectedSeriesGenre, selectedSeriesYear, selectedSeriesSort]);

  // Memoized Catalog List & Options
  const allCatalogItems = useMemo(() => {
    return uniqueById([
      ...movies, ...series, ...popularMovies, ...popularSeries,
      ...upcomingMovies, ...upcomingSeries, ...topRatedMovies, ...topRatedSeries
    ]);
  }, [movies, series, popularMovies, popularSeries, upcomingMovies, upcomingSeries, topRatedMovies, topRatedSeries]);

  const genreOptions = useMemo(() => {
    return ['All', ...new Set(allCatalogItems.flatMap((i) => i.Genre ? i.Genre.split(',').map((g) => g.trim()) : []).filter(Boolean))];
  }, [allCatalogItems]);

  const languageOptions = useMemo(() => {
    return ['All', ...new Set(allCatalogItems.map((i) => (i.original_language || 'en').toUpperCase()).filter(Boolean))];
  }, [allCatalogItems]);

  // Filter Helper — all active conditions are AND-combined
  const applyFilters = (items) => {
    return items.filter((item) => {
      // Search term must match title (if a search is active)
      const title = (item.Title || item.title || item.name || '').toLowerCase();
      const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase());

      const itemCategories = item.Genre ? item.Genre.split(',').map((g) => g.trim()) : [];
      const selectedGenres = CATEGORY_GENRE_ALIASES[selectedCategory] || [selectedCategory];
      const matchesCategory = selectedCategory === 'All' || selectedGenres.some((g) => itemCategories.includes(g));

      const matchesGenre = selectedGenre === 'All' || itemCategories.includes(selectedGenre);
      const matchesRating = Number(item.vote_average || 0) >= Number(minRating || 0);

      // Language: TMDB returns ISO 639-1 codes (e.g. 'en', 'ko'); compare case-insensitively
      const itemLanguage = (item.original_language || 'en').toUpperCase();
      const matchesLanguage = selectedLanguage === 'All' || itemLanguage === selectedLanguage.toUpperCase();

      return matchesSearch && matchesCategory && matchesGenre && matchesRating && matchesLanguage;
    });
  };

  // Continue Watching calculation
  const continueWatching = useMemo(() => {
    const latestMap = Object.values(episodeProgress)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .reduce((map, prog) => {
        if (!map.has(prog.seriesId)) map.set(prog.seriesId, prog);
        return map;
      }, new Map());

    return Array.from(latestMap.values()).map((prog) => {
      const seasonNumbers = prog.seasonNumbers || [];
      let resumeSeason = prog.seasonNumber;
      let resumeEpisode = prog.episodeNumber + 1;

      if (resumeEpisode > prog.episodeCountInSeason) {
        const nextSeason = seasonNumbers[seasonNumbers.indexOf(prog.seasonNumber) + 1];
        if (nextSeason === undefined) return null;
        resumeSeason = nextSeason;
        resumeEpisode = 1;
      }

      return {
        id: prog.seriesId,
        mediaType: 'tv',
        Title: prog.seriesTitle,
        Poster: prog.poster,
        Year: prog.year,
        Genre: `S${resumeSeason} E${resumeEpisode}`,
        vote_average: prog.vote_average || 0,
        resumeSeason,
        resumeEpisode
      };
    }).filter(Boolean);
  }, [episodeProgress]);

  const featuredItems = useMemo(() => {
    if (mediaType === 'tv') {
      return series.filter((s) => s.backdrop_path || s.backdrop).slice(0, 6);
    }
    if (mediaType === 'movie') {
      return movies.filter((m) => m.backdrop_path || m.backdrop).slice(0, 6);
    }
    // 'all': blend top rated / trending movies and series with backdrops
    const combined = [];
    const maxLen = Math.max(movies.length, series.length);
    for (let i = 0; i < maxLen && combined.length < 6; i++) {
      if (movies[i] && (movies[i].backdrop_path || movies[i].backdrop)) {
        combined.push(movies[i]);
      }
      if (series[i] && (series[i].backdrop_path || series[i].backdrop) && combined.length < 6) {
        combined.push(series[i]);
      }
    }
    return combined.length > 0 ? combined : (movies.slice(0, 6) || series.slice(0, 6));
  }, [mediaType, movies, series]);

  const handleToggleHeroWatchlist = (item) => {
    if (!item?.id) return;
    toggleBookmark({
      id: item.id,
      type: item.mediaType || (item.first_air_date ? 'tv' : 'movie'),
      title: item.Title || item.title || item.name,
      poster_path: item.poster_path || item.Poster
    });
  };

  // Dedicated TV Hub View
  if (mediaType === 'tv') {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 70 }, (_, i) => String(currentYear - i));

    return (
      <div className="main-section series-page">
        {featuredItems.length > 0 ? (
          <HeroBanner
            movies={featuredItems}
            onToggleWatchlist={handleToggleHeroWatchlist}
            autoPlayInterval={5500}
          />
        ) : null}

        <section className="series-filter-section">
          <label>
            Genre
            <select value={selectedSeriesGenre} onChange={(e) => setSelectedSeriesGenre(e.target.value)}>
              <option value="">All Genres</option>
              {tvGenres.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <label>
            Air Year
            <select value={selectedSeriesYear} onChange={(e) => setSelectedSeriesYear(e.target.value)}>
              <option value="">Any Year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            Sort By
            <select value={selectedSeriesSort} onChange={(e) => setSelectedSeriesSort(e.target.value)}>
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Top Rated</option>
              <option value="first_air_date.desc">Newest First</option>
            </select>
          </label>
        </section>

        {discoverError ? <p className="empty-state">{discoverError}</p> : null}

        <MediaRow id="series-discover" title="Browse Series" items={discoveredSeries} loading={discoverLoading} />
        <MediaRow id="series-trending" title="Trending Series" items={series} loading={loading} />
        <MediaRow id="series-popular" title="Popular Series" items={popularSeries} loading={loading} />
        <MediaRow id="series-top-rated" title="Top Rated Series" items={topRatedSeries} loading={loading} />
        <MediaRow id="series-airing-today" title="Airing Today" items={airingTodaySeries} loading={loading} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-shell">
        <div className="spinner" />
        <p>Loading Catalog...</p>
      </div>
    );
  }

  return (
    <div className="main-section">
      {/* Featured Cinematic Hero Banner with Autoplay Carousel */}
      {!searchTerm && featuredItems.length > 0 && (
        <HeroBanner
          movies={featuredItems}
          onToggleWatchlist={handleToggleHeroWatchlist}
          autoPlayInterval={5500}
        />
      )}

      {/* Search Bar */}
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
          />

          {showSuggestions && searchInput.trim() ? (
            <ul className="search-suggestions">
              {allCatalogItems
                .filter((i) => i.Title?.toLowerCase().includes(searchInput.toLowerCase()))
                .slice(0, 5)
                .map((item) => (
                  <li key={`${item.mediaType}-${item.id}`}>
                    <Link
                      to={item.mediaType === 'tv' ? `/series/${item.id}` : `/movie/${item.id}`}
                      onClick={() => setShowSuggestions(false)}
                    >
                      <span>{item.Title}</span>
                      <small>{item.mediaType === 'tv' ? 'TV' : 'Movie'}</small>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setFilterDrawerOpen((prev) => !prev)}
        >
          {filterDrawerOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className={`filter-panel ${filterDrawerOpen ? '' : 'closed'}`}>
        <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
          {genreOptions.map((g) => (
            <option key={g} value={g}>{g === 'All' ? 'All Genres' : g}</option>
          ))}
        </select>

        <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
          {languageOptions.map((l) => (
            <option key={l} value={l}>{l === 'All' ? 'All Languages' : l}</option>
          ))}
        </select>

        <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
          <option value="0">All Ratings</option>
          <option value="7">7.0+ Score</option>
          <option value="8">8.0+ Score</option>
        </select>
      </div>

      {/* Category Chips */}
      <div className="category-chip-group">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={selectedCategory === cat ? 'category-chip active' : 'category-chip'}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {error ? <p className="empty-state">{error}</p> : null}

      {/* Continue Watching Section */}
      {continueWatching.length > 0 && (
        <MediaRow id="continue-watching" title="Continue Watching" items={continueWatching} />
      )}

      {/* Dedicated Movie Rows */}
      {mediaType !== 'tv' && (
        <>
          <MediaRow
            id="trending-movies"
            title="Trending Movies"
            items={applyFilters(movies)}
            loading={loading}
          />
          <MediaRow
            id="upcoming-movies"
            title="Upcoming Movies"
            items={applyFilters(upcomingMovies)}
            loading={loading}
          />
        </>
      )}

      {/* Dedicated TV Series Rows */}
      {mediaType !== 'movie' && (
        <MediaRow
          id="popular-series"
          title="Popular TV Shows"
          items={applyFilters(popularSeries)}
          loading={loading}
        />
      )}
    </div>
  );
}

export default Main;