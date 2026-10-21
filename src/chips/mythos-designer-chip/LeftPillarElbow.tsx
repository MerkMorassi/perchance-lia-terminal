import React from 'react';

import { GeometryParams, MSDNavigationItem, ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { PillboxButton } from './PillboxButton';
import { Activity, ShieldAlert, Cpu, Database, Compass, MessageSquare } from 'lucide-react';
import { VoxconTranscriptionDisplay } from '../voice/VoxconTranscriptionDisplay';

interface LeftPillarElbowProps {
  navigationItems: MSDNavigationItem[];
  activeNavId: string;
  onSelectNav: (id: string) => void;
  currentTheme: ThemeId;
  geometryParams?: GeometryParams;
  anomalySimulated: boolean;
  onToggleAnomaly: () => void;
  transcripts?: any[];
}

export const LeftPillarElbow: React.FC<LeftPillarElbowProps> = ({
  navigationItems,
  activeNavId,
  onSelectNav,
  currentTheme,
  geometryParams = { outerElbowRadius: 32, innerElbowRadius: 16, padding: 16, barGap: 4 },
  anomalySimulated,
  onToggleAnomaly,
  transcripts = [],
}) => {
  const theme = THEMES[currentTheme];

  // Calculate elbow joint math strictly according to Specification 2.3: R_outer = R_inner + P
  const innerR = geometryParams.innerElbowRadius;
  const padding = geometryParams.padding;
  const outerR = innerR + padding;

  return (
    <aside className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2 select-none">
      {/* Structural Pillar Top Joint with Geometry Formula Display */}
      <div
        className="w-full flex flex-col p-3 transition-colors duration-300 relative overflow-hidden"
        style={{
          backgroundColor: theme.colors.primary,
          borderTopLeftRadius: `${outerR}px`,
          borderBottomLeftRadius: `${innerR}px`,
        }}
      >
        <div className={`flex items-center justify-between font-antonio font-extrabold tracking-wider ${currentTheme === 'noir-dark' ? 'text-slate-200' : 'text-black'}`}>
          <span className="text-sm uppercase">PILLAR // FRAME 01</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono-data ${currentTheme === 'noir-dark' ? 'bg-black/40 text-slate-200 border border-[#333333]' : 'bg-black/20 text-black'}`}>
            R={outerR}px
          </span>
        </div>
        <div className={`text-[10px] font-mono-data mt-1 ${currentTheme === 'noir-dark' ? 'text-slate-400' : 'text-black/80'}`}>
          FORMULA: R_outer ({outerR}) = R_inner ({innerR}) + P ({padding})
        </div>
      </div>

      {/* Navigation Pillbox Section */}
      <div className="flex flex-col gap-1.5 bg-[#0a0a0a] p-2 rounded-lg border border-[#333333]">
        <div className="text-[10px] font-mono-data text-slate-400 px-1 flex items-center justify-between uppercase tracking-widest">
          <span>NAVIGATION MODULES</span>
          <Compass className="w-3 h-3 text-blue-400" />
        </div>

        <div className="flex flex-col gap-1 mt-1">
          {navigationItems.map((nav, idx) => {
            const isActive = nav.id === activeNavId;
            return (
              <PillboxButton
                key={nav.id}
                terminalSide="both"
                size="md"
                active={isActive}
                onClick={() => onSelectNav(nav.id)}
                color={isActive ? theme.colors.accent : theme.colors.secondary}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <span>{nav.label}</span>
                  <span className="text-[10px] opacity-70 font-mono-data">
                    0{idx + 1}
                  </span>
                </div>
              </PillboxButton>
            );
          })}
        </div>
      </div>

      {/* System Telemetry & Anomaly Trigger Card */}
      <div className="flex flex-col gap-2 bg-[#111111] p-3 rounded-lg border border-[#333333]">
        <div className="flex items-center justify-between text-xs font-antonio font-bold tracking-wider text-slate-200">
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-blue-400" />
            TELEMETRY METRICS
          </span>
          <span className="font-mono-data text-[10px] text-green-400">ACTIVE</span>
        </div>

        <div className="space-y-2 text-xs font-mono-data">
          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-400">FIELD STABILITY</span>
              <span className={anomalySimulated ? 'text-red-400 font-bold' : 'text-green-400'}>
                {anomalySimulated ? '42.1%' : '98.6%'}
              </span>
            </div>
            <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden border border-[#333333]">
              <div
                className={`h-full transition-all duration-500 ${
                  anomalySimulated ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                }`}
                style={{ width: anomalySimulated ? '42%' : '98.6%' }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-400">ENTROPY RATE</span>
              <span className={anomalySimulated ? 'text-red-400 font-bold' : 'text-yellow-400'}>
                {anomalySimulated ? '0.84 ρS' : '0.04 ρS'}
              </span>
            </div>
            <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden border border-[#333333]">
              <div
                className={`h-full transition-all duration-500 ${
                  anomalySimulated ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                }`}
                style={{ width: anomalySimulated ? '84%' : '18%' }}
              />
            </div>
          </div>
        </div>

        {/* Anomaly Simulation Toggle */}
        <button
          type="button"
          onClick={onToggleAnomaly}
          className={`
            mt-2 w-full py-2 px-3 rounded text-xs font-antonio font-bold uppercase tracking-wider
            flex items-center justify-center gap-2 transition-all cursor-pointer border
            ${
              anomalySimulated
                ? 'bg-red-950/80 border-red-500 text-red-200 hover:bg-red-900 shadow-lg shadow-red-950/50'
                : 'bg-[#222222] border-[#444444] text-slate-300 hover:bg-[#333333] hover:text-white'
            }
          `}
        >
          <ShieldAlert className={`w-4 h-4 ${anomalySimulated ? 'animate-bounce text-red-400' : 'text-yellow-400'}`} />
          {anomalySimulated ? 'RESET SURGE ANOMALY' : 'INDUCE ANOMALY SURGE'}
        </button>
      </div>

      {/* Live Comms Monitor Block */}
      <div className="flex flex-col gap-2 bg-[#0d0d0d] p-2.5 rounded-lg border border-[#333333] flex-grow min-h-[180px] max-h-[350px]">
        <VoxconTranscriptionDisplay transcripts={transcripts} currentTheme={currentTheme} />
      </div>

      {/* Structural Geometry Footer */}
      <div className="mt-auto bg-[#0a0a0a] p-2.5 rounded-lg border border-[#333333] font-mono-data text-[10px] text-slate-400 flex flex-col gap-1">
        <div className="flex items-center justify-between text-slate-300 font-bold">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-400" />
            MythOS ENGINE
          </span>
          <span className="text-green-400">ONLINE</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>LATENCY:</span>
          <span>1.2ms</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>FRAME FREQ:</span>
          <span>60 Hz</span>
        </div>
      </div>
    </aside>
  );
};
