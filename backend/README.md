# JinFlix Backend

FastAPI service that fronts The Movie Database. It is the only process that
holds the TMDb API key.

## Why it exists

The browser must not talk to TMDb directly. Doing so would ship the API key to
every visitor, duplicate the normalization logic in each React page, and leave
the client without caching. This service owns all three:

- **The API key** — read from `TMDB_API_KEY`, `backend/.env`, or
  `frontend/.env`. There is no fallback literal in the source.
- **One data shape** — every list and search result is normalized to the same
  card, so the frontend never guesses which field holds the title.
- **Caching** — responses are held in memory for 15 minutes per process.

It also owns the **embed provider registry**, so playback URLs are defined once
rather than in three separate frontend files.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and add your key:

```env
TMDB_API_KEY=your_tmdb_api_key_here
```

Then run:

```bash
python -m uvicorn main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/providers` | Embed providers, in display order |
| `GET /api/stream-url` | Resolve an embed URL for a title |
| `GET /api/genres/{movie\|tv}` | Genre list for filter dropdowns |
| `GET /api/catalog?rows=...` | Several catalog rows in one request |
| `GET /api/discover/tv` | Filtered TV discovery |
| `GET /api/search` | Title search |
| `GET /api/media/{movie\|tv}/{id}` | Full title metadata |
| `GET /api/media/{movie\|tv}/{id}/recommendations` | More-like-this row |
| `GET /api/media/tv/{id}/season/{n}` | Episodes for a season |

### Catalog rows

`/api/catalog` accepts any comma-separated subset of: `trending_movies`,
`trending_series`, `popular_movies`, `popular_series`, `upcoming_movies`,
`upcoming_series`, `top_rated_movies`, `top_rated_series`,
`airing_today_series`, `cutie_movies`, `anime_movies`. Every requested key is
always present in the response; a row that fails upstream comes back empty
rather than failing the request.

A row name this API does not recognise comes back empty too, and the others
still load. That keeps a version skew harmless: a deployed frontend that is
newer than the deployed API asks for a row the API has not shipped yet, and
only that one row is missing instead of the whole catalog erroring out. A
request where *no* row is recognised is a genuine `400`.

### Keyword-driven rows

Two rows are driven by TMDb keywords rather than genres, because TMDb has no
"Cartoon" or "Anime" genre. Both ids are constants at the top of
`tmdb_service.py`; change one there to re-point a row.

| Row | Keyword | Id | Endpoint |
| --- | --- | --- | --- |
| `cutie_movies` | `cartoon` | 6513 | `/keyword/6513/movies` |
| `anime_movies` | `anime` | 210024 | `/keyword/210024/movies` |

`anime_movies` is deliberately movie-only: TMDb returns 404 for
`/keyword/210024/tv`, so there is no `anime_series` row. When either keyword
returns nothing, the row is empty and the frontend hides it.

## Card shape

```json
{
  "id": 550,
  "tmdb_id": 550,
  "media_type": "movie",
  "title": "Fight Club",
  "year": "1999",
  "release_date": "1999-10-15",
  "poster": "https://image.tmdb.org/t/p/w500/...",
  "backdrop": "https://image.tmdb.org/t/p/original/...",
  "rating": 8.4,
  "vote_average": 8.4,
  "vote_count": 26280,
  "overview": "A ticking-time-bomb insomniac...",
  "genres": ["Drama", "Thriller"],
  "original_language": "EN"
}
```

## Details payload

`/api/media/{type}/{id}` returns more than the card shape, including
`runtime_minutes` (an integer, or `null` when TMDb has no runtime on file) and
`runtime` (the preformatted label, e.g. `"139 min"` or `"42 min/ep"`). The
frontend formats the numeric field so it never has to parse a display string,
but both are published to keep existing clients working.

Upstream failures raise `TmdbError` rather than returning empty data, so a
TMDb outage surfaces as `502` instead of a misleading `404`:

- `400` — bad query parameter (`media_type`, empty `rows`)
- `404` — the title or season genuinely does not exist on TMDb
- `502` — TMDb is unreachable or erroring
- `503` — no API key is configured

A missing season returns `200` with an empty `episodes` array rather than a 404,
so the series page can render "no episodes listed" instead of an error.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `TMDB_API_KEY` | — | TMDb key. Required. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins. **Required for any deployed frontend.** |

Credentials are only enabled when the origin list is explicit. A wildcard
origin combined with credentials is rejected by browsers, so the two are not
enabled together.

### Deploying the frontend and API to different domains

The frontend and the API must be able to call each other cross-origin, so the
API's origin list has to name the frontend's origin. Unset, the API allows only
localhost and a deployed frontend is blocked by the browser:

```
Access to fetch at 'https://api.example.com/api/catalog' from origin
'https://app.example.com' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

Set the variable on the API host (Render, Railway, Fly, Cloud Run, ...):

```
CORS_ORIGINS=https://jinflix.vercel.app,https://www.jinflix.vercel.app
```

Rules that trip this up:

- Origins are **exact and case-sensitive**: scheme, host, and port must match
  what the browser sends. Use `https://` for the deployed site, not `http://`.
- Include the `www.` host as a separate entry if it is a different site.
- No trailing slash, and no path (`https://app.vercel.app`, not
  `https://app.vercel.app/`).
- A disallowed origin gets a normal `200` with no `Access-Control-Allow-Origin`
  header, so the API logs stay clean and only the browser reports it. The
  service therefore logs its effective origin list at startup and warns loudly
  when `CORS_ORIGINS` is unset — check the API host's logs first.

To confirm from a shell before blaming the browser:

```bash
curl -i -H "Origin: https://jinflix.vercel.app" https://<api-host>/api/providers
```

A `200` with the header present is working; no header means the origin is not
in the list.

## CLI

`fetch_metadata.py` exposes the same service for inspection and for
regenerating the frontend's static fallback catalog:

```bash
python fetch_metadata.py --id 550
python fetch_metadata.py --type tv --id 1399 --season 1
python fetch_metadata.py --trending --limit 10 --export ../frontend/src/Movies.json
python fetch_metadata.py --search "Interstellar"
python fetch_metadata.py --catalog trending_movies,popular_series
```