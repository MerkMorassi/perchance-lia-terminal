import React, { useState } from 'react';
import { Ruler, Sliders, CheckCircle2 } from 'lucide-react';
import { soundEngine } from '../../utils/audio';

export const GeometryLab: React.FC = () => {
  const [innerR, setInnerR] = useState(16);
  const [padding, setPadding] = useState(16);
  const [barGap, setBarGap] = useState(4);

  // Math formula strictly enforced: R_outer = R_inner + P
  const outerR = innerR + padding;

  return (
    <div className="w-full bg-[#0a0d12] p-4 rounded-xl border border-[#2f3749] flex flex-col gap-4 select-none">
      <div className="flex items-center justify-between pb-2 border-b border-[#2f3749]">
        <div className="flex items-center gap-2 font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider">
          <Ruler className="w-4 h-4 text-amber-400" />
          <span>2.3 STRUCTURAL GEOMETRY LAB & MATHEMATICAL FORMULAS</span>
        </div>
        <span className="font-mono-data text-xs text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800">
          FORMULA: R_outer = R_inner + P
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geometry Controls Sliders */}
        <div className="space-y-4 font-mono-data text-xs bg-[#101216] p-4 rounded border border-[#2f3749]">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>INNER RADIUS (R_inner):</span>
              <span className="text-amber-400 font-bold">{innerR} px</span>
            </div>
            <input
              type="range"
              min={8}
              max={32}
              value={innerR}
              onChange={(e) => {
                soundEngine.playBeep(500, 'sine', 0.02, 0.02);
                setInnerR(parseInt(e.target.value));
              }}
              className="w-full h-1.5 bg-[#1c3c55] rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>CONTAINER PADDING (P):</span>
              <span className="text-amber-400 font-bold">{padding} px</span>
            </div>
            <input
              type="range"
              min={8}
              max={32}
              value={padding}
              onChange={(e) => {
                soundEngine.playBeep(500, 'sine', 0.02, 0.02);
                setPadding(parseInt(e.target.value));
              }}
              className="w-full h-1.5 bg-[#1c3c55] rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>BAR RUNNER GAPS (Gap):</span>
              <span className="text-amber-400 font-bold">{barGap} px</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={barGap}
              onChange={(e) => {
                soundEngine.playBeep(500, 'sine', 0.02, 0.02);
                setBarGap(parseInt(e.target.value));
              }}
              className="w-full h-1.5 bg-[#1c3c55] rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="p-3 bg-[#050608] rounded border border-[#2f3749] text-slate-300 space-y-1">
            <div className="text-cyan-400 font-bold">CALCULATED OUTCOME:</div>
            <div>
              R_outer = {innerR}px + {padding}px = <span className="text-amber-400 font-bold">{outerR}px</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Guarantees zero-regression visual harmony across nested frame joints.
            </div>
          </div>
        </div>

        {/* Live Interactive Geometry Render Preview */}
        <div className="flex flex-col gap-3 bg-[#050608] p-4 rounded border border-[#2f3749]">
          <div className="text-xs font-antonio font-bold text-slate-300 uppercase tracking-wider">
            LIVE GEOMETRY RENDER PREVIEW
          </div>

          {/* Render Elbow Joint */}
          <div className="relative w-full h-32 bg-[#101216] rounded flex items-center justify-center p-4">
            <div
              className="w-48 h-20 bg-[#37a6d1] flex items-center justify-center transition-all duration-300"
              style={{
                borderTopLeftRadius: `${outerR}px`,
                borderBottomLeftRadius: `${innerR}px`,
              }}
            >
              <div className="font-antonio text-black font-extrabold text-xs uppercase tracking-wider">
                ELBOW JOINT ({outerR}px / {innerR}px)
              </div>
            </div>
          </div>

          {/* Render Bar Runner with custom gap */}
          <div className="flex items-center w-full mt-2" style={{ gap: `${barGap}px` }}>
            <div className="h-4 bg-[#37a6d1] w-1/4 rounded-l-full" />
            <div className="h-4 bg-[#2a7193] w-1/3" />
            <div className="h-4 bg-[#ffaa00] w-1/4" />
            <div className="h-4 bg-[#00eeee] flex-grow rounded-r-full" />
          </div>
          <div className="font-mono-data text-[10px] text-slate-400 text-center">
            Bar Runners with {barGap}px black divider gaps
          </div>
        </div>
      </div>
    </div>
  );
};
