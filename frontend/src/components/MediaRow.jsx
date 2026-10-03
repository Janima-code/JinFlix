import { useRef, useState, useEffect } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import MediaCard from './MediaCard';
import './MediaRow.css';

export default function MediaRow({
  id,
  title,
  items = [],
  loading = false,
  autoScroll = true,
  autoScrollInterval = 3800,
  emptyMessage = 'No titles found.',
}) {
  const rowRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  // Smooth horizontal scroll handler
  const scroll = (direction) => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  // Autoscroll timer effect
  useEffect(() => {
    if (!autoScroll || items.length === 0 || isPaused || loading) return;

    const timer = setInterval(() => {
      const el = rowRef.current;
      if (!el) return;

      // If at end of row, smoothly return to start
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 14) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const step = Math.min(el.clientWidth * 0.65, 340);
        el.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, autoScrollInterval);

    return () => clearInterval(timer);
  }, [autoScroll, items.length, isPaused, loading, autoScrollInterval]);

  return (
    <section id={id} className="content-section">
      <div className="section-header">
        <h2>{title}</h2>

        {/* Scroll Arrows */}
        {items.length > 0 && (
          <div className="row-scroll-controls">
            <button onClick={() => scroll('left')} className="scroll-btn left" aria-label="Scroll left">
              <FaChevronLeft />
            </button>
            <button onClick={() => scroll('right')} className="scroll-btn right" aria-label="Scroll right">
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* 1. Loading State */}
      {loading ? (
        <div className="movie-row skeleton-row">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton-card" />
          ))}
        </div>
      ) : items.length > 0 ? (
        /* 2. Populated Row */
        <div
          className="movie-row"
          ref={rowRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {items.map((item) => (
            <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        /* 3. Empty State */
        <p className="empty-state">{emptyMessage}</p>
      )}
    </section>
  );
}