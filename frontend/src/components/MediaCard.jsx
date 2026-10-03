import { memo } from 'react';
import { Link } from 'react-router-dom';

function MediaCard({ item, mediaType }) {
  if (!item?.id) return null;

  const resolvedType =
    item.mediaType === 'tv' || item.mediaType === 'series' || item.first_air_date
      ? 'series'
      : item.mediaType === 'movie' || item.release_date
        ? 'movie'
        : mediaType || 'movie';

  const poster = item.poster_path || item.backdrop_path;
  const title = item.name || item.Title || item.title || 'Untitled';
  const year =
    item.first_air_date?.slice(0, 4) ||
    item.release_date?.slice(0, 4) ||
    item.Year ||
    '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const typeLabel = resolvedType === 'series' ? 'TV' : 'Film';

  return (
    <Link to={`/${resolvedType}/${item.id}`} className="media-card">
      <div className="card-poster">
        {poster ? (
          <img
            src={`https://image.tmdb.org/t/p/w300${poster}`}
            alt={title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="poster-placeholder" aria-hidden="true">
            {title[0]}
          </div>
        )}
        {rating && <span className="card-rating">★ {rating}</span>}
      </div>

      <div className="card-info">
        <h3 className="card-title">{title}</h3>
        {(year || typeLabel) && (
          <p className="card-meta">
            {year && <span className="card-year">{year}</span>}
            {year && typeLabel && <span className="card-meta-sep" aria-hidden="true">·</span>}
            {typeLabel && <span className="card-type">{typeLabel}</span>}
          </p>
        )}
      </div>
    </Link>
  );
}

// React.memo prevents re-rendering cards during parent scroll state updates
export default memo(MediaCard);