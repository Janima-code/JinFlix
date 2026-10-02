import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FaStar } from 'react-icons/fa';
import MoviePlayer from '../components/movieplayer';
import MediaRow from '../components/MediaRow';
import { getEpisodeProgressId, useMediaState } from '../context/MediaStateContext';
import usePageMeta from '../hooks/usePageMeta';
import './SeriesDetailPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const FALLBACK_POSTER = 'https://placehold.co/500x750/17171d/ffffff?text=Series';
const FALLBACK_STILL = 'https://placehold.co/640x360/17171d/ffffff?text=No+Episode+Still';
const FALLBACK_PROFILE = 'https://placehold.co/180x220/17171d/ffffff?text=Person';

const getVisitorRegion = () => {
  try {
    return new Intl.Locale(navigator.language || 'en-US').region || 'US';
  } catch {
    return 'US';
  }
};

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
  const { episodeProgress, setEpisodeWatched } = useMediaState();
  const requestedSeason = Number(searchParams.get('season'));
  const requestedEpisode = Number(searchParams.get('episode'));
  const hasRequestedSeason = searchParams.has('season') && Number.isInteger(requestedSeason);
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
  const [providerGroups, setProviderGroups] = useState([]);
  const [providerLink, setProviderLink] = useState('');
  const [visitorRegion, setVisitorRegion] = useState('US');
  const [recommendations, setRecommendations] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [pageMeta, setPageMeta] = useState({
    title: 'Series Details | JinFlix',
    description: 'Explore series details and episodes on JinFlix.'
  });

  usePageMeta(pageMeta.title, pageMeta.description);

  useEffect(() => {
    if (!detailsLoading && !supportLoading && trailer && window.location.hash === '#trailer') {
      const frame = window.requestAnimationFrame(() => {
        document.getElementById('trailer')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [detailsLoading, supportLoading, trailer, episodesLoading, episodes.length]);

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
    }).catch((fetchError) => {
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
    const region = getVisitorRegion();
    setVisitorRegion(region);
    setCast([]);
    setTrailer(null);
    setProviderGroups([]);
    setProviderLink('');
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
      fetchOptional('watch/providers'),
      fetchOptional('recommendations')
    ]).then(([credits, videos, watchData, recommendationData]) => {
      if (controller.signal.aborted) return;

      setCast((credits?.cast || []).slice(0, 12));

      const trailers = (videos?.results || []).filter((video) => video.site === 'YouTube' && video.type === 'Trailer');
      setTrailer(trailers.find((video) => video.official) || trailers[0] || null);

      const regionalProviders = watchData?.results?.[region];
      if (regionalProviders) {
        setProviderGroups([
          { label: 'Streaming', providers: regionalProviders.flatrate || [] },
          { label: 'Rent', providers: regionalProviders.rent || [] },
          { label: 'Buy', providers: regionalProviders.buy || [] }
        ].filter((group) => group.providers.length > 0));
        setProviderLink(regionalProviders.link || watchData.link || '');
      }

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
    }).catch((fetchError) => {
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
            <Link to="/series" className="back-link series-back-link">Back to series</Link>
          </div>
        </div>
      </section>

      <section className="series-episodes-section" aria-labelledby="series-episodes-heading">
        <div className="series-episodes-heading">
          <div>
            <h2 id="series-episodes-heading">Episodes</h2>
            <p className="series-episode-total">{series.number_of_episodes || episodes.length} episodes across {series.number_of_seasons || seasons.length} seasons</p>
          </div>
          <div className="series-season-controls">
            <label className="series-season-select series-season-picker">
              Season
              <select
                value={selectedSeason ?? ''}
                onChange={(event) => {
                  setSelectedSeason(Number(event.target.value));
                  setSelectedEpisode(1);
                }}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.season_number}>
                    {season.name || `Season ${season.season_number}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="series-season-progress-list" aria-label="Progress by season">
          {seasons.filter((season) => season.episode_count > 0).map((season) => {
            const watchedCount = watchedCountBySeason[season.season_number] || 0;
            const progress = Math.round((watchedCount / season.episode_count) * 100);

            return (
              <div className="series-season-progress" key={season.id}>
                <div className="series-season-progress-label">
                  <span>{season.name || `Season ${season.season_number}`}</span>
                  <span>{watchedCount}/{season.episode_count}</span>
                </div>
                <div
                  className="series-season-progress-track"
                  role="progressbar"
                  aria-label={`${season.name || `Season ${season.season_number}`} watched`}
                  aria-valuemin="0"
                  aria-valuemax={season.episode_count}
                  aria-valuenow={watchedCount}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {selectedSeason !== null ? (
          <MoviePlayer
            tmdbId={series.id}
            mediaType="tv"
            movieTitle={title}
            totalEpisodes={series.number_of_episodes}
            seasonNumber={selectedSeason}
            episodeNumber={selectedEpisode}
            onEpisodeChange={setSelectedEpisode}
            episodeOptions={episodes}
            showEpisodeSelectors={false}
          />
        ) : null}

        {episodesLoading ? (
          <div className="series-episode-loading series-skeleton" role="status">Loading season episodes...</div>
        ) : seasonError ? (
          <p className="empty-state" role="alert">{seasonError}</p>
        ) : episodes.length > 0 ? (
          <div className="series-episode-list">
            {episodes.map((episode) => {
              const progressKey = getEpisodeProgressId(series.id, selectedSeason, episode.episode_number);
              const watched = Boolean(episodeProgress[progressKey]);

              return (
                <article
                  key={episode.id}
                  className={`series-episode${selectedEpisode === episode.episode_number ? ' selected' : ''}`}
                >
                  <button
                    type="button"
                    className="series-episode-select"
                    onClick={() => setSelectedEpisode(episode.episode_number)}
                    aria-pressed={selectedEpisode === episode.episode_number}
                  >
                    <img
                      src={episode.still_path ? `${IMAGE_BASE_URL}/w500${episode.still_path}` : FALLBACK_STILL}
                      alt={`${episode.name || `Episode ${episode.episode_number}`} still`}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="series-episode-copy">
                      <strong className="series-episode-title">{episode.episode_number}. {episode.name || 'Untitled episode'}</strong>
                      <span className={`series-episode-meta${episode.air_date && new Date(episode.air_date) > new Date() ? ' is-upcoming' : ''}`}>
                        {episode.air_date || 'Air date unavailable'}
                        <span aria-hidden="true"> · </span>
                        {episode.runtime ? `${episode.runtime} min` : 'Runtime unavailable'}
                      </span>
                      <span className="series-episode-overview">{episode.overview || 'No episode synopsis is available.'}</span>
                    </span>
                  </button>
                  <label className="episode-watched-control">
                    <input
                      type="checkbox"
                      checked={watched}
                      aria-label={`Mark ${title}, season ${selectedSeason}, episode ${episode.episode_number} as watched`}
                      onChange={(event) => setEpisodeWatched({
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
                        totalSeasons: series.number_of_seasons || seasons.length
                      }, event.target.checked)}
                    />
                    <span>Watched</span>
                  </label>
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

      <section id="trailer" className="series-support-section" aria-labelledby="series-trailer-heading">
        <h2 id="series-trailer-heading">Trailer</h2>
        {supportLoading ? (
          <p className="series-support-empty series-support-loading" role="status">Loading trailer...</p>
        ) : trailer ? (
          <div className="series-trailer-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailer.key}`}
              title={`${title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="series-support-empty">No trailer is available.</p>
        )}
      </section>

      <section className="series-support-section" aria-labelledby="series-watch-heading">
        <h2 id="series-watch-heading">Where to Watch</h2>
        <p className="series-support-region">Availability for {visitorRegion}</p>
        {supportLoading ? (
          <p className="series-support-empty series-support-loading" role="status">Loading provider availability...</p>
        ) : providerGroups.length > 0 ? (
          <>
            <div className="series-provider-groups">
              {providerGroups.map((group) => (
                <div className="series-provider-group" key={group.label}>
                  <h3>{group.label}</h3>
                  <div className="provider-row">
                    {group.providers.map((provider) => (
                      <span className="provider-chip" key={provider.provider_id}>
                        {provider.logo_path ? <img src={`${IMAGE_BASE_URL}/w92${provider.logo_path}`} alt="" className="provider-logo" /> : null}
                        {provider.provider_name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {providerLink ? <a className="series-provider-link" href={providerLink} target="_blank" rel="noreferrer">See all options</a> : null}
          </>
        ) : (
          <p className="series-support-empty">No provider listings are available for this region.</p>
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