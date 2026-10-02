import { useParams, Link } from 'react-router-dom';

export default function SeriesDetailsPage({ seriesData, loading, error }) {
  const { id } = useParams();

  // Find series from state or fallback
  const series = seriesData?.find((item) => String(item.id) === String(id));

  if (loading) return <div className="main-section"><p>Loading series details...</p></div>;
  if (error || !series) return <div className="main-section"><p role="alert">Series not found.</p></div>;

  const backdrop = series.backdrop_path || series.poster_path;
  const rating = series.vote_average ? series.vote_average.toFixed(1) : 'N/A';

  return (
    <div className="main-section series-details-page">
      <Link to="/series" className="back-link">← Back to Series</Link>

      {/* Hero Banner */}
      <div 
        className="details-hero"
        style={backdrop ? { backgroundImage: `url(https://image.tmdb.org/t/p/original${backdrop})` } : undefined}
      >
        <div className="details-hero-overlay">
          <h1>{series.name || series.Title}</h1>
          <p className="details-meta">
            <span>★ {rating}/10</span>
            <span>{series.first_air_date?.slice(0, 4) || series.Year}</span>
            {series.number_of_seasons && <span>{series.number_of_seasons} Seasons</span>}
          </p>
          <p className="details-overview">{series.overview || 'No overview available.'}</p>
        </div>
      </div>

      {/* Embedded Player Section */}
      <section className="player-section">
        <h2>Watch Now</h2>
        <div className="video-responsive">
          <iframe
            src={`https://www.2embed.cc/embedtv/${series.id}`}
            title={series.name || series.Title}
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}