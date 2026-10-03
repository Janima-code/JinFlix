import { memo } from 'react';
import { Link } from 'react-router-dom';
import { toRouteSegment } from '../api/media';

/**
 * Renders a card from the backend's normalized shape. Every field is already
 * resolved upstream, so this component makes no assumptions about which
 * property holds the title or poster.
 */
function MediaCard({ item }) {
  if (!item?.id) return null;

  const isSeries = item.media_type === 'tv';
  const poster = item.poster || item.backdrop;
  const rating = item.rating ? item.rating.toFixed(1) : null;

  return (
    <Link to={`/${toRouteSegment(item.media_type)}/${item.id}`} className="media-card">
      <div className="card-poster">
        {poster ? (
          <img src={poster} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="poster-placeholder" aria-hidden="true">
            {item.title?.[0]}
          </div>
        )}
        {rating && <span className="card-rating">★ {rating}</span>}
      </div>

      <div className="card-info">
        <h3 className="card-title">{item.title}</h3>
        {(item.year || item.media_type) && (
          <p className="card-meta">
            {item.year && item.year !== 'N/A' && <span className="card-year">{item.year}</span>}
            {item.year && item.year !== 'N/A' && (
              <span className="card-meta-sep" aria-hidden="true">·</span>
            )}
            <span className="card-type">{isSeries ? 'TV' : 'Film'}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

// Rows re-render on every parent state change; cards rarely do.
export default memo(MediaCard);