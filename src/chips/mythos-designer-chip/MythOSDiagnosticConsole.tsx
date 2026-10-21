import React, { useState } from 'react';
import { MSDLayoutManifest, SystemMetric } from '../../types/msd';
import { soundEngine } from '../../utils/audio';
import { Sparkles, Send, ShieldAlert, Cpu, Terminal, RefreshCw, Bot } from 'lucide-react';
import { CanonicalIntegrityShield } from '../common/CanonicalIntegrityShield';

interface MythOSDiagnosticConsoleProps {
  metrics: Record<string, SystemMetric>;
  manifest: MSDLayoutManifest;
  anomalySimulated: boolean;
  onInduceAnomaly: () => void;
}

export const MythOSDiagnosticConsole: React.FC<MythOSDiagnosticConsoleProps> = ({
  metrics,
  manifest,
  anomalySimulated,
  onInduceAnomaly,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>('GEMINI 3.8 FLASH');

  const handleAnalyze = async (customPrompt?: string) => {
    soundEngine.playChime();
    setLoading(true);
    setErrorMsg(null);
    setNotice(null);

    const activePrompt = customPrompt || prompt || 'Analyze overall quantum core coherence and thermodynamic entropy.';

    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: activePrompt,
          metrics,
          manifest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || 'Failed to communicate with MythOS AI Engine.';
        try {
          if (typeof msg === 'string' && msg.includes('{')) {
            const parsed = JSON.parse(msg.replace(/^ApiError:\s*/, ''));
            if (parsed?.error?.message) {
              msg = parsed.error.message;
            }
          }
        } catch {}
        throw new Error(msg);
      }

      setReport(data.analysis);
      if (data.modelUsed) {
        setActiveModel(String(data.modelUsed).replace(/-/g, ' ').toUpperCase());
      } else if (data.source === 'local_telemetry_matrix_fallback' || data.source === 'local_diagnostic_matrix') {
        setActiveModel('LOCAL TACTICAL MATRIX');
      }
      if (data.notice) {
        setNotice(data.notice);
      }
    } catch (err: unknown) {
      soundEngine.playAlert();
      setErrorMsg(err instanceof Error ? err.message : 'AI Analysis request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 select-none">
      {/* Console Header */}
      <div className="p-4 bg-[#0a0d12] border-2 border-[#2f3749] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
          <div>
            <h2 className="font-antonio font-extrabold text-lg uppercase text-slate-100 tracking-wider">
              MythOS // GEMINI TACTICAL AI DIAGNOSTIC ENGINE
            </h2>
            <p className="font-mono-data text-xs text-slate-400">
              AI-Powered Subspace Telemetry Analysis, Anomaly Diagnostics, & Layout Optimization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAnalyze('Perform full system diagnostic scan.')}
            disabled={loading}
            className="px-4 py-1.5 bg-[#00eeee] text-black font-antonio font-bold text-xs uppercase rounded hover:bg-cyan-300 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? 'animate-spin' : ''}`} />
            RUN DIAGNOSTIC SCAN
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Query Controls & Status */}
        <div className="flex flex-col gap-3 bg-[#0a0d12] p-4 rounded-xl border border-[#2f3749]">
          <div className="font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider pb-2 border-b border-[#2f3749] flex items-center justify-between">
            <span>PRESET DIAGNOSTIC QUERIES</span>
            <Bot className="w-4 h-4 text-amber-400" />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleAnalyze('Analyze entropy density and advise on cooling manifold pressures.')}
              className="w-full text-left p-2.5 bg-[#101216] border border-[#2f3749] hover:border-cyan-400 rounded text-xs font-mono-data text-slate-200 cursor-pointer transition-colors"
            >
              ➔ 01. Entropy Density & Coolant Pressure Scan
            </button>

            <button
              type="button"
              onClick={() => handleAnalyze('Evaluate shield harmonics vs warp field flux compression ratio.')}
              className="w-full text-left p-2.5 bg-[#101216] border border-[#2f3749] hover:border-cyan-400 rounded text-xs font-mono-data text-slate-200 cursor-pointer transition-colors"
            >
              ➔ 02. Shield Harmonics & Warp Flux Evaluation
            </button>

            <button
              type="button"
              onClick={() => handleAnalyze('Recommend layout schema optimizations for node positioning.')}
              className="w-full text-left p-2.5 bg-[#101216] border border-[#2f3749] hover:border-cyan-400 rounded text-xs font-mono-data text-slate-200 cursor-pointer transition-colors"
            >
              ➔ 03. MSD Layout Node Alignment
            </button>

            <button
              type="button"
              onClick={() => {
                onInduceAnomaly();
                handleAnalyze('CRITICAL: Anomaly surge induced! Provide emergency stabilization steps.');
              }}
              className="w-full text-left p-2.5 bg-red-950/60 border border-red-500 hover:bg-red-900 rounded text-xs font-mono-data text-red-300 cursor-pointer transition-colors"
            >
              ⚡ 04. Induce Anomaly & Request Emergency Stabilization
            </button>
          </div>

          {/* Custom Prompt Input */}
          <div className="mt-2 space-y-2 font-mono-data text-xs">
            <label className="block text-slate-400">CUSTOM AI TACTICAL PROMPT</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask MythOS AI to analyze metrics..."
                className="flex-grow p-2 bg-[#050608] border border-[#2f3749] rounded text-slate-100 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={loading}
                className="px-3 py-2 bg-[#1c3c55] border border-[#37a6d1] text-cyan-300 hover:bg-[#2a7193] rounded font-antonio font-bold uppercase cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* AI Output Terminal Report Display */}
        <div className="lg:col-span-2 flex flex-col gap-3 bg-[#0a0d12] p-4 rounded-xl border border-[#2f3749] min-h-[380px]">
          <div className="flex items-center justify-between pb-2 border-b border-[#2f3749]">
            <div className="font-antonio font-bold text-sm text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>TACTICAL DIAGNOSTIC REPORT OUTPUT</span>
            </div>

            <div className="flex items-center gap-2">
              {notice && (
                <span className="font-mono-data text-[10px] text-amber-300 bg-amber-950/60 border border-amber-600/80 px-2 py-0.5 rounded">
                  FAILOVER ENGAGED
                </span>
              )}
              <span className="font-mono-data text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded">
                MODEL: {activeModel}
              </span>
            </div>
          </div>

          {notice && (
            <div className="p-2.5 bg-amber-950/50 border border-amber-600/70 rounded text-xs font-mono-data text-amber-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500 rounded text-xs font-mono-data text-red-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 gap-3">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-spin" />
              <div className="font-mono-data text-xs text-cyan-300 animate-pulse">
                SYNTHESIZING TELEMETRY METRICS & GENERATING DIAGNOSTIC...
              </div>
            </div>
          ) : report ? (
            <div className="flex-grow p-4 bg-[#050608] rounded border border-[#2f3749] overflow-y-auto max-h-[460px] font-mono-data text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {report}
            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#2f3749] rounded">
              <Cpu className="w-10 h-10 text-slate-600 mb-2" />
              <div className="font-antonio font-bold text-sm uppercase text-slate-400">
                AWAITING DIAGNOSTIC COMMAND
              </div>
              <p className="font-mono-data text-xs text-slate-500 mt-1 max-w-md">
                Select a preset query or enter a custom prompt above to initiate real-time Gemini AI telemetry diagnostics.
              </p>
            </div>
          )}
        </div>
        
        {/* Canonical Identity Shield */}
        <div className="lg:col-span-3">
            <CanonicalIntegrityShield />
        </div>
      </div>
    </div>
  );
};

