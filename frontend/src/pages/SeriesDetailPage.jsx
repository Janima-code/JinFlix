import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import { Play, Film, Bookmark, ArrowLeft, Check, Clock, Calendar } from 'lucide-react';
import MediaRow from '../components/MediaRow';
import { getEpisodeProgressId, useMediaState } from '../context/mediaState';
import { getMediaDetails, getSeasonEpisodes, getRecommendations } from '../api/media';
import { createRequestGuard, isAbortError } from '../api/requestGuard';
import usePageMeta from '../hooks/usePageMeta';
import './SeriesDetailPage.css';

const FALLBACK_POSTER = 'https://placehold.co/500x750/17171d/ffffff?text=Series';
const FALLBACK_STILL = 'https://placehold.co/640x360/17171d/ffffff?text=No+Episode+Still';
const FALLBACK_PROFILE = 'https://placehold.co/180x220/17171d/ffffff?text=Person';

function formatYears(series) {
  const startYear = series.release_date?.slice(0, 4);
  const lastYear = series.last_air_date?.slice(0, 4);
  if (!startYear) return 'Release years unavailable';

  const isReturning = ['Returning Series', 'In Production'].includes(series.status);
  const endYear = isReturning ? 'Present' : lastYear || startYear;
  return startYear === endYear ? startYear : `${startYear} - ${endYear}`;
}

function SeriesDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { isBookmarked, toggleBookmark, episodeProgress, setEpisodeWatched } = useMediaState();
  const bookmarked = isBookmarked({ id, type: 'tv' });

  // Deep links from Continue Watching / the player may target one episode.
  const requestedSeason = Number(searchParams.get('season') ?? searchParams.get('s'));
  const requestedEpisode = Number(searchParams.get('episode') ?? searchParams.get('e'));
  const hasRequestedSeason = Number.isInteger(requestedSeason);

  const [series, setSeries] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [error, setError] = useState('');
  const [seasonError, setSeasonError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  // Which episode "Watch Now" opens when no episode is deep-linked.
  const [fallbackEpisode, setFallbackEpisode] = useState(1);

  usePageMeta(
    series ? `Watch ${series.title} | JinFlix` : 'Series Details | JinFlix',
    series?.overview || 'Explore series details, seasons, and episode guides on JinFlix.'
  );

  const detailsGuard = useMemo(() => createRequestGuard(), []);
  const seasonGuard = useMemo(() => createRequestGuard(), []);
  const supportGuard = useMemo(() => createRequestGuard(), []);

  useEffect(() => () => {
    detailsGuard.abort();
    seasonGuard.abort();
    supportGuard.abort();
  }, [detailsGuard, seasonGuard, supportGuard]);

  // Series details drive the season list, so the requested season is validated here.
  useEffect(() => {
    if (!id) return undefined;

    const signal = detailsGuard.start();
    let active = true;

    setDetailsLoading(true);
    setError('');
    setSeries(null);
    setSelectedSeason(null);
    setEpisodes([]);

    getMediaDetails('tv', id, { signal })
      .then((data) => {
        if (!active) return;

        setSeries(data);
        const seasons = data.seasons || [];
        const targetExists = hasRequestedSeason
          && seasons.some((season) => season.season_number === requestedSeason);
        const firstSeason = seasons.find((season) => season.season_number === 1) || seasons[0];

        setSelectedSeason(targetExists ? requestedSeason : firstSeason?.season_number ?? 0);
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setError('Could not load series details right now.');
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, requestedSeason, hasRequestedSeason, detailsGuard]);

  // Recommendations are supplementary, so a failure must not break the page.
  useEffect(() => {
    if (!id) return undefined;

    const signal = supportGuard.start();
    let active = true;

    setSupportLoading(true);
    setRecommendations([]);

    getRecommendations('tv', id, { signal })
      .then((items) => {
        if (active) setRecommendations(items);
      })
      .catch(() => {
        if (active) setRecommendations([]);
      })
      .finally(() => {
        if (active) setSupportLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, supportGuard]);

  useEffect(() => {
    if (!id || selectedSeason === null) return undefined;

    const signal = seasonGuard.start();
    let active = true;

    setEpisodes([]);
    setEpisodesLoading(true);
    setSeasonError('');

    getSeasonEpisodes(id, selectedSeason, { signal })
      .then((data) => {
        if (!active) return;

        const seasonEpisodes = data.episodes || [];
        setEpisodes(seasonEpisodes);

        const episodeExists = selectedSeason === requestedSeason
          && seasonEpisodes.some((episode) => episode.episode_number === requestedEpisode);
        if (!episodeExists) {
          setFallbackEpisode(seasonEpisodes[0]?.episode_number ?? 1);
        }
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setSeasonError('Could not load episodes for this season.');
      })
      .finally(() => {
        if (active) setEpisodesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, selectedSeason, requestedSeason, requestedEpisode, seasonGuard]);

  if (detailsLoading) {
    return (
      <main className="detail-page loading-detail-page">
        <div className="loading-shell" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Loading series details...</p>
        </div>
      </main>
    );
  }

  if (error || !series) {
    return (
      <main className="detail-page series-detail-page">
        <p role="alert">{error || 'Series not found.'}</p>
        <Link to="/series" className="back-link">Back to series</Link>
      </main>
    );
  }

  const seasons = series.seasons || [];
  const title = series.title;
  const isReturning = ['Returning Series', 'In Production'].includes(series.status);

  const watchedCountBySeason = Object.values(episodeProgress).reduce((counts, progress) => {
    if (String(progress.seriesId) === String(series.tmdb_id)) {
      counts[progress.seasonNumber] = (counts[progress.seasonNumber] || 0) + 1;
    }
    return counts;
  }, {});

  const watchedInSeason = watchedCountBySeason[selectedSeason] || 0;
  const seasonPercent = Math.round((watchedInSeason / Math.max(1, episodes.length)) * 100);
  const nextEpisode = series.next_episode_to_air;

  return (
    <main className="detail-page series-detail-page">
      <section
        className="detail-page-hero series-hero"
        style={series.backdrop ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.58), rgba(0,0,0,0.8)), url(${series.backdrop})` } : undefined}
      >
        <div className="detail-page-content series-hero-content">
          <div className="detail-page-poster-wrap series-poster-wrap">
            <img
              src={series.poster || FALLBACK_POSTER}
              alt={`${title} poster`}
              className="detail-page-poster"
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="detail-page-info series-info">
            <span className="detail-page-tag series-type-badge">Series</span>
            <h1>{title}</h1>
            <div className="detail-page-meta">
              <span className="series-year-range">{formatYears(series)}</span>
              <span className="series-status">{isReturning ? 'Returning' : 'Ended'}</span>
              <span className="series-season-count">{series.number_of_seasons || seasons.length} seasons</span>
              <span className="detail-rating series-rating-badge">
                <FaStar className="star-icon" />
                {series.rating ? `${series.rating.toFixed(1)}/10` : 'N/A'}
              </span>
            </div>
            <p className="series-overview">{series.overview}</p>
            <div className="series-detail-genres">
              <span>Genres</span>
              <strong>{series.genres.length ? series.genres.join(', ') : 'Unavailable'}</strong>
            </div>
            <div className="series-action-buttons">
              <button
                type="button"
                onClick={() => navigate(`/watch/tv/${series.tmdb_id}?season=${selectedSeason}&episode=${fallbackEpisode}`)}
                className="series-btn-primary"
                title={`Watch Season ${selectedSeason}, Episode ${fallbackEpisode}`}
              >
                <Play size={18} fill="currentColor" />
                <span>Watch Now</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/trailer/tv/${series.tmdb_id}`)}
                className="series-btn-secondary"
                title="Watch Series Trailer"
              >
                <Film size={18} />
                <span>Watch Trailer</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleBookmark({
                    id: series.tmdb_id,
                    type: 'tv',
                    title,
                    poster: series.poster,
                    year: series.year,
                    rating: series.rating,
                  })
                }
                className={`series-btn-icon ${bookmarked ? 'is-bookmarked' : ''}`}
                title={bookmarked ? 'Remove from My List' : 'Add to My List'}
                aria-label={bookmarked ? 'Remove from My List' : 'Add to My List'}
              >
                <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>

              <Link to="/series" className="series-back-link">
                <ArrowLeft size={16} />
                <span>Back to series</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="series-episodes-section" aria-labelledby="series-episodes-heading">
        <div className="series-episodes-heading">
          <div className="episodes-header-left">
            <h2 id="series-episodes-heading">Episodes</h2>
            <p className="series-episode-total">
              {series.number_of_episodes || episodes.length} episodes across {seasons.length} season{seasons.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="series-season-picker-wrap">
            <select
              value={selectedSeason ?? ''}
              onChange={(event) => {
                setSelectedSeason(Number(event.target.value));
                setFallbackEpisode(1);
              }}
              className="series-season-select-dropdown"
              aria-label="Select season"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.season_number}>
                  {season.name} ({season.episode_count || 0} eps)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="series-season-tabs-bar">
          <div className="series-season-tabs">
            {seasons.map((season) => {
              const isSelected = selectedSeason === season.season_number;
              const seasonWatched = watchedCountBySeason[season.season_number] || 0;
              const isFullyWatched = season.episode_count > 0 && seasonWatched >= season.episode_count;

              return (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => {
                    setSelectedSeason(season.season_number);
                    setFallbackEpisode(1);
                  }}
                  className={`season-tab-pill ${isSelected ? 'is-active-season' : ''}`}
                >
                  <span>{season.name}</span>
                  {isFullyWatched ? (
                    <span className="season-pill-badge is-completed">✓</span>
                  ) : seasonWatched > 0 ? (
                    <span className="season-pill-badge">{seasonWatched}/{season.episode_count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="selected-season-status-card">
          <div className="season-status-top">
            <div className="season-status-meta">
              <span className="season-badge-tag">Season {selectedSeason}</span>
              <strong className="season-status-title">
                {seasons.find((season) => season.season_number === selectedSeason)?.name}
              </strong>
            </div>
            <div className="season-progress-label">
              <span>{watchedInSeason} of {episodes.length} Watched</span>
              <span className="season-percent-pill">{seasonPercent}%</span>
            </div>
          </div>

          <div
            className="season-progress-track"
            role="progressbar"
            aria-label={`Season ${selectedSeason} progress`}
            aria-valuemin={0}
            aria-valuemax={episodes.length}
            aria-valuenow={watchedInSeason}
          >
            <div className="season-progress-fill" style={{ width: `${seasonPercent}%` }} />
          </div>
        </div>

        {episodesLoading ? (
          <div className="series-episodes-grid skeleton-grid" role="status">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="series-episode-card is-loading-card">
                <div className="episode-thumbnail-wrap skeleton-box" />
                <div className="episode-content skeleton-box" />
              </div>
            ))}
          </div>
        ) : seasonError ? (
          <p className="empty-state" role="alert">{seasonError}</p>
        ) : episodes.length > 0 ? (
          <div className="series-episodes-grid">
            {episodes.map((episode) => {
              const progressKey = getEpisodeProgressId(series.tmdb_id, selectedSeason, episode.episode_number);
              const watched = Boolean(episodeProgress[progressKey]);
              const watchPath = `/watch/tv/${series.tmdb_id}?season=${selectedSeason}&episode=${episode.episode_number}`;

              return (
                <article key={episode.id} className={`series-episode-card ${watched ? 'is-watched' : ''}`}>
                  <Link
                    to={watchPath}
                    className="episode-thumbnail-wrap"
                    aria-label={`Play episode ${episode.episode_number}: ${episode.name}`}
                  >
                    <img
                      src={episode.still || FALLBACK_STILL}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />

                    <span className="episode-play-overlay" aria-hidden="true">
                      <span className="episode-play-icon">
                        <Play size={22} fill="currentColor" />
                      </span>
                    </span>

                    <span className="episode-thumb-top-badges">
                      <span className="episode-number-badge">EP {episode.episode_number}</span>
                      {watched && (
                        <span className="episode-watched-badge">
                          <Check size={12} /> Watched
                        </span>
                      )}
                    </span>

                    {episode.runtime ? (
                      <span className="episode-runtime-badge">
                        <Clock size={11} /> {episode.runtime}m
                      </span>
                    ) : null}
                  </Link>

                  <div className="episode-content">
                    <div className="episode-title-row">
                      <h4 className="episode-title">
                        <Link to={watchPath}>
                          <span className="episode-number">{episode.episode_number}.</span>{' '}
                          {episode.name}
                        </Link>
                      </h4>
                    </div>

                    <div className="episode-meta-row">
                      {episode.air_date && (
                        <span className="episode-air-date">
                          <Calendar size={12} /> {episode.air_date}
                        </span>
                      )}
                      {episode.vote_average > 0 && (
                        <span className="episode-rating">★ {episode.vote_average.toFixed(1)}</span>
                      )}
                    </div>

                    <p className="episode-overview">{episode.overview}</p>

                    <div className="episode-actions-row">
                      <button
                        type="button"
                        onClick={() => navigate(watchPath)}
                        className="episode-watch-now-btn"
                        title={`Watch Episode ${episode.episode_number}`}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Watch Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFallbackEpisode(episode.episode_number);
                          setEpisodeWatched(
                            {
                              seriesId: series.tmdb_id,
                              seriesTitle: title,
                              poster: series.poster || FALLBACK_POSTER,
                              year: series.year,
                              genre: series.genres.join(', '),
                              vote_average: series.rating,
                              seasonNumber: selectedSeason,
                              episodeNumber: episode.episode_number,
                              episodeTitle: episode.name,
                              episodeCountInSeason: episodes.length,
                              seasonNumbers: seasons.map((season) => season.season_number),
                              totalSeasons: series.number_of_seasons,
                            },
                            !watched
                          );
                        }}
                        className={`episode-watched-btn ${watched ? 'is-active' : ''}`}
                        title={watched ? 'Mark as unwatched' : 'Mark as watched'}
                      >
                        <Check size={14} />
                        <span>{watched ? 'Watched' : 'Mark Watched'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">No episodes are listed for this season.</p>
        )}
      </section>

      <section className="series-support-section" aria-labelledby="next-episode-heading">
        <h2 id="next-episode-heading">Next Episode to Air</h2>
        {nextEpisode ? (
          <article className="series-next-episode">
            <img
              src={nextEpisode.still || FALLBACK_STILL}
              alt={`${nextEpisode.name} still`}
              loading="lazy"
              decoding="async"
            />
            <div>
              <p className="series-support-kicker">
                Season {nextEpisode.season_number}, Episode {nextEpisode.episode_number}
              </p>
              <h3>{nextEpisode.name || 'Episode title unavailable'}</h3>
              <p>{nextEpisode.air_date || 'Air date unavailable'}</p>
              <p>{nextEpisode.overview}</p>
            </div>
          </article>
        ) : (
          <p className="series-support-empty">No upcoming episode is listed.</p>
        )}
      </section>

      <section className="series-support-section" aria-labelledby="series-cast-heading">
        <h2 id="series-cast-heading">Cast</h2>
        {supportLoading ? (
          <p className="series-support-empty series-support-loading" role="status">Loading cast...</p>
        ) : series.cast.length > 0 ? (
          <div className="detail-author-grid series-cast-grid">
            {series.cast.map((person) => (
              <article key={person.id} className="detail-author-card series-cast-card">
                <Link
                  to={`/person/${person.id}`}
                  className="detail-author-link"
                  aria-label={`View ${person.name}'s profile`}
                >
                  <img
                    src={person.profile || FALLBACK_PROFILE}
                    alt={person.name}
                    className="detail-author-image"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="detail-author-content">
                    <div className="detail-author-head">
                      <h3>{person.name}</h3>
                      <span>{person.character}</span>
                    </div>
                    {person.total_episode_count ? (
                      <p>{person.total_episode_count} episodes</p>
                    ) : null}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="series-support-empty">Cast details are unavailable.</p>
        )}
      </section>

      <MediaRow
        id="series-recommendations"
        title="More Like This"
        items={recommendations}
        loading={supportLoading}
        emptyMessage="No similar series are available."
      />
    </main>
  );
}

export default SeriesDetailPage;