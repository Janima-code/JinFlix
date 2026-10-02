import { createContext, useContext, useEffect, useState } from 'react';

const MediaStateContext = createContext(null);
const EPISODE_PROGRESS_KEY = 'jinflix-episode-progress';

const readStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const getEpisodeProgressId = (seriesId, seasonNumber, episodeNumber) =>
  `${seriesId}:${seasonNumber}:${episodeNumber}`;

export function MediaStateProvider({ children }) {
  const [episodeProgress, setEpisodeProgress] = useState(() => readStorage(EPISODE_PROGRESS_KEY, {}));

  useEffect(() => {
    try {
      localStorage.setItem(EPISODE_PROGRESS_KEY, JSON.stringify(episodeProgress));
    } catch {
      return;
    }
  }, [episodeProgress]);

  const setEpisodeWatched = (record, watched) => {
    const key = getEpisodeProgressId(record.seriesId, record.seasonNumber, record.episodeNumber);
    setEpisodeProgress((current) => {
      if (!watched) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: { ...record, updatedAt: Date.now() } };
    });
  };

  return (
    <MediaStateContext.Provider value={{ episodeProgress, setEpisodeWatched }}>
      {children}
    </MediaStateContext.Provider>
  );
}

export function useMediaState() {
  const context = useContext(MediaStateContext);
  if (!context) throw new Error('useMediaState must be used within MediaStateProvider.');
  return context;
}