import React from 'react';
import { soundEngine } from '../../utils/audio';

interface PillboxButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'alert' | 'outline' | 'custom';
  terminalSide?: 'left' | 'right' | 'both' | 'flat';
  active?: boolean;
  className?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const PillboxButton: React.FC<PillboxButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  terminalSide = 'both',
  active = false,
  className = '',
  color,
  size = 'md',
  disabled = false,
}) => {
  const handleClick = () => {
    if (disabled) return;
    soundEngine.playChime();
    if (onClick) onClick();
  };

  // Base sizing
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs tracking-wider min-h-[28px]',
    md: 'px-4 py-1.5 text-xs sm:text-sm tracking-widest min-h-[34px]',
    lg: 'px-6 py-2.5 text-sm sm:text-base tracking-widest min-h-[42px]',
  }[size];

  // Terminal rounding
  const roundingClasses = {
    left: 'rounded-l-full rounded-r-none',
    right: 'rounded-r-full rounded-l-none',
    both: 'rounded-full',
    flat: 'rounded-none',
  }[terminalSide];

  // Variant styling
  const getVariantStyles = () => {
    if (color) {
      const isDarkHex =
        color === '#000' ||
        color === '#000000' ||
        color === '#111' ||
        color === '#111111' ||
        color === '#222' ||
        color === '#222222' ||
        color === '#333' ||
        color === '#333333' ||
        color === '#444' ||
        color === '#444444' ||
        color === '#555' ||
        color === '#555555' ||
        color.startsWith('#1') ||
        color.startsWith('#2') ||
        color.startsWith('#3') ||
        color.startsWith('#4');

      return {
        backgroundColor: color,
        color: isDarkHex ? '#ffffff' : '#050608',
      };
    }

    if (active) {
      return {
        backgroundColor: '#00eeee',
        color: '#050608',
      };
    }

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: '#37a6d1',
          color: '#050608',
        };
      case 'secondary':
        return {
          backgroundColor: '#1c3c55',
          color: '#00eeee',
        };
      case 'accent':
        return {
          backgroundColor: '#ffaa00',
          color: '#050608',
        };
      case 'alert':
        return {
          backgroundColor: '#e7442a',
          color: '#ffffff',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: '#37a6d1',
          border: '1px solid #37a6d1',
        };
      default:
        return {
          backgroundColor: '#2a7193',
          color: '#ffffff',
        };
    }
  };

  const style = getVariantStyles();

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={style}
      className={`
        font-antonio font-bold uppercase select-none transition-all duration-150
        flex items-center justify-center gap-2 cursor-pointer
        hover:brightness-125 active:scale-98
        disabled:opacity-40 disabled:cursor-not-allowed
        ${sizeClasses} ${roundingClasses} ${className}
      `}
    >
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
};
