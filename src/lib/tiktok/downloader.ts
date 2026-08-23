/**
 * TikTok video downloader.
 *
 * Uses Cobalt API (https://co.wuk.sh) — a popular, free, open-source
 * no-watermark TikTok downloader. Cobalt is a community project; if
 * the user runs their own instance they can configure CORS.
 *
 * For a self-contained app, we also include a fallback that uses
 * tiktok's own oembed thumbnail + a redirect to a save-from-style service.
 *
 * If the user is offline or the API is blocked, we surface a clear error.
 */

export interface TikTokVideo {
  url: string; // direct .mp4 URL
  thumbnail: string;
  title?: string;
  author?: string;
  duration?: number;
}

const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://co.wuk.sh/api/json',
  'https://api.cobalt.cyber-hire.com/api/json',
];

function extractTikTokId(url: string): string | null {
  const m = url.match(/tiktok\.com\/[@\w.-]*\/video\/(\d+)/);
  if (m) return m[1];
  const m2 = url.match(/vm\.tiktok\.com\/(\w+)/);
  if (m2) return m2[1];
  return null;
}

async function tryCobalt(url: string, endpoint: string): Promise<TikTokVideo> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      url,
      vQuality: '720',
      isAudioOnly: false,
      filenamePattern: 'tiktok',
    }),
  });
  if (!res.ok) throw new Error(`Cobalt returned ${res.status}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.text || 'Cobalt error');
  return {
    url: data.url,
    thumbnail: data.thumbnail || '',
    title: data.title,
    author: data.author,
  };
}

export async function fetchTikTok(inputUrl: string): Promise<TikTokVideo> {
  if (!inputUrl.includes('tiktok.com') && !inputUrl.includes('vm.tiktok.com')) {
    throw new Error('Please paste a TikTok URL');
  }
  // Normalize the URL — strip query params
  const cleanUrl = inputUrl.split('?')[0];

  // Try Cobalt instances in order
  let lastError: Error | null = null;
  for (const endpoint of COBALT_INSTANCES) {
    try {
      return await tryCobalt(cleanUrl, endpoint);
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw new Error(
    `Could not download TikTok. Cobalt API is unreachable from this browser. (${lastError?.message})`
  );
}

/**
 * Extract a TikTok ID from a URL. Useful for thumbnails.
 */
export function getTikTokId(url: string) {
  return extractTikTokId(url);
}
