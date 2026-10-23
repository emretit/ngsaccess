import '@/components/public/public.css';

export type ProductShotSource = {
  src: string;
  srcSet: string;
  width: number;
  height: number;
};

export type ProductShotProps = ProductShotSource & {
  mobile?: ProductShotSource & { media: string };
  alt: string;
  priority?: boolean;
  sizes: string;
  caption?: string;
  elevated?: boolean;
};

export function ProductShot({
  src,
  srcSet,
  width,
  height,
  mobile,
  alt,
  priority = false,
  sizes,
  caption,
  elevated = false,
}: ProductShotProps) {
  return (
    <figure className={`pub-product-shot${elevated ? ' pub-elevated' : ''}`}>
      <div>
        <picture>
          {mobile && (
            <source
              media={mobile.media}
              srcSet={mobile.srcSet}
              sizes={sizes}
              width={mobile.width}
              height={mobile.height}
            />
          )}
          <img
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
          />
        </picture>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
export default ProductShot;
