"""
fetch_metadata.py
-----------------
CLI utility over the same TMDb service the API uses. Useful for inspecting
normalized output or regenerating the frontend's static fallback catalog.

Usage examples:
    python fetch_metadata.py --id 550
    python fetch_metadata.py --type tv --id 1399 --season 1
    python fetch_metadata.py --trending --limit 10
    python fetch_metadata.py --trending --export ../frontend/src/Movies.json
    python fetch_metadata.py --search "Interstellar"
    python fetch_metadata.py --catalog trending_movies,popular_series
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

import tmdb_service
from tmdb_service import TmdbError


def _summarize(title: dict) -> None:
    print("\n" + "=" * 60)
    print(f"Title:     {title.get('title')}")
    print(f"Type:      {title.get('media_type')}")
    print(f"Year:      {title.get('year')}")
    print(f"Rating:    {title.get('rating')}/10 ({title.get('vote_count')} votes)")
    print(f"Genres:    {', '.join(title.get('genres') or []) or 'None'}")
    print(f"Trailer:   {title.get('trailer_url') or 'None'}")
    cast = title.get("cast") or []
    if cast:
        print(f"Top Cast:  {', '.join(member['name'] for member in cast[:5])}")
    providers = title.get("legal_providers") or []
    if providers:
        print(f"Streaming: {', '.join(p['name'] for p in providers)}")
    print("=" * 60 + "\n")


def _summarize_list(items: list) -> None:
    print(f"\n[+] {len(items)} title(s):")
    for index, item in enumerate(items, start=1):
        print(f"  {index:>2}. {item.get('title')} ({item.get('year')}) - {item.get('rating')}/10")


async def run(args: argparse.Namespace) -> int:
    result = None

    if args.id is not None:
        if args.season is not None:
            print(f"[*] Season {args.season} of TV id {args.id}...")
            result = await tmdb_service.get_season_details(args.id, args.season)
        else:
            print(f"[*] {args.type} id {args.id}...")
            result = await tmdb_service.get_media_details(args.type, args.id)

    elif args.catalog:
        rows = [row.strip() for row in args.catalog.split(",") if row.strip()]
        print(f"[*] Fetching catalog rows: {', '.join(rows)}")
        result = await tmdb_service.get_catalog_rows(rows)

    elif args.trending:
        print(f"[*] Fetching trending {args.type} titles...")
        trending = await tmdb_service.get_trending(args.type, "week")
        limited = trending[: args.limit]
        print(f"[*] Hydrating {len(limited)} title(s)...")
        detailed = []
        for item in limited:
            try:
                detailed.append(
                    await tmdb_service.get_media_details(
                        item["media_type"], item["tmdb_id"]
                    )
                )
            except TmdbError as error:
                print(f"[!] Skipped {item['media_type']} {item['tmdb_id']}: {error}")
        result = detailed

    elif args.search:
        print(f"[*] Searching TMDb for '{args.search}'...")
        result = (await tmdb_service.search_media(args.search, args.type))[: args.limit]

    if not result:
        print("[!] No data returned.")
        return 1

    if isinstance(result, dict):
        _summarize(result)
    else:
        _summarize_list(result)

    if args.export:
        export_path = Path(args.export).resolve()
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"[+] Exported to {export_path}")

    return 0


async def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch metadata using TMDb API")
    parser.add_argument("--id", type=int, help="TMDb id of the movie or TV show")
    parser.add_argument(
        "--type",
        choices=["movie", "tv", "series", "all"],
        default="movie",
        help="Media type filter",
    )
    parser.add_argument("--season", type=int, help="Fetch episodes for a TV season")
    parser.add_argument("--trending", action="store_true", help="Fetch trending titles")
    parser.add_argument("--catalog", type=str, help="Comma-separated catalog rows")
    parser.add_argument("--search", type=str, help="Search query")
    parser.add_argument("--limit", type=int, default=10, help="Max titles for trending/search")
    parser.add_argument("--export", type=str, help="Write JSON output to this path")
    args = parser.parse_args()

    if args.id is None and not (args.trending or args.search or args.catalog):
        parser.print_help()
        return 1

    try:
        return await run(args)
    except TmdbError as error:
        print(f"[!] {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))