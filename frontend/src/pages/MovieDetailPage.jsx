import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Film, Bookmark, ArrowLeft, Star, Calendar, Clock } from 'lucide-react';
import { useMediaState } from '../context/MediaStateContext';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

export default function MovieDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  const { bookmarks, toggleBookmark } = useMediaState();
  const isBookmarked = bookmarks?.some((b) => String(b.id) === String(id));

  useEffect(() => {
    async function fetchMovieDetails() {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`);
        const data = await res.json();
        setMovie(data);
      } catch (err) {
        console.error('Failed to fetch movie details:', err);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchMovieDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-4">Movie details not found</h2>
        <button
          onClick={() => navigate('/')}
          className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const runtimeHours = Math.floor((movie.runtime || 0) / 60);
  const runtimeMinutes = (movie.runtime || 0) % 60;
  const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : '';

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Top Back Navigation Button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-6 left-6 z-40 flex items-center gap-2 bg-black/60 hover:bg-black/90 text-white px-4 py-2 rounded-full border border-neutral-800 backdrop-blur-md transition-all"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Hero Backdrop Area */}
      <div className="relative w-full h-[65vh] md:h-[75vh]">
        <img
          src={movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : `${IMAGE_BASE_URL}${movie.poster_path}`}
          alt={movie.title}
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent" />
      </div>

      {/* Main Content Details */}
      <div className="max-w-6xl mx-auto px-6 -mt-32 md:-mt-48 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Poster Image */}
          <div className="w-48 md:w-64 flex-shrink-0 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-900">
            <img
              src={`${IMAGE_BASE_URL}${movie.poster_path}`}
              alt={movie.title}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Text & Primary Actions */}
          <div className="flex-1 space-y-4">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{movie.title}</h1>

            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
              {movie.vote_average > 0 && (
                <div className="flex items-center gap-1 text-yellow-400 font-semibold">
                  <Star size={16} fill="currentColor" />
                  <span>{movie.vote_average.toFixed(1)}</span>
                </div>
              )}
              {releaseYear && (
                <div className="flex items-center gap-1">
                  <Calendar size={16} className="text-neutral-500" />
                  <span>{releaseYear}</span>
                </div>
              )}
              {movie.runtime > 0 && (
                <div className="flex items-center gap-1">
                  <Clock size={16} className="text-neutral-500" />
                  <span>{`${runtimeHours}h ${runtimeMinutes}m`}</span>
                </div>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 pt-1">
              {movie.genres?.map((genre) => (
                <span
                  key={genre.id}
                  className="bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 px-3 py-1 rounded-full"
                >
                  {genre.name}
                </span>
              ))}
            </div>

            {/* Overview */}
            <p className="text-neutral-300 leading-relaxed max-w-3xl text-sm md:text-base pt-2">
              {movie.overview}
            </p>

            {/* Clean Action Buttons (Navigates to dedicated pages) */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              {/* Navigate to dedicated Watch page */}
              <button
                onClick={() => navigate(`/watch/movie/${id}`)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-600/20"
              >
                <Play size={20} fill="currentColor" />
                <span>Play Movie</span>
              </button>

              {/* Navigate to dedicated Trailer page */}
              <button
                onClick={() => navigate(`/trailer/movie/${id}`)}
                className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-white font-semibold px-6 py-3 rounded-xl transition-all"
              >
                <Film size={20} />
                <span>Watch Trailer</span>
              </button>

              {/* Bookmark Toggle Button */}
              <button
                onClick={() =>
                  toggleBookmark({
                    id: movie.id,
                    type: 'movie',
                    title: movie.title,
                    poster_path: movie.poster_path,
                  })
                }
                className={`p-3 rounded-xl border transition-all ${
                  isBookmarked
                    ? 'bg-neutral-800 border-red-600 text-red-500'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                }`}
                title={isBookmarked ? 'Remove from My List' : 'Add to My List'}
              >
                <Bookmark size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}