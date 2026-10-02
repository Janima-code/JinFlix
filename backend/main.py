from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

app = FastAPI(title="Embed Stream Provider API")

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
    provider_id: Optional[str] = "vidsrc",
    media_type: Optional[str] = "movie",
    season: Optional[int] = 1,
    episode: Optional[int] = 1,
):
    """Resolve the formatted embed URL for a given TMDB ID and media type."""
    provider = next((p for p in PROVIDERS if p["id"] == provider_id), None)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
