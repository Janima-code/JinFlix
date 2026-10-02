
import './App.css';
import { Route, Routes } from 'react-router-dom';
import Homepage from './pages/Homepage';
import MovieDetailPage from './pages/MovieDetailPage';
import SeriesDetailPage from './pages/SeriesDetailPage';
import TrailerPage from './pages/TrailerPage';
import StreamingPage from './pages/StreamingPage';
import Footer from './components/footer';
import { MediaStateProvider } from './context/MediaStateContext';

function Browse({ mediaType }) {
  return <Homepage mediaType={mediaType} />;
}

function SeriesDetail() {
  return <SeriesDetailPage />;
}

function MovieDetail() {
  return <MovieDetailPage mediaType="movie" />;
}

function App() {
  return (
    <MediaStateProvider>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/movies" element={<Browse mediaType="movie" />} />
        <Route path="/series" element={<Browse mediaType="tv" />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/movie/:id" element={<MovieDetail />} />
        <Route path="/tv/:id" element={<SeriesDetail />} />
        <Route path="/trailer/:type/:id" element={<TrailerPage />} />
        
      </Routes>
      <Footer />
    </MediaStateProvider>
  );
}

export default App;
