import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import MediaRow from '../components/MediaRow';
import { getPerson, getPersonCredits } from '../api/media';
import { createRequestGuard, isAbortError } from '../api/requestGuard';
import usePageMeta from '../hooks/usePageMeta';
import './PersonPage.css';

const FALLBACK_PROFILE = 'https://placehold.co/500x750/17171d/ffffff?text=Person';

/** "1969-08-18" -> "August 18, 1969". Returns null for missing or junk dates. */
function formatDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Person ids are stable, but stray values must not reach the API. */
function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function PersonPage() {
  const { id } = useParams();
  const personId = parseId(id);

  const [person, setPerson] = useState(null);
  const [credits, setCredits] = useState({ movies: [], tv_series: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageMeta(
    person ? `${person.name} | JinFlix` : 'Cast & Crew | JinFlix',
    person?.biography?.slice(0, 180) || 'Explore biography and filmography on JinFlix.',
  );

  const guard = useMemo(() => createRequestGuard(), []);
  useEffect(() => () => guard.abort(), [guard]);

  useEffect(() => {
    if (!personId) {
      setError('That profile link is not valid.');
      setLoading(false);
      return undefined;
    }

    const signal = guard.start();
    let active = true;

    setLoading(true);
    setError('');
    setPerson(null);
    setCredits({ movies: [], tv_series: [] });

    Promise.all([getPerson(personId, { signal }), getPersonCredits(personId, {}, { signal })])
      .then(([details, filmography]) => {
        if (!active) return;
        setPerson(details);
        setCredits({
          movies: filmography?.movies ?? [],
          tv_series: filmography?.tv_series ?? [],
        });
      })
      .catch((err) => {
        if (!active || isAbortError(err)) return;
        setError('We could not load this profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [personId, guard]);

  if (loading) {
    return (
      <main className="person-page">
        <div className="person-state" role="status">
          <div className="person-spinner" aria-hidden="true" />
          <p>Loading profile...</p>
        </div>
      </main>
    );
  }

  if (error || !person) {
    return (
      <main className="person-page">
        <div className="person-state" role="alert">
          <p>{error || 'This profile is unavailable.'}</p>
          <button type="button" className="person-btn-secondary" onClick={() => window.history.back()}>
            Go back
          </button>
        </div>
      </main>
    );
  }

  const born = formatDate(person.birthday);
  const died = formatDate(person.deathday);
  const lifespan = born
    ? `${born}${died ? ` — ${died}` : ' — present'}`
    : died
      ? `Died ${died}`
      : null;
  const aliasLine = person.also_known_as.filter((name) => name !== person.name);
  const movieCount = credits.movies.length;
  const seriesCount = credits.tv_series.length;

  const facts = [
    person.known_for_department && { label: 'Known for', value: person.known_for_department },
    lifespan && { label: 'Born', value: lifespan },
    person.place_of_birth && { label: 'Place of birth', value: person.place_of_birth },
    aliasLine.length > 0 && { label: 'Also known as', value: aliasLine.join(', ') },
  ].filter(Boolean);

  return (
    <main className="person-page">
      <section className="person-hero">
        <div className="person-hero-inner">
          <button
            type="button"
            className="person-back-link"
            onClick={() => window.history.back()}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="person-hero-grid">
            <div className="person-portrait-wrap">
              <img
                src={person.profile || FALLBACK_PROFILE}
                alt={`${person.name} portrait`}
                className="person-portrait"
                loading="eager"
                decoding="async"
              />
            </div>

            <div className="person-hero-content">
              <p className="person-kicker">
                {person.known_for_department || 'Cast & Crew'}
              </p>
              <h1>{person.name}</h1>

              {facts.length > 0 && (
                <dl className="person-facts">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>
      </section>

      {(movieCount > 0 || seriesCount > 0) && (
        <p className="person-tally">
          {movieCount} {movieCount === 1 ? 'title' : 'titles'}
          {seriesCount > 0 ? ` and ${seriesCount} series` : ''} on JinFlix
        </p>
      )}

      {person.biography && (
        <section className="person-section" aria-labelledby="person-bio-heading">
          <h2 id="person-bio-heading">Biography</h2>
          {person.biography.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index} className="person-bio-text">
              {paragraph.trim()}
            </p>
          ))}
        </section>
      )}

      <MediaRow
        id="person-movies"
        title="Movies"
        items={credits.movies}
        emptyMessage="No movies are listed for this person yet."
      />

      <MediaRow
        id="person-series"
        title="Series"
        items={credits.tv_series}
        emptyMessage="No series are listed for this person yet."
      />

      <div className="person-foot">
        <Link to="/movies" className="person-btn-secondary">
          Browse movies
        </Link>
        <Link to="/series" className="person-btn-secondary">
          Browse series
        </Link>
      </div>
    </main>
  );
}
