import './Header.css';
import { Link, NavLink } from 'react-router-dom';

function Header() {
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
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/series">Series</NavLink>
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