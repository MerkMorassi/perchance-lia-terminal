import React from 'react';
import { SchematicType, ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';

interface VectorSchematicProps {
  type: SchematicType;
  currentTheme: ThemeId;
  className?: string;
  anomalySimulated?: boolean;
}

export const VectorSchematics: React.FC<VectorSchematicProps> = ({
  type,
  currentTheme,
  className = '',
  anomalySimulated = false,
}) => {
  const theme = THEMES[currentTheme];
  const strokeColor = theme.colors.primary;
  const accentColor = theme.colors.accent;
  const alertColor = anomalySimulated ? '#ef4444' : theme.colors.alert;

  switch (type) {
    case 'quantum_core':
      return (
        <svg
          viewBox="0 0 800 500"
          className={`w-full h-full select-none ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="coreGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
              <stop offset="50%" stopColor={strokeColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.8" />
            </linearGradient>
            <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke={theme.colors.border} strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>

          {/* Grid Backdrop */}
          <rect width="800" height="500" fill="url(#gridPattern)" />

          {/* Outer Reactor Chassis */}
          <rect
            x="300"
            y="40"
            width="200"
            height="420"
            rx="20"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray="12,6"
          />

          {/* Magnetic Injection Coils */}
          {[80, 140, 200, 260, 320, 380].map((y, i) => (
            <g key={i}>
              <rect
                x="260"
                y={y}
                width="280"
                height="24"
                rx="6"
                fill={theme.colors.bgSlate}
                stroke={i % 2 === 0 ? strokeColor : accentColor}
                strokeWidth="2"
              />
              <line x1="180" y1={y + 12} x2="260" y2={y + 12} stroke={accentColor} strokeWidth="2" strokeDasharray="4,4" />
              <line x1="540" y1={y + 12} x2="620" y2={y + 12} stroke={accentColor} strokeWidth="2" strokeDasharray="4,4" />
            </g>
          ))}

          {/* Central Quantum Plasma Column */}
          <rect
            x="370"
            y="60"
            width="60"
            height="380"
            rx="12"
            fill="url(#coreGlow)"
            stroke={accentColor}
            strokeWidth="2"
            className="animate-pulse"
          />

          {/* Reaction Chamber Spherical Confinement */}
          <circle
            cx="400"
            cy="250"
            r="85"
            fill="none"
            stroke={anomalySimulated ? alertColor : accentColor}
            strokeWidth="4"
            strokeDasharray="8,8"
            className="animate-spin-slow"
          />
          <circle
            cx="400"
            cy="250"
            r="45"
            fill={anomalySimulated ? alertColor : theme.colors.gold}
            opacity="0.6"
            className="animate-pulse"
          />

          {/* Transfer Manifold Conduit Pipes */}
          <path
            d="M 120 120 L 260 120 L 260 200 L 370 200"
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
          />
          <path
            d="M 680 120 L 540 120 L 540 200 L 430 200"
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
          />
          <path
            d="M 120 380 L 260 380 L 260 300 L 370 300"
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
          />
          <path
            d="M 680 380 L 540 380 L 540 300 L 430 300"
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
          />

          {/* Structural Frame Borders */}
          <line x1="40" y1="20" x2="760" y2="20" stroke={strokeColor} strokeWidth="2" />
          <line x1="40" y1="480" x2="760" y2="480" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'bridge_command':
      return (
        <svg
          viewBox="0 0 800 500"
          className={`w-full h-full select-none ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Bridge Elliptical Structural Deck */}
          <ellipse cx="400" cy="250" rx="340" ry="200" fill="none" stroke={strokeColor} strokeWidth="3" />
          <ellipse cx="400" cy="250" rx="260" ry="150" fill="none" stroke={theme.colors.border} strokeWidth="2" strokeDasharray="6,6" />
          <ellipse cx="400" cy="250" rx="150" ry="80" fill="none" stroke={accentColor} strokeWidth="2" />

          {/* Command Console Stations */}
          {/* Tactical Center */}
          <rect x="360" y="80" width="80" height="40" rx="8" fill={theme.colors.bgSlate} stroke={accentColor} strokeWidth="2" />
          {/* Helm & Ops */}
          <rect x="300" y="290" width="80" height="36" rx="6" fill={theme.colors.bgSlate} stroke={strokeColor} strokeWidth="2" />
          <rect x="420" y="290" width="80" height="36" rx="6" fill={theme.colors.bgSlate} stroke={strokeColor} strokeWidth="2" />

          {/* Defensive Shield Array Arc Vectors */}
          <path d="M 100 250 A 300 180 0 0 1 700 250" fill="none" stroke={accentColor} strokeWidth="3" strokeDasharray="12,12" />
          <path d="M 100 250 A 300 180 0 0 0 700 250" fill="none" stroke={strokeColor} strokeWidth="3" strokeDasharray="12,12" />

          {/* Targeting Vector Lines */}
          <line x1="400" y1="50" x2="400" y2="450" stroke={theme.colors.border} strokeWidth="1" strokeDasharray="4,4" />
          <line x1="100" y1="250" x2="700" y2="250" stroke={theme.colors.border} strokeWidth="1" strokeDasharray="4,4" />
        </svg>
      );

    case 'neural_lattice':
      return (
        <svg
          viewBox="0 0 800 500"
          className={`w-full h-full select-none ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Synaptic Hexagonal Grid */}
          {[
            { cx: 250, cy: 150 },
            { cx: 400, cy: 120 },
            { cx: 550, cy: 150 },
            { cx: 200, cy: 280 },
            { cx: 400, cy: 260 },
            { cx: 600, cy: 280 },
            { cx: 300, cy: 390 },
            { cx: 500, cy: 390 },
          ].map((node, i) => (
            <g key={i}>
              <circle cx={node.cx} cy={node.cy} r="35" fill={theme.colors.bgSlate} stroke={accentColor} strokeWidth="2" />
              <circle cx={node.cx} cy={node.cy} r="18" fill={strokeColor} opacity="0.6" className="animate-pulse" />
            </g>
          ))}

          {/* Neural Connections */}
          <line x1="250" y1="150" x2="400" y2="120" stroke={strokeColor} strokeWidth="2" />
          <line x1="400" y1="120" x2="550" y2="150" stroke={strokeColor} strokeWidth="2" />
          <line x1="250" y1="150" x2="200" y2="280" stroke={strokeColor} strokeWidth="2" />
          <line x1="400" y1="120" x2="400" y2="260" stroke={accentColor} strokeWidth="3" />
          <line x1="550" y1="150" x2="600" y2="280" stroke={strokeColor} strokeWidth="2" />
          <line x1="200" y1="280" x2="400" y2="260" stroke={accentColor} strokeWidth="2" />
          <line x1="600" y1="280" x2="400" y2="260" stroke={accentColor} strokeWidth="2" />
          <line x1="200" y1="280" x2="300" y2="390" stroke={strokeColor} strokeWidth="2" />
          <line x1="400" y1="260" x2="300" y2="390" stroke={accentColor} strokeWidth="2" />
          <line x1="400" y1="260" x2="500" y2="390" stroke={accentColor} strokeWidth="2" />
          <line x1="600" y1="280" x2="500" y2="390" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'thermo_array':
    default:
      return (
        <svg
          viewBox="0 0 800 500"
          className={`w-full h-full select-none ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Array Concentric Thermodynamic Waves */}
          {[60, 120, 180, 240, 300].map((r, i) => (
            <circle
              key={i}
              cx="400"
              cy="250"
              r={r}
              fill="none"
              stroke={i % 2 === 0 ? accentColor : strokeColor}
              strokeWidth="2"
              strokeDasharray={`${r / 2}, ${r / 4}`}
            />
          ))}
          <circle cx="400" cy="250" r="20" fill={accentColor} className="animate-ping" />
        </svg>
      );
  }
};
