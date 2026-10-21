import React, { useState, useRef, useEffect } from 'react';
import { MSDNode, SystemMetric, ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import { Activity, Sliders, ShieldCheck, Zap, AlertCircle, X, BarChart3, TrendingUp, TrendingDown, ShieldAlert, Download, GitCompare, LineChart as LineChartIcon, Copy, Check, Pin } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface TelemetryPanelProps {
  metrics: Record<string, SystemMetric>;
  selectedNode: MSDNode | null;
  onCloseSelectedNode: () => void;
  onUpdateMetric: (key: string, newValue: number) => void;
  currentTheme: ThemeId;
  anomalySimulated: boolean;
}

export function calculateStabilityForecast(m: SystemMetric) {
  const history = m.history || [];
  if (history.length === 0) {
    return { sma: m.value, trend: 'STABLE' as const, risk: 'LOW' as const, riskScore: 0, delta: 0 };
  }
  
  const sma = history.reduce((sum, val) => sum + val, 0) / history.length;
  
  const recentHistory = history.slice(-3);
  let delta = 0;
  if (recentHistory.length >= 2) {
    delta = recentHistory[recentHistory.length - 1] - recentHistory[0];
  }
  
  let trend: 'UPWARD' | 'DOWNWARD' | 'STABLE' = 'STABLE';
  const rangeWidth = m.max - m.min;
  const movementThreshold = rangeWidth * 0.003;
  if (Math.abs(delta) > movementThreshold) {
    trend = delta > 0 ? 'UPWARD' : 'DOWNWARD';
  }

  const [nomMin, nomMax] = m.nominalRange;
  let riskScore = 0;
  
  if (sma >= nomMax || sma <= nomMin) {
    riskScore = 100;
  } else {
    const distToMax = nomMax - sma;
    const distToMin = sma - nomMin;
    const totalNominalSpan = nomMax - nomMin;
    
    const minDistancePercent = Math.min(distToMax, distToMin) / (totalNominalSpan / 2);
    const closeness = 1 - minDistancePercent;
    
    riskScore = closeness * 70;
    
    if (trend === 'UPWARD' && distToMax < distToMin) {
      riskScore += 20;
    } else if (trend === 'DOWNWARD' && distToMin < distToMax) {
      riskScore += 20;
    }
    
    riskScore = Math.min(95, Math.max(0, riskScore));
  }

  let risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (riskScore >= 80) {
    risk = 'CRITICAL';
  } else if (riskScore >= 50) {
    risk = 'HIGH';
  } else if (riskScore >= 25) {
    risk = 'MODERATE';
  }

  return {
    sma,
    trend,
    risk,
    riskScore: Math.round(riskScore),
    delta,
  };
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  metrics,
  selectedNode,
  onCloseSelectedNode,
  onUpdateMetric,
  currentTheme,
  anomalySimulated,
}) => {
  const theme = THEMES[currentTheme];

  const selectedMetric = selectedNode ? metrics[selectedNode.metricKey] : null;

  const [customThresholds, setCustomThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('mythos_custom_thresholds');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  interface AnomalyAlertRecord {
    id: string;
    metricKey: string;
    label: string;
    value: number;
    limit: number;
    timestamp: string;
  }

  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlertRecord[]>(() => {
    try {
      const saved = localStorage.getItem('mythos_anomaly_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [configuringKey, setConfiguringKey] = useState<string | null>(null);
  const breachedThresholdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    Object.values(metrics).forEach((m) => {
      const limit = customThresholds[m.key];
      if (limit !== undefined && m.value >= limit) {
        if (!breachedThresholdsRef.current.has(m.key)) {
          breachedThresholdsRef.current.add(m.key);
          soundEngine.playCriticalAlert();
          
          const newAlert: AnomalyAlertRecord = {
            id: Math.random().toString(36).substring(2, 9),
            metricKey: m.key,
            label: m.label,
            value: m.value,
            limit: limit,
            timestamp: new Date().toLocaleTimeString(),
          };

          setAnomalyAlerts((prev) => {
            const updated = [newAlert, ...prev].slice(0, 50); // Keep last 50
            try {
              localStorage.setItem('mythos_anomaly_alerts', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      } else {
        breachedThresholdsRef.current.delete(m.key);
      }
    });
  }, [metrics, customThresholds]);

  const metricKeys = Object.keys(metrics);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isPredictOpen, setIsPredictOpen] = useState(false);
  const [anomalyFilter, setAnomalyFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [pinnedMetrics, setPinnedMetrics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mythos_pinned_metrics');
      return saved ? JSON.parse(saved) : [metricKeys[0], metricKeys[1]].filter(Boolean);
    } catch {
      return [];
    }
  });

  const togglePin = (key: string) => {
    soundEngine.playToggle();
    setPinnedMetrics((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem('mythos_pinned_metrics', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleCopyLast10 = () => {
    soundEngine.playRoger();
    const last10 = anomalyAlerts.slice(0, 10);
    const summaryHeader = `=== MYTHOS DMS: LAST ${last10.length} ANOMALY EVENTS ===\nExported: ${new Date().toISOString()}\n--------------------------------------------------\n`;
    const logRows = last10.map((a, i) => `${i + 1}. [${a.timestamp}] ${a.label} BREACH - Value: ${a.value.toFixed(1)} (Limit: ${a.limit})`).join('\n');
    const fullText = summaryHeader + (logRows || 'No anomaly events recorded.');

    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 2500);
    }).catch(() => {
      // Fallback
    });
  };

  // Linear regression projection across all metrics
  const predictions = Object.values(metrics).map((m) => {
    const history = m.history && m.history.length > 0 ? m.history : [m.value];
    const n = history.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    history.forEach((y, x) => {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Project 5 steps into the future
    const futureSteps = 5;
    const projectedValue = slope * (n + futureSteps - 1) + intercept;
    const customLimit = customThresholds[m.key];
    const nominalMax = m.nominalRange[1];
    const warningThreshold = customLimit !== undefined ? customLimit : nominalMax * 1.1;

    const willBreach = projectedValue >= warningThreshold || (slope > 0 && m.value >= warningThreshold * 0.95);

    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      currentValue: m.value,
      slope,
      projectedValue,
      warningThreshold,
      willBreach,
    };
  });

  const metricA = metrics[compareMetricA] || Object.values(metrics)[0];
  const metricB = metrics[compareMetricB] || Object.values(metrics)[1] || metricA;

  const maxLength = Math.max(metricA?.history?.length || 0, metricB?.history?.length || 0);
  const chartData = Array.from({ length: Math.max(1, maxLength) }).map((_, index) => {
    return {
      index: index + 1,
      [metricA?.label || 'Metric A']: metricA?.history?.[index] ?? metricA?.value ?? 0,
      [metricB?.label || 'Metric B']: metricB?.history?.[index] ?? metricB?.value ?? 0,
    };
  });

  return (
    <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3 bg-[#0a0d12] p-3 rounded-lg border border-[#2f3749] select-none">
      {/* Panel Title */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2f3749]">
        <div className="flex items-center gap-2 font-antonio font-extrabold text-sm uppercase text-slate-100 tracking-wider">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>TELEMETRY METRICS & CONTROL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setIsPredictOpen(true);
            }}
            title="Project future metric drift and highlight upcoming threshold violations using linear regression"
            className="flex items-center gap-1 font-mono-data text-[9px] text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800 hover:bg-amber-900 transition-colors cursor-pointer"
          >
            <LineChartIcon className="w-3 h-3" />
            <span>PREDICT</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setIsCompareOpen(true);
            }}
            title="Compare two metrics on a synchronized line chart"
            className="flex items-center gap-1 font-mono-data text-[9px] text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800 hover:bg-purple-900 transition-colors cursor-pointer"
          >
            <GitCompare className="w-3 h-3" />
            <span>COMPARE</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playChime();
              const report = {
                exportTimestamp: new Date().toISOString(),
                selectedNode: selectedNode ? { id: selectedNode.id, label: selectedNode.label, metricKey: selectedNode.metricKey } : null,
                anomalySimulated,
                metrics: Object.values(metrics).map(m => ({
                  key: m.key,
                  label: m.label,
                  value: m.value,
                  unit: m.unit,
                  min: m.min,
                  max: m.max,
                  status: m.status,
                  nominalRange: m.nominalRange,
                  history: m.history || []
                }))
              };
              const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `mythos-telemetry-report-${Date.now()}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            title="Download structured JSON telemetry report with metrics history and node status"
            className="flex items-center gap-1 font-mono-data text-[9px] text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800 hover:bg-cyan-900 transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT</span>
          </button>
          <span className="font-mono-data text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
            REAL-TIME
          </span>
        </div>
      </div>

      {/* Selected Node Inspector Detail (If Active) */}
      {selectedNode ? (
        <div className="bg-[#101216] p-3 rounded border border-cyan-500/50 flex flex-col gap-2 relative animate-fade-in">
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              onCloseSelectedNode();
            }}
            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider pr-6">
            NODE INSPECTOR // {selectedNode.label}
          </div>

          <div className="text-xs font-mono-data text-slate-300">
            {selectedNode.description || 'Primary system hotspot telemetry node.'}
          </div>

          {selectedMetric && (
            <div className="mt-2 p-2 bg-[#050608] rounded border border-[#2f3749] space-y-2 font-mono-data text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">CURRENT VALUE:</span>
                <span className="text-amber-400 font-bold text-sm">
                  {selectedMetric.value.toFixed(2)} {selectedMetric.unit}
                </span>
              </div>

              {/* Live Metric Adjustment Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>OVERRIDE VALUE</span>
                  <span>{selectedMetric.min} - {selectedMetric.max}</span>
                </div>
                <input
                  type="range"
                  id="metric-slider-override"
                  name={selectedMetric.key}
                  data-voice-target={`${selectedMetric.label} ${selectedMetric.key} override knob slider`}
                  min={selectedMetric.min}
                  max={selectedMetric.max}
                  step={(selectedMetric.max - selectedMetric.min) / 100}
                  value={selectedMetric.value}
                  onChange={(e) => {
                    soundEngine.playBeep(600, 'sine', 0.02, 0.02);
                    onUpdateMetric(selectedMetric.key, parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-[#1c3c55] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#2f3749]">
                <span className="text-slate-400">HARMONIC PARITY:</span>
                <span
                  className={`font-bold uppercase ${
                    selectedMetric.status === 'critical'
                      ? 'text-red-400'
                      : selectedMetric.status === 'warning'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {selectedMetric.status}
                </span>
              </div>

              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => togglePin(selectedMetric.key)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                    pinnedMetrics.includes(selectedMetric.key)
                      ? 'bg-amber-600 text-white'
                      : 'bg-[#1c3c55] text-cyan-300 hover:bg-[#234b6c]'
                  }`}
                >
                  <Pin className="w-3 h-3" />
                  <span>{pinnedMetrics.includes(selectedMetric.key) ? 'PINNED TO SIDEBAR' : 'PIN TO SIDEBAR'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#101216]/50 p-2.5 rounded border border-[#2f3749] text-xs font-mono-data text-slate-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>Click any hotspot node on the MSD Canvas to inspect metrics.</span>
        </div>
      )}

      {/* Pinned Critical Metrics Section */}
      <div
        className="bg-[#0b0e14] p-2.5 rounded border border-amber-500/30 flex flex-col gap-1.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const droppedKey = e.dataTransfer.getData('text/plain');
          if (droppedKey && metrics[droppedKey] && !pinnedMetrics.includes(droppedKey)) {
            togglePin(droppedKey);
          }
        }}
      >
        <div className="flex items-center justify-between font-antonio text-xs font-bold uppercase tracking-wider text-amber-300">
          <span className="flex items-center gap-1">
            <Pin className="w-3.5 h-3.5 text-amber-400" />
            PINNED CRITICAL METRICS ({pinnedMetrics.length})
          </span>
          <span className="text-[9px] text-slate-500 font-mono-data">DRAG & DROP READY</span>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-40 pr-1">
          {pinnedMetrics.length === 0 ? (
            <div className="text-[10px] text-slate-500 font-mono-data text-center py-2 italic border border-dashed border-[#2f3749] rounded">
              No metrics pinned. Drag or pin critical metrics here for persistent monitoring.
            </div>
          ) : (
            pinnedMetrics.map((key) => {
              const m = metrics[key];
              if (!m) return null;
              const percent = ((m.value - m.min) / (m.max - m.min)) * 100;
              const isBreached = customThresholds[m.key] !== undefined && m.value >= customThresholds[m.key];

              return (
                <div
                  key={m.key}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', m.key);
                  }}
                  className={`bg-[#101216] border rounded p-2 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-all ${
                    isBreached ? 'border-red-500/80 bg-red-950/30 animate-pulse' : 'border-[#2f3749]'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono-data text-[10px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-200 uppercase">
                      <Pin className="w-3 h-3 text-amber-400" />
                      <span>{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isBreached ? 'text-red-400' : 'text-amber-400'}`}>
                        {m.value.toFixed(1)} {m.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePin(m.key)}
                        className="text-slate-500 hover:text-slate-300 p-0.5"
                        title="Unpin metric"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full bg-[#050608] h-1.5 rounded-full overflow-hidden border border-[#2f3749]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isBreached ? 'bg-red-500' : m.status === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
 
      {/* Predictive Stability Forecast Indicator */}
      <div className="bg-[#101216] p-3 rounded border border-purple-500/30 flex flex-col gap-2 relative">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#2f3749]">
          <div className="flex items-center gap-1.5 font-antonio font-bold text-xs uppercase text-purple-400 tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>STABILITY FORECAST MATRIX</span>
          </div>
          <span className="font-mono-data text-[9px] text-purple-400 font-bold bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800">
            PREDICTIVE
          </span>
        </div>

        {selectedMetric ? (() => {
          const forecast = calculateStabilityForecast(selectedMetric);
          return (
            <div className="space-y-2 font-mono-data text-xs animate-fade-in">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">INSPECTED VECTOR:</span>
                <span className="text-cyan-300 font-bold uppercase truncate max-w-[120px]">{selectedMetric.label}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">SMA (MOVING AVG):</span>
                <span className="text-slate-200 font-bold">{forecast.sma.toFixed(2)} {selectedMetric.unit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">TREND VECTOR:</span>
                <span className={`font-bold flex items-center gap-1 ${
                  forecast.trend === 'UPWARD' ? 'text-amber-400' : forecast.trend === 'DOWNWARD' ? 'text-blue-400' : 'text-emerald-400'
                }`}>
                  {forecast.trend === 'UPWARD' ? <TrendingUp className="w-3 h-3" /> : forecast.trend === 'DOWNWARD' ? <TrendingDown className="w-3 h-3" /> : null}
                  {forecast.trend}
                </span>
              </div>
              <div className="space-y-1 pt-1.5 border-t border-[#2f3749]/60">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">ANOMALY TRIGGER RISK:</span>
                  <span className={`font-bold ${
                    forecast.risk === 'CRITICAL' ? 'text-red-500 animate-pulse' : forecast.risk === 'HIGH' ? 'text-orange-400' : forecast.risk === 'MODERATE' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {forecast.risk} ({forecast.riskScore}%)
                  </span>
                </div>
                <div className="w-full bg-[#050608] h-1.5 rounded-full overflow-hidden border border-[#2f3749]">
                  <div
                    className={`h-full transition-all duration-500 ${
                      forecast.risk === 'CRITICAL' ? 'bg-red-500' : forecast.risk === 'HIGH' ? 'bg-orange-400' : forecast.risk === 'MODERATE' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${forecast.riskScore}%` }}
                  />
                </div>
              </div>
              {forecast.riskScore >= 50 && (
                <div className="mt-1 p-1.5 bg-red-950/20 border border-red-500/30 rounded text-[10px] text-red-300 flex items-start gap-1 leading-normal">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>PRE-ANOMALY DRIFT: Moving average approaching critical boundary. Calibration recommended.</span>
                </div>
              )}
            </div>
          );
        })() : (() => {
          const allMetrics = Object.values(metrics) as SystemMetric[];
          let maxRiskScore = 0;
          let mostAtRiskMetric: SystemMetric | null = null;
          
          allMetrics.forEach(m => {
            const forecast = calculateStabilityForecast(m);
            if (forecast.riskScore > maxRiskScore) {
              maxRiskScore = forecast.riskScore;
              mostAtRiskMetric = m;
            }
          });

          const maxRisk = maxRiskScore >= 80 ? 'CRITICAL' : maxRiskScore >= 50 ? 'HIGH' : maxRiskScore >= 25 ? 'MODERATE' : 'LOW';

          return (
            <div className="space-y-2 font-mono-data text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">OVERALL RISK PROFILE:</span>
                <span className={`font-bold ${
                  maxRisk === 'CRITICAL' ? 'text-red-500 animate-pulse' : maxRisk === 'HIGH' ? 'text-orange-400' : maxRisk === 'MODERATE' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {maxRisk}
                </span>
              </div>
              
              <div className="w-full bg-[#050608] h-1.5 rounded-full overflow-hidden border border-[#2f3749]">
                <div
                  className={`h-full transition-all duration-500 ${
                    maxRisk === 'CRITICAL' ? 'bg-red-500' : maxRisk === 'HIGH' ? 'bg-orange-400' : maxRisk === 'MODERATE' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(5, maxRiskScore)}%` }}
                />
              </div>

              {mostAtRiskMetric ? (() => {
                const metricName = (mostAtRiskMetric as SystemMetric).label;
                const mKey = (mostAtRiskMetric as SystemMetric).key;
                const f = calculateStabilityForecast(mostAtRiskMetric as SystemMetric);
                return (
                  <div className="pt-1 border-t border-[#2f3749]/60 text-[10px] space-y-1">
                    <div className="text-slate-400 uppercase tracking-tighter">PRIMARY VECTOR OF DRIFT:</div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 font-bold truncate max-w-[130px]">{metricName}</span>
                      <span className={`font-bold flex items-center gap-0.5 ${
                        f.trend === 'UPWARD' ? 'text-amber-400' : f.trend === 'DOWNWARD' ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {f.trend === 'UPWARD' ? <TrendingUp className="w-3 h-3" /> : f.trend === 'DOWNWARD' ? <TrendingDown className="w-3 h-3" /> : null}
                        {f.trend}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>SMA VS ACTUAL:</span>
                      <span>{f.sma.toFixed(1)} vs {(mostAtRiskMetric as SystemMetric).value.toFixed(1)}</span>
                    </div>
                    {maxRiskScore >= 50 && (
                      <div className="p-1 bg-amber-950/30 border border-amber-600/30 rounded text-[9px] text-amber-300 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>High drift in vector {mKey}. Correct override is advised before trigger thresholds breach.</span>
                      </div>
                    )}
                  </div>
                );
              })() : null}
            </div>
          );
        })()}
      </div>

      {/* Live System Metrics List */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
        {(Object.values(metrics) as SystemMetric[]).map((m) => {
          const percent = ((m.value - m.min) / (m.max - m.min)) * 100;
          const isConfiguring = configuringKey === m.key;
          const customLimit = customThresholds[m.key];
          const isBreached = customLimit !== undefined && m.value >= customLimit;

          return (
            <div
              key={m.key}
              id={`metric-card-${m.key}`}
              data-voice-target={`${m.label.toLowerCase()} card`}
              className={`bg-[#101216] p-2.5 rounded border transition-colors flex flex-col gap-1.5 ${
                isBreached ? 'border-red-500/80 bg-red-950/20' : 'border-[#2f3749] hover:border-cyan-500/40'
              }`}
            >
              <div className="flex items-center justify-between font-antonio text-xs font-bold uppercase tracking-wider text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${isBreached ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                  {m.label}
                  {isBreached && (
                    <span className="bg-red-600/30 border border-red-500 text-red-300 px-1 py-0.2 rounded text-[7px] animate-pulse font-bold">
                      ALERT
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono-data text-xs font-bold ${isBreached ? 'text-red-400' : 'text-amber-400'}`}>
                    {m.value.toFixed(1)} {m.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playToggle();
                      setConfiguringKey(isConfiguring ? null : m.key);
                    }}
                    title="Configure custom trigger threshold"
                    className={`p-0.5 rounded transition-colors ${isConfiguring ? 'text-cyan-400 bg-cyan-950/50' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Threshold Configuration Drawer */}
              {isConfiguring && (
                <div className="bg-[#050608] p-2 rounded border border-cyan-500/30 space-y-1.5 font-mono-data text-[10px] animate-fade-in my-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>CUSTOM TRIGGER THRESHOLD:</span>
                    {customLimit !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playToggle();
                          const next = { ...customThresholds };
                          delete next[m.key];
                          setCustomThresholds(next);
                          localStorage.setItem('mythos_custom_thresholds', JSON.stringify(next));
                        }}
                        className="text-red-400 hover:underline text-[9px]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={(m.max - m.min) / 50}
                      min={m.min}
                      max={m.max}
                      placeholder={`Threshold limit (Max: ${m.max})`}
                      value={customLimit !== undefined ? customLimit : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const next = { ...customThresholds };
                        if (!isNaN(val)) {
                          next[m.key] = val;
                        } else {
                          delete next[m.key];
                        }
                        setCustomThresholds(next);
                        localStorage.setItem('mythos_custom_thresholds', JSON.stringify(next));
                      }}
                      className="flex-grow bg-[#101216] border border-[#2f3749] px-2 py-1 rounded text-cyan-200 outline-none focus:border-cyan-500"
                    />
                    <span className="text-slate-400">{m.unit}</span>
                  </div>
                  {customLimit !== undefined && (
                    <div className="text-[9px] text-cyan-400">
                      Trigger set at ≥ {customLimit} {m.unit}
                    </div>
                  )}
                </div>
              )}

              {/* Gauge Progress Bar */}
              <div className="w-full bg-[#050608] h-2 rounded-full overflow-hidden border border-[#2f3749] relative">
                <div
                  className={`h-full transition-all duration-300 ${
                    isBreached
                      ? 'bg-red-500 animate-pulse'
                      : m.status === 'critical'
                      ? 'bg-red-500 animate-pulse'
                      : m.status === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
              </div>

              {/* Slider Controller */}
              <div className="flex items-center justify-between font-mono-data text-[10px] text-slate-400 pt-0.5">
                <span>{m.min}</span>
                <input
                  type="range"
                  id={`slider-${m.key}`}
                  name={m.key}
                  data-voice-target={`${m.label.toLowerCase()} ${m.key} knob slider`}
                  min={m.min}
                  max={m.max}
                  step={(m.max - m.min) / 50}
                  value={m.value}
                  onChange={(e) => onUpdateMetric(m.key, parseFloat(e.target.value))}
                  className="w-28 h-1 bg-[#1c3c55] rounded appearance-none cursor-pointer accent-cyan-400"
                  title={`${m.label} Knob (Voice: 'Adjust ${m.label} to [value]')`}
                />
                <span>{m.max}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Thermodynamic Entropy Waveform Sparkline */}
      <div className="bg-[#0b0e14] p-2.5 rounded border border-[#2f3749] flex flex-col gap-1">
        <div className="flex items-center justify-between font-antonio text-xs font-bold uppercase tracking-wider text-slate-300">
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            ENTROPY HARMONIC WAVEFORM
          </span>
          <span className="font-mono-data text-[10px] text-amber-400">ρS GRAPH</span>
        </div>

        <div className="h-12 w-full bg-[#050608] rounded border border-[#2f3749] flex items-end p-1 gap-1 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => {
            const h = Math.floor(Math.random() * 80) + 10;
            return (
              <div
                key={i}
                className={`flex-1 transition-all duration-300 ${
                  anomalySimulated ? 'bg-red-500' : 'bg-cyan-400'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Recent Anomaly Alerts Log */}
      <div className="bg-[#0b0e14] p-2.5 rounded border border-[#2f3749] flex flex-col gap-1">
        <div className="flex items-center justify-between font-antonio text-xs font-bold uppercase tracking-wider text-slate-300">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            RECENT ANOMALIES ({anomalyAlerts.length})
          </span>
          <div className="flex items-center gap-2">
            {anomalyAlerts.length > 0 && (
              <button
                type="button"
                onClick={handleCopyLast10}
                title="Copy summary of last 10 anomaly events to clipboard"
                className="flex items-center gap-1 text-[9px] text-cyan-300 hover:text-cyan-200 uppercase font-mono-data bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800 transition-colors"
              >
                {copiedLog ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLog ? 'COPIED!' : 'COPY LAST 10'}</span>
              </button>
            )}
            {anomalyAlerts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setAnomalyAlerts([]);
                  try {
                    localStorage.removeItem('mythos_anomaly_alerts');
                  } catch {}
                }}
                className="text-[9px] text-slate-400 hover:text-white uppercase font-mono-data"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Severity Filter Toggle Bar */}
        <div className="flex items-center gap-1 pt-1 pb-1 font-mono-data text-[9px]">
          <span className="text-slate-400 pr-1">FILTER:</span>
          {(['ALL', 'CRITICAL', 'WARNING'] as const).map((mode) => {
            const active = anomalyFilter === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setAnomalyFilter(mode);
                }}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  active
                    ? mode === 'CRITICAL'
                      ? 'bg-red-600 text-white shadow'
                      : mode === 'WARNING'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-cyan-600 text-white shadow'
                    : 'bg-[#12161f] text-slate-400 hover:text-slate-200 border border-[#2f3749]'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-32 pr-1 mt-0.5">
          {(() => {
            const filtered = anomalyAlerts.filter((alert) => {
              const metricObj = metrics[alert.metricKey];
              const isCrit = alert.value >= (alert.limit * 1.1) || (metricObj && metricObj.status === 'critical');
              if (anomalyFilter === 'CRITICAL') return isCrit;
              if (anomalyFilter === 'WARNING') return !isCrit;
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-[10px] text-slate-500 font-mono-data text-center py-2 italic">
                  No {anomalyFilter.toLowerCase()} anomaly alerts match filter.
                </div>
              );
            }

            return filtered.map((alert) => {
              const metricObj = metrics[alert.metricKey];
              const isCrit = alert.value >= (alert.limit * 1.1) || (metricObj && metricObj.status === 'critical');
              return (
                <div
                  key={alert.id}
                  className={`border rounded p-1.5 flex items-center justify-between font-mono-data text-[10px] ${
                    isCrit ? 'bg-red-950/20 border-red-500/40' : 'bg-amber-950/20 border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isCrit ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="flex flex-col">
                      <span className={`font-bold uppercase tracking-wide ${isCrit ? 'text-red-400' : 'text-amber-300'}`}>
                        {alert.label} {isCrit ? 'CRITICAL' : 'WARNING'}
                      </span>
                      <span className="text-slate-400 text-[9px]">
                        Val: {alert.value.toFixed(1)} (Limit: {alert.limit})
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-[9px]">{alert.timestamp}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Compare Metrics Overlay Modal */}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0a0d12] border border-cyan-500/50 rounded-lg p-4 w-full max-w-xl flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#2f3749]">
              <div className="flex items-center gap-2 font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider">
                <GitCompare className="w-4 h-4 text-cyan-400" />
                <span>METRICS CORRELATION COMPARATOR</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setIsCompareOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono-data text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[10px]">METRIC VECTOR A (CYAN):</span>
                <select
                  value={compareMetricA}
                  onChange={(e) => {
                    soundEngine.playToggle();
                    setCompareMetricA(e.target.value);
                  }}
                  className="bg-[#101216] border border-[#2f3749] text-cyan-300 p-1.5 rounded outline-none"
                >
                  {Object.values(metrics).map(m => (
                    <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-[10px]">METRIC VECTOR B (AMBER):</span>
                <select
                  value={compareMetricB}
                  onChange={(e) => {
                    soundEngine.playToggle();
                    setCompareMetricB(e.target.value);
                  }}
                  className="bg-[#101216] border border-[#2f3749] text-amber-300 p-1.5 rounded outline-none"
                >
                  {Object.values(metrics).map(m => (
                    <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recharts Synchronized Line Chart */}
            <div className="h-64 w-full bg-[#050608] border border-[#2f3749] rounded p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2f3749" opacity={0.4} />
                  <XAxis dataKey="index" stroke="#64748b" textAnchor="end" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a0d12', borderColor: '#2f3749', borderRadius: '4px', fontSize: '10px', color: '#f8fafc' }}
                  />
                  <Line type="monotone" dataKey={metricA?.label || 'Metric A'} stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={metricB?.label || 'Metric B'} stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono-data text-slate-400 pt-1 border-t border-[#2f3749]">
              <span>SYNCHRONIZED TIME-SERIES CORRELATION</span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setIsCompareOpen(false);
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1 rounded transition-colors"
              >
                CLOSE COMPARATOR
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Predict Trends Overlay Modal */}
      {isPredictOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0a0d12] border border-amber-500/50 rounded-lg p-4 w-full max-w-2xl flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#2f3749]">
              <div className="flex items-center gap-2 font-antonio font-bold text-sm text-amber-300 uppercase tracking-wider">
                <LineChartIcon className="w-4 h-4 text-amber-400" />
                <span>LINEAR REGRESSION DRIFT & THRESHOLD PROJECTION</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setIsPredictOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] font-mono-data text-slate-300">
              Projecting 5 future intervals using least-squares linear regression across metric historical vectors. Highlighted items indicate risk of threshold transgression.
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1">
              {predictions.map((p) => (
                <div
                  key={p.key}
                  className={`p-2.5 rounded border flex items-center justify-between font-mono-data text-xs ${
                    p.willBreach
                      ? 'bg-red-950/30 border-red-500/50 text-red-300 animate-pulse'
                      : 'bg-[#101216] border-[#2f3749] text-slate-300'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 uppercase">{p.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        p.willBreach ? 'bg-red-900/60 text-red-300 border border-red-700' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                      }`}>
                        {p.willBreach ? 'IMMINENT BREACH RISK' : 'STABLE TRAJECTORY'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-3">
                      <span>Current: <strong className="text-slate-200">{p.currentValue.toFixed(1)} {p.unit}</strong></span>
                      <span>Slope: <strong className={p.slope >= 0 ? 'text-amber-400' : 'text-cyan-400'}>{p.slope >= 0 ? '+' : ''}{p.slope.toFixed(2)}/step</strong></span>
                      <span>Projected: <strong className={p.willBreach ? 'text-red-400' : 'text-emerald-400'}>{p.projectedValue.toFixed(1)} {p.unit}</strong></span>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    Limit: <span className="text-amber-300 font-bold">{p.warningThreshold}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono-data text-slate-400 pt-1 border-t border-[#2f3749]">
              <span>ALGORITHM: LEAST-SQUARES LINEAR REGRESSION (t+5)</span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setIsPredictOpen(false);
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1 rounded transition-colors"
              >
                CLOSE PREDICTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
