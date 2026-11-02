/** What arrived from Android's share sheet, cleaned up for the add form. */
export interface SharedItem {
  url: string | null;
  name: string;
  location: string; // a venue or address to look up, from Google Maps shares
  source: string | null; // Instagram, TikTok, Google Maps, or the site's name
}

const URL_RE = /https?:\/\/[^\s]+/;

export function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('threads')) return 'Threads';
    if (host.includes('facebook') || host === 'fb.me') return 'Facebook';
    if (host.includes('goo.gl') || host.includes('google.')) return 'Google Maps';
    if (host.includes('eventbrite')) return 'Eventbrite';
    return host;
  } catch {
    return 'Link';
  }
}

export function readShare(params: URLSearchParams): SharedItem {
  const title = params.get('title')?.trim() ?? '';
  const text = params.get('text')?.trim() ?? '';
  const url = params.get('url')?.trim() || text.match(URL_RE)?.[0] || title.match(URL_RE)?.[0] || null;
  const source = url ? sourceName(url) : null;

  // Google Maps shares the place name and address as lines of text above the link.
  const lines = text
    .replace(URL_RE, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (source === 'Google Maps' && lines.length) {
    return { url, source, name: lines[0], location: lines.slice(0, 2).join(', ') };
  }
  const name = title && !URL_RE.test(title) ? title : '';
  return { url, source, name, location: '' };
}
