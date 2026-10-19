interface LogoProps {
  size?: 'md';
  tone?: 'light' | 'dark';
  className?: string;
}
const sizeMap = {
  md: { logo: 'h-8 w-8 min-[601px]:h-9 min-[601px]:w-9', text: 'text-[20px] min-[601px]:text-[22px]' },
};
export default function Logo({ size = 'md', tone = 'light', className = '' }: LogoProps) {
  const current = sizeMap[size];
  return (
    <div
      className={`inline-flex items-center gap-[10px] whitespace-nowrap leading-none ${tone === 'light' ? 'text-side-text' : 'text-primary'} ${className}`}
    >
      <img
        src="/logo.svg"
        alt=""
        width={36}
        height={36}
        className={`${current.logo} object-contain ${tone === 'light' ? 'brightness-0 invert' : ''}`}
      />
      <span className={`font-bold tracking-[-.8px] ${current.text}`}>NGS Plus</span>
    </div>
  );
}
