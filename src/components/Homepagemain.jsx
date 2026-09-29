import './Homepagemain.css';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaStar } from 'react-icons/fa';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const fallbackPoster = 'https://placehold.co/300x450/17171d/ffffff?text=Movie';

const buildPosterUrl = (path) => (path ? `${IMAGE_BASE_URL}${path}` : fallbackPoster);

const sortByRating = (items) =>
  [...items].sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));

const sortMediaByTab = (items, activeTab) => {
  const sorted = [...items];

  if (activeTab === 'Popular') {
    return sorted.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
  }

  if (activeTab === 'Upcoming') {
    return sorted.sort((a, b) => {
      const aDate = a.release_date || a.first_air_date || '1900-01-01';
      const bDate = b.release_date || b.first_air_date || '1900-01-01';
      return new Date(bDate) - new Date(aDate);
    });
  }

  if (activeTab === 'Top Rated') {
    return sortByRating(sorted);
  }

  return sortByRating(sorted);
};

const normalizeItem = (item, genreMap, type) => {
  const title = item.title || item.name || 'Untitled';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4) || 'N/A';
  const genreNames = (item.genre_ids || [])
    .map((id) => genreMap[id])
    .filter(Boolean)
    .join(', ');

  return {
    ...item,
    id: item.id,
    mediaType: type,
    Title: title,
    Year: year,
    Genre: genreNames || 'General',
    Poster: buildPosterUrl(item.poster_path),
    imdbRating: item.vote_average ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    Ratings: [
      {
        Source: 'Internet Movie Database',
        Value: item.vote_average ? `${item.vote_average.toFixed(1)}/10` : 'N/A'
      }
    ],
    Plot: item.overview || 'No overview available.'
  };
};

function Main() {
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularSeries, setPopularSeries] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [upcomingSeries, setUpcomingSeries] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [topRatedSeries, setTopRatedSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [minRating, setMinRating] = useState('0');
  const [activeTab, setActiveTab] = useState('Trending');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(true);
  const [visibleMovieCount, setVisibleMovieCount] = useState(8);
  const [visibleSeriesCount, setVisibleSeriesCount] = useState(8);
  const [maxTmdbPages, setMaxTmdbPages] = useState(3);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const isInitialLoad = !movies.length && !series.length && !popularMovies.length && !popularSeries.length && !upcomingMovies.length && !upcomingSeries.length && !topRatedMovies.length && !topRatedSeries.length;

    const fetchMedia = async () => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const query = searchTerm.trim();
        const fetchPages = query ? [1] : Array.from({ length: maxTmdbPages }, (_, index) => index + 1);

        const [movieGenreResponse, tvGenreResponse] = await Promise.all([
          axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          }),
          axios.get(`${TMDB_BASE_URL}/genre/tv/list`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          })
        ]);

        const genreMap = {
          ...(movieGenreResponse.data.genres || []).reduce((acc, item) => {
            acc[item.id] = item.name;
            return acc;
          }, {}),
          ...(tvGenreResponse.data.genres || []).reduce((acc, item) => {
            acc[item.id] = item.name;
            return acc;
          }, {})
        };

        const getMultiPageResults = async (movieEndpoint, seriesEndpoint) => {
          const pageResults = await Promise.all(
            fetchPages.map((page) =>
              Promise.all([
                axios.get(movieEndpoint, {
                  params: { api_key: TMDB_API_KEY, language: 'en-US', query, page }
                }),
                axios.get(seriesEndpoint, {
                  params: { api_key: TMDB_API_KEY, language: 'en-US', query, page }
                })
              ])
            )
          );

          const movieResults = pageResults.flatMap(([moviePage]) => moviePage.data.results || []);
          const seriesResults = pageResults.flatMap(([, seriesPage]) => seriesPage.data.results || []);

          return {
            movies: Array.from(new Map(movieResults.map((movie) => [movie.id, movie])).values()),
            series: Array.from(new Map(seriesResults.map((show) => [show.id, show])).values())
          };
        };

        const popularData = await getMultiPageResults(
          query ? `${TMDB_BASE_URL}/search/movie` : `${TMDB_BASE_URL}/movie/popular`,
          query ? `${TMDB_BASE_URL}/search/tv` : `${TMDB_BASE_URL}/tv/popular`
        );

        const upcomingData = await getMultiPageResults(
          query ? `${TMDB_BASE_URL}/search/movie` : `${TMDB_BASE_URL}/movie/upcoming`,
          query ? `${TMDB_BASE_URL}/search/tv` : `${TMDB_BASE_URL}/tv/on_the_air`
        );

        const topRatedData = await getMultiPageResults(
          query ? `${TMDB_BASE_URL}/search/movie` : `${TMDB_BASE_URL}/movie/top_rated`,
          query ? `${TMDB_BASE_URL}/search/tv` : `${TMDB_BASE_URL}/tv/top_rated`
        );

        const normalizeSource = (items, mediaType) =>
          sortByRating(items.map((item) => normalizeItem(item, genreMap, mediaType)));

        const popularMoviesData = normalizeSource(popularData.movies, 'movie');
        const popularSeriesData = normalizeSource(popularData.series, 'series');
        const upcomingMoviesData = normalizeSource(upcomingData.movies, 'movie');
        const upcomingSeriesData = normalizeSource(upcomingData.series, 'series');
        const topRatedMoviesData = normalizeSource(topRatedData.movies, 'movie');
        const topRatedSeriesData = normalizeSource(topRatedData.series, 'series');

        const trendingMoviesData = normalizeSource(
          [...popularData.movies, ...upcomingData.movies, ...topRatedData.movies],
          'movie'
        );

        const trendingSeriesData = normalizeSource(
          [...popularData.series, ...upcomingData.series, ...topRatedData.series],
          'series'
        );

        setMovies(trendingMoviesData);
        setSeries(trendingSeriesData);
        setPopularMovies(popularMoviesData);
        setPopularSeries(popularSeriesData);
        setUpcomingMovies(upcomingMoviesData);
        setUpcomingSeries(upcomingSeriesData);
        setTopRatedMovies(topRatedMoviesData);
        setTopRatedSeries(topRatedSeriesData);
      } catch (err) {
        console.error('Error fetching media:', err);
        setError('Could not load media right now.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchMedia();
  }, [searchTerm, maxTmdbPages]);

  useEffect(() => {
    setVisibleMovieCount(8);
    setVisibleSeriesCount(8);
    setMaxTmdbPages(3);
  }, [searchTerm, selectedCategory]);

  const allCatalogItems = [
    ...movies,
    ...series,
    ...popularMovies,
    ...popularSeries,
    ...upcomingMovies,
    ...upcomingSeries,
    ...topRatedMovies,
    ...topRatedSeries
  ];

  const categories = [
    'All',
    ...new Set(
      allCatalogItems
        .flatMap((item) =>
          item?.Genre ? item.Genre.split(',').map((genre) => genre.trim()) : []
        )
        .filter(Boolean)
    )
  ];

  const genreOptions = ['All', ...new Set(allCatalogItems.flatMap((item) => item?.Genre ? item.Genre.split(',').map((genre) => genre.trim()) : []).filter(Boolean))];
  const languageOptions = ['All', ...new Set(allCatalogItems.map((item) => (item.original_language || 'en').toUpperCase()).filter(Boolean))];
  const tabOptions = ['Trending', 'Popular', 'Upcoming', 'Top Rated'];

  const activeMovieSource = {
    Trending: movies,
    Popular: popularMovies,
    Upcoming: upcomingMovies,
    'Top Rated': topRatedMovies
  }[activeTab] || movies;

  const activeSeriesSource = {
    Trending: series,
    Popular: popularSeries,
    Upcoming: upcomingSeries,
    'Top Rated': topRatedSeries
  }[activeTab] || series;

  const searchSuggestions = allCatalogItems
    .filter((item) => {
      const query = searchInput.trim().toLowerCase();
      if (!query) return false;
      return item.Title?.toLowerCase().includes(query) || item.Genre?.toLowerCase().includes(query);
    })
    .slice(0, 6);

  const filterMedia = (items) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.Title?.toLowerCase().includes(normalizedSearch) ||
        item.Genre?.toLowerCase().includes(normalizedSearch);

      const itemCategories = item.Genre ? item.Genre.split(',').map((genre) => genre.trim()) : [];
      const matchesCategory = selectedCategory === 'All' || itemCategories.includes(selectedCategory);
      const itemGenres = itemGenresFromItem(item);
      const matchesGenre = selectedGenre === 'All' || itemGenres.includes(selectedGenre);
      const itemRating = Number(item.vote_average || 0);
      const matchesRating = itemRating >= Number(minRating || 0);
      const itemLanguage = (item.original_language || 'en').toUpperCase();
      const matchesLanguage = selectedLanguage === 'All' || itemLanguage === selectedLanguage;

      return matchesSearch && matchesCategory && matchesGenre && matchesRating && matchesLanguage;
    });
  };

  const itemGenresFromItem = (item) =>
    item.Genre ? item.Genre.split(',').map((genre) => genre.trim()) : [];

  const filteredMovies = sortMediaByTab(filterMedia(activeMovieSource), activeTab);
  const filteredSeries = sortMediaByTab(filterMedia(activeSeriesSource), activeTab);
  const comingSoon = filteredMovies.slice(0, visibleMovieCount);
  const trendingNow = filteredMovies.slice(visibleMovieCount, visibleMovieCount + 4);
  const visibleSeries = filteredSeries.slice(0, visibleSeriesCount);

  const getRatingLabel = (item) => {
    const imdbRating = item?.Ratings?.find((rating) => rating.Source === 'Internet Movie Database')?.Value;
    return imdbRating || item?.imdbRating || 'N/A';
  };

  if (loading) {
    return (
      <div className="loading-shell" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Loading movies...</p>
      </div>
    );
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="main-section">
      <div className="search-panel">
        <div className="search-input-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="Search by title or genre"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            aria-label="Search movies or series"
          />

          {showSuggestions && searchSuggestions.length > 0 ? (
            <ul className="search-suggestions">
              {searchSuggestions.map((item) => (
                <li key={`${item.mediaType}-${item.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearchInput(item.Title);
                      setSearchTerm(item.Title);
                      setShowSuggestions(false);
                    }}
                  >
                    <span>{item.Title}</span>
                    <small>{item.mediaType === 'series' ? 'TV' : 'Movie'}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setFilterDrawerOpen((current) => !current)}
        >
          {filterDrawerOpen ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      <div className={`filter-panel ${filterDrawerOpen ? '' : 'closed'}`}>
        <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
          {genreOptions.map((genre) => (
            <option key={genre} value={genre}>
              {genre === 'All' ? 'All genres' : genre}
            </option>
          ))}
        </select>

        <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
          {languageOptions.map((language) => (
            <option key={language} value={language}>
              {language === 'All' ? 'All languages' : language}
            </option>
          ))}
        </select>

        <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
          <option value="0">All ratings</option>
          <option value="7">7.0+</option>
          <option value="8">8.0+</option>
          <option value="9">9.0+</option>
        </select>
      </div>

      <div className="tab-row">
        {tabOptions.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'category-chip active' : 'category-chip'}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="category-chip-group" style={{ marginTop: '12px' }}>
        {categories.map((category) => (
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

      <section id="coming-soon" className="content-section">
        <div className="section-header">
          <h2>Coming Soon</h2>
        </div>

        <div className="movie-row">
          {comingSoon.length > 0 ? (
            comingSoon.map((movie) => {
              const detailLink = `/${movie.mediaType === 'series' ? 'tv' : 'movie'}/${movie.id}`;

              return (
                <article key={movie.id} className="movie-card">
                  <Link to={detailLink} className="movie-card-link">
                    <img src={movie.Poster} alt={movie.Title} loading="lazy" decoding="async" />
                  </Link>
                  <div className="movie-meta">
                    <h3>{movie.Title}</h3>
                    <p>{movie.Year}</p>
                    <p>{movie.Genre}</p>
                    <p className="rating-row">
                      <FaStar className="star-icon" />
                      <span>{getRatingLabel(movie)}</span>
                    </p>
                    <Link to={detailLink} className="details-button">
                      View details
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty-state">No movies found for this search.</p>
          )}
        </div>

        {filteredMovies.length > comingSoon.length && (
          <button
            type="button"
            className="load-more-button"
            disabled={loadingMore}
            onClick={() => {
              setVisibleMovieCount((count) => count + 4);
              setMaxTmdbPages((count) => count + 1);
            }}
          >
            {loadingMore ? 'Loading...' : 'Load more movies'}
          </button>
        )}
      </section>

      <section id="trending-now" className="content-section">
        <div className="section-header">
          <h2>Trending now</h2>
        </div>

        <div className="movie-row">
          {trendingNow.length > 0 ? (
            trendingNow.map((movie) => {
              const detailLink = `/${movie.mediaType === 'series' ? 'tv' : 'movie'}/${movie.id}`;

              return (
                <article key={movie.id} className="movie-card">
                  <Link to={detailLink} className="movie-card-link">
                    <img src={movie.Poster} alt={movie.Title} loading="lazy" decoding="async" />
                  </Link>
                  <div className="movie-meta">
                    <h3>{movie.Title}</h3>
                    <p>{movie.Year}</p>
                    <p>{movie.Genre}</p>
                    <p className="rating-row">
                      <FaStar className="star-icon" />
                      <span>{getRatingLabel(movie)}</span>
                    </p>
                    <Link to={detailLink} className="details-button">
                      View details
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty-state">No trending movies found for this filter.</p>
          )}
        </div>

        {filteredMovies.length > visibleMovieCount && (
          <button
            type="button"
            className="load-more-button"
            disabled={loadingMore}
            onClick={() => {
              setVisibleMovieCount((count) => count + 4);
              setMaxTmdbPages((count) => count + 1);
            }}
          >
            {loadingMore ? 'Loading...' : 'Load more movies'}
          </button>
        )}
      </section>

      <section id="popular-series" className="content-section">
        <div className="section-header">
          <h2>Popular Series</h2>
        </div>

        <div className="movie-row">
          {visibleSeries.length > 0 ? (
            visibleSeries.map((show) => {
              const detailLink = `/${show.mediaType === 'series' ? 'tv' : 'movie'}/${show.id}`;

              return (
                <article key={show.id} className="movie-card">
                  <Link to={detailLink} className="movie-card-link">
                    <img src={show.Poster} alt={show.Title} loading="lazy" decoding="async" />
                  </Link>
                  <div className="movie-meta">
                    <h3>{show.Title}</h3>
                    <p>{show.Year}</p>
                    <p>{show.Genre}</p>
                    <p className="rating-row">
                      <FaStar className="star-icon" />
                      <span>{getRatingLabel(show)}</span>
                    </p>
                    <Link to={detailLink} className="details-button">
                      View details
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="empty-state">No series found for this filter.</p>
          )}
        </div>

        {filteredSeries.length > visibleSeries.length && (
          <button
            type="button"
            className="load-more-button"
            disabled={loadingMore}
            onClick={() => {
              setVisibleSeriesCount((count) => count + 4);
              setMaxTmdbPages((count) => count + 1);
            }}
          >
            {loadingMore ? 'Loading...' : 'Load more series'}
          </button>
        )}
      </section>
    </div>
  );
}

export default Main;
