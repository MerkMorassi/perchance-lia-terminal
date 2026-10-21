import React from 'react';

interface BarRunnerProps {
  color?: string;
  segments?: number[];
  height?: number;
  className?: string;
  labels?: string[];
  gapPx?: number;
}

export const BarRunner: React.FC<BarRunnerProps> = ({
  color = '#37a6d1',
  segments = [15, 30, 20, 35],
  height = 12,
  className = '',
  labels,
  gapPx = 4,
}) => {
  const isDark =
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

  return (
    <div className={`flex items-center w-full ${className}`} style={{ gap: `${gapPx}px` }}>
      {segments.map((widthPercent, idx) => (
        <div
          key={idx}
          className="relative transition-colors duration-300 flex items-center justify-end px-2 overflow-hidden"
          style={{
            width: `${widthPercent}%`,
            height: `${height}px`,
            backgroundColor: color,
          }}
        >
          {labels && labels[idx] && (
            <span className={`font-antonio text-[10px] font-bold uppercase tracking-wider truncate ${isDark ? 'text-white' : 'text-black'}`}>
              {labels[idx]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
