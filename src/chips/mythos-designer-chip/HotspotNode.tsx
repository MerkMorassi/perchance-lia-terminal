import React from 'react';
import { MSDNode, SystemMetric, ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface HotspotNodeProps {
  node: MSDNode;
  metric?: SystemMetric;
  currentTheme: ThemeId;
  isSelected?: boolean;
  onSelectNode: (node: MSDNode) => void;
  draggable?: boolean;
  onDragNode?: (nodeId: string, newX: number, newY: number) => void;
}

export const HotspotNode: React.FC<HotspotNodeProps> = ({
  node,
  metric,
  currentTheme,
  isSelected = false,
  onSelectNode,
}) => {
  const theme = THEMES[currentTheme];

  const valueDisplay = metric
    ? `${metric.value.toFixed(1)} ${metric.unit}`
    : node.customValue !== undefined
    ? `${node.customValue}`
    : 'NOMINAL';

  const status = metric ? metric.status : node.status || 'nominal';

  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return '#ef4444'; // Basic Red
      case 'warning':
        return '#eab308'; // Basic Yellow
      case 'nominal':
      default:
        return '#22c55e'; // Basic Green
    }
  };

  const statusColor = getStatusColor();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playChime();
    onSelectNode(node);
  };

  return (
    <div
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
      }}
      onClick={handleClick}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 select-none"
    >
      {/* Outer Pulsing Target Ring */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-300 ${
          isSelected
            ? 'scale-175 ring-2 ring-blue-400 animate-pulse'
            : 'group-hover:scale-150 ring-1 ring-blue-500/40'
        }`}
        style={{
          border: `1.5px solid ${statusColor}`,
          boxShadow: `0 0 10px ${statusColor}`,
        }}
      />

      {/* Main Node Center Target */}
      <div
        className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full font-antonio text-xs font-bold uppercase transition-all duration-200 border shadow-lg ${
          isSelected
            ? 'scale-110 shadow-blue-500/30'
            : 'group-hover:scale-105'
        }`}
        style={{
          backgroundColor: '#0a0a0a',
          borderColor: statusColor,
          color: '#d1d5db',
        }}
      >
        {status === 'critical' ? (
          <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-bounce" />
        ) : status === 'warning' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        )}

        <span className="tracking-wider whitespace-nowrap text-slate-200">{node.label}</span>

        {/* Live Metric Badge Pill */}
        <span
          className="ml-1 px-1.5 py-0.2 rounded-full font-mono-data text-[10px] font-bold text-black"
          style={{ backgroundColor: statusColor }}
        >
          {valueDisplay}
        </span>
      </div>

      {/* Hover Tooltip Card */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col bg-[#0a0a0a]/95 border border-[#333333] backdrop-blur-md p-2 rounded shadow-2xl z-30 min-w-[160px] pointer-events-none">
        <div className="font-antonio text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
          <span>{node.label}</span>
          <span className="font-mono-data text-[9px] text-slate-400">{node.id}</span>
        </div>
        {node.description && (
          <p className="font-mono-data text-[10px] text-slate-400 mt-1 leading-tight">
            {node.description}
          </p>
        )}
        <div className="mt-1.5 pt-1 border-t border-[#333333] flex justify-between font-mono-data text-[10px]">
          <span className="text-slate-400">STATUS:</span>
          <span className="font-bold uppercase" style={{ color: statusColor }}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};
