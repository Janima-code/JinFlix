import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Play, Bookmark, Check, Star, Calendar, Film } from 'lucide-react';
import { useMediaState } from '../context/MediaStateContext';
import usePageMeta from '../hooks/usePageMeta';
import './TrailerPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'e56f5c7830c1eb10f6ff78f42d8c8544';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

function TrailerPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const isTv = type === 'tv' || type === 'series';
  const mediaType = isTv ? 'tv' : 'movie';
  const detailPath = isTv ? `/series/${id}` : `/movie/${id}`;
  const watchPath = isTv ? `/watch/tv/${id}` : `/watch/movie/${id}`;

  const [media, setMedia] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { bookmarks, toggleBookmark } = useMediaState();
  const isBookmarked = bookmarks?.some((b) => String(b.id) === String(id));

  const title = media?.title || media?.name || 'Loading Trailer...';

  usePageMeta(
    trailer ? `${title} - Official Trailer | JinFlix` : 'Official Trailer | JinFlix',
    `Watch the official ${title} trailer on JinFlix theater player.`
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setTrailer(null);
    setMedia(null);

    const fetchTrailer = async () => {
      try {
        const [detailsResponse, videosResponse] = await Promise.all([
          axios.get(`${TMDB_BASE_URL}/${mediaType}/${id}`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' },
            signal: controller.signal
          }),
          axios.get(`${TMDB_BASE_URL}/${mediaType}/${id}/videos`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' },
            signal: controller.signal
          })
        ]);
        if (controller.signal.aborted) return;

        const data = detailsResponse.data;
        setMedia(data);

        const trailers = (videosResponse.data.results || []).filter(
          (video) => video.site === 'YouTube' && video.type === 'Trailer'
        );
        const officialTrailer = trailers.find((video) => video.official) || trailers[0];

        if (officialTrailer) {
          setTrailer(officialTrailer);
        } else {
          // If no trailer, try Teaser or Clip
          const otherVideo = (videosResponse.data.results || []).find(
            (v) => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Clip')
          );
          if (otherVideo) {
            setTrailer(otherVideo);
          } else {
            setError('No official trailer is available for this title.');
          }
        }
      } catch {
        if (!controller.signal.aborted) setError('Could not load trailer at this time.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchTrailer();
    return () => controller.abort();
  }, [id, mediaType]);

  const releaseYear = (media?.release_date || media?.first_air_date || '').slice(0, 4);
  const rating = media?.vote_average ? media.vote_average.toFixed(1) : null;
  const genres = (media?.genres || []).map((g) => g.name);

  return (
    <div className="trailer-page">
      {/* Top Floating Cinema Bar */}
      <header className="trailer-topbar">
        <button
          type="button"
          onClick={() => navigate(detailPath)}
          className="trailer-back-btn"
          title={`Back to ${isTv ? 'series' : 'movie'}`}
        >
          <ArrowLeft size={16} />
          <span>Back to {isTv ? 'Series' : 'Movie'}</span>
        </button>

        <div className="trailer-header-title">
          <Film size={18} className="trailer-film-icon" />
          <h1 className="trailer-main-title">{title}</h1>
          <span className="trailer-badge">Official Trailer</span>
        </div>

        <div className="trailer-header-actions">
          <button
            type="button"
            onClick={() =>
              media &&
              toggleBookmark({
                id: media.id,
                type: mediaType,
                title,
                poster_path: media.poster_path,
              })
            }
            className={`trailer-action-btn ${isBookmarked ? 'is-bookmarked' : ''}`}
            title={isBookmarked ? 'Remove Bookmark' : 'Add to My List'}
            aria-label={isBookmarked ? 'Remove Bookmark' : 'Add to My List'}
          >
            {isBookmarked ? <Check size={16} /> : <Bookmark size={16} />}
            <span className="trailer-action-label">{isBookmarked ? 'In List' : 'Watchlist'}</span>
          </button>

          <Link to={watchPath} className="trailer-play-now-btn">
            <Play size={16} fill="currentColor" />
            <span>Watch Full {isTv ? 'Series' : 'Movie'}</span>
          </Link>
        </div>
      </header>

      {/* Main Theater View */}
      <main className="trailer-theater-stage">
        {/* Ambient Glow Backdrop */}
        {media?.backdrop_path && (
          <div
            className="trailer-ambient-glow"
            style={{ backgroundImage: `url(${IMAGE_BASE_URL}/original${media.backdrop_path})` }}
            aria-hidden="true"
          />
        )}

        <div className="trailer-theater-container">
          <div className="trailer-frame-wrapper">
            {loading ? (
              <div className="trailer-loading-state" role="status">
                <div className="trailer-spinner" />
                <p>Loading Official Trailer...</p>
              </div>
            ) : trailer ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`}
                title={`${title} official trailer`}
                className="trailer-iframe"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <div className="trailer-empty-state" role="status">
                <Film size={44} className="trailer-empty-icon" />
                <h3>No Trailer Available</h3>
                <p>{error || 'An official trailer is not available on YouTube for this title.'}</p>
                <Link to={watchPath} className="trailer-empty-cta">
                  <Play size={16} fill="currentColor" />
                  <span>Go to Movie Stream Instead</span>
                </Link>
              </div>
            )}
          </div>

          {/* Media Info Sheet Under Player */}
          {media && (
            <div className="trailer-info-card">
              {media.poster_path && (
                <img
                  src={`${IMAGE_BASE_URL}/w300${media.poster_path}`}
                  alt={title}
                  className="trailer-poster-thumb"
                  loading="lazy"
                />
              )}
              <div className="trailer-info-content">
                <div className="trailer-meta-row">
                  {rating && (
                    <span className="trailer-rating-chip">
                      <Star size={13} fill="currentColor" />
                      {rating}
                    </span>
                  )}
                  {releaseYear && (
                    <span className="trailer-year-chip">
                      <Calendar size={13} />
                      {releaseYear}
                    </span>
                  )}
                  <span className="trailer-quality-tag">ULTRA HD</span>
                  {isTv && media.number_of_seasons && (
                    <span className="trailer-season-tag">
                      {media.number_of_seasons} {media.number_of_seasons === 1 ? 'Season' : 'Seasons'}
                    </span>
                  )}
                </div>

                <h2 className="trailer-card-title">{title}</h2>

                {genres.length > 0 && (
                  <div className="trailer-genres-pills">
                    {genres.map((genre) => (
                      <span key={genre} className="trailer-genre-pill">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                <p className="trailer-overview-text">
                  {media.overview || 'No overview synopsis is available for this title.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default TrailerPage;