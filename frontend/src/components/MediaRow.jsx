import React, { useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import MediaCard from './MediaCard';

function MediaRow({
  id,
  title,
  items = [],
  loading = false,
  emptyMessage = 'No titles found.'
}) {
  const rowRef = useRef(null);

  // Smooth horizontal scroll handler for desktop navigation
  const handleScroll = (direction) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75; // Scroll 75% of view width
      rowRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id={id} className="content-section">
      <div className="section-header">
        <h2>{title}</h2>
        
        {/* Scroll Buttons (visible when items exist) */}
        {items.length > 0 && (
          <div className="row-scroll-controls">
            <button
              onClick={() => handleScroll('left')}
              className="scroll-btn left"
              aria-label="Scroll left"
            >
              <FaChevronLeft />
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="scroll-btn right"
              aria-label="Scroll right"
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* 1. Initial Skeleton Loading State */}
      {loading && items.length === 0 ? (
        <div className="movie-row skeleton-row" role="status" aria-label={`Loading ${title}`}>
          {Array.from({ length: 6 }, (_, index) => (
            <div className="skeleton-card" key={`skeleton-${index}`} aria-hidden="true">
              <div className="skeleton-poster" />
              <div className="skeleton-copy">
                <span />
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        /* 2. Populated Row State */
        <div className="movie-row" ref={rowRef}>
          {items.map((item) => {
            // Normalize media type ('tv' vs 'movie')
            const isTV = item.mediaType === 'series' || item.mediaType === 'tv' || item.type === 'tv';
            const normalizedType = isTV ? 'tv' : 'movie';

            // Normalize title, poster, year, and genre across OMDb / TMDb formats
            const cardTitle = item.title || item.Title || 'Untitled';
            const cardPoster = item.poster_path || item.poster || item.Poster;
            const cardYear = item.year || item.Year || (item.release_date ? item.release_date.split('-')[0] : '');
            const cardGenre = item.genre || item.Genre || '';

            // Normalize rating format
            const rawRating = item.vote_average ?? item.imdbRating ?? item.rating;
            const cardRating = typeof rawRating === 'number' ? rawRating.toFixed(1) : rawRating || 0;

            // Normalize watch route URL
            const watchHref = item.resumeSeason !== undefined
              ? `/watch/${normalizedType}/${item.id}?s=${item.resumeSeason}&e=${item.resumeEpisode}`
              : `/watch/${normalizedType}/${item.id}`;

            const trailerHref = item.trailerUrl || `/trailer/${normalizedType}/${item.id}`;

            return (
              <MediaCard
                key={`${normalizedType}-${item.id}`}
                title={cardTitle}
                poster={cardPoster}
                rating={cardRating}
                year={cardYear}
                genre={cardGenre}
                href={watchHref}
                trailerHref={trailerHref}
              />
            );
          })}
        </div>
      ) : (
        /* 3. Empty Fallback State */
        <p className="empty-state">{emptyMessage}</p>
      )}

      {/* Append Loading Indicator for Infinite Scroll / Append Fetching */}
      {loading && items.length > 0 && (
        <p className="media-row-loading" role="status">Loading more titles...</p>
      )}
    </section>
  );
}

export default MediaRow;