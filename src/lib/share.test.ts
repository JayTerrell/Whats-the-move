import { describe, expect, it } from 'vitest';
import { readShare } from './share';

describe('readShare', () => {
  it('pulls the link out of Instagram share text', () => {
    const s = readShare(new URLSearchParams({ text: 'https://www.instagram.com/p/Dd7JzHDstLx/?stkn=abc' }));
    expect(s).toMatchObject({ url: 'https://www.instagram.com/p/Dd7JzHDstLx/?stkn=abc', source: 'Instagram', name: '' });
  });

  it('reads the name and address from a Google Maps share', () => {
    const s = readShare(
      new URLSearchParams({
        text: 'Merit Coffee\n2700 Commerce St, Dallas, TX 75226\nhttps://maps.app.goo.gl/abc123',
      }),
    );
    expect(s).toMatchObject({
      source: 'Google Maps',
      name: 'Merit Coffee',
      location: 'Merit Coffee, 2700 Commerce St, Dallas, TX 75226',
      url: 'https://maps.app.goo.gl/abc123',
    });
  });

  it('uses the page title from a website share', () => {
    const s = readShare(new URLSearchParams({ title: 'Vinyl show', url: 'https://www.eventbrite.com/e/123' }));
    expect(s).toMatchObject({ name: 'Vinyl show', source: 'Eventbrite' });
  });
});
