import './Homepage.css';
import { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import Main from '../components/Homepagemain.jsx';

function Homepage() {
    const [theme, setTheme] = useState('dark');
    const [activeNav, setActiveNav] = useState('Movies');

    useEffect(() => {
        document.body.dataset.theme = theme;
        document.title = 'JinFlix | Discover Movies & Series';

        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
        }
        metaDescription.setAttribute(
            'content',
            'JinFlix helps you discover trending movies, top-rated series, and detailed streaming info powered by TMDb ratings.'
        );

        return () => {
            document.body.removeAttribute('data-theme');
        };
    }, [theme]);

    return (
        <div className="body">
            <Header theme={theme} setTheme={setTheme} activeNav={activeNav} setActiveNav={setActiveNav} />
            <Main />
        </div>
    );
}

export default Homepage;