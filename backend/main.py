"""JinFlix API.

The backend is the only thing that talks to TMDb. It owns two things the
browser must not duplicate:

* the normalized media shape (see ``tmdb_service``)
* the embed provider registry below

The frontend calls these routes instead of TMDb directly.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import tmdb_service

# Uvicorn already configures this logger with handlers and level, so startup
# notes land in the host's log stream instead of being dropped.
logger = logging.getLogger("uvicorn.error")

# Embed providers. This list is the single source of truth for playback URLs.
PROVIDERS = [
    {
        "id": "vidsrc-pm",
        "name": "Server 1 (Alpha / VidSrc PM)",
        "badge": "Alpha",
        "movie_template": "https://vidsrc.pm/embed/movie/{tmdb_id}",
        "tv_template": "https://vidsrc.pm/embed/tv/{tmdb_id}/{season}/{episode}",
    },
    {
        "id": "vidlink",
        "name": "Server 2 (Beta / VidLink)",
        "badge": "Beta",
        "movie_template": "https://vidlink.pro/movie/{tmdb_id}?primaryColor=ef3947",
        "tv_template": "https://vidlink.pro/tv/{tmdb_id}/{season}/{episode}?primaryColor=ef3947",
    },
    {
        "id": "vidsrc-cc",
        "name": "Server 3 (VidSrc CC)",
        "badge": "Fast",
        "movie_template": "https://vidsrc.cc/v2/embed/movie/{tmdb_id}",
        "tv_template": "https://vidsrc.cc/v2/embed/tv/{tmdb_id}/{season}/{episode}",
    },
    {
        "id": "autoembed",
        "name": "Server 4 (AutoEmbed)",
        "badge": "Multi-Sub",
        "movie_template": "https://player.autoembed.cc/embed/movie/{tmdb_id}",
        "tv_template": "https://player.autoembed.cc/embed/tv/{tmdb_id}/{season}/{episode}",
    },
    {
        "id": "smashystream",
        "name": "Server 5 (SmashyStream)",
        "badge": "Mirror",
        "movie_template": "https://embed.smashystream.com/playere.php?tmdb={tmdb_id}",
        "tv_template": "https://embed.smashystream.com/playere.php?tmdb={tmdb_id}&season={season}&episode={episode}",
    },
]

DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def _cors_origins() -> List[str]:
    raw = os.getenv("CORS_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return DEFAULT_ORIGINS


def _log_cors_configuration(origins: List[str]) -> None:
    """Report the allowed origins at boot.

    A disallowed origin gets a 200 with no ``Access-Control-Allow-Origin``
    header, which the browser reports only as a generic CORS error. Logging the
    effective list turns that into something readable in the host's logs.
    """
    configured = bool(os.getenv("CORS_ORIGINS"))
    logger.info("CORS allowed origins: %s", ", ".join(origins) or "(none)")
    if not configured:
        logger.warning(
            "CORS_ORIGINS is not set, so only %s may call this API. A deployed "
            "frontend on another domain will be blocked by the browser. Set "
            "CORS_ORIGINS to its origin, e.g. https://your-app.vercel.app",
            ", ".join(origins),
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    _log_cors_configuration(origins)
    yield
    await tmdb_service.close_client()


app = FastAPI(
    title="JinFlix Backend & TMDb Metadata API",
    lifespan=lifespan,
)

origins = _cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Credentials are off because wildcard origins are permitted in dev, and
    # browsers reject that pairing. Auth, if added later, needs an explicit
    # origin list plus credentials enabled.
    allow_credentials="*" not in origins,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(tmdb_service.TmdbNotFoundError)
async def tmdb_not_found_handler(_, exc: tmdb_service.TmdbNotFoundError):
    """A title TMDb does not have is a 404, not an upstream failure.

    Starlette resolves handlers along the exception's MRO, so this subclass
    handler takes precedence over the ``TmdbError`` one below.
    """
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(tmdb_service.TmdbError)
async def tmdb_error_handler(_, exc: tmdb_service.TmdbError):
    message = str(exc)
    if "not configured" in message:
        return JSONResponse(status_code=503, content={"detail": message})
    return JSONResponse(
        status_code=502, content={"detail": "Upstream metadata service is unavailable."}
    )


# --- Stream providers -------------------------------------------------------


@app.get("/api/providers")
def list_providers():
    """Every embed provider the player may offer, in display order."""
    return [
        {"id": p["id"], "name": p["name"], "badge": p["badge"]} for p in PROVIDERS
    ]


@app.get("/api/stream-url")
def get_stream_url(
    tmdb_id: int,
    provider_id: str = "vidsrc-pm",
    media_type: str = "movie",
    season: int = 1,
    episode: int = 1,
):
    """Resolve the embed URL for a title from the provider registry."""
    provider = next((p for p in PROVIDERS if p["id"] == provider_id), None)
    if provider is None:
        provider = PROVIDERS[0] if PROVIDERS else None
    if provider is None:
        raise HTTPException(status_code=404, detail="No streaming provider available")

    normalized_type = "tv" if media_type in ("tv", "series") else "movie"

    if normalized_type == "tv":
        embed_url = provider["tv_template"].format(
            tmdb_id=tmdb_id, season=season, episode=episode
        )
    else:
        embed_url = provider["movie_template"].format(tmdb_id=tmdb_id)

    return {
        "tmdb_id": tmdb_id,
        "provider_id": provider["id"],
        "provider": provider["name"],
        "media_type": normalized_type,
        "embed_url": embed_url,
    }


# --- Catalog ----------------------------------------------------------------


@app.get("/api/genres/{media_type}")
async def get_genres(media_type: str):
    """Genre list for filter dropdowns."""
    if media_type not in ("movie", "tv", "series"):
        raise HTTPException(status_code=400, detail="media_type must be movie or tv")
    return await tmdb_service.get_genres(media_type)


@app.get("/api/catalog")
async def get_catalog(
    rows: str = Query(
        "trending_movies,trending_series,popular_movies,popular_series,"
        "upcoming_movies,upcoming_series,top_rated_movies,top_rated_series,"
        "airing_today_series"
    ),
    page: int = 1,
):
    """Fetch several catalog rows concurrently, keyed by row name."""
    requested = [row.strip() for row in rows.split(",") if row.strip()]
    if not requested:
        raise HTTPException(status_code=400, detail="At least one row must be requested")
    try:
        return await tmdb_service.get_catalog_rows(requested, page=page)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/discover/tv")
async def discover_tv(
    genre_id: Optional[int] = None,
    year: Optional[int] = None,
    sort_by: str = "popularity.desc",
    page: int = 1,
):
    """Filtered TV discovery for the series hub."""
    return await tmdb_service.discover_series(genre_id, year, sort_by, page)


@app.get("/api/search")
async def search_catalog(
    query: str,
    media_type: str = "all",
    page: int = 1,
):
    """Search titles. Returns the same card shape as the catalog routes."""
    return await tmdb_service.search_media(query, media_type, page)


@app.get("/api/trending")
async def get_trending(
    media_type: str = "all",
    time_window: str = "week",
    page: int = 1,
):
    return await tmdb_service.get_trending(media_type, time_window, page)


# --- Title detail -----------------------------------------------------------


@app.get("/api/media/{media_type}/{tmdb_id}")
async def get_media_metadata(media_type: str, tmdb_id: int):
    """Rich normalized metadata for a movie or TV show."""
    if media_type not in ("movie", "tv", "series"):
        raise HTTPException(status_code=400, detail="media_type must be movie or tv")
    try:
        return await tmdb_service.get_media_details(media_type, tmdb_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/media/{media_type}/{tmdb_id}/recommendations")
async def get_recommendations(media_type: str, tmdb_id: int):
    """More-like-this row for a title."""
    if media_type not in ("movie", "tv", "series"):
        raise HTTPException(status_code=400, detail="media_type must be movie or tv")
    return await tmdb_service.get_recommendations(media_type, tmdb_id)


@app.get("/api/media/tv/{series_id}/season/{season_number}")
async def get_series_season(series_id: int, season_number: int):
    """Episodes for one season of a TV show."""
    return await tmdb_service.get_season_details(series_id, season_number)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)