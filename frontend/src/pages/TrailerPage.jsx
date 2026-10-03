import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Bookmark, Check, Star, Calendar, Film } from 'lucide-react';
import { useMediaState } from '../context/mediaState';
import { getMediaDetails, toApiMediaType, toRouteSegment } from '../api/media';
import { createRequestGuard, isAbortError } from '../api/requestGuard';
import usePageMeta from '../hooks/usePageMeta';
import './TrailerPage.css';

const FALLBACK_POSTER = 'https://placehold.co/300x450/17171d/ffffff?text=No+Poster';

function TrailerPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();

  const isTv = toApiMediaType(type) === 'tv';
  const detailPath = `/${toRouteSegment(isTv ? 'tv' : 'movie')}/${id}`;
  const watchPath = `/watch/${isTv ? 'tv' : 'movie'}/${id}`;

  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { isBookmarked, toggleBookmark } = useMediaState();
  const bookmarked = isBookmarked({ id, type: isTv ? 'tv' : 'movie' });

  const title = media?.title || 'Loading Trailer...';

  usePageMeta(
    media?.trailer_key ? `${title} - Official Trailer | JinFlix` : 'Official Trailer | JinFlix',
    `Watch the official trailer for ${title} on JinFlix.`
  );

  const guard = useMemo(() => createRequestGuard(), []);
  useEffect(() => () => guard.abort(), [guard]);

  useEffect(() => {
    if (!id) return undefined;

    const signal = guard.start();
    let active = true;

    setLoading(true);
    setError('');
    setMedia(null);

    getMediaDetails(isTv ? 'tv' : 'movie', id, { signal })
      .then((data) => {
        if (!active) return;
        setMedia(data);
        if (!data.trailer_key) setError('No official trailer is available for this title.');
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setError('Could not load trailer at this time.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isTv, guard]);

  const rating = media?.rating ? media.rating.toFixed(1) : null;

  return (
    <div className="trailer-page">
      <header className="trailer-topbar">
        <button type="button" onClick={() => navigate(detailPath)} className="trailer-back-btn">
          <ArrowLeft size={16} />
          <span>Back to {isTv ? 'series' : 'movie'}</span>
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
                id: media.tmdb_id,
                type: isTv ? 'tv' : 'movie',
                title,
                poster: media.poster,
                year: media.year,
                rating: media.rating,
              })
            }
            className={`trailer-action-btn ${bookmarked ? 'is-bookmarked' : ''}`}
            title={bookmarked ? 'Remove Bookmark' : 'Add to My List'}
            aria-label={bookmarked ? 'Remove Bookmark' : 'Add to My List'}
          >
            {bookmarked ? <Check size={16} /> : <Bookmark size={16} />}
            <span className="trailer-action-label">{bookmarked ? 'In List' : 'Watchlist'}</span>
          </button>

          <Link to={watchPath} className="trailer-play-now-btn">
            <Play size={16} fill="currentColor" />
            <span>Watch Full {isTv ? 'Series' : 'Movie'}</span>
          </Link>
        </div>
      </header>

      <main className="trailer-theater-stage">
        {media?.backdrop && (
          <div
            className="trailer-ambient-glow"
            style={{ backgroundImage: `url(${media.backdrop})` }}
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
            ) : media?.trailer_key ? (
              <iframe
                src={`${media.trailer_embed}?autoplay=1&rel=0`}
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
                <p>{error || 'An official trailer is not available for this title.'}</p>
                <Link to={watchPath} className="trailer-empty-cta">
                  <Play size={16} fill="currentColor" />
                  <span>Go to the stream instead</span>
                </Link>
              </div>
            )}
          </div>

          {media && (
            <div className="trailer-info-card">
              <img
                src={media.poster || FALLBACK_POSTER}
                alt={title}
                className="trailer-poster-thumb"
                loading="lazy"
                decoding="async"
              />

              <div className="trailer-info-content">
                <div className="trailer-meta-row">
                  {rating && (
                    <span className="trailer-rating-chip">
                      <Star size={13} fill="currentColor" />
                      {rating}
                    </span>
                  )}
                  {media.year && media.year !== 'N/A' && (
                    <span className="trailer-year-chip">
                      <Calendar size={13} />
                      {media.year}
                    </span>
                  )}
                  {isTv && media.number_of_seasons > 0 && (
                    <span className="trailer-season-tag">
                      {media.number_of_seasons} {media.number_of_seasons === 1 ? 'Season' : 'Seasons'}
                    </span>
                  )}
                </div>

                <h2 className="trailer-card-title">{title}</h2>

                {media.genres.length > 0 && (
                  <div className="trailer-genres-pills">
                    {media.genres.map((genre) => (
                      <span key={genre} className="trailer-genre-pill">{genre}</span>
                    ))}
                  </div>
                )}

                <p className="trailer-overview-text">{media.overview}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default TrailerPage;