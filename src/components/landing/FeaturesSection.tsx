import Section from '@/components/public/Section';
import ProductShot, { type ProductShotProps } from '@/components/public/ProductShot';
import { marketingFacts as copy } from './marketingFacts';

type Feature = (typeof copy.features)[number];
type FeatureLayout = 'full' | 'pair' | 'strip';
type FeaturePresentation = Pick<ProductShotProps, 'src' | 'srcSet' | 'width' | 'height' | 'mobile' | 'sizes'> & {
  layout: FeatureLayout;
};

const fullSizes = '(max-width: 600px) calc(100vw - 40px), (max-width: 1264px) calc(100vw - 64px), 1200px';
const pairSizes = '(max-width: 600px) calc(100vw - 40px), (max-width: 1264px) calc((100vw - 94px) / 2), 585px';
const presentation: Record<Feature['shot'], FeaturePresentation> = {
  'canli-izleme': {
    layout: 'full',
    src: '/marketing/crop-canli-2400.webp',
    srcSet: '/marketing/crop-canli-1200.webp 1200w, /marketing/crop-canli-2400.webp 2400w',
    width: 2400,
    height: 735,
    sizes: fullSizes,
    mobile: {
      media: '(max-width: 600px)',
      src: '/marketing/crop-canli-m-1400.webp',
      srcSet: '/marketing/crop-canli-m-700.webp 700w, /marketing/crop-canli-m-1400.webp 1400w',
      width: 1400,
      height: 1301,
    },
  },
  'pdks-kayitlari': {
    layout: 'pair',
    src: '/marketing/crop-pdks-1200.webp',
    srcSet: '/marketing/crop-pdks-600.webp 600w, /marketing/crop-pdks-1200.webp 1200w',
    width: 1200,
    height: 1029,
    sizes: pairSizes,
    mobile: {
      media: '(max-width: 600px)',
      src: '/marketing/crop-pdks-m-1400.webp',
      srcSet: '/marketing/crop-pdks-m-700.webp 700w, /marketing/crop-pdks-m-1400.webp 1400w',
      width: 1400,
      height: 1566,
    },
  },
  'gecis-kontrol': {
    layout: 'pair',
    src: '/marketing/crop-gecis-1200.webp',
    srcSet: '/marketing/crop-gecis-600.webp 600w, /marketing/crop-gecis-1200.webp 1200w',
    width: 1200,
    height: 780,
    sizes: pairSizes,
    mobile: {
      media: '(max-width: 600px)',
      src: '/marketing/crop-gecis-m-1400.webp',
      srcSet: '/marketing/crop-gecis-m-700.webp 700w, /marketing/crop-gecis-m-1400.webp 1400w',
      width: 1400,
      height: 1091,
    },
  },
  vardiyalar: {
    layout: 'strip',
    src: '/marketing/crop-vardiya-2400.webp',
    srcSet: '/marketing/crop-vardiya-1200.webp 1200w, /marketing/crop-vardiya-2400.webp 2400w',
    width: 2400,
    height: 789,
    sizes: fullSizes,
    mobile: {
      media: '(max-width: 600px)',
      src: '/marketing/crop-vardiya-m-1400.webp',
      srcSet: '/marketing/crop-vardiya-m-700.webp 700w, /marketing/crop-vardiya-m-1400.webp 1400w',
      width: 1400,
      height: 1463,
    },
  },
};

function FeatureItems({ items }: { items: readonly string[] }) {
  return (
    <ul className="pub-feature-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function FeaturesSection() {
  return (
    <Section id="ozellikler" title={copy.featuresTitle} description={copy.featuresDescription}>
      <div className="pub-features">
        {copy.features.map((feature) => {
          const { layout, ...shot } = presentation[feature.shot];
          return (
            <article key={feature.shot} className={`pub-feature pub-feature-${layout}`}>
              <div className="pub-feature-heading">
                <div className="pub-feature-copy">
                  <div className="pub-feature-name">{feature.name}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
                {layout !== 'pair' && <FeatureItems items={feature.items} />}
              </div>
              {layout === 'pair' ? (
                <div className="pub-feature-body">
                  <ProductShot {...shot} alt={feature.alt} caption={feature.caption} />
                  <FeatureItems items={feature.items} />
                </div>
              ) : (
                <ProductShot {...shot} alt={feature.alt} caption={feature.caption} />
              )}
            </article>
          );
        })}
      </div>
    </Section>
  );
}
