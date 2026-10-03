import { Routes, Route } from 'react-router-dom';
import Homepage from './pages/Homepage';
import MovieDetailPage from './pages/MovieDetailPage';
import SeriesDetailPage from './pages/SeriesDetailPage';
import PersonPage from './pages/PersonPage';
import TrailerPage from './pages/TrailerPage';
import WatchPage from './pages/WatchPage';
import MyListPage from './pages/MyListPage';
import { MediaStateProvider } from './context/MediaStateContext';

export default function App() {
  return (
    <MediaStateProvider>
      <Routes>
        <Route path="/" element={<Homepage mediaType="all" />} />
        <Route path="/movies" element={<Homepage mediaType="movie" />} />
        <Route path="/series" element={<Homepage mediaType="tv" />} />

        {/* Detail Routes */}
        <Route path="/movie/:id" element={<MovieDetailPage />} />
        <Route path="/series/:id" element={<SeriesDetailPage />} />
        <Route path="/person/:id" element={<PersonPage />} />

        {/* Standalone Player Routes */}
        <Route path="/trailer/:type/:id" element={<TrailerPage />} />
        <Route path="/watch/:type/:id" element={<WatchPage />} />

        {/* My List */}
        <Route path="/my-list" element={<MyListPage />} />
      </Routes>
    </MediaStateProvider>
  );
}