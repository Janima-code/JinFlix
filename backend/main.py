from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import tmdb_service

app = FastAPI(title="JinFlix Backend & TMDb Metadata API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active third-party stream provider configurations
PROVIDERS = [
   
    {
        "id": "vidsrc-pm",
        "name": "Alpha",
        "movie_template": "https://vidsrc.pm/embed/movie/{tmdb_id}",
        "tv_template": "https://vidsrc.pm/embed/tv/{tmdb_id}/{season}/{episode}"
    },
    {
        "id": "vidlink",
        "name": "Beta",
        "movie_template": "https://vidlink.pro/movie/{tmdb_id}?primaryColor=6366f1",
        "tv_template": "https://vidlink.pro/tv/{tmdb_id}/{season}/{episode}?primaryColor=6366f1"
    }
    
]

@app.get("/api/providers")
def list_providers():
    """Return list of available stream server names and IDs."""
    return [{"id": p["id"], "name": p["name"]} for p in PROVIDERS]


@app.get("/api/stream-url")
def get_stream_url(
    tmdb_id: int,
    provider_id: Optional[str] = "vidsrc-pm",
    media_type: Optional[str] = "movie",
    season: Optional[int] = 1,
    episode: Optional[int] = 1,
):
    """Resolve the formatted embed URL for a given TMDB ID and media type."""
    provider = next((p for p in PROVIDERS if p["id"] == provider_id), None)
    if not provider:
        # Gracefully fallback to the primary provider
        provider = PROVIDERS[0] if PROVIDERS else None

    if not provider:
        raise HTTPException(status_code=404, detail="No streaming provider available")

    if media_type == "tv":
        embed_url = provider["tv_template"].format(
            tmdb_id=tmdb_id, season=season, episode=episode
        )
    else:
        embed_url = provider["movie_template"].format(tmdb_id=tmdb_id)

    return {
        "tmdb_id": tmdb_id,
        "provider": provider["name"],
        "media_type": media_type,
        "embed_url": embed_url,
    }


# TMDb Metadata Endpoints


@app.get("/api/media/{media_type}/{tmdb_id}")
async def get_media_metadata(media_type: str, tmdb_id: int):
    """Fetch rich normalized metadata for a movie or TV show using TMDb API."""
    data = await tmdb_service.get_media_details(media_type=media_type, tmdb_id=tmdb_id)
    if not data:
        raise HTTPException(status_code=404, detail="Media title not found on TMDb")
    return data


@app.get("/api/media/tv/{series_id}/season/{season_number}")
async def get_series_season(series_id: int, season_number: int):
    """Fetch episodes metadata for a TV show season."""
    data = await tmdb_service.get_season_details(series_id=series_id, season_number=season_number)
    return data


@app.get("/api/media/trending")
async def get_trending_catalog(
    media_type: Optional[str] = "all",
    time_window: Optional[str] = "week",
    page: Optional[int] = 1,
):
    """Fetch trending titles catalog from TMDb."""
    return await tmdb_service.get_trending(
        media_type=media_type, time_window=time_window, page=page
    )


@app.get("/api/media/search")
async def search_catalog(
    query: str,
    media_type: Optional[str] = "all",
    page: Optional[int] = 1,
):
    """Search titles on TMDb with normalized result cards."""
    return await tmdb_service.search_media(
        query=query, media_type=media_type, page=page
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
