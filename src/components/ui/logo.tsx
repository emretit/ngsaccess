
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className = '' 
}) => {
  // Size mapping
  const sizeMap = {
    sm: {
      logo: 'h-8 w-8',
      text: 'text-lg'
    },
    md: {
      logo: 'h-10 w-10',
      text: 'text-xl'
    },
    lg: {
      logo: 'h-12 w-12',
      text: 'text-2xl'
    }
  };

  const currentSize = sizeMap[size];

  // Icon only variant
  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img 
          src="/lovable-uploads/42e75e5c-71bf-4922-82ed-7f442cd9d3ea.png" 
          alt="NGS Plus" 
          className={`${currentSize.logo} object-contain rounded-full`}
        />
      </div>
    );
  }

  // Compact variant (logo + Plus)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <img 
          src="/lovable-uploads/42e75e5c-71bf-4922-82ed-7f442cd9d3ea.png" 
          alt="NGS Plus" 
          className={`${currentSize.logo} object-contain rounded-full`}
        />
        <span className={`font-bold font-['Poppins'] ${currentSize.text} text-white`}>
          Plus
        </span>
      </div>
    );
  }

  // Full variant (logo + NGS Plus)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img 
        src="/lovable-uploads/42e75e5c-71bf-4922-82ed-7f442cd9d3ea.png" 
        alt="NGS Plus" 
        className={`${currentSize.logo} object-contain rounded-full shadow-lg`}
      />
      <div className={`font-bold font-['Poppins'] ${currentSize.text}`}>
        <span className="text-white">NGS</span>
        <span className="text-yellow-300 ml-1">Plus</span>
      </div>
    </div>
  );
};

export default Logo;
