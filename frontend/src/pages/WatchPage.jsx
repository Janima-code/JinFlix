import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Bookmark,
  Server,
  ChevronLeft,
  ChevronRight,
  Play,
  Film,
  Star,
  Calendar,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { getEpisodeProgressId, useMediaState } from '../context/mediaState';
import {
  getProviders,
  getStreamUrl,
  getMediaDetails,
  getSeasonEpisodes,
  toApiMediaType,
  toRouteSegment,
} from '../api/media';
import { createRequestGuard, isAbortError } from '../api/requestGuard';
import usePageMeta from '../hooks/usePageMeta';
import './WatchPage.css';

export default function WatchPage() {
  const { type = 'movie', id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);

  const isTv = toApiMediaType(type) === 'tv';
  const seasonNum = Number.parseInt(searchParams.get('season') || '1', 10) || 1;
  const episodeNum = Number.parseInt(searchParams.get('episode') || '1', 10) || 1;

  const [details, setDetails] = useState(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const { isBookmarked, toggleBookmark, episodeProgress, setEpisodeWatched } = useMediaState();

  const bookmarkItem = { id, type: isTv ? 'tv' : 'movie' };
  const bookmarked = isBookmarked(bookmarkItem);
  const progressKey = isTv ? getEpisodeProgressId(id, seasonNum, episodeNum) : null;
  const isWatched = progressKey ? Boolean(episodeProgress[progressKey]) : false;

  const title = details?.title || 'Loading Stream...';
  const detailPath = `/${toRouteSegment(isTv ? 'tv' : 'movie')}/${id}`;
  const trailerPath = `/trailer/${isTv ? 'tv' : 'movie'}/${id}`;
  const currentEpisode = seasonEpisodes.find((episode) => episode.episode_number === episodeNum);

  usePageMeta(
    details ? `Watch ${title}${isTv ? ` - S${seasonNum} E${episodeNum}` : ''} | JinFlix` : 'Watch Stream | JinFlix',
    details ? `Watch ${title} on JinFlix.` : 'Watch a title on JinFlix.'
  );

  const detailsGuard = useMemo(() => createRequestGuard(), []);
  const seasonGuard = useMemo(() => createRequestGuard(), []);
  const providerGuard = useMemo(() => createRequestGuard(), []);

  useEffect(() => () => {
    detailsGuard.abort();
    seasonGuard.abort();
    providerGuard.abort();
  }, [detailsGuard, seasonGuard, providerGuard]);

  useEffect(() => {
    if (!id) return undefined;

    const signal = detailsGuard.start();
    let active = true;

    setLoading(true);

    getMediaDetails(isTv ? 'tv' : 'movie', id, { signal })
      .then((data) => {
        if (active) setDetails(data);
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setDetails(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isTv, detailsGuard]);

  useEffect(() => {
    if (!isTv || !id) {
      setSeasonEpisodes([]);
      return undefined;
    }

    const signal = seasonGuard.start();
    let active = true;

    setSeasonEpisodes([]);

    getSeasonEpisodes(id, seasonNum, { signal })
      .then((data) => {
        if (active) setSeasonEpisodes(data.episodes || []);
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setSeasonEpisodes([]);
      });

    return () => {
      active = false;
    };
  }, [id, isTv, seasonNum, seasonGuard]);

  // Provider list comes from the backend, so the player and the API can never
  // drift apart.
  useEffect(() => {
    const signal = providerGuard.start();
    let active = true;

    getProviders({ signal })
      .then((list) => {
        if (active) setProviders(list);
      })
      .catch(() => {
        if (active) setProviders([]);
      });

    return () => {
      active = false;
    };
  }, [providerGuard]);

  const activeProviderId = selectedProvider ?? providers[0]?.id ?? null;

  // Resolve the embed URL server-side so templates stay out of the bundle.
  useEffect(() => {
    if (!id || !activeProviderId) return undefined;

    const signal = providerGuard.start();
    let active = true;

    setEmbedUrl('');

    getStreamUrl(
      {
        tmdbId: id,
        providerId: activeProviderId,
        mediaType: isTv ? 'tv' : 'movie',
        season: seasonNum,
        episode: episodeNum,
      },
      { signal }
    )
      .then((data) => {
        if (active) setEmbedUrl(data.embed_url);
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setEmbedUrl('');
      });

    return () => {
      active = false;
    };
  }, [id, activeProviderId, isTv, seasonNum, episodeNum, providerGuard]);

  const handleToggleWatched = () => {
    if (!isTv) return;
    setEpisodeWatched(
      {
        seriesId: id,
        seriesTitle: details?.title,
        poster: details?.poster,
        year: details?.year,
        vote_average: details?.rating,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
        episodeTitle: currentEpisode?.name,
      },
      !isWatched
    );
  };

  const goToEpisode = (nextEpisodeNum) => {
    navigate(`/watch/tv/${id}?season=${seasonNum}&episode=${nextEpisodeNum}`);
  };

  const handleFullscreen = () => {
    const frame = iframeRef.current;
    if (!frame) return;
    if (frame.requestFullscreen) frame.requestFullscreen();
    else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
  };

  const rating = details?.rating ? details.rating.toFixed(1) : null;
  const genres = details?.genres ?? [];
  const hasNextEpisode = seasonEpisodes.length === 0 || episodeNum < seasonEpisodes.length;

  return (
    <div className="watch-page">
      <header className="watch-topbar">
        <button type="button" onClick={() => navigate(detailPath)} className="watch-back-btn">
          <ArrowLeft size={16} />
          <span>Back to {isTv ? 'Series' : 'Movie'}</span>
        </button>

        <div className="watch-title-block">
          <h1 className="watch-title">{title}</h1>
          {isTv && (
            <div className="watch-submeta">
              <span className="watch-ep-pill">S{seasonNum} · E{episodeNum}</span>
              <span className="watch-ep-name">{currentEpisode?.name || `Episode ${episodeNum}`}</span>
            </div>
          )}
        </div>

        <div className="watch-controls-group">
          {isTv && (
            <div className="watch-episode-nav">
              <button
                type="button"
                onClick={() => goToEpisode(episodeNum - 1)}
                disabled={episodeNum <= 1}
                className="watch-episode-nav-btn"
                title="Previous Episode"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => goToEpisode(episodeNum + 1)}
                disabled={!hasNextEpisode}
                className="watch-episode-nav-btn"
                title="Next Episode"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="watch-server-picker">
            <Server size={14} className="watch-server-icon" />
            <select
              value={activeProviderId ?? ''}
              onChange={(event) => setSelectedProvider(event.target.value)}
              className="watch-server-select"
              aria-label="Select streaming server"
              disabled={providers.length === 0}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>

          {isTv && (
            <button
              type="button"
              onClick={handleToggleWatched}
              className={`watch-icon-btn ${isWatched ? 'is-active-watched' : ''}`}
              title={isWatched ? 'Marked as Watched' : 'Mark as Watched'}
              aria-label={isWatched ? 'Marked as Watched' : 'Mark as Watched'}
            >
              <CheckCircle size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              details &&
              toggleBookmark({
                id: Number(id),
                type: isTv ? 'tv' : 'movie',
                title,
                poster: details.poster,
                year: details.year,
                rating: details.rating,
              })
            }
            className={`watch-icon-btn ${bookmarked ? 'is-bookmarked' : ''}`}
            title={bookmarked ? 'Remove Bookmark' : 'Add to My List'}
            aria-label={bookmarked ? 'Remove Bookmark' : 'Add to My List'}
          >
            <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            className="watch-icon-btn"
            title="Fullscreen Player"
            aria-label="Fullscreen Player"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      <main className="watch-theater-area">
        {details?.backdrop && (
          <div
            className="watch-ambient-glow"
            style={{ backgroundImage: `url(${details.backdrop})` }}
            aria-hidden="true"
          />
        )}

        <div className="watch-theater-stage">
          <div className="watch-frame-box" ref={iframeRef}>
            {loading && (
              <div className="watch-loading-spinner" role="status">
                <div className="watch-spinner" />
                <p>Preparing player...</p>
              </div>
            )}

            {!loading && !embedUrl && (
              <div className="watch-loading-spinner" role="alert">
                <p>No stream source is available for this title. Try another server.</p>
              </div>
            )}

            {embedUrl && (
              <iframe
                key={`${activeProviderId}-${id}-${seasonNum}-${episodeNum}-${iframeKey}`}
                src={embedUrl}
                title={`Watch ${title}`}
                className="watch-iframe"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="origin"
              />
            )}
          </div>

          {providers.length > 0 && (
            <div className="watch-quick-servers-bar">
              <span className="watch-servers-label">
                <Server size={14} />
                <span>Servers:</span>
              </span>

              <div className="watch-server-chips-list">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`watch-server-chip ${provider.id === activeProviderId ? 'is-active' : ''}`}
                  >
                    <span className="watch-chip-name">{provider.badge || provider.name}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIframeKey((previous) => previous + 1)}
                className="watch-reload-btn"
                title="Reload Stream"
              >
                <RefreshCw size={14} />
                <span>Reload</span>
              </button>
            </div>
          )}

          {isTv && seasonEpisodes.length > 0 && (
            <section className="watch-episodes-shelf" aria-labelledby="episodes-shelf-heading">
              <div className="watch-shelf-header">
                <h2 id="episodes-shelf-heading">Season {seasonNum} Episodes</h2>
                <span className="watch-shelf-count">{seasonEpisodes.length} Episodes</span>
              </div>

              <div className="watch-episodes-carousel">
                {seasonEpisodes.map((episode) => {
                  const isCurrent = episode.episode_number === episodeNum;
                  const watched = Boolean(episodeProgress[getEpisodeProgressId(id, seasonNum, episode.episode_number)]);

                  return (
                    <button
                      key={episode.id}
                      type="button"
                      onClick={() => goToEpisode(episode.episode_number)}
                      className={`watch-ep-card ${isCurrent ? 'is-current' : ''}`}
                    >
                      <div className="watch-ep-thumb-wrap">
                        {episode.still ? (
                          <img src={episode.still} alt={episode.name} className="watch-ep-thumb" loading="lazy" />
                        ) : (
                          <div className="watch-ep-placeholder">Ep {episode.episode_number}</div>
                        )}
                        {isCurrent && (
                          <span className="watch-now-playing-badge">
                            <Play size={10} fill="currentColor" /> Playing
                          </span>
                        )}
                        {watched && !isCurrent && (
                          <span className="watch-ep-watched-tag">
                            <CheckCircle size={12} /> Watched
                          </span>
                        )}
                      </div>

                      <div className="watch-ep-card-info">
                        <strong className="watch-ep-card-title">
                          {episode.episode_number}. {episode.name}
                        </strong>
                        <span className="watch-ep-card-runtime">
                          {episode.runtime ? `${episode.runtime}m` : '—'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {details && (
            <div className="watch-details-card">
              {details.poster && (
                <img
                  src={details.poster}
                  alt={title}
                  className="watch-poster-thumb"
                  loading="lazy"
                  decoding="async"
                />
              )}

              <div className="watch-details-info">
                <div className="watch-meta-strip">
                  {rating && (
                    <span className="watch-score-chip">
                      <Star size={13} fill="currentColor" />
                      {rating}
                    </span>
                  )}
                  {details.year && details.year !== 'N/A' && (
                    <span className="watch-year-chip">
                      <Calendar size={13} />
                      {details.year}
                    </span>
                  )}
                  {isTv && <span className="watch-tv-badge">TV Series</span>}
                </div>

                <h2 className="watch-card-title">{title}</h2>

                {genres.length > 0 && (
                  <div className="watch-genres-row">
                    {genres.map((genre) => (
                      <span key={genre} className="watch-genre-pill">{genre}</span>
                    ))}
                  </div>
                )}

                <p className="watch-overview-synopsis">{details.overview}</p>

                <div className="watch-card-actions">
                  {details.trailer_key && (
                    <Link to={trailerPath} className="watch-trailer-btn">
                      <Film size={16} />
                      <span>Watch Trailer</span>
                    </Link>
                  )}
                  <Link to={detailPath} className="watch-moreinfo-btn">
                    <span>Full Details & Cast</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="watch-footer-note">
        <span>
          Playback is provided by third-party embed servers. If a stream fails, switch servers or reload it.
        </span>
      </footer>
    </div>
  );
}