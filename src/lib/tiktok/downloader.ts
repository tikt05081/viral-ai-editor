/**
 * Unified video fetcher.
 *
 * Real talk on the YouTube situation (as of 2026):
 *  - Google aggressively blocks all public YouTube download APIs.
 *  - Cobalt shut down its public instance Nov 2024 and now requires auth.
 *  - Invidious and Piped public instances are mostly dead.
 *  - There is no reliable free public YouTube download API.
 *
 * So for YouTube, we surface a clear error asking the user to download
 * the video via yt-dlp and upload the file. For TikTok, tikwm.com
 * (free no-watermark) works reliably.
 *
 * Direct video URLs and TikTok CDN URLs are also supported.
 */

export interface FetchedVideo {
  url: string;
  thumbnail: string;
  title?: string;
  author?: string;
  duration?: number;
  source: 'tiktok' | 'youtube' | 'twitter' | 'instagram' | 'direct';
}

export type VideoSource =
  | { kind: 'tiktok'; videoId: string }
  | { kind: 'youtube'; videoId: string }
  | { kind: 'twitter'; statusId: string }
  | { kind: 'instagram'; shortcode: string }
  | { kind: 'direct'; url: string };

/**
 * Detect the source from any URL.
 */
export function detectSource(inputUrl: string): VideoSource | null {
  const url = inputUrl.split('?')[0].split('#')[0];

  // TikTok
  let m = url.match(/tiktok\.com\/[@\w.-]+\/video\/(\d+)/);
  if (m) return { kind: 'tiktok', videoId: m[1] };
  m = url.match(/vm\.tiktok\.com\/(\w+)/);
  if (m) return { kind: 'tiktok', videoId: m[1] };

  // YouTube
  m = url.match(/youtube\.com\/watch\?v=([\w-]+)/);
  if (m) return { kind: 'youtube', videoId: m[1] };
  m = url.match(/youtu\.be\/([\w-]+)/);
  if (m) return { kind: 'youtube', videoId: m[1] };
  m = url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (m) return { kind: 'youtube', videoId: m[1] };

  // Twitter / X
  m = url.match(/(?:twitter|x)\.com\/[\w]+\/status\/(\d+)/);
  if (m) return { kind: 'twitter', statusId: m[1] };

  // Instagram
  m = url.match(/instagram\.com\/(?:p|reel|reels)\/([\w-]+)/);
  if (m) return { kind: 'instagram', shortcode: m[1] };

  // Direct video
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || /cdn|cloudfront|tiktokcdn|fbcdn/i.test(url)) {
    return { kind: 'direct', url };
  }

  return null;
}

// ============================================================
// TikTok (tikwm.com — free, no watermark, still working 2026)
// ============================================================
async function fetchTikTok(videoId: string): Promise<FetchedVideo> {
  const cleanUrl = `https://www.tiktok.com/@_/video/${videoId}`;
  const tikwmEndpoints = [
    `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`,
  ];
  for (const endpoint of tikwmEndpoints) {
    try {
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.code === 0 && data.data) {
        return {
          url: data.data.hdplay || data.data.play,
          thumbnail: data.data.origin_cover || data.data.cover,
          title: data.data.title,
          author: data.data.author?.nickname,
          duration: data.data.duration,
          source: 'tiktok',
        };
      }
    } catch {}
  }
  throw new Error(
    'Could not download TikTok. Try uploading the file directly below.'
  );
}

// ============================================================
// YouTube — surface a clear "use yt-dlp" message
// ============================================================
async function fetchYouTube(videoId: string): Promise<FetchedVideo> {
  // As of 2026, no reliable free public YouTube download API exists.
  // We throw a helpful error pointing the user to yt-dlp.
  throw new Error(
    `YouTube blocked all public download APIs. To use a YouTube video, download it locally:\n\n` +
    `  yt-dlp "https://www.youtube.com/watch?v=${videoId}"\n\n` +
    `Then drag the resulting .mp4 into the upload box below. (yt-dlp is free: brew install yt-dlp or pip install yt-dlp)`
  );
}

// ============================================================
// Twitter / X
// ============================================================
async function fetchTwitter(statusId: string): Promise<FetchedVideo> {
  const endpoints = [
    `https://api.fxtwitter.com/status/${statusId}`,
    `https://api.vxtwitter.com/status/${statusId}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = await res.json();
      const variants =
        data.video?.variants ||
        data.tweet?.video?.variants ||
        data.media?.video?.variants ||
        [];
      const mp4 = variants.find(
        (v: any) => v.content_type === 'video/mp4' || /\.mp4(\?|$)/i.test(v.url || '')
      );
      if (mp4?.url) {
        return {
          url: mp4.url,
          thumbnail: data.thumbnail_url || data.video?.poster || '',
          title: data.text || data.tweet?.text,
          author: data.author?.name || data.tweet?.author?.name,
          duration: data.video?.durationMs
            ? Math.round(data.video.durationMs / 1000)
            : undefined,
          source: 'twitter',
        };
      }
    } catch {}
  }
  throw new Error('Could not fetch Twitter/X video. Try uploading the file directly.');
}

// ============================================================
// Instagram
// ============================================================
async function fetchInstagram(shortcode: string): Promise<FetchedVideo> {
  throw new Error(
    'Instagram downloads require authentication. Try uploading the file directly.'
  );
}

// ============================================================
// Direct URL
// ============================================================
function fetchDirect(url: string): FetchedVideo {
  return {
    url,
    thumbnail: '',
    title: 'Direct video',
    source: 'direct',
  };
}

// ============================================================
// Public entry point
// ============================================================
export async function fetchVideo(inputUrl: string): Promise<FetchedVideo> {
  const source = detectSource(inputUrl);
  if (!source) {
    throw new Error(
      'Could not recognize that URL. Supported: TikTok, Twitter/X, or a direct .mp4 link. (For YouTube, see the error message you get.)'
    );
  }
  switch (source.kind) {
    case 'tiktok':
      return await fetchTikTok(source.videoId);
    case 'youtube':
      return await fetchYouTube(source.videoId);
    case 'twitter':
      return await fetchTwitter(source.statusId);
    case 'instagram':
      return await fetchInstagram(source.shortcode);
    case 'direct':
      return fetchDirect(source.url);
  }
}

// Backwards-compatible export (the old fetchTikTok function)
export { fetchVideo as fetchTikTok };
export const getTikTokId = (url: string) => detectSource(url);
