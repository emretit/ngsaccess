import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ProductShot from './ProductShot';

describe('ProductShot', () => {
  it('reserves the distinct desktop and mobile crop dimensions', () => {
    const html = renderToStaticMarkup(
      <ProductShot
        src="/marketing/crop-canli-2400.webp"
        srcSet="/marketing/crop-canli-1200.webp 1200w, /marketing/crop-canli-2400.webp 2400w"
        width={2400}
        height={735}
        mobile={{
          media: '(max-width: 600px)',
          src: '/marketing/crop-canli-m-1400.webp',
          srcSet: '/marketing/crop-canli-m-700.webp 700w, /marketing/crop-canli-m-1400.webp 1400w',
          width: 1400,
          height: 1301,
        }}
        sizes="100vw"
        alt="Akış"
        caption="Örnek kayıtlar"
      />,
    );
    expect(html).toMatch(/<source[^>]+media="\(max-width: 600px\)"[^>]+width="1400" height="1301"/);
    expect(html).toMatch(/<img[^>]+width="2400" height="735" loading="lazy"/);
    expect(html).toContain('<figcaption>Örnek kayıtlar</figcaption>');
    expect(html).not.toContain('aspect-ratio');
  });
});
