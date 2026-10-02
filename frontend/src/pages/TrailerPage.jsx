import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import usePageMeta from '../hooks/usePageMeta';
import './TrailerPage.css';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function TrailerPage() {
  const { type, id } = useParams();
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const detailPath = mediaType === 'tv' ? `/series/${id}` : `/movie/${id}`;
  const [title, setTitle] = useState('');
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageMeta(
    trailer ? `${title} Official Trailer | JinFlix` : 'Official Trailer | JinFlix',
    `Watch the official ${title || 'title'} trailer on JinFlix.`
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setTrailer(null);

    const fetchTrailer = async () => {
      try {
        const [detailsResponse, videosResponse] = await Promise.all([
          axios.get(`${TMDB_BASE_URL}/${mediaType}/${id}`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' },
            signal: controller.signal
          }),
          axios.get(`${TMDB_BASE_URL}/${mediaType}/${id}/videos`, {
            params: { api_key: TMDB_API_KEY, language: 'en-US' },
            signal: controller.signal
          })
        ]);
        if (controller.signal.aborted) return;

        const mediaTitle = detailsResponse.data.title || detailsResponse.data.name || 'Untitled';
        const trailers = (videosResponse.data.results || []).filter(
          (video) => video.site === 'YouTube' && video.type === 'Trailer'
        );
        const officialTrailer = trailers.find((video) => video.official) || trailers[0];
        setTitle(mediaTitle);
        if (officialTrailer) {
          setTrailer(officialTrailer);
        } else {
          setError('No official trailer is available for this title.');
        }
      } catch {
        if (!controller.signal.aborted) setError('Could not load this trailer right now.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchTrailer();
    return () => controller.abort();
  }, [id, mediaType]);

  return (
    <main className="trailer-page">
      <div className="trailer-page-inner">
        <Link to={detailPath} className="trailer-back-link">Back to {mediaType === 'tv' ? 'series' : 'movie'}</Link>
        <h1>{title ? `${title} Official Trailer` : 'Official Trailer'}</h1>

        {loading ? (
          <div className="trailer-loading" role="status">Loading trailer...</div>
        ) : trailer ? (
          <div className="trailer-page-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailer.key}`}
              title={`${title} official trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="trailer-page-message" role="status">{error}</p>
        )}
      </div>
    </main>
  );
}

export default TrailerPage;