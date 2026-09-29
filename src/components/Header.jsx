import './Header.css';

function Header({ theme, setTheme }) {
  return (
    <section className="header-section">
      <header className="header-topbar">
        <div className="brand-block">
          <img
            src="https://i.postimg.cc/cLwjf5Q2/Gemini-Generated-Image-nhc9clnhc9clnhc9.jpg"
            alt="JinFlix logo"
            className="brand-logo"
          />
          <span className="brand-name">JinFlix</span>
        </div>

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

      <div className="header-content">
        <h1>Search movies. Find your next favorite.</h1>
        <p>
          Explore popular releases, browse by genre, and open any title to see its details, story, and ratings.
        </p>
      </div>
    </section>
  );
}

export default Header;