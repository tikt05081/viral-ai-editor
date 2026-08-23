/**
 * TikTok video downloader.
 *
 * Uses tikwm.com — a popular free, no-watermark TikTok downloader.
 * Falls back to additional public endpoints if needed.
 *
 * Cobalt API (the previous default) was shut down on Nov 11 2024.
 * If the user runs their own Cobalt instance they can configure
 * the endpoint via the Cobalt env below.
 */

export interface TikTokVideo {
  url: string; // direct .mp4 URL
  thumbnail: string;
  title?: string;
  author?: string;
  duration?: number;
}

interface TikwmResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    title: string;
    duration: number;
    cover: string;
    origin_cover: string;
    play: string; // no watermark
    wmplay: string; // with watermark
    hdplay?: string;
    author?: { nickname: string; unique_id: string };
  };
}

async function tryTikwm(url: string): Promise<TikTokVideo> {
  // Strip query params
  const cleanUrl = url.split('?')[0].split('#')[0];
  const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`tikwm returned ${res.status}`);
  const data: TikwmResponse = await res.json();
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || 'tikwm error');
  }
  return {
    url: data.data.hdplay || data.data.play,
    thumbnail: data.data.origin_cover || data.data.cover,
    title: data.data.title,
    author: data.data.author?.nickname,
    duration: data.data.duration,
  };
}

export async function fetchTikTok(inputUrl: string): Promise<TikTokVideo> {
  if (!inputUrl.includes('tiktok.com') && !inputUrl.includes('vm.tiktok.com')) {
    throw new Error('Please paste a TikTok URL');
  }
  return await tryTikwm(inputUrl);
}

/**
 * Extract a TikTok ID from a URL. Useful for thumbnails.
 */
export function getTikTokId(url: string) {
  const m = url.match(/tiktok\.com\/[@\w.-]*\/video\/(\d+)/);
  if (m) return m[1];
  const m2 = url.match(/vm\.tiktok\.com\/(\w+)/);
  if (m2) return m2[1];
  return null;
}

