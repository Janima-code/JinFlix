# JinFlix

A React + Vite movie and series browser. The FastAPI service in `../backend`
supplies all metadata; this app never calls TMDb directly.

## Running it

Two processes are needed. Start the backend first:

```bash
cd ../backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Then the frontend:

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`, so the browser only ever makes
same-origin requests and CORS never enters the picture in development.

## Configuration

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_BASE_URL=
```

Leave it empty for local development and for any deploy that serves the API
under the same origin. Set it to a bare origin such as `https://api.example.com`
to point at a separately hosted backend. Do **not** include a trailing `/api` —
request paths already carry that prefix.

No TMDb key is needed here. The backend holds it.

## Architecture

```
src/
  api/
    client.js       fetch wrapper: TTL cache, request de-duplication, abort support
    media.js        typed wrappers for each backend route
    requestGuard.js per-effect cancellation so stale responses cannot win
  context/
    mediaState.js        context object, bookmark/progress keys, useMediaState
    MediaStateContext.jsx provider that persists to localStorage
  components/    Header, HeroBanner, Homepagemain, MediaRow, MediaCard, ErrorBoundary
  pages/         Homepage, MovieDetailPage, SeriesDetailPage, TrailerPage, WatchPage, MyListPage
```

### Data flow

Every page reads the same normalized card shape produced by the backend, so
there is no per-page field guessing:

```js
{ id, tmdb_id, media_type, title, year, release_date, poster, backdrop,
  rating, vote_average, vote_count, overview, genres, original_language }
```

The homepage issues **one** request per load (`/api/catalog`) instead of a dozen
parallel TMDb calls. Navigating back to a page the client already fetched within
the last 60 seconds is served from memory.

### Cancellable loads

`createRequestGuard()` gives each effect an `AbortController` that supersedes the
previous one, so switching series or episodes quickly cannot let an older
response overwrite a newer one:

```js
const guard = useMemo(() => createRequestGuard(), []);

useEffect(() => {
  const signal = guard.start();
  getMediaDetails('tv', id, { signal })
    .then((data) => { if (guard.isCurrent(signal)) setSeries(data); })
    .catch((err) => { if (!guard.isCurrent(signal) || isAbortError(err)) return; });
  return () => guard.abort();
}, [id, guard]);
```

### Playback

The embed provider list lives in the backend (`/api/providers`) and URLs are
resolved through `/api/stream-url`, so provider templates appear in exactly one
place. `WatchPage` fetches the list, offers a selector, and requests a URL for
the chosen provider.

### Local state

My List bookmarks and per-episode watch progress persist to `localStorage`.
Bookmarks are keyed on `type:id`, because TMDb ids are only unique per media
type — movie 550 and TV series 550 are different titles.

Stored bookmarks are normalized on read (`normalizeBookmarks`), so lists saved
before the backend migration keep working. Earlier versions stored a bare TMDb
path in `poster_path` and used capitalised `Title`/`Poster` keys; those are
mapped onto `poster`/`title`, and the legacy path is expanded to a full image
URL. New entries are stored in the canonical shape, so the migration stops
mattering once a title is re-saved.

### Runtime display

Movie details expose `runtime_minutes` as a number alongside the `runtime`
label ("2h 19m"). `MovieDetailPage` formats the numeric field and still parses
the older display string, so cached payloads and the `src/Movies.json` fallback
remain readable.

## Scripts

```bash
npm run dev      # dev server with /api proxy
npm run build    # production build to dist/
npm run preview  # serve the production build
npm run lint     # eslint
```

## Notes

- `src/Movies.json` is a static fallback catalog. It only fills gaps when the
  backend is unreachable; live data always wins.
- `api/share.js` is a Vercel serverless function that renders bot-readable
  Open Graph HTML for title URLs, so link previews render without executing the
  SPA.