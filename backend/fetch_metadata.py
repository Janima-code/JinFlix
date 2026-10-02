"""
fetch_metadata.py
-----------------
CLI utility to fetch metadata from The Movie Database (TMDb) API.
Can fetch movie/series details, trending lists, search queries, and
optionally export data to a JSON file (such as Movies.json).

Usage examples:
    python fetch_metadata.py --type movie --id 550
    python fetch_metadata.py --type tv --id 1399
    python fetch_metadata.py --trending --limit 10
    python fetch_metadata.py --trending --export ../frontend/src/Movies.json
    python fetch_metadata.py --search "Interstellar"
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
import tmdb_service


async def main():
    parser = argparse.ArgumentParser(description="Fetch metadata using TMDb API")
    parser.add_argument("--id", type=int, help="TMDb ID of the movie or TV show")
    parser.add_argument(
        "--type",
        choices=["movie", "tv", "series"],
        default="movie",
        help="Media type: 'movie' or 'tv'",
    )
    parser.add_argument("--season", type=int, help="TV season number to fetch episodes for")
    parser.add_argument("--trending", action="store_true", help="Fetch currently trending titles")
    parser.add_argument("--search", type=str, help="Search query to search on TMDb")
    parser.add_argument("--limit", type=int, default=10, help="Limit number of items for trending/search")
    parser.add_argument("--export", type=str, help="Path to export JSON output (e.g., ../frontend/src/Movies.json)")
    parser.add_argument("--pretty", action="store_true", default=True, help="Pretty print JSON output")

    args = parser.parse_args()

    if not args.id and not args.trending and not args.search:
        parser.print_help()
        sys.exit(1)

    result_data = None

    if args.id:
        if args.season is not None:
            print(f"[*] Fetching Season {args.season} metadata for TV series {args.id}...")
            result_data = await tmdb_service.get_season_details(args.id, args.season)
        else:
            print(f"[*] Fetching metadata for {args.type} ID {args.id}...")
            result_data = await tmdb_service.get_media_details(args.type, args.id)

    elif args.trending:
        print(f"[*] Fetching trending {args.type} catalog...")
        trending_list = await tmdb_service.get_trending(args.type, "week")
        limited = trending_list[:args.limit]
        
        # If exporting or detailed view requested, fetch full details for top items
        print(f"[*] Fetching full metadata for {len(limited)} trending titles...")
        detailed_items = []
        for item in limited:
            m_type = item.get("media_type") or args.type
            m_id = item.get("id")
            try:
                full_item = await tmdb_service.get_media_details(m_type, m_id)
                if full_item:
                    detailed_items.append(full_item)
            except Exception as e:
                print(f"[!] Error fetching {m_type} {m_id}: {e}")

        result_data = detailed_items

    elif args.search:
        print(f"[*] Searching TMDb for '{args.search}'...")
        results = await tmdb_service.search_media(args.search, args.type)
        result_data = results[:args.limit]

    if not result_data:
        print("[!] No data returned from TMDb API.")
        sys.exit(1)

    # Print summary to console
    if isinstance(result_data, dict):
        print("\n" + "=" * 50)
        print(f"Title:       {result_data.get('title')}")
        print(f"Year:        {result_data.get('year')}")
        print(f"Rating:      {result_data.get('rating')}/10 ({result_data.get('vote_count')} votes)")
        print(f"Genres:      {result_data.get('genres_formatted')}")
        print(f"Trailer:     {result_data.get('trailer_url') or 'None'}")
        if result_data.get("cast"):
            cast_names = ", ".join([c["name"] for c in result_data["cast"][:5]])
            print(f"Top Cast:    {cast_names}")
        print(f"Overview:    {result_data.get('overview')[:180]}...")
        print("=" * 50 + "\n")
    elif isinstance(result_data, list):
        print(f"\n[+] Successfully fetched {len(result_data)} titles:")
        for idx, item in enumerate(result_data, start=1):
            print(f"  {idx}. {item.get('title')} ({item.get('year')}) - Rating: {item.get('rating')}/10")
        print()

    # Export to JSON if specified
    if args.export:
        export_path = Path(args.export).resolve()
        export_path.parent.mkdir(parents=True, exist_ok=True)
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
        print(f"[+] Metadata successfully exported to: {export_path}")


if __name__ == "__main__":
    asyncio.run(main())
