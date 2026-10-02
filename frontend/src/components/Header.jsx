import './Header.css';
import { Link, NavLink } from 'react-router-dom';

function Header({ theme, setTheme, showHero = true }) {
  return (
    <section className={showHero ? 'header-section' : 'header-section header-section-compact'}>
      <header className="header-topbar">
        <Link to="/" className="brand-block">
          <img
            src="https://i.postimg.cc/cLwjf5Q2/Gemini-Generated-Image-nhc9clnhc9clnhc9.jpg"
            alt="JinFlix logo"
            className="brand-logo"
          />
          <span className="brand-name">JinFlix</span>
        </Link>

        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/series">Series</NavLink>
        </nav>

        <div className="header-actions">
          <a href="https://www.buymeacoffee.com/Olinyo" target="_blank" rel="noreferrer">
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me a Coffee"
              style={{ height: '40px', width: '146px' }}
            />
          </a>

          <button
            type="button"
            className="theme-toggle"
            aria-label="Toggle dark mode"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {showHero ? (
        <div className="header-content">
          <h1>Choose a title. Start watching.</h1>
          
        </div>
      ) : null}
    </section>
  );
}

export default Header;