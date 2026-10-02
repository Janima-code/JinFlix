import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import { Play, Film, Bookmark, ArrowLeft } from 'lucide-react';
import { useMediaState } from '../context/MediaStateContext';
import './MovieDetailPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const FALLBACK_POSTER = 'https://placehold.co/500x750/17171d/ffffff?text=Movie';
const FALLBACK_PROFILE = 'https://placehold.co/180x220/17171d/ffffff?text=Person';

export default function MovieDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  const { bookmarks, toggleBookmark } = useMediaState();
  const isBookmarked = bookmarks?.some((b) => String(b.id) === String(id));

  useEffect(() => {
    const controller = new AbortController();
    async function fetchMovieDetails() {
      setLoading(true);
      try {
        const res = await fetch(
          `${BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setMovie(data.success === false ? null : data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch movie details:', err);
          setMovie(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    if (id) fetchMovieDetails();
    return () => controller.abort();
  }, [id]);

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

  if (!movie) {
    return (
      <main className="movie-detail-page">
        <div className="movie-state" role="alert">
          <p>We couldn't load this movie.</p>
          <button type="button" className="movie-btn-secondary" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </main>
    );
  }

  const hours = Math.floor((movie.runtime || 0) / 60);
  const minutes = (movie.runtime || 0) % 60;
  const year = movie.release_date?.slice(0, 4);
  const director = movie.credits?.crew?.find((c) => c.job === 'Director')?.name;
  const cast = (movie.credits?.cast || []).slice(0, 12);
  const hasTrailer = movie.videos?.results?.some((v) => v.site === 'YouTube');
  const language = movie.original_language
    ? new Intl.DisplayNames(['en'], { type: 'language' }).of(movie.original_language)
    : null;

  const facts = [
    director && { label: 'Director', value: director },
    movie.status && { label: 'Status', value: movie.status },
    language && { label: 'Language', value: language },
  ].filter(Boolean);

  return (
    <main className="movie-detail-page">
      <section
        className="movie-hero"
        style={{
          backgroundImage: movie.backdrop_path
            ? `url(${IMAGE_BASE_URL}/w1280${movie.backdrop_path})`
            : 'none',
        }}
      >
        <div className="movie-hero-content">
          <div className="movie-poster-wrap">
            <img
              src={movie.poster_path ? `${IMAGE_BASE_URL}/w500${movie.poster_path}` : FALLBACK_POSTER}
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
              {year && <span className="movie-meta-pill">{year}</span>}
              {movie.runtime > 0 && <span className="movie-meta-pill">{`${hours}h ${minutes}m`}</span>}
              <span className="movie-meta-pill">
                <FaStar className="star-icon" />
                {movie.vote_average ? `${movie.vote_average.toFixed(1)}/10` : 'N/A'}
              </span>
            </div>

            <p className="movie-overview">{movie.overview || 'No movie overview is available.'}</p>

            {movie.genres?.length > 0 && (
              <div className="movie-genres">
                {movie.genres.map((g) => (
                  <span key={g.id}>{g.name}</span>
                ))}
              </div>
            )}

            <div className="movie-action-buttons">
              <button
                type="button"
                className="movie-btn-primary"
                onClick={() => navigate(`/watch/movie/${id}`)}
              >
                <Play size={18} fill="currentColor" />
                <span>Watch Now</span>
              </button>

              {hasTrailer && (
                <button
                  type="button"
                  className="movie-btn-secondary"
                  onClick={() => navigate(`/trailer/movie/${id}`)}
                >
                  <Film size={18} />
                  <span>Watch Trailer</span>
                </button>
              )}

              <button
                type="button"
                className={`movie-btn-icon ${isBookmarked ? 'is-bookmarked' : ''}`}
                onClick={() =>
                  toggleBookmark({
                    id: movie.id,
                    type: 'movie',
                    title: movie.title,
                    poster_path: movie.poster_path,
                  })
                }
                aria-pressed={isBookmarked}
                aria-label={isBookmarked ? 'Remove from My List' : 'Add to My List'}
                title={isBookmarked ? 'Remove from My List' : 'Add to My List'}
              >
                <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
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
          <p className="movie-story-text">
            {movie.overview || 'No description is available yet.'}
          </p>
          {facts.length > 0 && (
            <dl className="movie-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {cast.length > 0 && (
        <section className="movie-section" aria-labelledby="movie-cast-heading">
          <h2 id="movie-cast-heading">Cast</h2>
          <ul className="movie-cast-row">
            {cast.map((person) => (
              <li key={person.id} className="movie-cast-card">
                <img
                  src={person.profile_path ? `${IMAGE_BASE_URL}/w185${person.profile_path}` : FALLBACK_PROFILE}
                  alt={person.name}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3>{person.name}</h3>
                  <p>{person.character || 'Cast member'}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}