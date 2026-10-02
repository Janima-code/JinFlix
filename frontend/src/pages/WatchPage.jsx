import { useState, useEffect, useRef } from 'react';
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
import { useMediaState, getEpisodeProgressId } from '../context/MediaStateContext';
import usePageMeta from '../hooks/usePageMeta';
import './WatchPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'e56f5c7830c1eb10f6ff78f42d8c8544';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Available embed provider sources using TMDB IDs
const EMBED_SERVERS = [
  {
    id: 'vidsrc-pm',
    name: 'Server 1 (Alpha / VidSrc PM)',
    badge: 'Alpha',
    getMovieUrl: (id) => `https://vidsrc.pm/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidlink',
    name: 'Server 2 (Beta / VidLink)',
    badge: 'Beta',
    getMovieUrl: (id) => `https://vidlink.pro/movie/${id}?primaryColor=ef3947`,
    getTvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=ef3947`,
  },
  {
    id: 'vidsrc-cc',
    name: 'Server 3 (VidSrc CC)',
    badge: 'Fast',
    getMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'autoembed',
    name: 'Server 4 (AutoEmbed)',
    badge: 'Multi-Sub',
    getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'smashystream',
    name: 'Server 5 (SmashyStream)',
    badge: 'Mirror',
    getMovieUrl: (id) => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    getTvUrl: (id, s, e) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
  },
];

export default function WatchPage() {
  const { type = 'movie', id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);

  const isTv = type === 'tv' || type === 'series';
  const mediaType = isTv ? 'tv' : 'movie';

  const seasonNum = parseInt(searchParams.get('season') || '1', 10);
  const episodeNum = parseInt(searchParams.get('episode') || '1', 10);

  const [details, setDetails] = useState(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [selectedServer, setSelectedServer] = useState(EMBED_SERVERS[0].id);
  const [loading, setLoading] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const { bookmarks, toggleBookmark, episodeProgress, setEpisodeWatched } = useMediaState();

  const isBookmarked = bookmarks?.some((b) => String(b.id) === String(id));
  const progressKey = isTv ? getEpisodeProgressId(id, seasonNum, episodeNum) : null;
  const isWatched = progressKey ? !!episodeProgress[progressKey] : false;

  const title = details?.title || details?.name || 'Loading Stream...';
  const detailPath = isTv ? `/series/${id}` : `/movie/${id}`;
  const trailerPath = isTv ? `/trailer/tv/${id}` : `/trailer/movie/${id}`;

  const currentEpisodeObj = seasonEpisodes.find((ep) => ep.episode_number === episodeNum);
  const episodeTitle = currentEpisodeObj?.name || `Episode ${episodeNum}`;

  usePageMeta(
    details ? `Watch ${title}${isTv ? ` - S${seasonNum} E${episodeNum}` : ''} | JinFlix` : 'Watch Stream | JinFlix',
    `Watch ${title} on JinFlix dedicated stream player.`
  );

  // Fetch core media details
  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/${mediaType}/${id}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        console.error('Error fetching media details:', err);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchDetails();
  }, [mediaType, id]);

  // Fetch episodes for TV season
  useEffect(() => {
    if (!isTv || !id) return;
    async function fetchSeason() {
      try {
        const res = await fetch(`${BASE_URL}/tv/${id}/season/${seasonNum}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        setSeasonEpisodes(data.episodes || []);
      } catch (err) {
        console.warn('Could not load season episodes:', err);
      }
    }
    fetchSeason();
  }, [id, isTv, seasonNum]);

  const activeServerObj = EMBED_SERVERS.find((s) => s.id === selectedServer) || EMBED_SERVERS[0];

  const iframeSrc = isTv
    ? activeServerObj.getTvUrl(id, seasonNum, episodeNum)
    : activeServerObj.getMovieUrl(id);

  const handleToggleWatched = () => {
    if (!isTv) return;
    setEpisodeWatched(
      {
        seriesId: id,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
        title: episodeTitle,
      },
      !isWatched
    );
  };

  const handlePrevEpisode = () => {
    if (episodeNum > 1) {
      navigate(`/watch/tv/${id}?season=${seasonNum}&episode=${episodeNum - 1}`);
    }
  };

  const handleNextEpisode = () => {
    navigate(`/watch/tv/${id}?season=${seasonNum}&episode=${episodeNum + 1}`);
  };

  const handleReloadIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      } else if (iframeRef.current.webkitRequestFullscreen) {
        iframeRef.current.webkitRequestFullscreen();
      }
    }
  };

  const releaseYear = (details?.release_date || details?.first_air_date || '').slice(0, 4);
  const rating = details?.vote_average ? details.vote_average.toFixed(1) : null;
  const genres = (details?.genres || []).map((g) => g.name);

  return (
    <div className={`watch-page ${theaterMode ? 'is-theater-mode' : ''}`}>
      {/* Top Floating Control Bar */}
      <header className="watch-topbar">
        <button
          type="button"
          onClick={() => navigate(detailPath)}
          className="watch-back-btn"
          title={`Back to ${isTv ? 'series' : 'movie'}`}
        >
          <ArrowLeft size={16} />
          <span>Back to {isTv ? 'Series' : 'Movie'}</span>
        </button>

        <div className="watch-title-block">
          <h1 className="watch-title">{title}</h1>
          {isTv && (
            <div className="watch-submeta">
              <span className="watch-ep-pill">S{seasonNum} · E{episodeNum}</span>
              <span className="watch-ep-name">{episodeTitle}</span>
            </div>
          )}
        </div>

        <div className="watch-controls-group">
          {/* Episode Quick Switcher (Prev/Next) */}
          {isTv && (
            <div className="watch-episode-nav">
              <button
                type="button"
                onClick={handlePrevEpisode}
                disabled={episodeNum <= 1}
                className="watch-episode-nav-btn"
                title="Previous Episode"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNextEpisode}
                disabled={seasonEpisodes.length > 0 && episodeNum >= seasonEpisodes.length}
                className="watch-episode-nav-btn"
                title="Next Episode"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Server Selector Dropdown */}
          <div className="watch-server-picker">
            <Server size={14} className="watch-server-icon" />
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="watch-server-select"
              aria-label="Select streaming server"
            >
              {EMBED_SERVERS.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </div>

          {/* Watched Toggle (TV Shows) */}
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

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={() =>
              details &&
              toggleBookmark({
                id,
                type: mediaType,
                title,
                poster_path: details.poster_path,
              })
            }
            className={`watch-icon-btn ${isBookmarked ? 'is-bookmarked' : ''}`}
            title={isBookmarked ? 'Remove Bookmark' : 'Add to My List'}
            aria-label={isBookmarked ? 'Remove Bookmark' : 'Add to My List'}
          >
            <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>

          {/* Fullscreen Button */}
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

      {/* Main Theater Player Area */}
      <main className="watch-theater-area">
        {/* Ambient Glow from Backdrop */}
        {details?.backdrop_path && (
          <div
            className="watch-ambient-glow"
            style={{ backgroundImage: `url(${IMAGE_BASE_URL}/original${details.backdrop_path})` }}
            aria-hidden="true"
          />
        )}

        <div className="watch-theater-stage">
          {/* Cinema Player Container */}
          <div className="watch-frame-box" ref={iframeRef}>
            {loading && (
              <div className="watch-loading-spinner" role="status">
                <div className="watch-spinner" />
                <p>Connecting to {activeServerObj.name}...</p>
              </div>
            )}

            <iframe
              key={`${selectedServer}-${id}-${seasonNum}-${episodeNum}-${iframeKey}`}
              src={iframeSrc}
              title={`Watch ${title}`}
              className="watch-iframe"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="origin"
            />
          </div>

          {/* Quick Server Switcher Pills */}
          <div className="watch-quick-servers-bar">
            <span className="watch-servers-label">
              <Server size={14} />
              <span>Servers:</span>
            </span>

            <div className="watch-server-chips-list">
              {EMBED_SERVERS.map((server) => {
                const isActive = server.id === selectedServer;
                return (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => setSelectedServer(server.id)}
                    className={`watch-server-chip ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="watch-chip-name">{server.badge}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleReloadIframe}
              className="watch-reload-btn"
              title="Reload Stream"
            >
              <RefreshCw size={14} />
              <span>Reload</span>
            </button>
          </div>

          {/* TV Episodes Carousel (TV Series only) */}
          {isTv && seasonEpisodes.length > 0 && (
            <section className="watch-episodes-shelf" aria-labelledby="episodes-shelf-heading">
              <div className="watch-shelf-header">
                <h2 id="episodes-shelf-heading">Season {seasonNum} Episodes</h2>
                <span className="watch-shelf-count">{seasonEpisodes.length} Episodes</span>
              </div>

              <div className="watch-episodes-carousel">
                {seasonEpisodes.map((ep) => {
                  const isCurrent = ep.episode_number === episodeNum;
                  const epWatched = !!episodeProgress[getEpisodeProgressId(id, seasonNum, ep.episode_number)];

                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => navigate(`/watch/tv/${id}?season=${seasonNum}&episode=${ep.episode_number}`)}
                      className={`watch-ep-card ${isCurrent ? 'is-current' : ''}`}
                    >
                      <div className="watch-ep-thumb-wrap">
                        {ep.still_path ? (
                          <img
                            src={`${IMAGE_BASE_URL}/w300${ep.still_path}`}
                            alt={ep.name}
                            className="watch-ep-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div className="watch-ep-placeholder">Ep {ep.episode_number}</div>
                        )}
                        {isCurrent && (
                          <span className="watch-now-playing-badge">
                            <Play size={10} fill="currentColor" /> Playing
                          </span>
                        )}
                        {epWatched && !isCurrent && (
                          <span className="watch-ep-watched-tag">
                            <CheckCircle size={12} /> Watched
                          </span>
                        )}
                      </div>

                      <div className="watch-ep-card-info">
                        <strong className="watch-ep-card-title">
                          {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                        </strong>
                        <span className="watch-ep-card-runtime">
                          {ep.runtime ? `${ep.runtime}m` : '45m'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Media Info & Actions Card */}
          {details && (
            <div className="watch-details-card">
              {details.poster_path && (
                <img
                  src={`${IMAGE_BASE_URL}/w300${details.poster_path}`}
                  alt={title}
                  className="watch-poster-thumb"
                  loading="lazy"
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
                  {releaseYear && (
                    <span className="watch-year-chip">
                      <Calendar size={13} />
                      {releaseYear}
                    </span>
                  )}
                  <span className="watch-4k-chip">ULTRA HD 4K</span>
                  {isTv && (
                    <span className="watch-tv-badge">TV Series</span>
                  )}
                </div>

                <h2 className="watch-card-title">{title}</h2>

                {genres.length > 0 && (
                  <div className="watch-genres-row">
                    {genres.map((g) => (
                      <span key={g} className="watch-genre-pill">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="watch-overview-synopsis">
                  {details.overview || 'No synopsis is available for this title.'}
                </p>

                <div className="watch-card-actions">
                  <Link to={trailerPath} className="watch-trailer-btn">
                    <Film size={16} />
                    <span>Watch Trailer</span>
                  </Link>

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
        <span>If playback freezes or shows an error, switch servers using the quick chips above or reload the stream.</span>
      </footer>
    </div>
  );
}