import './footer.css';
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube } from 'react-icons/fa';

function Footer() {

  const handleExploreClick = (event, sectionId) => {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="footer-section">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-brand-header">
            <img
              src="https://i.postimg.cc/cLwjf5Q2/Gemini-Generated-Image-nhc9clnhc9clnhc9.jpg"
              alt="JinFlix logo"
              className="footer-brand-logo"
            />
            <h3>JinFlix</h3>
          </div>
          <p>
            Discover the latest movies, trending series and hidden gems in one cinematic space.
            JinFlix helps you browse smarter and find your next favorite watch.
          </p>
          <div className="social-icons" aria-label="Social media links">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
              <FaTwitter />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
              <FaYoutube />
            </a>
          </div>
        </div>

        <div className="footer-links">
          <h4>Explore</h4>
          <ul>
            <li><a href="#coming-soon" onClick={(event) => handleExploreClick(event, 'coming-soon')}>Popular Movies</a></li>
            <li><a href="#trending-now" onClick={(event) => handleExploreClick(event, 'trending-now')}>Trending Series</a></li>
            <li><a href="#popular-series" onClick={(event) => handleExploreClick(event, 'popular-series')}>Top Rated</a></li>
            <li><a href="#coming-soon" onClick={(event) => handleExploreClick(event, 'coming-soon')}>New Releases</a></li>
          </ul>
        </div>

        <div className="support-box">
          <h4>Support JinFlix</h4>
          <a href="https://www.buymeacoffee.com/Olinyo" target="_blank" rel="noreferrer">
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me a Coffee"
              style={{ height: '40px', width: '146px' }}
            />
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2026 JinFlix. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;