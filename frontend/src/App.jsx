import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Homepage from './pages/Homepage';
import MovieDetailPage from './pages/MovieDetailPage';
import SeriesDetailPage from './pages/SeriesDetailPage';
import TrailerPage from './pages/TrailerPage';
import WatchPage from './pages/WatchPage'; // New standalone watch page
import { MediaStateProvider } from './context/MediaStateContext';

export default function App() {
  return (
    <MediaStateProvider>
      <Routes>
        <Route path="/" element={<Homepage mediaType="all" />} />
        <Route path="/movies" element={<Homepage mediaType="movie" />} />
        <Route path="/series" element={<Homepage mediaType="tv" />} />

        {/* Detail Routes */}
        <Route path="/movie/:id" element={<MovieDetailPage mediaType="movie" />} />
        <Route path="/series/:id" element={<SeriesDetailPage />} />

        {/* Standalone Player Routes */}
        <Route path="/trailer/:type/:id" element={<TrailerPage />} />
        <Route path="/watch/:type/:id" element={<WatchPage />} />
      </Routes>
      </MediaStateProvider>
    
  );
}