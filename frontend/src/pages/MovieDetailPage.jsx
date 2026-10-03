import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import { Play, Film, Bookmark, ArrowLeft } from 'lucide-react';
import { useMediaState } from '../context/mediaState';
import { getMediaDetails } from '../api/media';
import { createRequestGuard, isAbortError } from '../api/requestGuard';
import usePageMeta from '../hooks/usePageMeta';
import './MovieDetailPage.css';

const FALLBACK_POSTER = 'https://placehold.co/500x750/17171d/ffffff?text=Movie';
const FALLBACK_PROFILE = 'https://placehold.co/180x220/17171d/ffffff?text=Person';

/**
 * Accepts the numeric `runtime_minutes` the backend provides, and still copes
 * with the pre-migration display string ("139 min", "42 min/ep") that older
 * cached payloads and `src/Movies.json` carry.
 */
function formatRuntime(minutes) {
  const totalMinutes = typeof minutes === 'number' ? minutes : Number.parseInt(minutes, 10);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export default function MovieDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { isBookmarked, toggleBookmark } = useMediaState();
  const bookmarked = isBookmarked({ id, type: 'movie' });

  usePageMeta(
    movie ? `${movie.title} (${movie.year}) | JinFlix` : 'Movie Details | JinFlix',
    movie?.overview || 'Explore movie details, cast, and streaming options on JinFlix.'
  );

  const guard = useMemo(() => createRequestGuard(), []);
  useEffect(() => () => guard.abort(), [guard]);

  useEffect(() => {
    if (!id) return undefined;

    const signal = guard.start();
    let active = true;

    setLoading(true);
    setError('');
    setMovie(null);

    getMediaDetails('movie', id, { signal })
      .then((data) => {
        if (active) setMovie(data);
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setError('We could not load this movie.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, guard]);

  if (loading) {
    return (
      <main className="movie-detail-page">
        <div className="movie-state" role="status">
          <div className="movie-spinner" aria-hidden="true" />
          <p>Loading movie details...</p>
        </div>
      </main>
    );
  }

  if (error || !movie) {
    return (
      <main className="movie-detail-page">
        <div className="movie-state" role="alert">
          <p>{error || 'This movie is unavailable.'}</p>
          <Link to="/movies" className="movie-btn-secondary">Back to movies</Link>
        </div>
      </main>
    );
  }

  const runtime = formatRuntime(movie.runtime_minutes ?? movie.runtime);
  const language = movie.original_language
    ? new Intl.DisplayNames(['en'], { type: 'language' }).of(movie.original_language.toLowerCase())
    : null;

  const facts = [
    movie.crew?.Director && { label: 'Director', value: movie.crew.Director },
    movie.status && { label: 'Status', value: movie.status },
    language && { label: 'Language', value: language },
  ].filter(Boolean);

  return (
    <main className="movie-detail-page">
      <section
        className="movie-hero"
        style={movie.backdrop ? { backgroundImage: `url(${movie.backdrop})` } : undefined}
      >
        <div className="movie-hero-content">
          <div className="movie-poster-wrap">
            <img
              src={movie.poster || FALLBACK_POSTER}
              alt={`${movie.title} poster`}
              className="movie-poster"
              loading="eager"
              decoding="async"
            />
          </div>

          <div className="movie-info">
            <span className="movie-type-badge">Movie</span>
            <h1>{movie.title}</h1>
            {movie.tagline && <p className="movie-tagline">{movie.tagline}</p>}

            <div className="movie-meta">
              {movie.year && movie.year !== 'N/A' && (
                <span className="movie-meta-pill">{movie.year}</span>
              )}
              {runtime && <span className="movie-meta-pill">{runtime}</span>}
              <span className="movie-meta-pill">
                <FaStar className="star-icon" />
                {movie.rating ? `${movie.rating.toFixed(1)}/10` : 'N/A'}
              </span>
            </div>

            <p className="movie-overview">{movie.overview}</p>

            {movie.genres.length > 0 && (
              <div className="movie-genres">
                {movie.genres.map((genre) => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>
            )}

            {movie.legal_providers.length > 0 && (
              <div className="movie-genres">
                {movie.legal_providers.map((provider) => (
                  <span key={provider.id}>{provider.name}</span>
                ))}
              </div>
            )}

            <div className="movie-action-buttons">
              <button
                type="button"
                className="movie-btn-primary"
                onClick={() => navigate(`/watch/movie/${movie.tmdb_id}`)}
              >
                <Play size={18} fill="currentColor" />
                <span>Watch Now</span>
              </button>

              {movie.trailer_key && (
                <button
                  type="button"
                  className="movie-btn-secondary"
                  onClick={() => navigate(`/trailer/movie/${movie.tmdb_id}`)}
                >
                  <Film size={18} />
                  <span>Watch Trailer</span>
                </button>
              )}

              <button
                type="button"
                className={`movie-btn-icon ${bookmarked ? 'is-bookmarked' : ''}`}
                onClick={() =>
                  toggleBookmark({
                    id: movie.tmdb_id,
                    type: 'movie',
                    title: movie.title,
                    poster: movie.poster,
                    year: movie.year,
                    rating: movie.rating,
                  })
                }
                aria-pressed={bookmarked}
                aria-label={bookmarked ? 'Remove from My List' : 'Add to My List'}
                title={bookmarked ? 'Remove from My List' : 'Add to My List'}
              >
                <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>

              <button type="button" className="movie-back-link" onClick={() => navigate(-1)}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="movie-section" aria-labelledby="movie-story-heading">
        <h2 id="movie-story-heading">Story</h2>
        <div className="movie-story-grid">
          <p className="movie-story-text">{movie.overview}</p>
          {facts.length > 0 && (
            <dl className="movie-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {movie.cast.length > 0 && (
        <section className="movie-section" aria-labelledby="movie-cast-heading">
          <h2 id="movie-cast-heading">Cast</h2>
          <ul className="movie-cast-row">
            {movie.cast.map((person) => (
              <li key={person.id} className="movie-cast-card">
                <Link
                  to={`/person/${person.id}`}
                  className="movie-cast-link"
                  aria-label={`View ${person.name}'s profile`}
                >
                  <img
                    src={person.profile || FALLBACK_PROFILE}
                    alt={person.name}
                    loading="lazy"
                    decoding="async"
                  />
                  <div>
                    <h3>{person.name}</h3>
                    <p>{person.character}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}