import React, { useState } from 'react';
import { MSDLayoutManifest } from '../../types/msd';
import { soundEngine } from '../../utils/audio';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ManifestImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportManifest: (manifest: MSDLayoutManifest) => void;
}

export const ManifestImporterModal: React.FC<ManifestImporterModalProps> = ({
  isOpen,
  onClose,
  onImportManifest,
}) => {
  const [jsonInput, setJsonInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleImport = () => {
    try {
      setErrorMsg('');
      const parsed = JSON.parse(jsonInput) as MSDLayoutManifest;
      if (!parsed.layoutId || !parsed.msdCanvas || !parsed.header) {
        throw new Error('Missing required manifest fields (layoutId, msdCanvas, header)');
      }
      soundEngine.playChime();
      onImportManifest(parsed);
      onClose();
    } catch (err: unknown) {
      soundEngine.playAlert();
      setErrorMsg(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl bg-[#0a0d12] border-2 border-[#2f3749] rounded-xl p-4 flex flex-col gap-3 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between pb-2 border-b border-[#2f3749]">
          <div className="flex items-center gap-2 font-antonio font-extrabold text-base text-cyan-300 uppercase tracking-widest">
            <Upload className="w-5 h-5 text-amber-400" />
            <span>IMPORT MSD LAYOUT MANIFEST</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="font-mono-data text-xs text-slate-300">
          Paste an MSDLayoutManifest JSON blueprint below or choose a JSON file to load into the MythOS Design Engine.
        </p>

        {errorMsg && (
          <div className="flex items-center gap-2 bg-red-950/80 border border-red-500 p-2.5 rounded text-xs font-mono-data text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <textarea
          rows={10}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="Paste JSON manifest here..."
          className="w-full p-3 bg-[#050608] border border-[#2f3749] rounded font-mono-data text-xs text-cyan-300 focus:outline-none focus:border-cyan-400"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2f3749]">
          <label className="flex items-center gap-2 bg-[#101216] border border-[#2f3749] px-3 py-1.5 rounded text-xs font-antonio font-bold uppercase text-slate-300 hover:text-white cursor-pointer">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>UPLOAD JSON FILE</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#101216] border border-[#2f3749] text-xs font-antonio font-bold uppercase text-slate-300 hover:text-white rounded cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="px-5 py-1.5 bg-[#00eeee] text-black text-xs font-antonio font-bold uppercase rounded hover:bg-cyan-300 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              LOAD MANIFEST
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
