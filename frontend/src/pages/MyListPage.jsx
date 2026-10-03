import { Link } from 'react-router-dom';
import { useMediaState } from '../context/mediaState';
import { toRouteSegment } from '../api/media';
import './MyListPage.css';

const FALLBACK_POSTER = 'https://placehold.co/300x450/17171d/ffffff?text=No+Poster';

export default function MyListPage() {
  const { bookmarks, toggleBookmark } = useMediaState();

  return (
    <div className="my-list-page">
      <div className="my-list-inner">
        <header className="my-list-header">
          <Link to="/" className="my-list-back">← Home</Link>
          <h1 className="my-list-title">My List</h1>
          <p className="my-list-count">
            {bookmarks.length === 0
              ? 'No titles saved yet.'
              : `${bookmarks.length} title${bookmarks.length === 1 ? '' : 's'} saved`}
          </p>
        </header>

        {bookmarks.length === 0 ? (
          <div className="my-list-empty">
            <p className="my-list-empty-icon">🎬</p>
            <p className="my-list-empty-msg">Browse movies and shows, then hit <strong>+ My List</strong> to save them here.</p>
            <Link to="/" className="my-list-browse-btn">Browse Catalog</Link>
          </div>
        ) : (
          <ul className="my-list-grid" role="list">
            {bookmarks.map((item) => {
              const isSeries = item.type === 'tv' || item.type === 'series';
              const poster = item.poster || FALLBACK_POSTER;

              return (
                <li key={`${item.type}-${item.id}`} className="my-list-card">
                  <Link to={`/${toRouteSegment(item.type)}/${item.id}`} className="my-list-card-link">
                    <div className="my-list-poster-wrap">
                      <img src={poster} alt={item.title || 'Poster'} loading="lazy" decoding="async" />
                      <span className="my-list-type-badge">{isSeries ? 'TV' : 'Film'}</span>
                    </div>
                    <div className="my-list-card-info">
                      <h3 className="my-list-card-title">{item.title || 'Untitled'}</h3>
                      {item.year && item.year !== 'N/A' && (
                        <span className="my-list-card-year">{item.year}</span>
                      )}
                    </div>
                  </Link>
                  <button
                    className="my-list-remove-btn"
                    onClick={() => toggleBookmark(item)}
                    aria-label={`Remove ${item.title} from My List`}
                    title="Remove from My List"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}