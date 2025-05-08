
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
      plus: 'w-3 h-3'
    },
    md: {
      container: 'h-10',
      icon: 'h-8 w-8',
      text: 'text-xl',
      plus: 'w-4 h-4'
    },
    lg: {
      container: 'h-12',
      icon: 'h-10 w-10',
      text: 'text-2xl',
      plus: 'w-5 h-5'
    }
  };

  // The selected size
  const currentSize = sizeMap[size];

  // Render logo based on variant
  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className={`bg-[#800020] rounded-md flex items-center justify-center relative ${currentSize.icon}`}>
          <span className="text-white font-bold">N</span>
          <div className={`absolute -bottom-1 -right-1 bg-white rounded-full flex items-center justify-center ${currentSize.plus}`}>
            <span className="text-[#800020] font-bold text-xs">+</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`bg-[#800020] rounded-md flex items-center justify-center mr-2 relative ${currentSize.icon}`}>
          <span className="text-white font-bold">N</span>
          <div className={`absolute -bottom-1 -right-1 bg-white rounded-full flex items-center justify-center ${currentSize.plus}`}>
            <span className="text-[#800020] font-bold text-xs">+</span>
          </div>
        </div>
        <span className={`font-semibold font-['Poppins'] ${currentSize.text}`}>
          <span className="text-[#800020]">Plus</span>
        </span>
      </div>
    );
  }

  // Default full logo
  return (
    <div className={`flex items-center ${className}`}>
      <div className={`bg-[#800020] rounded-md flex items-center justify-center mr-2 relative ${currentSize.icon}`}>
        <span className="text-white font-bold">N</span>
        <div className={`absolute -bottom-1 -right-1 bg-white rounded-full flex items-center justify-center ${currentSize.plus}`}>
          <span className="text-[#800020] font-bold text-xs">+</span>
        </div>
      </div>
      <span className={`font-semibold font-['Poppins'] ${currentSize.text}`}>
        <span className="text-gray-800">NGS</span> <span className="text-[#800020]">Plus</span>
      </span>
    </div>
  );
};

export default Logo;
