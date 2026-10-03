import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MediaStateContext,
  getBookmarkKey,
  getEpisodeProgressId,
  normalizeBookmark,
  normalizeBookmarks,
} from './mediaState';

const BOOKMARKS_STORAGE_KEY = 'jinflix_bookmarks';
const PROGRESS_STORAGE_KEY = 'jinflix_episode_progress';

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to persist ${key}`, error);
  }
}

/**
 * Holds everything the app remembers between visits: the My List and per-episode
 * watch progress. Both live in localStorage; there is no account system.
 */
export function MediaStateProvider({ children }) {
  const [bookmarks, setBookmarks] = useState(() =>
    normalizeBookmarks(readStorage(BOOKMARKS_STORAGE_KEY, []))
  );
  const [episodeProgress, setEpisodeProgress] = useState(() =>
    readStorage(PROGRESS_STORAGE_KEY, {})
  );

  useEffect(() => {
    writeStorage(BOOKMARKS_STORAGE_KEY, bookmarks);
  }, [bookmarks]);

  useEffect(() => {
    writeStorage(PROGRESS_STORAGE_KEY, episodeProgress);
  }, [episodeProgress]);

  const toggleBookmark = useCallback((item) => {
    const bookmark = normalizeBookmark(item);
    const key = getBookmarkKey(bookmark);
    if (!key) return;

    setBookmarks((prev) => {
      const exists = prev.some((b) => getBookmarkKey(b) === key);
      if (exists) return prev.filter((b) => getBookmarkKey(b) !== key);
      return [...prev, bookmark];
    });
  }, []);

  const isBookmarked = useCallback(
    (item) => {
      const key = getBookmarkKey(normalizeBookmark(item));
      return key ? bookmarks.some((b) => getBookmarkKey(b) === key) : false;
    },
    [bookmarks]
  );

  const setEpisodeWatched = useCallback((episodeDetails, isWatched) => {
    const key = getEpisodeProgressId(
      episodeDetails.seriesId,
      episodeDetails.seasonNumber,
      episodeDetails.episodeNumber
    );

    setEpisodeProgress((prev) => {
      if (!isWatched) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: { ...episodeDetails, updatedAt: new Date().toISOString() },
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      bookmarks,
      toggleBookmark,
      isBookmarked,
      episodeProgress,
      setEpisodeWatched,
    }),
    [bookmarks, toggleBookmark, isBookmarked, episodeProgress, setEpisodeWatched]
  );

  return (
    <MediaStateContext.Provider value={value}>
      {children}
    </MediaStateContext.Provider>
  );
}