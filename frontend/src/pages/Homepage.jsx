import './Homepage.css';
import { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import Main from '../components/Homepagemain.jsx';
import usePageMeta from '../hooks/usePageMeta';

const getStoredTheme = () => {
    try {
        return localStorage.getItem('jinflix-theme') || 'dark';
    } catch {
        return 'dark';
    }
};

function Homepage({ mediaType = 'all' }) {
    const [theme, setTheme] = useState(getStoredTheme);
    const pageLabel = mediaType === 'movie' ? 'Movies' : mediaType === 'tv' ? 'Series' : 'Movies and Series';
    const pageTitle = `JinFlix | ${pageLabel} to Watch`;
    const description = `Browse ${mediaType === 'movie' ? 'movies' : mediaType === 'tv' ? 'series' : 'movies and series'} on JinFlix and try playback through available embedded providers. Availability may vary.`;

    useEffect(() => {
        document.body.dataset.theme = theme;
        try {
            localStorage.setItem('jinflix-theme', theme);
        } catch {
            // Theme remains usable when browser storage is unavailable.
        }

        return () => {
            document.body.removeAttribute('data-theme');
        };
    }, [theme]);

    usePageMeta(pageTitle, description);

    return (
        <div className="body">
            <Header theme={theme} setTheme={setTheme} showHero={mediaType !== 'tv'} />
            <Main mediaType={mediaType} />
        </div>
    );
}

export default Homepage;