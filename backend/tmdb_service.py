"""TMDb access layer.

Owns every outbound call to The Movie Database: API-key resolution, a pooled
async HTTP client, a short-lived response cache, and the single normalization
shape that the whole app consumes.

Cards are always returned as::

    {
        id, tmdb_id, media_type, title, year, release_date,
        poster, backdrop, rating, vote_average, vote_count,
        overview, genres, original_language
    }

Consumers should never need to guess which field holds the title.
"""

import asyncio
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

TMDB_BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p"
CACHE_TTL = 900  # 15 minutes
REQUEST_TIMEOUT = 10.0

# TMDb has no "Cartoon" genre, so the Cutie row is driven by the `cartoon`
# keyword (id 6513), which covers the animated family titles people mean by it.
# Verify the id still resolves at https://www.themoviedb.org/keyword/6513-cartoon
TMDB_KEYWORD_CARTOON = 6513

# The `anime` keyword (id 210024). Movies only — TMDb has no `/keyword/.../tv`
# for it, so there is deliberately no anime_series row.
# https://www.themoviedb.org/keyword/210024-anime
TMDB_KEYWORD_ANIME = 210024


class TmdbError(RuntimeError):
    """Raised when TMDb is unreachable, misconfigured, or returns an error."""


class TmdbNotFoundError(TmdbError):
    """Raised when TMDb has no record for the requested title.

    Kept separate from :class:`TmdbError` so the API can answer 404 for a title
    that genuinely does not exist instead of blaming the upstream service.
    """


def _load_api_key() -> str:
    """Resolve the TMDb key from the environment, then local .env files."""
    key = os.getenv("TMDB_API_KEY")
    if key:
        return key.strip().strip('"').strip("'")

    candidates = (
        (Path(__file__).resolve().parent / ".env", "TMDB_API_KEY="),
        (
            Path(__file__).resolve().parent.parent / "frontend" / ".env",
            "VITE_TMDB_API_KEY=",
        ),
    )

    for env_path, prefix in candidates:
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith(prefix):
                value = stripped.split("=", 1)[1].strip().strip('"').strip("'")
                if value:
                    return value

    return ""


TMDB_API_KEY = _load_api_key()

_CACHE: Dict[str, tuple[float, Any]] = {}
_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    """Return a lazily-created shared client so connections are pooled."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
    return _client


def _get_from_cache(cache_key: str) -> Optional[Any]:
    entry = _CACHE.get(cache_key)
    if entry is None:
        return None
    timestamp, value = entry
    if time.time() - timestamp < CACHE_TTL:
        return value
    del _CACHE[cache_key]
    return None


def _set_cache(cache_key: str, value: Any) -> None:
    _CACHE[cache_key] = (time.time(), value)


def format_poster(path: Optional[str], size: str = "w500") -> Optional[str]:
    return f"{IMAGE_BASE_URL}/{size}{path}" if path else None


def format_backdrop(path: Optional[str], size: str = "original") -> Optional[str]:
    return f"{IMAGE_BASE_URL}/{size}{path}" if path else None


async def close_client() -> None:
    """Close the pooled client. Call on application shutdown."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


async def _tmdb_get(
    endpoint: str,
    params: Optional[Dict[str, Any]] = None,
    *,
    allow_not_found: bool = False,
) -> Any:
    """Fetch one TMDb endpoint.

    Returns the decoded body, or ``None`` when ``allow_not_found`` is set and
    TMDb reports 404. Any other failure raises :class:`TmdbError` so callers can
    distinguish "does not exist" from "upstream is broken".
    """
    if not TMDB_API_KEY:
        raise TmdbError(
            "TMDB_API_KEY is not configured. Set it in backend/.env or the "
            "TMDB_API_KEY environment variable."
        )

    query: Dict[str, Any] = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        query.update(params)

    try:
        response = await _get_client().get(
            f"{TMDB_BASE_URL}{endpoint}", params=query
        )
    except httpx.HTTPError as exc:
        raise TmdbError(f"TMDb request to {endpoint} failed: {exc}") from exc

    if response.status_code == 404:
        if allow_not_found:
            return None
        raise TmdbNotFoundError(f"TMDb has no record for {endpoint}")

    if response.is_error:
        raise TmdbError(
            f"TMDb responded {response.status_code} for {endpoint}"
        )

    return response.json()


async def _tmdb_get_many(
    requests: List[tuple],
) -> List[Any]:
    """Run several ``_tmdb_get`` calls concurrently.

    ``requests`` is a list of ``(endpoint, params, allow_not_found)`` tuples.
    Optional endpoints resolve to ``None`` on failure so a single degraded
    sub-resource cannot blank out an otherwise valid page.
    """
    results = await asyncio.gather(
        *(
            _tmdb_get(endpoint, params, allow_not_found=allow_not_found)
            for endpoint, params, allow_not_found in requests
        ),
        return_exceptions=True,
    )

    resolved: List[Any] = []
    for result, (endpoint, _, _) in zip(results, requests):
        if isinstance(result, TmdbError):
            resolved.append(None)
        else:
            resolved.append(result)
    return resolved


def _normalize_type(media_type: Optional[str]) -> Optional[str]:
    if media_type in ("tv", "series"):
        return "tv"
    if media_type in ("movie", "film"):
        return "movie"
    return None


def normalize_card(
    item: Dict[str, Any],
    media_type: Optional[str] = None,
    genre_map: Optional[Dict[int, str]] = None,
) -> Dict[str, Any]:
    """Convert any TMDb list/search result into the shared card shape.

    TMDb returns genres as ids on list endpoints and as objects on detail
    endpoints. Passing ``genre_map`` resolves ids to names here, so the card
    shape stays identical either way.
    """
    item_type = _normalize_type(media_type) or _normalize_type(item.get("media_type"))
    title = item.get("title") or item.get("name") or item.get("original_name") or "Untitled"
    release_date = item.get("release_date") or item.get("first_air_date") or ""
    vote_average = float(item.get("vote_average") or 0)

    if genre_map:
        genre_names = [
            genre_map[gid] for gid in (item.get("genre_ids") or []) if gid in genre_map
        ]
    else:
        genre_names = [
            genre["name"]
            for genre in (item.get("genres") or [])
            if isinstance(genre, dict) and genre.get("name")
        ]

    return {
        "id": item.get("id"),
        "tmdb_id": item.get("id"),
        "media_type": item_type,
        "title": title,
        "year": release_date[:4] if release_date else "N/A",
        "release_date": release_date,
        "poster": format_poster(item.get("poster_path")),
        "backdrop": format_backdrop(item.get("backdrop_path")),
        "rating": round(vote_average, 1),
        "vote_average": vote_average,
        "vote_count": item.get("vote_count", 0),
        "overview": item.get("overview") or "",
        "genres": genre_names,
        "original_language": (item.get("original_language") or "en").upper(),
    }


def _normalize_cards(
    payload: Optional[Dict[str, Any]],
    media_type: Optional[str] = None,
    genre_map: Optional[Dict[int, str]] = None,
) -> List[Dict[str, Any]]:
    results = (payload or {}).get("results") or []
    cards = []
    for item in results:
        if not item.get("id"):
            continue
        card = normalize_card(item, media_type, genre_map)
        # People and other non-title entries appear in /search/multi.
        if card["media_type"] not in ("movie", "tv"):
            continue
        cards.append(card)
    return cards


async def get_genre_map(media_type: str = "movie") -> Dict[int, str]:
    """Return ``{genre_id: genre_name}`` for movies or TV."""
    normalized = _normalize_type(media_type) or "movie"
    cache_key = f"genres:{normalized}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    payload = await _tmdb_get(f"/genre/{normalized}/list")
    genre_map = {g["id"]: g["name"] for g in (payload or {}).get("genres", []) if g.get("name")}

    _set_cache(cache_key, genre_map)
    return genre_map


async def get_genres(media_type: str = "movie") -> List[Dict[str, Any]]:
    """Return the genre list as ``[{id, name}]`` for filter dropdowns."""
    normalized = _normalize_type(media_type) or "movie"
    cache_key = f"genre-list:{normalized}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    payload = await _tmdb_get(f"/genre/{normalized}/list")
    genres = [
        {"id": genre["id"], "name": genre["name"]}
        for genre in (payload or {}).get("genres", [])
        if genre.get("name")
    ]

    _set_cache(cache_key, genres)
    return genres


async def get_catalog_rows(
    rows: List[str],
    page: int = 1,
    genre_map: Optional[Dict[int, str]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """Fetch several TMDb list endpoints concurrently.

    ``rows`` names a curated set (``trending_movies``, ``popular_series``,
    ``upcoming_movies``, ``airing_today_series``, ``cutie_movies``,
    ``anime_movies``, ...). Every row is resolved independently; a failing row
    comes back as an empty list, so a row with no TMDb data simply renders as
    nothing rather than an error.
    """
    if genre_map is None:
        movie_map, tv_map = await asyncio.gather(
            get_genre_map("movie"), get_genre_map("tv")
        )
        genre_map = {**movie_map, **tv_map}

    endpoint_specs = {
        "trending_movies": ("/trending/movie/week", None),
        "trending_series": ("/trending/tv/week", None),
        "popular_movies": ("/movie/popular", "movie"),
        "popular_series": ("/tv/popular", "tv"),
        "upcoming_movies": ("/movie/upcoming", "movie"),
        "upcoming_series": ("/tv/on_the_air", "tv"),
        "top_rated_movies": ("/movie/top_rated", "movie"),
        "top_rated_series": ("/tv/top_rated", "tv"),
        "airing_today_series": ("/tv/airing_today", "tv"),
        "cutie_movies": (f"/keyword/{TMDB_KEYWORD_CARTOON}/movies", "movie"),
        "anime_movies": (f"/keyword/{TMDB_KEYWORD_ANIME}/movies", "movie"),
    }

    known = [row for row in rows if row in endpoint_specs]
    unknown = [row for row in rows if row not in endpoint_specs]
    if unknown:
        raise ValueError(f"Unknown catalog rows: {', '.join(unknown)}")

    payloads = await asyncio.gather(
        *(
            _cached_list(endpoint, {"page": page}, cache_key=f"row:{row}:{page}")
            for row, (endpoint, _) in ((r, endpoint_specs[r]) for r in known)
        ),
        return_exceptions=True,
    )

    result: Dict[str, List[Dict[str, Any]]] = {row: [] for row in rows}
    for row, payload in zip(known, payloads):
        if isinstance(payload, BaseException):
            continue
        media_type = endpoint_specs[row][1]
        result[row] = _normalize_cards(payload, media_type, genre_map)

    return result


async def _cached_list(endpoint: str, params: Dict[str, Any], cache_key: str) -> Any:
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached
    payload = await _tmdb_get(endpoint, params, allow_not_found=True)
    _set_cache(cache_key, payload)
    return payload


async def discover_series(
    genre_id: Optional[int] = None,
    year: Optional[int] = None,
    sort_by: str = "popularity.desc",
    page: int = 1,
) -> List[Dict[str, Any]]:
    """Fetch a page of TV shows matching discover filters."""
    params: Dict[str, Any] = {"sort_by": sort_by, "page": page}
    if genre_id:
        params["with_genres"] = genre_id
    if year:
        params["first_air_date_year"] = year

    cache_key = f"discover-tv:{genre_id}:{year}:{sort_by}:{page}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    tv_genres = await get_genre_map("tv")
    payload = await _tmdb_get("/discover/tv", params, allow_not_found=True)

    cards = _normalize_cards(payload, "tv", tv_genres)
    _set_cache(cache_key, cards)
    return cards


async def search_media(
    query: str,
    media_type: str = "all",
    page: int = 1,
) -> List[Dict[str, Any]]:
    """Search TMDb for movies and/or TV shows."""
    query = (query or "").strip()
    if not query:
        return []

    cache_key = f"search:{media_type}:{query.lower()}:{page}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    normalized = _normalize_type(media_type)
    endpoint = f"/search/{normalized}" if normalized else "/search/multi"
    payload = await _tmdb_get(endpoint, {"query": query, "page": page}, allow_not_found=True)

    movie_map, tv_map = await asyncio.gather(
        get_genre_map("movie"), get_genre_map("tv")
    )
    cards = _normalize_cards(payload, normalized, {**movie_map, **tv_map})

    _set_cache(cache_key, cards)
    return cards


async def get_media_details(media_type: str, tmdb_id: int) -> Dict[str, Any]:
    """Full metadata for one movie or TV show.

    Core details, cast, trailer, and legal watch providers are fetched
    concurrently. Optional sub-resources degrade to empty rather than failing
    the whole request.
    """
    normalized = _normalize_type(media_type)
    if normalized is None:
        raise ValueError(f"Unsupported media_type: {media_type}")

    cache_key = f"details:{normalized}:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    base = f"/{normalized}/{tmdb_id}"
    credits_endpoint = f"{base}/credits" if normalized == "movie" else f"{base}/aggregate_credits"

    details_res, credits_res, videos_res, providers_res = await _tmdb_get_many(
        [
            (base, None, False),
            (credits_endpoint, None, True),
            (f"{base}/videos", None, True),
            (f"{base}/watch/providers", None, True),
        ]
    )

    if not details_res:
        raise TmdbNotFoundError(f"TMDb has no record for {normalized}/{tmdb_id}")

    release_date = details_res.get("release_date") or details_res.get("first_air_date") or ""
    genres = [g["name"] for g in details_res.get("genres", []) if g.get("name")]

    if normalized == "movie":
        runtime_minutes = details_res.get("runtime")
        runtime = f"{runtime_minutes} min" if runtime_minutes else "N/A"
    else:
        episode_times = details_res.get("episode_run_time") or []
        runtime_minutes = episode_times[0] if episode_times else None
        runtime = f"{runtime_minutes} min/ep" if runtime_minutes else "N/A"

    trailer = _pick_trailer(videos_res)

    cast = _normalize_cast(credits_res, limit=12)

    providers = _normalize_watch_providers(providers_res)

    vote_average = float(details_res.get("vote_average") or 0)

    result: Dict[str, Any] = {
        "id": details_res.get("id"),
        "tmdb_id": details_res.get("id"),
        "media_type": normalized,
        "title": details_res.get("title") or details_res.get("name") or "Untitled",
        "year": release_date[:4] if release_date else "N/A",
        "release_date": release_date,
        "last_air_date": details_res.get("last_air_date"),
        "runtime": runtime,
        "runtime_minutes": runtime_minutes,
        "genres": genres,
        "tagline": details_res.get("tagline") or "",
        "overview": details_res.get("overview") or "No overview available.",
        "rating": round(vote_average, 1),
        "vote_average": vote_average,
        "vote_count": details_res.get("vote_count", 0),
        "poster": format_poster(details_res.get("poster_path"), size="w500"),
        "backdrop": format_backdrop(details_res.get("backdrop_path"), size="original"),
        "trailer_key": trailer.get("key") if trailer else None,
        "trailer_url": f"https://www.youtube.com/watch?v={trailer['key']}" if trailer else None,
        "trailer_embed": (
            f"https://www.youtube-nocookie.com/embed/{trailer['key']}" if trailer else None
        ),
        "cast": cast,
        "legal_providers": providers,
        "status": details_res.get("status"),
        "original_language": (details_res.get("original_language") or "en").upper(),
        "crew": _normalize_crew(credits_res),
    }

    if normalized == "tv":
        seasons = [
            season
            for season in details_res.get("seasons", [])
            if season.get("season_number") is not None
        ]
        result.update(
            {
                "number_of_seasons": details_res.get("number_of_seasons", len(seasons)),
                "number_of_episodes": details_res.get("number_of_episodes", 0),
                "seasons": [
                    {
                        "id": season.get("id"),
                        "season_number": season.get("season_number"),
                        "name": season.get("name") or f"Season {season.get('season_number')}",
                        "episode_count": season.get("episode_count", 0),
                        "poster": format_poster(season.get("poster_path"), size="w300"),
                        "air_date": season.get("air_date"),
                    }
                    for season in seasons
                ],
                "next_episode_to_air": _normalize_episode(details_res.get("next_episode_to_air")),
            }
        )
    else:
        result.update(
            {
                "budget": details_res.get("budget", 0),
                "revenue": details_res.get("revenue", 0),
            }
        )

    _set_cache(cache_key, result)
    return result


def _pick_trailer(videos_res: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    videos = (videos_res or {}).get("results", [])
    trailers = [
        v for v in videos if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser")
    ]
    if not trailers:
        return None
    return next((v for v in trailers if v.get("official")), None) or trailers[0]


def _normalize_cast(
    credits_res: Optional[Dict[str, Any]], limit: int = 12
) -> List[Dict[str, Any]]:
    cast_list = (credits_res or {}).get("cast", [])[:limit]
    normalized = []
    for person in cast_list:
        roles = person.get("roles") or []
        character = roles[0].get("character") if roles else person.get("character")
        normalized.append(
            {
                "id": person.get("id"),
                "name": person.get("name") or person.get("original_name") or "Unknown",
                "character": character or "Cast Member",
                "profile": format_poster(person.get("profile_path"), size="w185"),
                "total_episode_count": person.get("total_episode_count"),
            }
        )
    return normalized


def _normalize_crew(credits_res: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    crew = {}
    for member in (credits_res or {}).get("crew", []):
        job = member.get("job")
        if job and job not in crew:
            crew[job] = member.get("name")
    return crew


def _normalize_episode(episode: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not episode:
        return None
    return {
        "id": episode.get("id"),
        "episode_number": episode.get("episode_number"),
        "season_number": episode.get("season_number"),
        "name": episode.get("name"),
        "overview": episode.get("overview") or "",
        "air_date": episode.get("air_date"),
        "runtime": episode.get("runtime"),
        "vote_average": episode.get("vote_average", 0.0),
        "still": format_backdrop(episode.get("still_path"), size="w500"),
    }


def _normalize_watch_providers(providers_res: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results = (providers_res or {}).get("results") or {}
    if not results:
        return []

    region = results.get("US") or results.get("GB") or next(iter(results.values()))
    providers = []
    for provider in (region or {}).get("flatrate", []):
        providers.append(
            {
                "id": provider.get("provider_id"),
                "name": provider.get("provider_name"),
                "logo": format_poster(provider.get("logo_path"), size="w92"),
            }
        )
    return providers


async def get_season_details(series_id: int, season_number: int) -> Dict[str, Any]:
    """Every episode for one season of a TV show."""
    cache_key = f"season:{series_id}:{season_number}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    payload = await _tmdb_get(
        f"/tv/{series_id}/season/{season_number}", allow_not_found=True
    )
    if payload is None:
        return {"series_id": series_id, "season_number": season_number, "name": None, "overview": "", "episodes": []}

    episodes = [
        _normalize_episode({**episode, "still_path": episode.get("still_path")})
        for episode in payload.get("episodes", [])
    ]

    result = {
        "series_id": series_id,
        "season_number": season_number,
        "name": payload.get("name") or f"Season {season_number}",
        "overview": payload.get("overview") or "",
        "episodes": episodes,
    }

    _set_cache(cache_key, result)
    return result


async def get_recommendations(media_type: str, tmdb_id: int) -> List[Dict[str, Any]]:
    """More-like-this row for a title."""
    normalized = _normalize_type(media_type)
    if normalized is None:
        raise ValueError(f"Unsupported media_type: {media_type}")

    cache_key = f"recommendations:{normalized}:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    payload = await _cached_list(
        f"/{normalized}/{tmdb_id}/recommendations", {"page": 1}, cache_key=cache_key
    )

    movie_map, tv_map = await asyncio.gather(
        get_genre_map("movie"), get_genre_map("tv")
    )
    cards = _normalize_cards(payload, normalized, {**movie_map, **tv_map})

    _set_cache(cache_key, cards)
    return cards


async def get_trending(
    media_type: str = "all", time_window: str = "week", page: int = 1
) -> List[Dict[str, Any]]:
    """Trending titles. Retained for the original /api/media/trending route."""
    normalized = _normalize_type(media_type)
    endpoint = f"/trending/{normalized or media_type}/{time_window}"

    cache_key = f"trending:{media_type}:{time_window}:{page}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    payload = await _tmdb_get(endpoint, {"page": page}, allow_not_found=True)

    movie_map, tv_map = await asyncio.gather(
        get_genre_map("movie"), get_genre_map("tv")
    )
    result = _normalize_cards(payload, normalized, {**movie_map, **tv_map})
    _set_cache(cache_key, result)
    return result