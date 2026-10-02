import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaArrowLeft, FaStar, FaFilm, FaTv } from 'react-icons/fa';
import AutoFallbackPlayer from './AutoFallbackPlayer'; // Your player component using movieplayer.css
import MediaRow from './MediaRow';
import { useMediaState } from '../context/MediaStateContext';
import './movieplayer.css';
import './MovieStreamPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const MovieStreamPage = () => {
  const { mediaType, id } = useParams(); // 'movie' or 'tv'
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateEpisodeProgress } = useMediaState();

  const numericId = parseInt(id, 10);
  const isTV = mediaType === 'tv';
  const currentSeason = parseInt(searchParams.get('s') || '1', 10);
  const currentEpisode = parseInt(searchParams.get('e') || '1', 10);

  const [mediaDetails, setMediaDetails] = useState(null);
  const [episodesList, setEpisodesList] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Movie / TV Details & Recommendations
  useEffect(() => {
    const fetchMediaData = async () => {
      try {
        setLoading(true);
        setError(null);

        const endpoint = isTV ? `/tv/${numericId}` : `/movie/${numericId}`;
        const recEndpoint = isTV ? `/tv/${numericId}/recommendations` : `/movie/${numericId}/recommendations`;

        const [detailsRes, recsRes] = await Promise.all([
          axios.get(`${TMDB_BASE_URL}${endpoint}`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          }),
          axios.get(`${TMDB_BASE_URL}${recEndpoint}`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' }
          })
        ]);

        setMediaDetails(detailsRes.data);

        const normalizedRecs = (recsRes.data.results || []).map((item) => ({
          ...item,
          id: item.id,
          mediaType: isTV ? 'tv' : 'movie',
          Title: item.title || item.name,
          Year: (item.release_date || item.first_air_date || '').slice(0, 4),
          Poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          vote_average: item.vote_average || 0
        }));

        setRecommendations(normalizedRecs);
      } catch (err) {
        console.error('Failed to load title details:', err);
        setError('Unable to load media details.');
      } finally {
        setLoading(false);
      }
    };

    fetchMediaData();
  }, [mediaType, numericId, isTV]);

  // Fetch Season Episodes list if TV show
  useEffect(() => {
    if (!isTV || !numericId) return;

    const fetchSeasonEpisodes = async () => {
      try {
        const res = await axios.get(`${TMDB_BASE_URL}/tv/${numericId}/season/${currentSeason}`, {
          params: { api_key: TMDB_API_KEY, language: 'en-US' }
        });
        setEpisodesList(res.data.episodes || []);
      } catch (err) {
        console.error('Failed to fetch season episodes:', err);
        setEpisodesList([]);
      }
    };

    fetchSeasonEpisodes();
  }, [isTV, numericId, currentSeason]);

  // Sync Progress with Context
  useEffect(() => {
    if (isTV && mediaDetails && updateEpisodeProgress) {
      updateEpisodeProgress({
        seriesId: numericId,
        seriesTitle: mediaDetails.name,
        poster: mediaDetails.poster_path ? `https://image.tmdb.org/t/p/w500${mediaDetails.poster_path}` : null,
        year: (mediaDetails.first_air_date || '').slice(0, 4),
        seasonNumber: currentSeason,
        episodeNumber: currentEpisode,
        episodeCountInSeason: episodesList.length || 20,
        seasonNumbers: mediaDetails.seasons?.map((s) => s.season_number).filter((n) => n > 0) || [1],
        vote_average: mediaDetails.vote_average,
        updatedAt: Date.now()
      });
    }
  }, [isTV, numericId, currentSeason, currentEpisode, mediaDetails, episodesList.length, updateEpisodeProgress]);

  const handleSeasonChange = (seasonNum) => {
    setSearchParams({ s: seasonNum, e: 1 });
  };

  const handleEpisodeChange = (episodeNum) => {
    setSearchParams({ s: currentSeason, e: episodeNum });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="stream-standalone-page">
        <div className="player-message">
          <p>Loading media player...</p>
        </div>
      </div>
    );
  }

  if (error || !mediaDetails) {
    return (
      <div className="stream-standalone-page">
        <div className="player-message error">
          <div>
            <p>{error || 'Title not found.'}</p>
            <button className="back-nav-btn" onClick={() => navigate(-1)}>
              <FaArrowLeft /> Return Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const title = mediaDetails.title || mediaDetails.name;
  const releaseYear = (mediaDetails.release_date || mediaDetails.first_air_date || '').slice(0, 4);
  const rating = mediaDetails.vote_average ? mediaDetails.vote_average.toFixed(1) : 'N/A';
  const genres = mediaDetails.genres?.map((g) => g.name).join(', ') || 'General';

  return (
    <div className="stream-standalone-page">
      {/* Top Header Navigation */}
      <header className="standalone-header">
        <button className="back-nav-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
          <span>Back</span>
        </button>
        <div className="header-title-badge">
          {isTV ? <FaTv /> : <FaFilm />}
          <span>{title} {isTV && `(S${currentSeason} E${currentEpisode})`}</span>
        </div>
      </header>

      {/* Embedded Stream Player */}
      <main className="player-section-wrapper">
        <AutoFallbackPlayer
          tmdbId={numericId}
          mediaType={mediaType}
          season={currentSeason}
          episode={currentEpisode}
          title={isTV ? `${title} S${currentSeason} E${currentEpisode}` : title}
          onSeasonChange={handleSeasonChange}
          onEpisodeChange={handleEpisodeChange}
        />
      </main>

      {/* Overview & TV Episode Grid */}
      <section className="media-info-container">
        <div className="info-main-header">
          <h1>{title}</h1>
          <div className="info-meta-tags">
            <span className="year-badge">{releaseYear}</span>
            <span className="genre-badge">{genres}</span>
            <span className="rating-badge">
              <FaStar className="star-icon" /> {rating}
            </span>
          </div>
        </div>

        <p className="media-overview-text">
          {mediaDetails.overview || 'No overview available for this title.'}
        </p>

        {/* TV Episode Selector */}
        {isTV && mediaDetails.seasons && (
          <div className="tv-episodes-panel">
            <div className="season-select-wrapper">
              <label htmlFor="season-dropdown">Season: </label>
              <select
                id="season-dropdown"
                value={currentSeason}
                onChange={(e) => handleSeasonChange(Number(e.target.value))}
              >
                {mediaDetails.seasons
                  .filter((s) => s.season_number > 0)
                  .map((s) => (
                    <option key={s.id} value={s.season_number}>
                      {s.name || `Season ${s.season_number}`} ({s.episode_count} Episodes)
                    </option>
                  ))}
              </select>
            </div>

            <div className="episodes-grid">
              {episodesList.map((ep) => (
                <button
                  key={ep.id}
                  className={`episode-card-btn ${ep.episode_number === currentEpisode ? 'active' : ''}`}
                  onClick={() => handleEpisodeChange(ep.episode_number)}
                >
                  <span className="ep-num">E{ep.episode_number}</span>
                  <span className="ep-title">{ep.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section className="recommendations-section">
          <MediaRow
            id="recommended-stream-titles"
            title="You Might Also Like"
            items={recommendations}
          />
        </section>
      )}
    </div>
  );
};

export default MovieStreamPage;