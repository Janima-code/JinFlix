import { useState, useEffect } from 'react';
import Header from '../components/Header.jsx';
import Main from '../components/Homepagemain.jsx';
import usePageMeta from '../hooks/usePageMeta';

const THEME_STORAGE_KEY = 'jinflix-theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

const PAGE_LABELS = {
  all: ['Movies and Series', 'movies and series'],
  movie: ['Movies', 'movies'],
  tv: ['Series', 'series'],
};

function Homepage({ mediaType = 'all' }) {
  const [theme] = useState(getStoredTheme);
  const [label, subject] = PAGE_LABELS[mediaType] ?? PAGE_LABELS.all;

  useEffect(() => {
    document.body.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme stays applied for this session even without storage access.
    }

    return () => document.body.removeAttribute('data-theme');
  }, [theme]);

  usePageMeta(
    `JinFlix | ${label} to Watch`,
    `Browse ${subject} on JinFlix and try playback through the available embedded providers. Availability may vary.`
  );

  return (
    <div className="body">
      <Header />
      <Main mediaType={mediaType} />
    </div>
  );
}

export default Homepage;