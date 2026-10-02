import React, { useState, useEffect } from 'react';
import {
  Play,
  Info,
  Plus,
  Check,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Pause,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMediaState } from '../context/MediaStateContext';
import './HeroBanner.css';

export const HeroBanner = ({
  movie,
  movies = [],
  onPlay,
  onMoreInfo,
  isInWatchlist = false,
  onToggleWatchlist,
  isMuted = false,
  onToggleMute,
  autoPlayInterval = 5500,
}) => {
  const navigate = useNavigate();
  const items = movies && movies.length > 0 ? movies : movie ? [movie] : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [internalMuted, setInternalMuted] = useState(true);

  // Guard against out-of-bounds index
  useEffect(() => {
    if (currentIndex >= items.length && items.length > 0) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

  // Autoplay Timer Loop
  useEffect(() => {
    if (items.length <= 1 || isPaused || !autoPlayEnabled) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [items.length, isPaused, autoPlayEnabled, autoPlayInterval, currentIndex]);

  if (items.length === 0) return null;

  const currentMovie = items[currentIndex] || items[0];

  // Normalize current movie properties
  const id = currentMovie.id || currentMovie.tmdb_id;
  const title = currentMovie.title || currentMovie.name || currentMovie.Title || 'Featured Title';
  const description = currentMovie.description || currentMovie.overview || currentMovie.Plot || 'No synopsis available.';
  const backdrop = currentMovie.backdrop || (currentMovie.backdrop_path ? `https://image.tmdb.org/t/p/original${currentMovie.backdrop_path}` : currentMovie.poster || currentMovie.Poster);
  const mediaType = currentMovie.mediaType || (currentMovie.first_air_date || currentMovie.seasons ? 'tv' : 'movie');

  // Match score calculation
  const voteAvg = Number(currentMovie.vote_average || currentMovie.rating || 8.0);
  const matchScore = currentMovie.matchScore || Math.min(99, Math.max(70, Math.round(voteAvg * 10)));

  // Release year
  const releaseYear = currentMovie.releaseYear || (currentMovie.release_date || currentMovie.first_air_date || currentMovie.Year || '').slice(0, 4) || new Date().getFullYear();

  // Rating badge
  const ratingBadge = currentMovie.rating && typeof currentMovie.rating === 'string' && currentMovie.rating.length <= 6
    ? currentMovie.rating
    : voteAvg > 0 ? `${voteAvg.toFixed(1)} ★` : 'PG-13';

  // Duration
  const duration = currentMovie.duration || (mediaType === 'tv' ? 'Series' : '2h 14m');

  // Genres
  const genres = Array.isArray(currentMovie.genres)
    ? currentMovie.genres.map(g => (typeof g === 'object' ? g.name : g))
    : typeof currentMovie.Genre === 'string'
      ? currentMovie.Genre.split(',').map(g => g.trim())
      : ['Action', 'Drama', 'Featured'];

  // Handlers
  const handlePlay = () => {
    if (onPlay) {
      onPlay(currentMovie);
    } else {
      navigate(`/watch/${mediaType}/${id}`);
    }
  };

  const handleMoreInfo = () => {
    if (onMoreInfo) {
      onMoreInfo(currentMovie);
    } else {
      navigate(`/${mediaType === 'tv' ? 'series' : 'movie'}/${id}`);
    }
  };

  const mediaState = useMediaState();
  const bookmarks = mediaState?.bookmarks || [];
  const toggleBookmark = mediaState?.toggleBookmark;

  const isCurrentInWatchlist = bookmarks.some((b) => String(b.id) === String(id)) || isInWatchlist;

  const handleToggleWatchlist = () => {
    if (onToggleWatchlist) {
      onToggleWatchlist(currentMovie);
    } else if (toggleBookmark) {
      toggleBookmark({
        id: currentMovie.id || currentMovie.tmdb_id,
        type: mediaType,
        title: title,
        poster_path: currentMovie.poster_path || currentMovie.Poster || currentMovie.backdrop_path,
      });
    }
  };

  const activeMuted = onToggleMute ? isMuted : internalMuted;
  const handleMuteToggle = () => {
    if (onToggleMute) {
      onToggleMute();
    } else {
      setInternalMuted(prev => !prev);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <section
      className="hero-banner-section relative w-full h-[78vh] min-h-[520px] max-h-[820px] bg-black overflow-hidden flex items-end"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image / Backdrop with Fade Transition */}
      <div className="hero-backdrop-container absolute inset-0 z-0">
        {items.map((item, idx) => {
          const bg = item.backdrop || (item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : item.poster || item.Poster);
          const isCurrent = idx === currentIndex;
          return (
            <img
              key={item.id || idx}
              src={bg}
              alt={item.title || item.name}
              referrerPolicy="no-referrer"
              className={`hero-backdrop-img hero-slide-bg ${isCurrent ? 'is-active-slide' : ''}`}
            />
          );
        })}

        {/* Cinematic Vignette Gradients */}
        <div className="hero-vignette-bottom absolute inset-0 z-10" />
        <div className="hero-vignette-left absolute inset-0 z-10 hidden sm:block" />
        <div className="hero-vignette-top absolute inset-0 z-10 h-32" />
      </div>

      {/* Carousel Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="hero-carousel-arrow hero-arrow-left"
            aria-label="Previous Slide"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="hero-carousel-arrow hero-arrow-right"
            aria-label="Next Slide"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Hero Content */}
      <div className="hero-content-wrap relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        <div className="hero-content-inner max-w-2xl space-y-4">
          {/* Metadata Row: Clean typographic separators */}
          <div className="hero-meta-row flex items-center gap-2.5 text-xs font-semibold tracking-wide text-white/90">
            <span className="hero-match-score text-[#46d369] font-bold">{matchScore}% Match</span>
            <span className="hero-meta-dot text-white/40" aria-hidden="true">·</span>
            <span>{releaseYear}</span>
            <span className="hero-meta-dot text-white/40" aria-hidden="true">·</span>
            <span className="hero-rating-badge border border-white/40 px-1 py-0.2 rounded text-[11px] font-medium tracking-tight">
              {ratingBadge}
            </span>
            <span className="hero-meta-dot text-white/40" aria-hidden="true">·</span>
            <span>{duration}</span>
            <span className="hero-meta-dot text-white/40" aria-hidden="true">·</span>
            <span className="hero-quality-badge border border-white/30 px-1 py-0.2 rounded text-[10px] text-white/70">
              ULTRA HD 4K
            </span>
          </div>

          {/* Title */}
          <h1 className="hero-title font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white drop-shadow-2xl leading-none">
            {title}
          </h1>

          {/* Synopsis */}
          <p className="hero-synopsis text-neutral-200 text-sm sm:text-base leading-relaxed line-clamp-3 sm:line-clamp-4 drop-shadow font-normal max-w-xl">
            {description}
          </p>

          {/* Genre tags: quiet text with typographic dots */}
          <div className="hero-genres-row flex flex-wrap items-center gap-2 text-xs text-neutral-400 pt-1">
            {genres.map((genre, idx) => (
              <React.Fragment key={genre}>
                <span className="hero-genre-item hover:text-white transition-colors">{genre}</span>
                {idx < genres.length - 1 && (
                  <span className="hero-meta-dot text-neutral-600" aria-hidden="true">·</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Call to Actions */}
          <div className="hero-cta-row flex flex-wrap items-center gap-3 pt-3">
            <button
              type="button"
              onClick={handlePlay}
              className="hero-btn-play flex items-center gap-2.5 bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded font-bold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Play Now</span>
            </button>

            <button
              type="button"
              onClick={handleMoreInfo}
              className="hero-btn-info flex items-center gap-2 bg-neutral-600/70 hover:bg-neutral-600 text-white px-5 py-2.5 rounded font-semibold text-sm sm:text-base backdrop-blur-md transition-all duration-200 cursor-pointer"
            >
              <Info className="w-5 h-5" />
              <span>More Info</span>
            </button>

            <button
              type="button"
              onClick={handleToggleWatchlist}
              className={`hero-btn-watchlist p-2.5 rounded-full border transition-all duration-200 cursor-pointer ${
                isCurrentInWatchlist
                  ? 'in-watchlist bg-[#E50914] border-[#E50914] text-white hover:bg-[#b80710]'
                  : 'bg-black/40 border-white/30 text-white hover:border-white hover:bg-black/60'
              }`}
              title={isCurrentInWatchlist ? 'Remove from My List' : 'Add to My List'}
              aria-label={isCurrentInWatchlist ? 'Remove from My List' : 'Add to My List'}
            >
              {isCurrentInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>

          {/* Carousel Slide Indicators / Dots */}
          {items.length > 1 && (
            <div className="hero-carousel-dots">
              {items.map((item, idx) => (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`hero-dot-bar ${idx === currentIndex ? 'is-active-dot' : ''}`}
                  title={`Jump to ${item.title || item.name}`}
                  aria-label={`Slide ${idx + 1}`}
                >
                  <span className="hero-dot-fill" />
                </button>
              ))}

              <button
                type="button"
                onClick={() => setAutoPlayEnabled(prev => !prev)}
                className="hero-autoplay-indicator"
                title={autoPlayEnabled ? 'Autoplay is On (Click to Pause)' : 'Autoplay is Paused (Click to Play)'}
                aria-label="Toggle Carousel Autoplay"
              >
                {autoPlayEnabled ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Right Controls: Maturity Badge & Sound Toggle */}
      <div className="hero-floating-controls absolute right-4 sm:right-8 bottom-16 sm:bottom-24 z-20 flex items-center gap-3">
        <button
          type="button"
          onClick={handleMuteToggle}
          className="hero-btn-sound p-2.5 rounded-full border border-white/20 bg-black/40 hover:bg-black/70 text-white backdrop-blur transition-all duration-200 cursor-pointer"
          title={activeMuted ? 'Unmute' : 'Mute'}
          aria-label={activeMuted ? 'Unmute preview audio' : 'Mute preview audio'}
        >
          {activeMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <div className="hero-maturity-badge bg-neutral-900/80 border-l-2 border-white px-3 py-1 text-xs text-neutral-300 font-semibold backdrop-blur">
          {ratingBadge}
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
