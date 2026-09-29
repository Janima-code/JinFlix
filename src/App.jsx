
import './App.css';
import { Route, Routes } from 'react-router-dom';
import Homepage from './pages/Homepage';
import MovieDetailPage from './pages/MovieDetailPage';
import Footer from './components/footer';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/:type/:id" element={<MovieDetailPage />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
