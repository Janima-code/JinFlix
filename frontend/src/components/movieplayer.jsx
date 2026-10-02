import { useEffect, useRef, useState } from 'react';
import './movieplayer.css';

const API_BASE = 'http://localhost:8000/api';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const getNextProvider = (providers, attemptedProviderIds, failedProviderId) => {
  attemptedProviderIds.current.add(failedProviderId);
  return providers.find((provider) => !attemptedProviderIds.current.has(provider.id));
};

const MoviePlayer = ({
  tmdbId,
  mediaType = 'movie',
  movieTitle,
  totalEpisodes,
  seasonNumber,
  episodeNumber,
  onEpisodeChange,
  episodeOptions,
  showEpisodeSelectors = true
}) => {
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [internalSeason, setInternalSeason] = useState(1);
  const [internalEpisode, setInternalEpisode] = useState(1);
  const [internalEpisodes, setInternalEpisodes] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingEmbed, setLoadingEmbed] = useState(false);
  const [error, setError] = useState('');
  const attemptedProviderIds = useRef(new Set());
  const season = seasonNumber ?? internalSeason;
  const episode = episodeNumber ?? internalEpisode;
  const episodes = episodeOptions ?? internalEpisodes;
  const updateEpisode = (value) => {
    if (onEpisodeChange) {
      onEpisodeChange(value);
    } else {
      setInternalEpisode(value);
    }
  };

  useEffect(() => {
    attemptedProviderIds.current.clear();
  }, [tmdbId, mediaType, season, episode]);

  useEffect(() => {
    if (mediaType !== 'tv' || !tmdbId || !TMDB_API_KEY || episodeOptions !== undefined) {
      setInternalEpisodes([]);
      return undefined;
    }

    const controller = new AbortController();
    setInternalEpisodes([]);

    const fetchEpisodes = async () => {
      try {
        const queryParams = new URLSearchParams({ api_key: TMDB_API_KEY });
        const response = await fetch(
          `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}?${queryParams}`,
          { signal: controller.signal }
        );
        if (!response.ok) return;

        const data = await response.json();
        const seasonEpisodes = Array.isArray(data.episodes) ? data.episodes : [];
        if (!controller.signal.aborted) {
          setInternalEpisodes(seasonEpisodes);
          if (!seasonEpisodes.some((item) => item.episode_number === episode)) {
            updateEpisode(seasonEpisodes[0]?.episode_number || 1);
          }
        }
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setInternalEpisodes([]);
        }
      }
    };

    fetchEpisodes();
    return () => controller.abort();
  }, [tmdbId, mediaType, season, episodeOptions]);

  const episodeTitle = episodes.find((item) => item.episode_number === episode)?.name || '';

  useEffect(() => {
    const controller = new AbortController();

    const fetchProviders = async () => {
      try {
        const response = await fetch(`${API_BASE}/providers`, { signal: controller.signal });
        if (!response.ok) throw new Error('Could not load streaming servers.');

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('The server returned an invalid provider list.');

        setProviders(data);
        setSelectedProviderId(data[0]?.id || '');
        setError(data.length ? '' : 'No streaming servers are available.');
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setError(fetchError.message || 'Could not load streaming servers.');
        }
      } finally {
        if (!controller.signal.aborted) setLoadingProviders(false);
      }
    };

    fetchProviders();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!tmdbId || !selectedProviderId) return undefined;

    const controller = new AbortController();
    const queryParams = new URLSearchParams({
      tmdb_id: String(tmdbId),
      provider_id: selectedProviderId,
      media_type: mediaType,
      season: String(season),
      episode: String(episode),
    });

    const fetchEmbedUrl = async () => {
      setLoadingEmbed(true);
      setEmbedUrl('');
      setError('');

      try {
        const response = await fetch(`${API_BASE}/stream-url?${queryParams}`, { signal: controller.signal });
        if (!response.ok) throw new Error('This server could not resolve a stream for the title.');

        const data = await response.json();
        if (!data.embed_url) throw new Error('The server did not return an embed URL.');
        setEmbedUrl(data.embed_url);
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          const nextProvider = getNextProvider(providers, attemptedProviderIds, selectedProviderId);
          if (nextProvider) {
            setSelectedProviderId(nextProvider.id);
          } else {
            setError(fetchError.message || 'Every configured server failed to resolve a stream.');
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoadingEmbed(false);
      }
    };

    fetchEmbedUrl();
    return () => controller.abort();
  }, [tmdbId, selectedProviderId, mediaType, season, episode, providers]);

  const handleIframeError = () => {
    setEmbedUrl('');
    const nextProvider = getNextProvider(providers, attemptedProviderIds, selectedProviderId);
    if (nextProvider) {
      setSelectedProviderId(nextProvider.id);
    } else {
      setError('Every configured server failed to load. Select a server to try again.');
    }
  };

  if (loadingProviders) {
    return <div className="player-message" role="status">Loading streaming servers...</div>;
  }

  return (
    <div className="stream-player-card">
      <div className="player-header">
        <h3>{movieTitle}</h3>
        <div className="player-controls">
          {mediaType === 'tv' && showEpisodeSelectors ? (
            <div className="tv-selectors">
              <label>
                Season
                <input
                  type="number"
                  min="1"
                  value={season}
                  onChange={(event) => setInternalSeason(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                />
              </label>
              <label>
                Episode
                {episodes.length > 0 ? (
                  <select
                    aria-label="Choose episode"
                    value={episode}
                    onChange={(event) => updateEpisode(Number(event.target.value))}
                  >
                    {episodes.map((item) => (
                      <option key={item.id} value={item.episode_number}>
                        Episode {item.episode_number}: {item.name || 'Untitled'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={episode}
                    onChange={(event) => updateEpisode(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                  />
                )}
              </label>
            </div>
          ) : null}

          <label className="provider-select-label">
            Server
            <select
              value={selectedProviderId}
              onChange={(event) => {
                attemptedProviderIds.current.clear();
                setSelectedProviderId(event.target.value);
              }}
              disabled={!providers.length}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="iframe-container" aria-live="polite">
        {loadingEmbed ? (
          <div className="player-message" role="status">Resolving stream...</div>
        ) : error ? (
          <div className="player-message error" role="alert">{error}</div>
        ) : embedUrl ? (
          <iframe className="stream-iframe"
            key={`${selectedProviderId}:${embedUrl}`}
            src={embedUrl}
            title={movieTitle || 'Stream player'}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="origin"
            onError={handleIframeError}
          />
        ) : (
          <div className="player-message">Select a server to load the stream.</div>
        )}
      </div>
      {mediaType === 'tv' ? (
        <p className="episode-label" aria-live="polite">
          Season {season} · Episode {episode}{episodeTitle ? ` · ${episodeTitle}` : ''}
          {Number.isFinite(totalEpisodes) && totalEpisodes > 0 ? (
            <span className="total-episode-count">{totalEpisodes} episodes total</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
};

export default MoviePlayer;
