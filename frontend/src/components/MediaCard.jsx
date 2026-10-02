import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';

const FALLBACK_POSTER = 'https://via.placeholder.com/300x450/181820/ffffff?text=No+Poster';

function MediaCard({
  title = 'Untitled',
  poster,
  rating = 0,
  year,
  genre,
  href = '#',
  trailerHref
}) {
  const [imgSrc, setImgSrc] = useState(poster || FALLBACK_POSTER);

  // Detect if the trailer URL points to an external site (YouTube, Vimeo, etc.)
  const isExternalTrailer = trailerHref?.startsWith('http') || trailerHref?.startsWith('//');

  return (
    <article className="movie-card">
      {/* Poster Image */}
      <Link to={href} className="movie-card-link" aria-label={`Watch ${title}`}>
        <img
          src={imgSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setImgSrc(FALLBACK_POSTER)}
        />
      </Link>

      {/* Content & Actions */}
      <div className="movie-meta">
        <h3 className="movie-title">{title}</h3>

        <div className="sub-meta">
          {year && <span className="movie-year">{year}</span>}
          {genre && <span className="movie-genre">{genre}</span>}
        </div>

        {rating > 0 && (
          <p className="rating-row">
            <FaStar className="star-icon" />
            <span>{Number(rating).toFixed(1)}</span>
          </p>
        )}

        {/* Primary Watch Action */}
        <Link to={href} className="details-button">
          Watch now
        </Link>

        {/* Dynamic Trailer Action (Internal Route vs External Link) */}
        {trailerHref && (
          isExternalTrailer ? (
            <a
              href={trailerHref}
              target="_blank"
              rel="noopener noreferrer"
              className="trailer-button"
            >
              Watch Trailer
            </a>
          ) : (
            <Link to={trailerHref} className="trailer-button">
              Watch Trailer
            </Link>
          )
        )}
      </div>
    </article>
  );
}

export default MediaCard;