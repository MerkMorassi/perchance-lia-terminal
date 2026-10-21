import { AccessGate } from "../auth/AccessGate";
import React, { useState } from 'react';
import { MSDLayoutManifest, MSDNode, SystemMetric, ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { SchematicCanvas } from '../msd/SchematicCanvas';
import { TelemetryPanel } from '../msd/TelemetryPanel';
import { soundEngine } from '../../utils/audio';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  CheckCircle,
  AlertTriangle,
  Server,
  Terminal,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Clock,
  ListFilter
} from 'lucide-react';

interface ModernDashboardViewProps {
  manifest: MSDLayoutManifest;
  metrics: Record<string, SystemMetric>;
  currentTheme: ThemeId;
  selectedNode: MSDNode | null;
  onSelectNode: (node: MSDNode | null) => void;
  anomalySimulated: boolean;
  onUpdateMetric: (key: string, value: number) => void;
  onClearCustomImage?: () => void;
  activeTab?: 'dashboard' | 'schematic' | 'split';
  onTabChange?: (tab: 'dashboard' | 'schematic' | 'split') => void;
}

export const ModernDashboardView: React.FC<ModernDashboardViewProps> = ({
  manifest,
  metrics,
  currentTheme,
  selectedNode,
  onSelectNode,
  anomalySimulated,
  onUpdateMetric,
  onClearCustomImage,
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<'dashboard' | 'schematic' | 'split'>('dashboard');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleSelectTab = (tab: 'dashboard' | 'schematic' | 'split') => {
    soundEngine.playToggle();
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'nominal' | 'alert'>('all');
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];

  // Default KPI cards if not present in manifest
  const kpiCards = manifest.kpiCards && manifest.kpiCards.length > 0
    ? manifest.kpiCards
    : [
        { id: 'kpi-1', label: 'SYSTEM COHERENCE', value: metrics.coherenceFactor ? `${metrics.coherenceFactor.value.toFixed(1)}%` : '98.4%', change: '+3.2%', isPositive: true, metricKey: 'coherenceFactor' as const },
        { id: 'kpi-2', label: 'INGRESS THROUGHPUT', value: metrics.plasmaFlowRate ? `${metrics.plasmaFlowRate.value.toFixed(1)} GB/s` : '48.6 GB/s', change: '+12.4%', isPositive: true, metricKey: 'plasmaFlowRate' as const },
        { id: 'kpi-3', label: 'ERROR ENTROPY', value: metrics.meanEntropyDensity ? `${metrics.meanEntropyDensity.value.toFixed(3)}` : '0.012', change: '-18.5%', isPositive: true, metricKey: 'meanEntropyDensity' as const },
        { id: 'kpi-4', label: 'THERMAL PRESSURE', value: metrics.coreTemperature ? `${metrics.coreTemperature.value.toFixed(1)} K` : '312.4 K', change: 'Stable', isPositive: true, metricKey: 'coreTemperature' as const },
      ];

  // Simulated node/pod fleet data for Extrapolated Table
  const podFleet = [
    { id: 'pod-us-w1', name: 'ingress-router-alpha', region: 'us-west-1', status: 'Healthy', load: '42%', latency: '1.2ms', memory: '3.4 GB' },
    { id: 'pod-us-w2', name: 'inference-worker-01', region: 'us-west-1', status: anomalySimulated ? 'Degraded' : 'Healthy', load: anomalySimulated ? '96%' : '58%', latency: anomalySimulated ? '42.8ms' : '2.4ms', memory: '12.8 GB' },
    { id: 'pod-eu-c1', name: 'cache-redis-mesh', region: 'eu-central-1', status: 'Healthy', load: '28%', latency: '0.8ms', memory: '16.0 GB' },
    { id: 'pod-ap-s1', name: 'persistence-cluster-db', region: 'ap-southeast-1', status: 'Healthy', load: '64%', latency: '3.1ms', memory: '24.2 GB' },
    { id: 'pod-us-e1', name: 'telemetry-vector-sink', region: 'us-east-1', status: 'Healthy', load: '35%', latency: '1.5ms', memory: '6.2 GB' },
  ];

  // Activity events stream
  const auditLogs = [
    { id: 'log-1', time: '14:28:12.492', level: 'INFO', msg: 'Zero-trust TLS mutual handshake verified for mesh ingress' },
    { id: 'log-2', time: '14:28:09.118', level: anomalySimulated ? 'WARN' : 'INFO', msg: anomalySimulated ? 'Anomalous entropy divergence detected in primary compute matrix' : 'Coherence field harmonics synchronized at nominal threshold' },
    { id: 'log-3', time: '14:28:01.820', level: 'INFO', msg: 'Cryptographic attestation valid for active cluster orchestrator' },
    { id: 'log-4', time: '14:27:52.404', level: 'INFO', msg: 'Automatic horizontal scale check passed (24 active nodes)' },
  ];

  return (
    <div className="flex flex-col gap-3 w-full font-sans">
      {/* View Switcher Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 rounded-lg border bg-[#080d17] border-[#1e293b]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            id="tab-extrapolated-dashboard"
            data-voice-target="extrapolated dashboard"
            onClick={() => handleSelectTab('dashboard')}
            className={`px-3 py-1.5 text-xs font-mono-data font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Extrapolated Telemetry & Pod Status Dashboard (Voice: 'Extrapolated Dashboard')"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>EXTRAPOLATED DASHBOARD</span>
          </button>

          <button
            type="button"
            id="tab-schematic-canvas"
            data-voice-target="schematic canvas"
            onClick={() => handleSelectTab('schematic')}
            className={`px-3 py-1.5 text-xs font-mono-data font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'schematic'
                ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="MSD Schematic Canvas & Hotspot Telemetry (Voice: 'Schematic Canvas')"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SCHEMATIC CANVAS</span>
            {manifest.msdCanvas?.customImage && (
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] border border-cyan-500/40 animate-pulse">
                HOST ASSET
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-split-observability"
            data-voice-target="split observability"
            onClick={() => handleSelectTab('split')}
            className={`px-3 py-1.5 text-xs font-mono-data font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'split'
                ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Dual-Split Observability View (Voice: 'Split Observability')"
          >
            <Server className="w-3.5 h-3.5" />
            <span>SPLIT OBSERVABILITY</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-data text-slate-400">
          <span>LAYOUT:</span>
          <span className="text-cyan-300 font-bold uppercase">
            {manifest.layoutArchetype || 'MODERN DASHBOARD'}
          </span>
        </div>
      </div>

      {/* Extrapolated KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((kpi, idx) => {
          const liveValue = kpi.metricKey && metrics[kpi.metricKey]
            ? `${metrics[kpi.metricKey].value.toFixed(1)} ${metrics[kpi.metricKey].unit || ''}`
            : kpi.value;

          return (
            <div
              key={kpi.id || idx}
              id={`kpi-card-${kpi.id || idx}`}
              data-voice-target={kpi.label.toLowerCase()}
              className="p-3.5 rounded-lg border flex flex-col justify-between gap-2 shadow-sm transition-all hover:border-slate-400/50 cursor-pointer"
              style={{
                backgroundColor: theme.colors.bgSlate,
                borderColor: theme.colors.border,
              }}
              onClick={() => {
                soundEngine.playToggle();
                if (kpi.metricKey) {
                  onSelectNode({
                    id: `node-${kpi.metricKey}`,
                    label: kpi.label,
                    description: `Primary KPI telemetry metric node for ${kpi.label}.`,
                    status: 'nominal',
                    coordinates: { x: 50, y: 50 },
                    subsystem: 'telemetry',
                    metricKey: kpi.metricKey,
                  });
                }
              }}
              title={`KPI: ${kpi.label} (Voice: '${kpi.label}')`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono-data">
                <span className="uppercase font-semibold tracking-wider">{kpi.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono-data font-bold flex items-center gap-0.5 ${
                    kpi.isPositive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {kpi.isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {kpi.change || 'Nominal'}
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold font-mono-data tracking-tight text-white">
                  {liveValue}
                </span>
                {kpi.unit && (
                  <span className="text-xs text-slate-400 font-mono-data">
                    {kpi.unit}
                  </span>
                )}
              </div>

              {/* Sparkline Visual Simulation */}
              <div className="w-full h-2 bg-[#090d18] rounded-full overflow-hidden border border-[#1e293b]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${65 + (idx * 9) % 30}%`,
                    backgroundColor: idx === 0 ? theme.colors.primary : idx === 1 ? theme.colors.accent : idx === 2 ? theme.colors.live : theme.colors.gold,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Workspace Body based on Active Tab */}
      {(activeTab === 'dashboard' || activeTab === 'split') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full">
          {/* Left 2 Cols: Real-time Telemetry Trend & Component Status Table */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Live Telemetry Area Vector Chart */}
            <div
              className="p-4 rounded-lg border shadow-sm flex flex-col gap-3"
              style={{
                backgroundColor: theme.colors.bgSlate,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm text-white font-sans uppercase tracking-wide">
                    Real-Time Telemetry Trend Vector
                  </span>
                </div>
                <span className="text-[10px] font-mono-data px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  ROLLING 60-SEC WINDOW
                </span>
              </div>

              {/* SVG Sparkline & Trend Simulation */}
              <div className="w-full h-44 bg-[#080d19] rounded-md border border-[#1e293b] p-2 relative overflow-hidden flex flex-col justify-end">
                {/* Horizontal Grid lines */}
                <div className="absolute inset-0 grid grid-rows-4 pointer-events-none opacity-20">
                  <div className="border-b border-cyan-500/40" />
                  <div className="border-b border-cyan-500/40" />
                  <div className="border-b border-cyan-500/40" />
                  <div className="border-b border-cyan-500/40" />
                </div>

                <svg className="w-full h-36 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 50">
                  <defs>
                    <linearGradient id="vectorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.colors.primary} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <polygon
                    points="0,50 0,35 15,30 30,38 45,22 60,28 75,18 90,22 100,15 100,50"
                    fill="url(#vectorGrad)"
                  />
                  {/* Stroke line */}
                  <polyline
                    points="0,35 15,30 30,38 45,22 60,28 75,18 90,22 100,15"
                    fill="none"
                    stroke={theme.colors.accent}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                <div className="flex justify-between items-center text-[10px] font-mono-data text-slate-400 pt-1 border-t border-[#1e293b]">
                  <span>T-60s</span>
                  <span>T-45s</span>
                  <span>T-30s</span>
                  <span>T-15s</span>
                  <span className="text-cyan-400 font-bold">NOW (LIVE)</span>
                </div>
              </div>
            </div>

            {/* Extrapolated Pod & Node Status Table */}
            <div
              className="p-4 rounded-lg border shadow-sm flex flex-col gap-3"
              style={{
                backgroundColor: theme.colors.bgSlate,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-white font-sans uppercase tracking-wide">
                    Extrapolated Cluster Component Grid
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono-data">
                  {podFleet.length} SERVICES MONITORING
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono-data border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e293b] text-slate-400 text-[11px]">
                      <th className="pb-2 font-semibold">SERVICE NODE</th>
                      <th className="pb-2 font-semibold">REGION</th>
                      <th className="pb-2 font-semibold">STATUS</th>
                      <th className="pb-2 font-semibold">LOAD</th>
                      <th className="pb-2 font-semibold">LATENCY</th>
                      <th className="pb-2 font-semibold">MEMORY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#172033]">
                    {podFleet.map((pod) => (
                      <tr
                        key={pod.id}
                        id={`pod-row-${pod.id}`}
                        data-voice-target={pod.name.toLowerCase()}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => {
                          soundEngine.playToggle();
                          onSelectNode({
                            id: `node-${pod.id}`,
                            label: pod.name,
                            description: `Pod Cluster Worker: ${pod.name} in ${pod.region}. Status: ${pod.status}, Load: ${pod.load}, Latency: ${pod.latency}.`,
                            status: pod.status === 'Healthy' ? 'nominal' : 'critical',
                            coordinates: { x: 50, y: 50 },
                            subsystem: 'compute',
                          });
                        }}
                        title={`Cluster Pod: ${pod.name} (Voice: '${pod.name}')`}
                      >
                        <td className="py-2.5 font-bold text-slate-200">{pod.name}</td>
                        <td className="py-2.5 text-slate-400">{pod.region}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pod.status === 'Healthy'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
                            }`}
                          >
                            {pod.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-300">{pod.load}</td>
                        <td className="py-2.5 text-cyan-300 font-semibold">{pod.latency}</td>
                        <td className="py-2.5 text-slate-400">{pod.memory}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Live Audit Event Stream & Quick Control */}
          <div className="flex flex-col gap-3">
            {/* System Admin Controls (Access Gated) */}
            <AccessGate minRole="SUPERVISOR">
              <div
                className="p-4 rounded-lg border shadow-sm flex flex-col gap-3"
                style={{
                  backgroundColor: theme.colors.bgSlate,
                  borderColor: theme.colors.border,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-400" />
                    <span className="font-bold text-sm text-white font-sans uppercase tracking-wide">
                      System Admin Controls
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playAlert();
                    alert('SYSTEM RESET INITIATED (Simulated)');
                  }}
                  className="w-full px-3 py-2 text-xs font-mono-data font-bold rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 hover:text-white border border-red-500/30 transition-all text-center"
                >
                  INITIATE SYSTEM RESET
                </button>
              </div>
            </AccessGate>

            {/* Real-time Activity Ledger */}
            <div
              className="p-4 rounded-lg border shadow-sm flex flex-col gap-3 flex-grow"
              style={{
                backgroundColor: theme.colors.bgSlate,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-white font-sans uppercase tracking-wide">
                    Live Event Stream
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded bg-[#090e1b] border border-[#1e293b] flex flex-col gap-1 text-xs font-mono-data"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-slate-500" />
                        {log.time}
                      </span>
                      <span
                        className={`font-bold ${
                          log.level === 'WARN' ? 'text-amber-400' : 'text-cyan-400'
                        }`}
                      >
                        [{log.level}]
                      </span>
                    </div>
                    <div className="text-slate-300 leading-snug">{log.msg}</div>
                  </div>
                ))}
              </div>

              {/* Rationale / Extrapolation Notes */}
              {manifest.designRationale && (
                <div className="mt-2 p-2.5 rounded bg-[#070b14] border border-[#1a2336] text-[11px] font-mono-data text-slate-400">
                  <div className="text-cyan-300 font-bold mb-0.5">SYNTHESIS RATIONALE:</div>
                  <div>{manifest.designRationale}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schematic Canvas View */}
      {(activeTab === 'schematic' || activeTab === 'split') && (
        <div className="flex flex-col lg:flex-row gap-3 w-full">
          <SchematicCanvas
            canvasConfig={manifest.msdCanvas}
            metrics={metrics}
            currentTheme={currentTheme}
            selectedNode={selectedNode}
            onSelectNode={onSelectNode}
            anomalySimulated={anomalySimulated}
            onClearCustomImage={onClearCustomImage}
          />
          <TelemetryPanel
            metrics={metrics}
            selectedNode={selectedNode}
            onCloseSelectedNode={() => onSelectNode(null)}
            onUpdateMetric={onUpdateMetric}
            currentTheme={currentTheme}
            anomalySimulated={anomalySimulated}
          />
        </div>
      )}
    </div>
  );
};
