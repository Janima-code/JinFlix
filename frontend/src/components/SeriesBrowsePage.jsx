import { Link } from 'react-router-dom';
import MediaRow from './MediaRow';

function SeriesBrowsePage({
  loading,
  error,
  trending,
  popular,
  topRated,
  onTheAir,
  airingToday,
  genres,
  selectedGenre,
  onGenreChange,
  selectedYear,
  onYearChange,
  sortBy,
  onSortChange,
  discovered,
  discoverLoading,
  discoverError
}) {
  if (error && !loading) {
    return <div className="main-section"><p role="alert">{error}</p></div>;
  }

  const featuredSeries = [...trending].sort(
    (left, right) => Number(right.popularity || 0) - Number(left.popularity || 0)
  )[0];
  const featuredBackdrop = featuredSeries?.backdrop_path || featuredSeries?.poster_path;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, index) => String(currentYear - index));

  return (
    <div className="main-section series-page">
      <section
        className="series-featured"
        style={featuredBackdrop ? {
          backgroundImage: `linear-gradient(90deg, rgba(8, 8, 10, 0.94) 0%, rgba(8, 8, 10, 0.72) 48%, rgba(8, 8, 10, 0.12) 100%), url("https://image.tmdb.org/t/p/original${featuredBackdrop}")`
        } : undefined}
      >
        {featuredSeries ? (
          <div className="series-featured-content">
            <p className="series-featured-kicker">Featured series</p>
            <h1>{featuredSeries.Title}</h1>
            <p className="series-featured-meta">
              {featuredSeries.Year} <span aria-hidden="true">·</span> {featuredSeries.vote_average?.toFixed(1) || 'N/A'}/10
            </p>
            <p className="series-featured-overview">{featuredSeries.overview || 'Explore this series and its available episodes.'}</p>
            <Link to={`/series/${featuredSeries.id}`} className="series-featured-link">View series</Link>
          </div>
        ) : loading ? (
          <div className="series-featured-skeleton" role="status" aria-label="Loading featured series">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="series-featured-content"><h1>Series to watch</h1></div>
        )}
      </section>

      <section className="series-filter-section" aria-label="Filter series">
        <label>
          Genre
          <select value={selectedGenre} onChange={(event) => onGenreChange(event.target.value)}>
            <option value="">All genres</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>{genre.name}</option>
            ))}
          </select>
        </label>
        <label>
          First air year
          <select value={selectedYear} onChange={(event) => onYearChange(event.target.value)}>
            <option value="">Any year</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value)}>
            <option value="popularity.desc">Most popular</option>
            <option value="vote_average.desc">Top rated</option>
            <option value="first_air_date.desc">Newest first</option>
            <option value="first_air_date.asc">Oldest first</option>
          </select>
        </label>
      </section>

      {discoverError ? <p className="empty-state" role="alert">{discoverError}</p> : null}
      <MediaRow id="series-discover" title="Browse Series" items={discovered.slice(0, 12)} loading={discoverLoading} emptyMessage="No series match these filters." />
      <MediaRow id="series-trending" title="Trending" items={trending.slice(0, 12)} loading={loading} emptyMessage="No trending series found." />
      <MediaRow id="series-popular" title="Popular" items={popular.slice(0, 12)} loading={loading} emptyMessage="No popular series found." />
      <MediaRow id="series-top-rated" title="Top Rated" items={topRated.slice(0, 12)} loading={loading} emptyMessage="No top-rated series found." />
      <MediaRow id="series-on-the-air" title="On the Air" items={onTheAir.slice(0, 12)} loading={loading} emptyMessage="No series are currently listed as on the air." />
      <MediaRow id="series-airing-today" title="Airing Today" items={airingToday.slice(0, 12)} loading={loading} emptyMessage="No series are listed as airing today." />
    </div>
  );
}

export default SeriesBrowsePage;