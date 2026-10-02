import os
import time
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

# Load API Key from environment or local .env file
TMDB_BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

def _load_api_key() -> str:
    key = os.getenv("TMDB_API_KEY")
    if key:
        return key.strip().strip('"').strip("'")
    
    # Try reading from backend/.env or frontend/.env
    backend_env = Path(__file__).resolve().parent / ".env"
    if backend_env.exists():
        for line in backend_env.read_text(encoding="utf-8").splitlines():
            if line.startswith("TMDB_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
                
    frontend_env = Path(__file__).resolve().parent.parent / "frontend" / ".env"
    if frontend_env.exists():
        for line in frontend_env.read_text(encoding="utf-8").splitlines():
            if line.startswith("VITE_TMDB_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")

    return "e56f5c7830c1eb10f6ff78f42d8c8544"

TMDB_API_KEY = _load_api_key()

# In-memory cache with Time-To-Live (TTL in seconds)
_CACHE: Dict[str, tuple[float, Any]] = {}
CACHE_TTL = 900  # 15 minutes


def _get_from_cache(cache_key: str) -> Optional[Any]:
    if cache_key in _CACHE:
        timestamp, value = _CACHE[cache_key]
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


async def _tmdb_get(client: httpx.AsyncClient, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{TMDB_BASE_URL}{endpoint}"
    req_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        req_params.update(params)

    try:
        response = await client.get(url, params=req_params, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {}
        raise
    except Exception:
        return {}


async def get_media_details(media_type: str, tmdb_id: int) -> Dict[str, Any]:
    """
    Fetch comprehensive metadata for a movie or TV show:
    - Core metadata (title, overview, genres, release date, runtime, ratings)
    - Primary Official YouTube trailer
    - Top cast members with character roles & profiles
    - Available stream & legal watch providers (US/Global)
    """
    cache_key = f"details:{media_type}:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    normalized_type = "tv" if media_type in ("tv", "series") else "movie"
    base_endpoint = f"/{normalized_type}/{tmdb_id}"
    credits_endpoint = f"{base_endpoint}/credits" if normalized_type == "movie" else f"{base_endpoint}/aggregate_credits"

    async with httpx.AsyncClient() as client:
        details_task = _tmdb_get(client, base_endpoint)
        credits_task = _tmdb_get(client, credits_endpoint)
        videos_task = _tmdb_get(client, f"{base_endpoint}/videos")
        providers_task = _tmdb_get(client, f"{base_endpoint}/watch/providers")

        details_res, credits_res, videos_res, providers_res = await asyncio.gather(
            details_task, credits_task, videos_task, providers_task
        )

    if not details_res:
        return {}

    title = details_res.get("title") or details_res.get("name") or "Untitled"
    release_date = details_res.get("release_date") or details_res.get("first_air_date") or ""
    year = release_date[:4] if release_date else "N/A"
    genres = [g.get("name") for g in details_res.get("genres", []) if g.get("name")]

    # Runtime calculation
    if normalized_type == "movie":
        runtime_min = details_res.get("runtime")
        runtime = f"{runtime_min} min" if runtime_min else "N/A"
    else:
        ep_times = details_res.get("episode_run_time") or []
        runtime = f"{ep_times[0]} min/ep" if ep_times else "N/A"

    # Best trailer resolution
    videos = videos_res.get("results", [])
    trailers = [
        v for v in videos
        if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser")
    ]
    primary_trailer = next((v for v in trailers if v.get("official")), None) or (trailers[0] if trailers else None)

    # Top Cast & Crew
    cast_list = credits_res.get("cast", [])[:10]
    normalized_cast = []
    for person in cast_list:
        roles = person.get("roles", [])
        char_name = roles[0].get("character") if roles else person.get("character")
        normalized_cast.append({
            "id": person.get("id"),
            "name": person.get("name") or person.get("original_name"),
            "character": char_name or "Cast Member",
            "profile_path": format_poster(person.get("profile_path"), size="w185")
        })

    # Watch providers (Flatrate / Rent / Buy)
    prov_results = providers_res.get("results", {})
    region_data = prov_results.get("US") or prov_results.get("GB") or (next(iter(prov_results.values())) if prov_results else {})
    stream_providers = []
    if region_data:
        flatrate = region_data.get("flatrate", [])
        for prov in flatrate:
            stream_providers.append({
                "id": prov.get("provider_id"),
                "name": prov.get("provider_name"),
                "logo": format_poster(prov.get("logo_path"), size="w92")
            })

    result = {
        "id": details_res.get("id"),
        "tmdb_id": details_res.get("id"),
        "media_type": normalized_type,
        "title": title,
        "year": year,
        "release_date": release_date,
        "runtime": runtime,
        "genres": genres,
        "genres_formatted": ", ".join(genres) if genres else "General",
        "tagline": details_res.get("tagline") or "",
        "overview": details_res.get("overview") or "No overview available.",
        "vote_average": details_res.get("vote_average", 0.0),
        "rating": round(float(details_res.get("vote_average", 0)), 1),
        "vote_count": details_res.get("vote_count", 0),
        "poster": format_poster(details_res.get("poster_path"), size="w500"),
        "backdrop": format_backdrop(details_res.get("backdrop_path"), size="original"),
        "trailer_key": primary_trailer.get("key") if primary_trailer else None,
        "trailer_url": f"https://www.youtube.com/watch?v={primary_trailer['key']}" if primary_trailer else None,
        "trailer_embed": f"https://www.youtube-nocookie.com/embed/{primary_trailer['key']}" if primary_trailer else None,
        "cast": normalized_cast,
        "legal_providers": stream_providers,
        "status": details_res.get("status"),
        "original_language": details_res.get("original_language", "en").upper(),
    }

    # TV series specific fields
    if normalized_type == "tv":
        seasons = details_res.get("seasons", [])
        result.update({
            "number_of_seasons": details_res.get("number_of_seasons", len(seasons)),
            "number_of_episodes": details_res.get("number_of_episodes", 0),
            "seasons": [
                {
                    "id": s.get("id"),
                    "season_number": s.get("season_number"),
                    "name": s.get("name") or f"Season {s.get('season_number')}",
                    "episode_count": s.get("episode_count", 0),
                    "poster": format_poster(s.get("poster_path"), size="w300"),
                }
                for s in seasons if s.get("season_number") is not None
            ],
            "next_episode_to_air": details_res.get("next_episode_to_air")
        })
    else:
        result.update({
            "budget": details_res.get("budget", 0),
            "revenue": details_res.get("revenue", 0)
        })

    _set_cache(cache_key, result)
    return result


async def get_season_details(series_id: int, season_number: int) -> Dict[str, Any]:
    """Fetch all episodes for a specific TV show season with metadata."""
    cache_key = f"season:{series_id}:{season_number}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    endpoint = f"/tv/{series_id}/season/{season_number}"
    async with httpx.AsyncClient() as client:
        data = await _tmdb_get(client, endpoint)

    if not data:
        return {"episodes": []}

    episodes = []
    for ep in data.get("episodes", []):
        episodes.append({
            "id": ep.get("id"),
            "episode_number": ep.get("episode_number"),
            "season_number": ep.get("season_number", season_number),
            "name": ep.get("name") or f"Episode {ep.get('episode_number')}",
            "overview": ep.get("overview") or "",
            "air_date": ep.get("air_date"),
            "runtime": ep.get("runtime"),
            "vote_average": ep.get("vote_average", 0.0),
            "still_path": format_backdrop(ep.get("still_path"), size="w500"),
        })

    result = {
        "series_id": series_id,
        "season_number": season_number,
        "name": data.get("name") or f"Season {season_number}",
        "overview": data.get("overview") or "",
        "episodes": episodes
    }

    _set_cache(cache_key, result)
    return result


async def get_trending(media_type: str = "all", time_window: str = "week", page: int = 1) -> List[Dict[str, Any]]:
    """Fetch trending movies or TV series."""
    cache_key = f"trending:{media_type}:{time_window}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    endpoint = f"/trending/{media_type}/{time_window}"
    async with httpx.AsyncClient() as client:
        data = await _tmdb_get(client, endpoint, {"page": page})

    results = []
    for item in data.get("results", []):
        item_type = item.get("media_type") or media_type
        if item_type not in ("movie", "tv"):
            continue

        title = item.get("title") or item.get("name") or "Untitled"
        rel_date = item.get("release_date") or item.get("first_air_date") or ""

        results.append({
            "id": item.get("id"),
            "media_type": item_type,
            "title": title,
            "year": rel_date[:4] if rel_date else "N/A",
            "poster": format_poster(item.get("poster_path")),
            "backdrop": format_backdrop(item.get("backdrop_path")),
            "vote_average": item.get("vote_average", 0.0),
            "rating": round(float(item.get("vote_average", 0.0)), 1),
            "overview": item.get("overview") or ""
        })

    _set_cache(cache_key, results)
    return results


async def search_media(query: str, media_type: str = "all", page: int = 1) -> List[Dict[str, Any]]:
    """Search TMDB for movies and/or TV shows."""
    if not query.strip():
        return []

    cache_key = f"search:{media_type}:{query.strip().lower()}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    endpoint = "/search/multi" if media_type == "all" else f"/search/{media_type}"
    async with httpx.AsyncClient() as client:
        data = await _tmdb_get(client, endpoint, {"query": query, "page": page})

    results = []
    for item in data.get("results", []):
        item_type = item.get("media_type") or media_type
        if item_type not in ("movie", "tv"):
            continue

        title = item.get("title") or item.get("name") or "Untitled"
        rel_date = item.get("release_date") or item.get("first_air_date") or ""

        results.append({
            "id": item.get("id"),
            "media_type": item_type,
            "title": title,
            "year": rel_date[:4] if rel_date else "N/A",
            "poster": format_poster(item.get("poster_path")),
            "vote_average": item.get("vote_average", 0.0),
            "rating": round(float(item.get("vote_average", 0.0)), 1),
            "overview": item.get("overview") or ""
        })

    _set_cache(cache_key, results)
    return results
