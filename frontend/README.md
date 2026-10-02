# JinFlix

A React + Vite movie app with a TMDB-powered catalog and trailer modal.

## Setup

1. Create a `.env` file in the project root.
2. Add your TMDB API key:

```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

3. Start the app:

```bash
npm install
npm run dev
```

## Notes

- The app uses TMDB for movie and series metadata, genres, posters, ratings, and trailer/video lookups.
- The search box calls TMDB query endpoints such as `/search/movie` and `/search/tv` instead of using static popular lists.
- The Watch now modal shows a trailer-focused detail layout with poster, metadata, plot summary, and the player.
