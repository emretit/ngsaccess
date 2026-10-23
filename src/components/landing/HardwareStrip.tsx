import { marketingFacts as copy } from './marketingFacts';

type Brand = (typeof copy.hardwareBrands)[number];

const brandLogos: Record<Brand, { src: string; width: number; height: number; displayHeight: number }> = {
  Hikvision: { src: '/brands/hikvision-logo.svg', width: 1024, height: 137, displayHeight: 22 },
  Dahua: { src: '/brands/dahua-logo.svg', width: 1024, height: 318, displayHeight: 34 },
  'IDE Smart': { src: '/brands/ide-smart-logo.png', width: 251, height: 96, displayHeight: 52 },
  Mavisoft: { src: '/brands/mavisoft-logo.png', width: 300, height: 33, displayHeight: 18 },
};

export default function HardwareStrip() {
  return (
    <div className="pub-wrap">
      <div className="pub-hardware">
        <div className="pub-hardware-head">
          <p className="pub-hardware-title">{copy.hardware[0]}</p>
          <p>{copy.hardware[1]}</p>
        </div>
        <ul className="pub-hardware-brands">
          {copy.hardwareBrands.map((brand) => {
            const logo = brandLogos[brand];
            return (
              <li key={brand}>
                <img
                  src={logo.src}
                  alt={brand}
                  width={logo.width}
                  height={logo.height}
                  loading="lazy"
                  style={{ height: logo.displayHeight }}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
