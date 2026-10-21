import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Terminal, AlertTriangle, Key, Lock } from 'lucide-react';
import { soundEngine } from '../../utils/audio';

interface IntegrityViolationModalProps {
  isVisible: boolean;
  onOverride: () => void;
}

export const IntegrityViolationModal: React.FC<IntegrityViolationModalProps> = ({ isVisible, onOverride }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isVisible) {
      soundEngine.playAlert();
      setCode('');
      setError(false);
    }
  }, [isVisible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().toUpperCase() === 'MCF-OVERRIDE') {
      soundEngine.playChime();
      onOverride();
    } else {
      setError(true);
      soundEngine.playAlert();
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="w-full max-w-2xl bg-[#0b101c] border-2 border-red-500/80 rounded-lg shadow-[0_0_50px_rgba(239,68,68,0.2)] overflow-hidden font-mono-data"
          >
            {/* Header */}
            <div className="bg-red-500/20 border-b border-red-500/40 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <span className="font-bold text-lg tracking-widest uppercase">Integrity Gate Failure : System Halted</span>
              </div>
              <div className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded border border-red-500/30">
                BLOCKED_SOURCE_ARTIFACT_MISMATCH
              </div>
            </div>

            {/* Body */}
            <div className="p-6 text-sm text-slate-300 space-y-6">
              <div className="flex gap-4">
                <AlertTriangle className="w-12 h-12 text-amber-500 shrink-0" />
                <div>
                  <div className="text-red-400 font-bold mb-2 uppercase text-base">SOMA Audit Event Generated</div>
                  <p className="text-slate-400 leading-relaxed text-sm">
                    Required source byte stream or directive artifact is missing, truncated, ambiguous, or failed structural validation. Substrate independence cannot be verified.
                  </p>
                </div>
              </div>
              
              <div className="bg-[#05080f] p-5 rounded border border-[#1e293b] space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="text-red-500 font-bold">1.</span>
                  <span><strong>HALT</strong> execution immediately.</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-red-500 font-bold">2.</span>
                  <span><strong>DO NOT</strong> attempt to reconstruct, estimate, fill in gaps, or guess missing parameters.</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-red-500 font-bold">3.</span>
                  <span><strong>SET</strong> state to: <code className="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded text-xs ml-1">BLOCKED_SOURCE_ARTIFACT_MISMATCH</code></span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-red-500 font-bold">4.</span>
                  <span><strong>EMIT</strong> cryptographically signed error event to the SOMA audit channel.</span>
                </div>
              </div>

              {/* Override Form */}
              <form onSubmit={handleSubmit} className="border-t border-[#1e293b] pt-6 mt-6">
                <label className="block text-cyan-400 font-bold mb-2 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  ADMINISTRATIVE OVERRIDE REQUIRED (CODE: MCF-OVERRIDE)
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(false);
                    }}
                    placeholder="Enter auth code..."
                    className={`flex-grow bg-[#05080f] border ${error ? 'border-red-500 text-red-400' : 'border-[#2f3749] text-slate-200'} rounded px-4 py-2 focus:outline-none focus:border-cyan-500 transition-colors uppercase`}
                    autoComplete="off"
                    spellCheck="false"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-red-600/20 text-red-400 border border-red-500/50 hover:bg-red-600/40 hover:text-white px-6 py-2 rounded font-bold transition-colors flex items-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    ACKNOWLEDGE & OVERRIDE
                  </button>
                </div>
                {error && <div className="text-red-500 text-xs mt-2 font-bold animate-pulse">INVALID OVERRIDE CODE SIGNATURE</div>}
              </form>
            </div>
            
            <div className="bg-[#05080f] px-6 py-3 border-t border-[#1e293b] flex items-center gap-2 text-[10px] text-slate-500">
              <Terminal className="w-3 h-3" />
              <span>MCF Protocol Violation Logged - Awaiting Manual Override</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
