import { useState } from 'react';
import './MoviePlayer.css';

const SERVERS = [
  {
    id: 'vidsrc-cc',
    name: 'Server 1 (VidSrc CC)',
    getMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
  },
  {
    id: 'vidsrc-me',
    name: 'Server 2 (VidSrc Pro)',
    getMovieUrl: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
  },
  {
    id: 'autoembed',
    name: 'Server 3 (AutoEmbed)',
    getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
  },
  {
    id: 'smashystream',
    name: 'Server 4 (SmashyStream)',
    getMovieUrl: (id) => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    getTvUrl: (id, s, e) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`
  }
];

function MoviePlayer({
  tmdbId,
  mediaType = 'movie',
  movieTitle = '',
  seasonNumber = 1,
  episodeNumber = 1,
  seasonsCount = 1,
  onEpisodeChange,
  onSeasonChange,
  episodeOptions = [],
  showEpisodeSelectors = false
}) {
  const [selectedServerId, setSelectedServerId] = useState(SERVERS[0].id);

  const activeServer = SERVERS.find((s) => s.id === selectedServerId) || SERVERS[0];

  const embedUrl =
    mediaType === 'tv'
      ? activeServer.getTvUrl(tmdbId, seasonNumber, episodeNumber)
      : activeServer.getMovieUrl(tmdbId);

  return (
    <div className="stream-player-card">
      <div className="player-controls-bar">
        {/* Server Selection Dropdown */}
        <div className="control-group">
          <label htmlFor="server-select">Server:</label>
          <select
            id="server-select"
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
          >
            {SERVERS.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        {/* TV Episode & Season Selectors */}
        {showEpisodeSelectors && mediaType === 'tv' && (
          <div className="tv-selectors">
            {seasonsCount > 1 && (
              <div className="control-group">
                <label htmlFor="season-select">Season:</label>
                <select
                  id="season-select"
                  value={seasonNumber}
                  onChange={(e) => onSeasonChange?.(Number(e.target.value))}
                >
                  {Array.from({ length: seasonsCount }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>
                      Season {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {episodeOptions.length > 0 ? (
              <div className="control-group">
                <label htmlFor="episode-select">Episode:</label>
                <select
                  id="episode-select"
                  value={episodeNumber}
                  onChange={(e) => onEpisodeChange?.(Number(e.target.value))}
                >
                  {episodeOptions.map((ep) => (
                    <option key={ep.id || ep.episode_number} value={ep.episode_number}>
                      Ep {ep.episode_number}: {ep.name || `Episode ${ep.episode_number}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Video Iframe Frame */}
      <div className="player-video-frame">


        <iframe
          src={embedUrl}
          title={`Watch ${movieTitle}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="origin"
          allowFullScreen
        />
      </div>

      <div className="player-footer-note">
        <p>If the video doesn't load or stutters, try switching to a different server using the dropdown above.</p>
      </div>
    </div>
  );
}

export default MoviePlayer;