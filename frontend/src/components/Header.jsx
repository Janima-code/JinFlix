import './Header.css';
import { Link, NavLink, useLocation } from 'react-router-dom';

function Header() {
  const { search } = useLocation();

  // Home, Movies and Series are three views of the same catalog, so they hand
  // the active filters to each other. A bare `to="/movies"` drops the query
  // string, which left the URL saying one thing and the mounted page still
  // holding the previous filter until an effect silently reset it.
  const catalogLink = (pathname) => ({ pathname, search });

  return (
    <header className="header-topbar-wrapper">
      <div className="header-topbar">
        <Link to="/" className="brand-block">
          <img style={{ width: '60px', height: '60px', marginRight: '6px', marginLeft: '12px' }}
            src="https://i.postimg.cc/cLwjf5Q2/Gemini-Generated-Image-nhc9clnhc9clnhc9.jpg"
            alt="JinFlix logo"
            className="brand-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="brand-name" >JinFlix</span>
        </Link>

        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to={catalogLink('/')} end>Home</NavLink>
          <NavLink to={catalogLink('/movies')}>Movies</NavLink>
          <NavLink to={catalogLink('/series')}>Series</NavLink>
          <NavLink to="/my-list">My List</NavLink>
        </nav>

        <div className="header-actions">
          <a
            href="https://www.buymeacoffee.com/Olinyo"
            target="_blank"
            rel="noreferrer"
            className="coffee-button-link"
          >
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy me a coffee"
              style={{ height: '36px', width: '120px' }}
            />
          </a>
        </div>
      </div>
    </header>
  );
}

export default Header;