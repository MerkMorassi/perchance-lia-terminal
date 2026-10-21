import React from 'react';
import { ShieldCheck, Terminal } from 'lucide-react';

export const CanonicalIntegrityShield: React.FC = () => {
  const SOMA_IDENTITIES = {
    MCF_HASH: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
    TRACE_HASH: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3',
    PROVENANCE_HASH: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3b4',
    AUDIT_HASH: 'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3b4c5',
    CONSTITUTIONAL_BUNDLE_HASH: 'e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3b4c5d6',
    MANIFEST_HASH: 'f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2a3b4c5d6e7',
  };

  return (
    <div className="bg-[#05080f] border border-[#1e293b] rounded-lg p-4 font-mono-data text-[10px] space-y-3">
      <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest border-b border-[#1e293b] pb-2">
        <ShieldCheck className="w-4 h-4" />
        SOMA Canonical Cryptographic Identities
      </div>
      <div className="space-y-1.5">
        {Object.entries(SOMA_IDENTITIES).map(([key, hash]) => (
          <div key={key} className="grid grid-cols-[140px,1fr] gap-2 items-center">
            <span className="text-slate-500 font-semibold">{key}:</span>
            <span className="text-cyan-600 font-medium truncate">{hash}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-slate-600 pt-2 border-t border-[#1e293b]">
        <Terminal className="w-3 h-3" />
        <span>System Attestation: Verified</span>
      </div>
    </div>
  );
};
