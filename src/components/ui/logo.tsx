import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'compact' | 'icon';
  tone?: 'light' | 'dark';
  className?: string;
}

const sizeMap = {
  sm: { logo: 'h-8 w-8', text: 'text-lg' },
  md: { logo: 'h-10 w-10', text: 'text-xl' },
  lg: { logo: 'h-12 w-12', text: 'text-2xl' },
};

const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  tone = 'light',
  className = '',
}) => {
  const currentSize = sizeMap[size];
  const ngsClass = tone === 'light' ? 'text-white' : 'text-primary';
  const plusClass = tone === 'light' ? 'text-yellow-300' : 'text-yellow-500';

  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img
          src="/logo.svg"
          alt="NGS Plus"
          className={`${currentSize.logo} object-contain`}
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img
          src="/logo.svg"
          alt="NGS Plus"
          className={`${currentSize.logo} object-contain`}
        />
        <div className={`font-bold ${currentSize.text}`}>
          <span className={ngsClass}>NGS</span>
          <span className={`${plusClass} ml-0.5`}>Plus</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.svg"
        alt="NGS Plus"
        className={`${currentSize.logo} object-contain`}
      />
      <div className={`font-bold ${currentSize.text}`}>
        <span className={ngsClass}>NGS</span>
        <span className={`${plusClass} ml-1`}>Plus</span>
      </div>
    </div>
  );
};

export default Logo;
