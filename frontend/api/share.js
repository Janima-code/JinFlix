const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const SITE_URL = 'https://jinflix.vercel.app';
const FALLBACK_IMAGE = 'https://i.postimg.cc/cLwjf5Q2/Gemini-Generated-Image-nhc9clnhc9clnhc9.jpg';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

export default async function handler(request, response) {
  const id = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const mediaType = request.query?.type === 'tv' ? 'tv' : 'movie';
  if (!/^\d+$/.test(String(id || ''))) {
    return response.status(400).send('Invalid title id.');
  }

  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    return response.status(503).send('Title metadata is unavailable.');
  }

  try {
    const detailsUrl = new URL(`${TMDB_BASE_URL}/${mediaType}/${id}`);
    detailsUrl.searchParams.set('api_key', apiKey);
    detailsUrl.searchParams.set('language', 'en-US');
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) return response.status(502).send('Title metadata is unavailable.');

    const titleData = await detailsResponse.json();
    const title = titleData.title || titleData.name || titleData.original_name || 'JinFlix';
    const titleYear = (titleData.release_date || titleData.first_air_date || '').slice(0, 4);
    const description = titleData.overview
      || `View details and try available playback providers for ${title} on JinFlix.`;
    const canonicalUrl = `${SITE_URL}/${mediaType === 'tv' ? 'series' : 'movie'}/${id}`;
    const imagePath = titleData.backdrop_path || titleData.poster_path;
    const imageUrl = imagePath
      ? `https://image.tmdb.org/t/p/w1280${imagePath}`
      : FALLBACK_IMAGE;
    const displayTitle = `Watch ${title}${titleYear ? ` (${titleYear})` : ''} | JinFlix`;
    const escapedTitle = escapeHtml(displayTitle);
    const escapedDescription = escapeHtml(description);
    const escapedUrl = escapeHtml(canonicalUrl);
    const escapedImage = escapeHtml(imageUrl);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapedTitle}</title><meta name="description" content="${escapedDescription}"><link rel="canonical" href="${escapedUrl}"><meta property="og:title" content="${escapedTitle}"><meta property="og:description" content="${escapedDescription}"><meta property="og:type" content="website"><meta property="og:url" content="${escapedUrl}"><meta property="og:image" content="${escapedImage}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapedTitle}"><meta name="twitter:description" content="${escapedDescription}"><meta name="twitter:image" content="${escapedImage}"></head><body><a href="${escapedUrl}">${escapedTitle}</a></body></html>`;

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response.status(200).send(html);
  } catch {
    return response.status(502).send('Title metadata is unavailable.');
  }
}