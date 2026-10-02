import { createContext, useContext, useState, useEffect } from 'react';

const MediaStateContext = createContext();

// ✅ Helper function exported directly for imports like in SeriesDetailPage.jsx
export function getEpisodeProgressId(seriesId, seasonNumber, episodeNumber) {
  return `${seriesId}_s${seasonNumber}_e${episodeNumber}`;
}

export function MediaStateProvider({ children }) {
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('jinflix_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [episodeProgress, setEpisodeProgress] = useState(() => {
    try {
      const saved = localStorage.getItem('jinflix_episode_progress');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jinflix_bookmarks', JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks to localStorage', e);
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem('jinflix_episode_progress', JSON.stringify(episodeProgress));
    } catch (e) {
      console.error('Failed to save episode progress to localStorage', e);
    }
  }, [episodeProgress]);

  // Toggle bookmark function
  const toggleBookmark = (item) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === item.id);
      if (exists) {
        return prev.filter((b) => b.id !== item.id);
      }
      return [...prev, item];
    });
  };

  // Toggle or update episode watched status
  const setEpisodeWatched = (episodeDetails, isWatched) => {
    const key = getEpisodeProgressId(
      episodeDetails.seriesId,
      episodeDetails.seasonNumber,
      episodeDetails.episodeNumber
    );

    setEpisodeProgress((prev) => {
      const updated = { ...prev };
      if (isWatched) {
        updated[key] = {
          ...episodeDetails,
          updatedAt: new Date().toISOString(),
        };
      } else {
        delete updated[key];
      }
      return updated;
    });
  };

  return (
    <MediaStateContext.Provider
      value={{
        bookmarks,
        toggleBookmark,
        episodeProgress,
        setEpisodeWatched,
        getEpisodeProgressId,
      }}
    >
      {children}
    </MediaStateContext.Provider>
  );
}

export function useMediaState() {
  const context = useContext(MediaStateContext);
  if (!context) {
    throw new Error('useMediaState must be used within a MediaStateProvider');
  }
  return context;
}