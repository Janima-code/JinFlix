import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaStar } from 'react-icons/fa';
import { Play, Film, Bookmark, ArrowLeft, Check, Clock, Calendar } from 'lucide-react';
import MediaRow from '../components/MediaRow';
import { getEpisodeProgressId, useMediaState } from '../context/MediaStateContext';
import usePageMeta from '../hooks/usePageMeta';
import './SeriesDetailPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'e56f5c7830c1eb10f6ff78f42d8c8544';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const FALLBACK_POSTER = 'https://placehold.co/500x750/17171d/ffffff?text=Series';
const FALLBACK_STILL = 'https://placehold.co/640x360/17171d/ffffff?text=No+Episode+Still';
const FALLBACK_PROFILE = 'https://placehold.co/180x220/17171d/ffffff?text=Person';

function formatYears(series) {
  const startYear = series.first_air_date?.slice(0, 4);
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
  const { bookmarks, toggleBookmark, episodeProgress, setEpisodeWatched } = useMediaState();
  const isBookmarked = bookmarks?.some((b) => String(b.id) === String(id));
  const rawSeason = searchParams.get('season') || searchParams.get('s');
  const rawEpisode = searchParams.get('episode') || searchParams.get('e');
  const requestedSeason = Number(rawSeason);
  const requestedEpisode = Number(rawEpisode);
  const hasRequestedSeason = rawSeason !== null && Number.isInteger(requestedSeason);
  const [series, setSeries] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [error, setError] = useState('');
  const [seasonError, setSeasonError] = useState('');
  const [cast, setCast] = useState([]);
  const [trailer, setTrailer] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [pageMeta, setPageMeta] = useState({
    title: 'Series Details | JinFlix',
    description: 'Explore series details and episodes on JinFlix.'
  });

  usePageMeta(pageMeta.title, pageMeta.description);

  useEffect(() => {
    const controller = new AbortController();
    setDetailsLoading(true);
    setError('');
    setSeries(null);
    setSelectedSeason(null);
    setEpisodes([]);

    axios.get(`${TMDB_BASE_URL}/tv/${id}`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US' },
      signal: controller.signal
    }).then((response) => {
      const data = response.data;
      const seasons = data.seasons || [];
      const firstSeason = seasons.find((season) => season.season_number === 1) || seasons[0];
      if (controller.signal.aborted) return;

      setSeries(data);
      const requestedSeasonExists = hasRequestedSeason
        && seasons.some((season) => season.season_number === requestedSeason);
      setSelectedSeason(requestedSeasonExists ? requestedSeason : firstSeason?.season_number ?? 0);
      setPageMeta({
        title: `Watch ${data.name || data.original_name || 'Series'} | JinFlix`,
        description: `View ${data.name || data.original_name || 'this series'} details, seasons, and episode guides on JinFlix.`
      });
    }).catch(() => {
      if (!controller.signal.aborted) {
        setError('Could not load series details right now.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setDetailsLoading(false);
    });

    return () => controller.abort();
  }, [id, requestedSeason, hasRequestedSeason]);

  useEffect(() => {
    const controller = new AbortController();
    setCast([]);
    setTrailer(null);
    setRecommendations([]);
    setSupportLoading(true);

    const fetchOptional = (resource) =>
      axios.get(`${TMDB_BASE_URL}/tv/${id}/${resource}`, {
        params: { api_key: TMDB_API_KEY, language: 'en-US' },
        signal: controller.signal
      }).then((response) => response.data).catch(() => null);

    Promise.all([
      fetchOptional('aggregate_credits'),
      fetchOptional('videos'),
      fetchOptional('recommendations')
    ]).then(([credits, videos, recommendationData]) => {
      if (controller.signal.aborted) return;

      setCast((credits?.cast || []).slice(0, 12));

      const trailers = (videos?.results || []).filter((video) => video.site === 'YouTube' && video.type === 'Trailer');
      setTrailer(trailers.find((video) => video.official) || trailers[0] || null);

      const resultItems = (recommendationData?.results || []).map((item) => ({
        ...item,
        id: item.id,
        mediaType: 'series',
        Title: item.name || item.original_name || 'Untitled series',
        Year: item.first_air_date?.slice(0, 4) || 'N/A',
        Genre: '',
        Poster: item.poster_path ? `${IMAGE_BASE_URL}/w500${item.poster_path}` : FALLBACK_POSTER
      }));
      setRecommendations(resultItems);
    }).finally(() => {
      if (!controller.signal.aborted) setSupportLoading(false);
    });

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id || selectedSeason === null) return undefined;

    const controller = new AbortController();
    setEpisodes([]);
    setEpisodesLoading(true);
    setSeasonError('');

    axios.get(`${TMDB_BASE_URL}/tv/${id}/season/${selectedSeason}`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US' },
      signal: controller.signal
    }).then((response) => {
      const seasonEpisodes = response.data.episodes || [];
      if (controller.signal.aborted) return;

      setEpisodes(seasonEpisodes);
      const requestedEpisodeExists = selectedSeason === requestedSeason
        && seasonEpisodes.some((episode) => episode.episode_number === requestedEpisode);
      setSelectedEpisode(requestedEpisodeExists ? requestedEpisode : seasonEpisodes[0]?.episode_number || 1);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setSeasonError('Could not load episodes for this season.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setEpisodesLoading(false);
    });

    return () => controller.abort();
  }, [id, selectedSeason, requestedSeason, requestedEpisode]);

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

  const title = series.name || series.original_name || 'Untitled series';
  const genres = (series.genres || []).map((genre) => genre.name).join(', ') || 'Genres unavailable';
  const returning = ['Returning Series', 'In Production'].includes(series.status);
  const statusLabel = returning ? 'Returning' : 'Ended';
  const seasons = series.seasons || [];
  const watchedCountBySeason = Object.values(episodeProgress).reduce((counts, progress) => {
    if (progress.seriesId === series.id) {
      counts[progress.seasonNumber] = (counts[progress.seasonNumber] || 0) + 1;
    }
    return counts;
  }, {});

  return (
    <main className="detail-page series-detail-page">
      <section
        className="detail-page-hero series-hero"
        style={{
          backgroundImage: series.backdrop_path
            ? `linear-gradient(rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.8)), url(${IMAGE_BASE_URL}/original${series.backdrop_path})`
            : 'none'
        }}
      >
        <div className="detail-page-content series-hero-content">
          <div className="detail-page-poster-wrap series-poster-wrap">
            <img
              src={series.poster_path ? `${IMAGE_BASE_URL}/w500${series.poster_path}` : FALLBACK_POSTER}
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
              <span className="series-status">{statusLabel}</span>
              <span className="series-season-count">{series.number_of_seasons || seasons.length} seasons</span>
              <span className="detail-rating series-rating-badge"><FaStar className="star-icon" />{series.vote_average ? `${series.vote_average.toFixed(1)}/10` : 'N/A'}</span>
            </div>
            <p className="series-overview">{series.overview || 'No series overview is available.'}</p>
            <div className="series-detail-genres">
              <span>Genres</span>
              <strong>{genres}</strong>
            </div>
            <div className="series-action-buttons">
              <button
                type="button"
                onClick={() => navigate(`/watch/tv/${id}?season=${selectedSeason || 1}&episode=${selectedEpisode || 1}`)}
                className="series-btn-primary"
                title={`Watch Season ${selectedSeason || 1}, Episode ${selectedEpisode || 1}`}
              >
                <Play size={18} fill="currentColor" />
                <span>Watch Now</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/trailer/tv/${id}`)}
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
                    id: series.id,
                    type: 'tv',
                    title,
                    poster_path: series.poster_path,
                  })
                }
                className={`series-btn-icon ${isBookmarked ? 'is-bookmarked' : ''}`}
                title={isBookmarked ? 'Remove from My List' : 'Add to My List'}
                aria-label={isBookmarked ? 'Remove from My List' : 'Add to My List'}
              >
                <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>

              <Link to="/series" className="series-back-link">
                <ArrowLeft size={16} />
                <span>Back to series</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Arranged Episodes Section */}
      <section className="series-episodes-section" aria-labelledby="series-episodes-heading">
        <div className="series-episodes-heading">
          <div className="episodes-header-left">
            <h2 id="series-episodes-heading">Episodes</h2>
            <p className="series-episode-total">
              {series.number_of_episodes || episodes.length} episodes across {seasons.length} season{seasons.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* Quick Season Dropdown Selector */}
          <div className="series-season-picker-wrap">
            <select
              value={selectedSeason ?? ''}
              onChange={(event) => {
                setSelectedSeason(Number(event.target.value));
                setSelectedEpisode(1);
              }}
              className="series-season-select-dropdown"
              aria-label="Select season"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.season_number}>
                  {season.name || `Season ${season.season_number}`} ({season.episode_count || 0} eps)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Season Navigation Tab Pills */}
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
                    setSelectedEpisode(1);
                  }}
                  className={`season-tab-pill ${isSelected ? 'is-active-season' : ''}`}
                >
                  <span>{season.name || `Season ${season.season_number}`}</span>
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

        {/* Selected Season Status & Progress Header */}
        <div className="selected-season-status-card">
          <div className="season-status-top">
            <div className="season-status-meta">
              <span className="season-badge-tag">Season {selectedSeason}</span>
              <strong className="season-status-title">
                {seasons.find((s) => s.season_number === selectedSeason)?.name || `Season ${selectedSeason}`}
              </strong>
            </div>
            <div className="season-progress-label">
              <span>{watchedCountBySeason[selectedSeason] || 0} of {episodes.length} Watched</span>
              <span className="season-percent-pill">
                {Math.round(((watchedCountBySeason[selectedSeason] || 0) / Math.max(1, episodes.length)) * 100)}%
              </span>
            </div>
          </div>

          <div
            className="season-progress-track"
            role="progressbar"
            aria-label={`Season ${selectedSeason} progress`}
            aria-valuemin="0"
            aria-valuemax={episodes.length}
            aria-valuenow={watchedCountBySeason[selectedSeason] || 0}
          >
            <div
              className="season-progress-fill"
              style={{ width: `${Math.round(((watchedCountBySeason[selectedSeason] || 0) / Math.max(1, episodes.length)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Episode Cards Grid */}
        {episodesLoading ? (
          <div className="series-episodes-grid skeleton-grid" role="status">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="series-episode-card is-loading-card">
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
              const progressKey = getEpisodeProgressId(series.id, selectedSeason, episode.episode_number);
              const watched = Boolean(episodeProgress[progressKey]);

              return (
                <article
                  key={episode.id}
                  className={`series-episode-card ${watched ? 'is-watched' : ''}`}
                >
                  {/* Thumbnail with overlay play trigger */}
                  <div
                    className="episode-thumbnail-wrap"
                    onClick={() => {
                      setSelectedEpisode(episode.episode_number);
                      navigate(`/watch/tv/${id}?season=${selectedSeason}&episode=${episode.episode_number}`);
                    }}
                  >
                    <img
                      src={episode.still_path ? `${IMAGE_BASE_URL}/w500${episode.still_path}` : FALLBACK_STILL}
                      alt={`${episode.name || `Episode ${episode.episode_number}`} still`}
                      loading="lazy"
                      decoding="async"
                    />

                    {/* Play hover overlay */}
                    <div className="episode-play-overlay">
                      <div className="episode-play-icon">
                        <Play size={22} fill="currentColor" />
                      </div>
                    </div>

                    {/* Corner Badges */}
                    <div className="episode-thumb-top-badges">
                      <span className="episode-number-badge">EP {episode.episode_number}</span>
                      {watched && <span className="episode-watched-badge"><Check size={12} /> Watched</span>}
                    </div>

                    {episode.runtime ? (
                      <span className="episode-runtime-badge">
                        <Clock size={11} /> {episode.runtime}m
                      </span>
                    ) : null}
                  </div>

                  {/* Episode Content */}
                  <div className="episode-content">
                    <div className="episode-title-row">
                      <h4
                        className="episode-title"
                        onClick={() => navigate(`/watch/tv/${id}?season=${selectedSeason}&episode=${episode.episode_number}`)}
                      >
                        {episode.episode_number}. {episode.name || `Episode ${episode.episode_number}`}
                      </h4>
                    </div>

                    <div className="episode-meta-row">
                      {episode.air_date && (
                        <span className="episode-air-date">
                          <Calendar size={12} /> {episode.air_date}
                        </span>
                      )}
                      {episode.vote_average > 0 && (
                        <span className="episode-rating">
                          ★ {episode.vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <p className="episode-overview">
                      {episode.overview || 'No episode synopsis is currently available.'}
                    </p>

                    {/* Action Bar */}
                    <div className="episode-actions-row">
                      <button
                        type="button"
                        onClick={() => navigate(`/watch/tv/${id}?season=${selectedSeason}&episode=${episode.episode_number}`)}
                        className="episode-watch-now-btn"
                        title={`Watch Episode ${episode.episode_number}`}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Watch Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEpisodeWatched(
                            {
                              seriesId: series.id,
                              seriesTitle: title,
                              poster: series.poster_path ? `${IMAGE_BASE_URL}/w500${series.poster_path}` : FALLBACK_POSTER,
                              year: series.first_air_date?.slice(0, 4) || 'N/A',
                              genre: genres,
                              rating: series.vote_average ? `${series.vote_average.toFixed(1)}/10` : 'N/A',
                              vote_average: series.vote_average,
                              seasonNumber: selectedSeason,
                              episodeNumber: episode.episode_number,
                              episodeTitle: episode.name || 'Untitled episode',
                              episodeCountInSeason: episodes.length,
                              seasonNumbers: seasons.map((season) => season.season_number),
                              totalSeasons: series.number_of_seasons || seasons.length,
                            },
                            !watched
                          )
                        }
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
        {series.next_episode_to_air ? (
          <article className="series-next-episode">
            <img
              src={series.next_episode_to_air.still_path ? `${IMAGE_BASE_URL}/w500${series.next_episode_to_air.still_path}` : FALLBACK_STILL}
              alt={`${series.next_episode_to_air.name || 'Next episode'} still`}
              loading="lazy"
              decoding="async"
            />
            <div>
              <p className="series-support-kicker">
                Season {series.next_episode_to_air.season_number}, Episode {series.next_episode_to_air.episode_number}
              </p>
              <h3>{series.next_episode_to_air.name || 'Episode title unavailable'}</h3>
              <p>{series.next_episode_to_air.air_date || 'Air date unavailable'}</p>
              <p>{series.next_episode_to_air.overview || 'No episode synopsis is available.'}</p>
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
        ) : cast.length > 0 ? (
          <div className="detail-author-grid series-cast-grid">
            {cast.map((person) => {
              const roles = (person.roles || []).map((role) => role.character).filter(Boolean);
              const roleLabel = [...new Set(roles)].join(', ') || 'Cast member';

              return (
                <article key={person.id} className="detail-author-card series-cast-card">
                  <img
                    src={person.profile_path ? `${IMAGE_BASE_URL}/w185${person.profile_path}` : FALLBACK_PROFILE}
                    alt={person.name}
                    className="detail-author-image"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="detail-author-content">
                    <div className="detail-author-head">
                      <h3>{person.name}</h3>
                      <span>{roleLabel}</span>
                    </div>
                    <p>{person.total_episode_count || 0} episodes</p>
                  </div>
                </article>
              );
            })}
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