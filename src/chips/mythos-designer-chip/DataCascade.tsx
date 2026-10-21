import React, { useState, useEffect } from 'react';

interface DataCascadeProps {
  columns?: number;
  rows?: number;
  speedMs?: number;
  className?: string;
}

export const DataCascade: React.FC<DataCascadeProps> = ({
  columns = 3,
  rows = 12,
  speedMs = 150,
  className = '',
}) => {
  const [dataStream, setDataStream] = useState<string[][]>([]);

  // Generate random hex/numerical streams
  const generateRandomHex = () => {
    const chars = '0123456789ABCDEF';
    let str = '';
    for (let i = 0; i < 4; i++) {
      str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
  };

  useEffect(() => {
    // Initialize stream grid
    const initialGrid = Array.from({ length: columns }, () =>
      Array.from({ length: rows }, () => generateRandomHex())
    );
    setDataStream(initialGrid);

    const interval = setInterval(() => {
      setDataStream((prev) =>
        prev.map((col) => {
          const newCol = [...col];
          // Shift down and add new top element
          newCol.pop();
          newCol.unshift(generateRandomHex());
          return newCol;
        })
      );
    }, speedMs);

    return () => clearInterval(interval);
  }, [columns, rows, speedMs]);

  return (
    <div
      className={`font-mono-data text-[10px] leading-tight select-none pointer-events-none opacity-80 ${className}`}
    >
      <div className="grid grid-cols-3 gap-2">
        {dataStream.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-0.5">
            {col.map((val, rowIdx) => {
              const isHighlight = rowIdx === 0;
              return (
                <div
                  key={rowIdx}
                  className={`transition-colors duration-100 ${
                    isHighlight
                      ? 'text-blue-400 font-bold opacity-90'
                      : rowIdx < 3
                      ? 'text-slate-400 opacity-70'
                      : 'text-slate-600 opacity-40'
                  }`}
                >
                  {val}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
