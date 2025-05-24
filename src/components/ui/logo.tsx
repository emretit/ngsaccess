
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
      container: 'h-8',
      icon: 'h-6 w-6',
      text: 'text-lg',
      logo: 'h-6 w-6'
    },
    md: {
      container: 'h-10',
      icon: 'h-8 w-8',
      text: 'text-xl',
      logo: 'h-8 w-8'
    },
    lg: {
      container: 'h-12',
      icon: 'h-10 w-10',
      text: 'text-2xl',
      logo: 'h-10 w-10'
    }
  };

  // The selected size
  const currentSize = sizeMap[size];

  // Render logo based on variant
  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img 
          src="/lovable-uploads/42e75e5c-71bf-4922-82ed-7f442cd9d3ea.png" 
          alt="NGS Plus" 
          className={`${currentSize.logo} object-contain`}
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center ${className}`}>
        <img 
          src="/lovable-uploads/42e75e5c-71bf-4922-82ed-7f442cd9d3ea.png" 
          alt="NGS Plus" 
          className={`${currentSize.logo} object-contain mr-2`}
        />
        <span className={`font-semibold font-['Poppins'] ${currentSize.text}`}>
          <span className="text-[#800020]">Plus</span>
        </span>
      </div>
    );
  }

  // Default full logo
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/lovable-uploads/42e75e5c-71bf-4922-82ed-7f442cd9d3ea.png" 
        alt="NGS Plus" 
        className={`${currentSize.logo} object-contain mr-2`}
      />
      <span className={`font-semibold font-['Poppins'] ${currentSize.text}`}>
        <span className="text-gray-800">NGS</span> <span className="text-[#800020]">Plus</span>
      </span>
    </div>
  );
};

export default Logo;
