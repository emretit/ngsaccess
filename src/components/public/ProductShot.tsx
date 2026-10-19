import '@/components/public/public.css';
export type ProductShotProps = {
  name: 'ana-sayfa' | 'canli-izleme' | 'pdks-kayitlari' | 'gecis-kontrol' | 'vardiyalar' | 'izinler';
  alt: string;
  priority?: boolean;
  sizes?: string;
  caption?: string;
  elevated?: boolean;
  expandable?: boolean;
};
export function ProductShot({
  name,
  alt,
  priority = false,
  sizes = '(max-width: 600px) calc(100vw - 40px), 650px',
  caption,
  elevated = false,
  expandable = true,
}: ProductShotProps) {
  const src = `/marketing/${name}-1600.webp`;
  const picture = (
    <picture>
      <img
        src={src}
        srcSet={`/marketing/${name}-800.webp 800w, ${src} 1600w`}
        sizes={sizes}
        alt={alt}
        width={1600}
        height={1000}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
      />
    </picture>
  );
  return (
    <figure className={`pub-product-shot${elevated ? ' pub-elevated' : ''}`}>
      {expandable ? (
        <a href={src} aria-label={`${alt}: büyük görseli aç`}>
          {picture}
        </a>
      ) : (
        <div>{picture}</div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
export default ProductShot;
