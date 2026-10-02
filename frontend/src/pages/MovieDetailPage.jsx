import '../components/Homepagemain.css';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { FaStar } from 'react-icons/fa';
import MoviePlayer from '../components/movieplayer';
import usePageMeta from '../hooks/usePageMeta';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const fallbackPoster = 'https://placehold.co/500x750/17171d/ffffff?text=Movie';

const buildPosterUrl = (path) => (path ? `${IMAGE_BASE_URL}${path}` : fallbackPoster);
const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

function MovieDetailPage({ mediaType: routeMediaType }) {
  const { type: routeType, id } = useParams();
  const type = routeMediaType || (routeType === 'series' ? 'tv' : routeType) || 'movie';
  const [movie, setMovie] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [contributorsLoading, setContributorsLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageMeta, setPageMeta] = useState({
    title: 'JinFlix | Movies and Series to Watch',
    description: 'Browse movies and series on JinFlix and try playback through available embedded providers. Availability may vary.'
  });

  usePageMeta(pageMeta.title, pageMeta.description);

  useEffect(() => {
    if (!loading && movie?.trailerKey && window.location.hash === '#trailer') {
      document.getElementById('trailer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, movie?.trailerKey]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        setContributorsLoading(true);

        const endpoint = type === 'tv' ? `${TMDB_BASE_URL}/tv/${id}` : `${TMDB_BASE_URL}/movie/${id}`;
        const creditsEndpoint = `${endpoint}/credits`;
        const providersEndpoint = `${endpoint}/watch/providers`;
        const videosEndpoint = `${endpoint}/videos`;

        const [detailsResponse, creditsResponse, providersResponse, videosResponse] = await Promise.all([
          axios.get(endpoint, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          }),
          axios.get(creditsEndpoint, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          }),
          axios.get(providersEndpoint, {
            params: { api_key: TMDB_API_KEY }
          }),
          axios.get(videosEndpoint, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          }).catch(() => ({ data: { results: [] } }))
        ]);

        const item = detailsResponse.data;
        const title = item.title || item.name || 'Untitled';
        const year = (item.release_date || item.first_air_date || '').slice(0, 4) || 'N/A';
        const genres = (item.genres || []).map((genre) => genre.name).join(', ') || 'General';
        const runtime = item.runtime
          ? `${item.runtime} min`
          : item.episode_run_time?.[0]
            ? `${item.episode_run_time[0]} min/ep`
            : 'N/A';

        const providerResults = providersResponse.data?.results || {};
        const providerRegion = providerResults.US || providerResults.IN || Object.values(providerResults)[0] || {};
        const providers = [
          ...(providerRegion.flatrate || []),
          ...(providerRegion.rent || []),
          ...(providerRegion.buy || [])
        ].filter((provider, index, array) => array.findIndex((item) => item.provider_id === provider.provider_id) === index);
        const trailers = (videosResponse.data?.results || [])
          .filter((video) => video.site === 'YouTube' && video.type === 'Trailer');
        const trailer = trailers.find((video) => video.official) || trailers[0] || null;

        const candidatePeople = [...(creditsResponse.data.cast || []), ...(creditsResponse.data.crew || [])]
          .filter((person) => person && (person.name || person.original_name))
          .slice(0, 8);

        const peopleDetails = await Promise.all(
          candidatePeople.map(async (person) => {
            try {
              const personResponse = await axios.get(`${TMDB_BASE_URL}/person/${person.id}`, {
                params: { api_key: TMDB_API_KEY, language: 'en-US' }
              });

              const personData = personResponse.data || {};
              const biography = personData.biography || 'Biography details are not available for this contributor yet.';
              const role = person.character || person.job || person.department || 'Contributor';

              return {
                id: person.id,
                name: person.name || person.original_name || 'Unknown contributor',
                role,
                biography: biography.trim() || 'Biography details are not available for this contributor yet.',
                profile: personData.profile_path ? `https://image.tmdb.org/t/p/w185${personData.profile_path}` : 'https://placehold.co/180x220/17171d/ffffff?text=Person'
              };
            } catch {
              return null;
            }
          })
        );

        const seoDescription = `Watch ${title} (${year}) on JinFlix through available embedded providers. Explore its ${genres.toLowerCase()} story, cast, and TMDb rating. Playback availability depends on the provider.`;

        setPageMeta({ title: `Watch ${title} | JinFlix`, description: seoDescription });

        setMovie({
          id: item.id,
          title,
          year,
          genre: genres,
          overview: item.overview || 'No overview available.',
          poster: buildPosterUrl(item.poster_path),
          backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : '',
          backdropPath: item.backdrop_path || '',
          rating: item.vote_average ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
          tagline: item.tagline || 'Explore the story behind this title.',
          releaseDate: item.release_date || item.first_air_date || 'N/A',
          runtime,
          originalLanguage: item.original_language ? item.original_language.toUpperCase() : 'N/A',
          budget: formatCurrency(item.budget),
          cost: formatCurrency(item.budget),
          providers: providers.map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name,
            logo: provider.logo_path ? `https://image.tmdb.org/t/p/w92${provider.logo_path}` : ''
          })),
          totalEpisodes: item.number_of_episodes,
          trailerKey: trailer?.key || '',
          type
        });

        const cleanedContributors = peopleDetails
          .filter(Boolean)
          .filter((person, index, arr) => arr.findIndex((item) => item.id === person.id) === index);

        setContributors(cleanedContributors);
        setContributorsLoading(false);
      } catch (err) {
        console.error('Error fetching movie details:', err);
        setContributorsLoading(false);
        setError('Could not load movie details right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id, type]);

  if (loading) {
    return (
      <div className="detail-page loading-detail-page">
        <div className="loading-shell" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Loading details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="detail-page"><p>{error}</p><Link to="/" className="back-link">Back to home</Link></div>;
  }

  if (!movie) {
    return <div className="detail-page"><p>Movie not found.</p><Link to="/" className="back-link">Back to home</Link></div>;
  }

  return (
    <div className="detail-page">
      <div className="detail-page-hero" style={{ backgroundImage: movie.backdrop ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url(${movie.backdrop})` : 'none' }}>
        <div className="detail-page-content">
          <div className="detail-page-poster-wrap">
            <img src={movie.poster} alt={movie.title} className="detail-page-poster" loading="lazy" decoding="async" />
          </div>

          <div className="detail-page-info">
            <span className="detail-page-tag">{movie.type === 'tv' ? 'Series' : 'Movie'}</span>
            <h1>{movie.title}</h1>
            <div className="detail-page-meta">
              <span>{movie.year}</span>
              <span>{movie.genre}</span>
              <span className="detail-rating">
                <FaStar className="star-icon" />
                {movie.rating}
              </span>
            </div>
            {movie.tagline ? <p className="detail-page-tagline">“{movie.tagline}”</p> : null}
            <p>{movie.overview}</p>

            {movie.providers && movie.providers.length > 0 ? (
              <div className="provider-section">
                <span className="provider-label">Where to watch</span>
                <div className="provider-row">
                  {movie.providers.map((provider) => (
                    <span key={provider.id} className="provider-chip">
                      {provider.logo ? <img src={provider.logo} alt={provider.name} className="provider-logo" /> : null}
                      {provider.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="detail-info-grid">
              <div>
                <span>Genre</span>
                <strong>{movie.genre}</strong>
              </div>
              <div>
                <span>Release date</span>
                <strong>{movie.releaseDate}</strong>
              </div>
              <div>
                <span>Runtime</span>
                <strong>{movie.runtime}</strong>
              </div>
              <div>
                <span>Budget</span>
                <strong>{movie.budget || movie.cost || 'N/A'}</strong>
              </div>
              <div>
                <span>Language</span>
                <strong>{movie.originalLanguage}</strong>
              </div>
            </div>

            <div className="detail-page-actions">
              <Link to="/" className="back-link">Back to home</Link>
            </div>
          </div>
        </div>
      </div>

      <section className="detail-author-section">
        <div className="section-header">
          <h2>Movie player</h2>
        </div>
        <MoviePlayer
          tmdbId={movie.id}
          mediaType={movie.type}
          movieTitle={movie.title}
          totalEpisodes={movie.totalEpisodes}
        />
      </section>

      {movie.trailerKey ? (
        <section id="trailer" className="detail-author-section" aria-labelledby="movie-trailer-heading">
          <div className="section-header">
            <h2 id="movie-trailer-heading">Official Trailer</h2>
          </div>
          <div className="detail-trailer-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${movie.trailerKey}`}
              title={`${movie.title} official trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      <section className="detail-author-section">
        <div className="section-header">
          <h2>Cast & creators</h2>
        </div>

        {contributorsLoading ? (
          <div className="contributors-loading" aria-live="polite">
            <div className="mini-spinner" aria-hidden="true" />
            <span>Loading cast & creators...</span>
          </div>
        ) : contributors.length > 0 ? (
          <div className="detail-author-grid">
            {contributors.map((person) => {
              const shouldTruncate = person.biography.length > 220;
              const bioText = shouldTruncate ? `${person.biography.slice(0, 220)}...` : person.biography;

              return (
                <article key={person.id} className="detail-author-card">
                  <img src={person.profile} alt={person.name} className="detail-author-image" />
                  <div className="detail-author-content">
                    <div className="detail-author-head">
                      <h3>{person.name}</h3>
                      <span>{person.role}</span>
                    </div>
                    <p className="bio-text">{bioText}</p>
                    {shouldTruncate ? (
                      <button
                        type="button"
                        className="read-more-button"
                        onClick={() => setSelectedPerson(person)}
                      >
                        Read more
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">Contributor biographies are not available for this title.</p>
        )}
      </section>

      {selectedPerson ? (
        <div className="bio-modal-backdrop" onClick={() => setSelectedPerson(null)}>
          <div className="bio-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="bio-modal-close" onClick={() => setSelectedPerson(null)} aria-label="Close biography">
              ×
            </button>
            <div className="bio-modal-header">
              <img src={selectedPerson.profile} alt={selectedPerson.name} className="bio-modal-image" />
              <div>
                <h3>{selectedPerson.name}</h3>
                <span>{selectedPerson.role}</span>
              </div>
            </div>
            <p>{selectedPerson.biography || 'Biography details are not available for this contributor yet.'}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MovieDetailPage;
