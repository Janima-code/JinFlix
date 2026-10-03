import { Link } from 'react-router-dom';
import { useMediaState } from '../context/MediaStateContext';
import './MyListPage.css';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w300';
const FALLBACK_POSTER = 'https://placehold.co/300x450/17171d/ffffff?text=No+Poster';

export default function MyListPage() {
  const { bookmarks, toggleBookmark } = useMediaState();

  const resolveRoute = (item) => {
    if (item.type === 'tv' || item.type === 'series') return `/series/${item.id}`;
    return `/movie/${item.id}`;
  };

  const getPoster = (item) => {
    if (!item.poster_path) return FALLBACK_POSTER;
    // poster_path may already be a full URL (from HeroBanner watchlist adds)
    if (item.poster_path.startsWith('http')) return item.poster_path;
    return `${IMAGE_BASE_URL}${item.poster_path}`;
  };

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
            {bookmarks.map((item) => (
              <li key={`${item.type}-${item.id}`} className="my-list-card">
                <Link to={resolveRoute(item)} className="my-list-card-link">
                  <div className="my-list-poster-wrap">
                    <img
                      src={getPoster(item)}
                      alt={item.title || 'Poster'}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="my-list-type-badge">
                      {item.type === 'tv' || item.type === 'series' ? 'TV' : 'Film'}
                    </span>
                  </div>
                  <div className="my-list-card-info">
                    <h3 className="my-list-card-title">{item.title || 'Untitled'}</h3>
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
