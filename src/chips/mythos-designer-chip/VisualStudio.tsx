import React, { useState } from 'react';
import {
  MSDCanvasConfig,
  MSDHeader,
  MSDLayoutManifest,
  MSDNode,
  MetricKey,
  SchematicType,
  ThemeId,
  MSDMacro,
  MSDMacroCommand,
  HardwareMappingConfig,
  RotaryKnobConfig,
} from '../../types/msd';
import { TEMPLATE_PRESETS } from '../../constants/templates';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import { CodeExporter } from './CodeExporter';
import { ManifestImporterModal } from './ManifestImporterModal';
import {
  Plus,
  Trash2,
  Sliders,
  Layers,
  Upload,
  RotateCcw,
  Sparkles,
  MapPin,
  CheckCircle2,
  Terminal,
  Play,
  Square,
  Zap,
  Cpu,
  Radio,
  Grid,
  Activity,
  Vibrate,
  Wand2,
  BookOpen,
  ArrowRight,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface VisualStudioProps {
  manifest: MSDLayoutManifest;
  onUpdateManifest: (updated: MSDLayoutManifest) => void;
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onOpenThemeForge?: () => void;
}

export const VisualStudio: React.FC<VisualStudioProps> = ({
  manifest,
  onUpdateManifest,
  currentTheme,
  onThemeChange,
  onOpenThemeForge,
}) => {
  const [activeTab, setActiveTab] = useState<'canvas' | 'macros' | 'hardware'>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  // Macro Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [macroName, setMacroName] = useState('');
  const [macroHotkey, setMacroHotkey] = useState('K1');
  const [recordedCommands, setRecordedCommands] = useState<MSDMacroCommand[]>([]);
  const [executingMacroId, setExecutingMacroId] = useState<string | null>(null);

  // Hardware Mapping Selected Key Inspection State
  const [inspectedKeyId, setInspectedKeyId] = useState<string>('K1');

  // Key Binding Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardTarget, setWizardTarget] = useState<string>('K1');
  const [wizardAction, setWizardAction] = useState<string>('Simulate Anomaly');
  const [wizardTestSuccess, setWizardTestSuccess] = useState(false);

  const selectedNode = manifest.msdCanvas.nodes.find((n) => n.id === selectedNodeId);
  const macros = manifest.macros || [];

  // Pre-defined Macro Library Presets
  const macroLibraryPresets = [
    { id: 'lib-1', name: 'Emergency Stop', description: 'Kills all anomaly alarms and resets baseline', action: 'Emergency Reset' },
    { id: 'lib-2', name: 'Cycle All Displays', description: 'Rotates active schematic overlay and sensors', action: 'MSD View' },
    { id: 'lib-3', name: 'Clear Telemetry Cache', description: 'Purges metric history buffers and resets charts', action: 'RESET_METRICS' },
    { id: 'lib-4', name: 'Full Coherence Boost', description: 'Sets coherence factor Φ to nominal 1.0', action: 'SET_COHERENCE_MAX' },
    { id: 'lib-5', name: 'Diagnostic Uplink', description: 'Activates VoxCon telemetry diagnostics', action: 'AI Diagnostics' },
    { id: 'lib-6', name: 'Audio Mute Toggle', description: 'Toggles master sound engine audio mute', action: 'Mute Audio' },
  ];

  // Hardware Mapping State initialization
  const hardwareMapping: HardwareMappingConfig = manifest.hardwareMapping || {
    keyAssignments: {
      K1: 'MSD View',
      K2: 'UI Builder',
      K3: 'Token Lab',
      K4: 'AI Diagnostics',
      K5: 'VoxCon Live',
      K6: 'Theme Forge',
      K7: 'Mute Audio',
      K8: 'Predict Trends',
      K9: 'Copy Anomaly Log',
      K10: 'Toggle Pinned Metrics',
      K11: 'Emergency Reset',
      K12: 'Simulate Anomaly',
    },
    knobAlpha: { sensitivity: 2, clickAction: 'TOGGLE_ANOMALY', stops: 20 },
    knobBeta: { sensitivity: 5, clickAction: 'RESET_METRICS', stops: 20 },
    activeBank: 1,
    hapticIntensity: 75,
  };

  const handleUpdateHardwareMapping = (updated: Partial<HardwareMappingConfig>) => {
    soundEngine.playToggle();
    onUpdateManifest({
      ...manifest,
      hardwareMapping: {
        ...hardwareMapping,
        ...updated,
      },
    });
  };

  const handleKeyAssignmentChange = (keyId: string, actionVal: string) => {
    soundEngine.playToggle();
    handleUpdateHardwareMapping({
      keyAssignments: {
        ...hardwareMapping.keyAssignments,
        [keyId]: actionVal,
      },
    });
  };

  // Conflict detection for keys
  const actionKeyMap: Record<string, string[]> = {};
  Object.entries(hardwareMapping.keyAssignments).forEach(([kId, action]) => {
    if (action && action !== 'Unassigned') {
      if (!actionKeyMap[action]) actionKeyMap[action] = [];
      actionKeyMap[action].push(kId);
    }
  });

  const conflictingKeys = new Set<string>();
  Object.values(actionKeyMap).forEach((keys) => {
    if (keys.length > 1) {
      keys.forEach((k) => conflictingKeys.add(k));
    }
  });

  const handleDeconflict = () => {
    soundEngine.playChime();
    const newAssignments = { ...hardwareMapping.keyAssignments };
    Object.values(actionKeyMap).forEach((keys) => {
      if (keys.length > 1) {
        // Keep the first key assignment, set subsequent conflicting keys to 'Unassigned'
        for (let i = 1; i < keys.length; i++) {
          newAssignments[keys[i]] = 'Unassigned';
        }
      }
    });
    handleUpdateHardwareMapping({ keyAssignments: newAssignments });
  };

  // Available command templates for macro recording
  const availableCommandTemplates = [
    { action: 'SET_COHERENCE_MAX', label: 'Set Coherence Factor to 1.0 (Nominal)' },
    { action: 'SIMULATE_ANOMALY', label: 'Trigger Thermodynamic Anomaly Spike' },
    { action: 'MUTE_AUDIO', label: 'Toggle Master Audio Mute' },
    { action: 'RESET_METRICS', label: 'Reset All Metric History Buffers' },
    { action: 'SWITCH_MODE_MSD', label: 'Switch Active View to MSD Display' },
    { action: 'SWITCH_MODE_BUILDER', label: 'Switch Active View to UI Builder' },
  ];

  const handleAddCommandToMacro = (template: { action: string; label: string }) => {
    soundEngine.playToggle();
    const newCmd: MSDMacroCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action: template.action,
      label: template.label,
    };
    setRecordedCommands((prev) => [...prev, newCmd]);
  };

  const handleSaveMacro = () => {
    if (!macroName.trim()) return;
    soundEngine.playChime();
    const newMacro: MSDMacro = {
      id: `macro-${Date.now()}`,
      name: macroName.trim(),
      hotkey: macroHotkey || `K${macros.length + 1}`,
      commands: recordedCommands.length > 0 ? recordedCommands : [{ id: 'cmd-default', action: 'SIMULATE_ANOMALY', label: 'Trigger Thermodynamic Anomaly Spike' }],
    };

    onUpdateManifest({
      ...manifest,
      macros: [...macros, newMacro],
    });

    setMacroName('');
    setIsRecording(false);
    setRecordedCommands([]);
  };

  const handleDeleteMacro = (id: string) => {
    soundEngine.playChime();
    onUpdateManifest({
      ...manifest,
      macros: macros.filter((m) => m.id !== id),
    });
  };

  const handleExecuteMacro = (macro: MSDMacro) => {
    soundEngine.playChime();
    setExecutingMacroId(macro.id);
    setTimeout(() => {
      setExecutingMacroId(null);
    }, macro.commands.length * 600 + 400);
  };

  // Update canvas schematic or overlay
  const handleCanvasConfigChange = (field: keyof MSDCanvasConfig, val: unknown) => {
    onUpdateManifest({
      ...manifest,
      msdCanvas: {
        ...manifest.msdCanvas,
        [field]: val,
      },
    });
  };

  // Add new hotspot node
  const handleAddNode = () => {
    soundEngine.playChime();
    const newId = `node-0${manifest.msdCanvas.nodes.length + 1}`;
    const newNode: MSDNode = {
      id: newId,
      label: 'NEW SYSTEM HOTSPOT',
      x: 50,
      y: 50,
      metricKey: 'coherenceFactor',
      description: 'Operator configured hotspot telemetry node',
      status: 'nominal',
    };

    onUpdateManifest({
      ...manifest,
      msdCanvas: {
        ...manifest.msdCanvas,
        nodes: [...manifest.msdCanvas.nodes, newNode],
      },
    });
  };

  // Update node
  const handleUpdateNode = (updatedNode: MSDNode) => {
    soundEngine.playToggle();
    onUpdateManifest({
      ...manifest,
      msdCanvas: {
        ...manifest.msdCanvas,
        nodes: manifest.msdCanvas.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)),
      },
    });
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    soundEngine.playChime();
    onUpdateManifest({
      ...manifest,
      msdCanvas: {
        ...manifest.msdCanvas,
        nodes: manifest.msdCanvas.nodes.filter((n) => n.id !== nodeId),
      },
    });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#07090e] text-slate-100 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl">
      {/* Visual Studio Header / Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-[#0a0d14] border-b border-emerald-500/30 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-antonio font-bold text-lg text-emerald-300 tracking-wider">
              VISUAL STUDIO // LAYOUT BUILDER & HARDWARE DECK
            </h2>
            <p className="text-[10px] font-mono-data text-slate-400">
              Interactive MSD Manifest Architect, Macro Studio, & Handheld Keypad Controller Mapper
            </p>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setActiveTab('canvas');
            }}
            className={`px-4 py-2 rounded-lg font-antonio font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'canvas'
                ? 'bg-emerald-600 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400'
                : 'bg-[#121620] text-slate-300 hover:text-white border border-[#2f3749]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>01. MSD Canvas Architect</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setActiveTab('macros');
            }}
            className={`px-4 py-2 rounded-lg font-antonio font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'macros'
                ? 'bg-emerald-600 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400'
                : 'bg-[#121620] text-slate-300 hover:text-white border border-[#2f3749]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>02. Macro Recorder Studio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setActiveTab('hardware');
            }}
            className={`px-4 py-2 rounded-lg font-antonio font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'hardware'
                ? 'bg-emerald-600 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400'
                : 'bg-[#121620] text-slate-300 hover:text-white border border-[#2f3749]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>03. Hardware Mapping</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setIsImporterOpen(true);
            }}
            className="px-3 py-2 bg-[#121620] hover:bg-[#1a2230] text-slate-300 border border-[#2f3749] rounded-lg font-antonio font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Import or Export JSON Manifest"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import JSON</span>
          </button>
        </div>
      </div>

      {/* TAB 01: MSD CANVAS ARCHITECT */}
      {activeTab === 'canvas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 flex-1 overflow-y-auto">
          {/* Left 2 Cols: Live Canvas Preview & Node Placement */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-[#0c1018] p-5 rounded-xl border border-emerald-500/30 shadow-lg flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono-data text-emerald-400 font-bold uppercase tracking-wider">
                    Interactive Layout Canvas // Archetype: {manifest.layoutArchetype || 'default'}
                  </span>
                  <h3 className="font-antonio font-bold text-lg text-slate-100">
                    {manifest.name || 'Custom MSD Deck Architecture'}
                  </h3>
                </div>

                <div className="flex items-center gap-2 font-mono-data text-xs">
                  <span className="text-slate-400">Theme:</span>
                  <select
                    value={currentTheme}
                    onChange={(e) => onThemeChange(e.target.value as ThemeId)}
                    className="bg-[#121620] border border-emerald-500/60 text-emerald-300 px-3 py-1 rounded cursor-pointer"
                  >
                    {Object.entries(THEMES).map(([id, t]) => (
                      <option key={id} value={id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schematic Archetype Selector */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2f3749]">
                <span className="text-xs font-mono-data text-slate-400">Archetype:</span>
                {(['warp-core', 'deflector', 'lifesupport', 'tactical', 'engineering'] as SchematicType[]).map((arch) => (
                  <button
                    key={arch}
                    type="button"
                    onClick={() => {
                      soundEngine.playToggle();
                      onUpdateManifest({
                        ...manifest,
                        layoutArchetype: arch,
                        msdCanvas: {
                          ...manifest.msdCanvas,
                          schematicType: arch,
                        },
                      });
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono-data uppercase transition-colors cursor-pointer ${
                      manifest.layoutArchetype === arch
                        ? 'bg-emerald-500 text-black font-bold'
                        : 'bg-[#121620] text-slate-300 border border-[#2f3749] hover:border-emerald-500'
                    }`}
                  >
                    {arch.replace('-', ' ')}
                  </button>
                ))}
              </div>

              {/* Interactive Visual Canvas Area */}
              <div className="relative w-full h-80 bg-[#05070a] border-2 border-dashed border-[#2f3749] rounded-xl flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#10b98115_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                {/* Render nodes as draggable/clickable interactive hot spots */}
                {manifest.msdCanvas.nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        soundEngine.playToggle();
                        setSelectedNodeId(node.id);
                      }}
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 p-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-lg border ${
                        isSelected
                          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400 scale-110 z-20'
                          : 'bg-[#121620]/90 border-emerald-500/50 text-slate-200 hover:border-emerald-400 z-10'
                      }`}
                    >
                      <MapPin className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-antonio font-bold text-xs uppercase tracking-wide">{node.label}</span>
                        <span className="font-mono-data text-[9px] text-slate-400">{node.metricKey}</span>
                      </div>
                    </div>
                  );
                })}

                <div className="absolute bottom-3 left-3 text-[10px] font-mono-data text-slate-400 bg-black/60 px-2 py-1 rounded border border-[#2f3749]">
                  Click any hotspot node to edit coordinates or telemetry binding.
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleAddNode}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-antonio font-bold text-xs uppercase rounded flex items-center gap-2 cursor-pointer shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Hotspot Node</span>
                </button>
                <span className="text-xs font-mono-data text-slate-400">
                  Total Active Nodes: {manifest.msdCanvas.nodes.length}
                </span>
              </div>
            </div>
          </div>

          {/* Right Col: Node Inspector / Canvas Properties */}
          <div className="flex flex-col gap-4 bg-[#0a0d12] p-5 rounded-xl border border-emerald-500/30 shadow-lg font-mono-data text-xs">
            <div className="flex items-center gap-2 font-antonio font-bold text-sm text-emerald-300 uppercase tracking-wider pb-2 border-b border-[#2f3749]">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>CANVAS & NODE INSPECTOR</span>
            </div>

            {selectedNode ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center justify-between bg-[#121620] p-2.5 rounded border border-emerald-500/40">
                  <span className="text-emerald-400 font-bold">Selected Node ID: {selectedNode.id}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                    title="Delete Node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">NODE LABEL</label>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) => handleUpdateNode({ ...selectedNode, label: e.target.value })}
                    className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-100 rounded focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">X POSITION (%)</label>
                    <input
                      type="number"
                      min="5"
                      max="95"
                      value={selectedNode.x}
                      onChange={(e) => handleUpdateNode({ ...selectedNode, x: Number(e.target.value) })}
                      className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-100 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Y POSITION (%)</label>
                    <input
                      type="number"
                      min="5"
                      max="95"
                      value={selectedNode.y}
                      onChange={(e) => handleUpdateNode({ ...selectedNode, y: Number(e.target.value) })}
                      className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-100 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">TELEMETRY BINDING KEY</label>
                  <select
                    value={selectedNode.metricKey}
                    onChange={(e) => handleUpdateNode({ ...selectedNode, metricKey: e.target.value as MetricKey })}
                    className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-200 rounded cursor-pointer"
                  >
                    <option value="coherenceFactor">Coherence Factor (Φ)</option>
                    <option value="plasmaTemperature">Plasma Temperature</option>
                    <option value="warpFieldSymmetry">Warp Field Symmetry</option>
                    <option value="structuralStress">Structural Stress</option>
                    <option value="subspaceCarrier">Subspace Carrier</option>
                    <option value="containmentPressure">Containment Pressure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">NODE DESCRIPTION</label>
                  <textarea
                    rows={2}
                    value={selectedNode.description || ''}
                    onChange={(e) => handleUpdateNode({ ...selectedNode, description: e.target.value })}
                    className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-100 rounded"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 gap-2">
                <MapPin className="w-8 h-8 text-slate-600 animate-bounce" />
                <span>Select a hotspot node on the visual canvas to inspect and configure its parameters.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 02: MACRO RECORDER STUDIO */}
      {activeTab === 'macros' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 flex-1 overflow-y-auto">
          {/* Left Col: Recorder Console & Command Builder */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-[#0c1018] p-5 rounded-xl border border-emerald-500/30 shadow-lg flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-[#2f3749] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-antonio font-bold text-base text-emerald-300 uppercase tracking-wider">
                    Macro Sequence Recorder & Virtual Hotkey Binder
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono-data text-emerald-400 font-bold">READY TO RECORD</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono-data text-slate-400 mb-1">MACRO SEQUENCE NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. Emergency Lockdown Protocol"
                    value={macroName}
                    onChange={(e) => setMacroName(e.target.value)}
                    className="w-full p-2.5 bg-[#050608] border border-emerald-500/50 text-slate-100 rounded text-xs font-mono-data focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono-data text-slate-400 mb-1">BIND TO VIRTUAL HOTKEY / KEYPAD</label>
                  <select
                    value={macroHotkey}
                    onChange={(e) => setMacroHotkey(e.target.value)}
                    className="w-full p-2.5 bg-[#050608] border border-emerald-500/50 text-emerald-300 rounded text-xs font-mono-data cursor-pointer"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={`K${i + 1}`}>Key K{i + 1} (Bank 1-40)</option>
                    ))}
                    <option value="KNOB_ALPHA">Knob Alpha Click (α)</option>
                    <option value="KNOB_BETA">Knob Beta Click (β)</option>
                  </select>
                </div>
              </div>

              {/* Recorded Command Sequence Queue */}
              <div className="flex flex-col gap-2">
                <label className="block text-[10px] font-mono-data text-slate-400">RECORDED COMMAND QUEUE ({recordedCommands.length} Steps)</label>
                <div className="min-h-32 bg-[#05070a] border border-[#2f3749] rounded-xl p-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {recordedCommands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-xs font-mono-data gap-1">
                      <span>No commands recorded yet. Click templates below to append to macro queue.</span>
                    </div>
                  ) : (
                    recordedCommands.map((cmd, idx) => (
                      <div
                        key={cmd.id}
                        className="flex items-center justify-between bg-[#121620] border border-emerald-500/40 p-2.5 rounded-lg text-xs font-mono-data animate-fade-in"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-300 text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="text-slate-100 font-bold">{cmd.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playToggle();
                            setRecordedCommands((prev) => prev.filter((c) => c.id !== cmd.id));
                          }}
                          className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          title="Remove Command"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Command Templates for Recording */}
              <div className="flex flex-col gap-2">
                <label className="block text-[10px] font-mono-data text-slate-400">AVAILABLE SYSTEM COMMAND TEMPLATES</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableCommandTemplates.map((tpl) => (
                    <button
                      key={tpl.action}
                      type="button"
                      onClick={() => handleAddCommandToMacro(tpl)}
                      className="p-2.5 bg-[#121620] hover:bg-emerald-950/50 border border-[#2f3749] hover:border-emerald-500/60 rounded-lg text-left flex items-center justify-between text-xs font-mono-data cursor-pointer transition-colors"
                    >
                      <span className="text-slate-200">{tpl.label}</span>
                      <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-[#2f3749]">
                <button
                  type="button"
                  onClick={handleSaveMacro}
                  disabled={!macroName.trim()}
                  className={`px-6 py-2.5 rounded-lg font-antonio font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                    macroName.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Save Macro & Bind Hotkey</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Col: Active Stored Macros Library & One-Touch Runner */}
          <div className="flex flex-col gap-4 bg-[#0a0d12] p-5 rounded-xl border border-emerald-500/30 shadow-lg font-mono-data text-xs">
            <div className="flex items-center gap-2 font-antonio font-bold text-sm text-emerald-300 uppercase tracking-wider pb-2 border-b border-[#2f3749]">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>SAVED MACRO LIBRARY ({macros.length})</span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              Test-fire stored complex system macros instantly or review their bound virtual hotkeys.
            </p>

            <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
              {macros.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-2">
                  <Terminal className="w-8 h-8 text-slate-600 animate-pulse" />
                  <span>No custom macros created yet. Use the recorder console on the left to build one.</span>
                </div>
              ) : (
                macros.map((macro) => {
                  const isExecuting = executingMacroId === macro.id;
                  return (
                    <div
                      key={macro.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 ${
                        isExecuting
                          ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-[1.02]'
                          : 'bg-[#121620] border-[#2f3749] hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-antonio font-bold text-sm text-emerald-300 uppercase">{macro.name}</span>
                        <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          HOTKEY: {macro.hotkey}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400">
                        Steps: {macro.commands.map((c) => c.label).join(' → ')}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => handleExecuteMacro(macro)}
                          disabled={isExecuting}
                          className={`px-3 py-1.5 rounded font-antonio font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isExecuting
                              ? 'bg-emerald-400 text-black animate-pulse'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-black'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isExecuting ? 'EXECUTING...' : 'RUN MACRO'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMacro(macro.id)}
                          className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          title="Delete Macro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 03: HARDWARE MAPPING */}
      {activeTab === 'hardware' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 flex-1 overflow-y-auto">
          {/* Left 2 Cols: 12-Key Tactile Grid & Macro Library Drawer */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-[#0c1018] p-5 rounded-xl border border-emerald-500/30 shadow-lg flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-[#2f3749] pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-antonio font-bold text-base text-emerald-300 uppercase tracking-wider">
                    Handheld Keypad Controller Matrix (480 Macro Options / 40 Banks)
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playChime();
                      setWizardStep(1);
                      setWizardTestSuccess(false);
                      setIsWizardOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer shadow transition-colors text-xs font-mono-data"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>KEY BINDING WIZARD</span>
                  </button>

                  <select
                    value={hardwareMapping.activeBank}
                    onChange={(e) => handleUpdateHardwareMapping({ activeBank: Number(e.target.value) })}
                    className="bg-[#121620] border border-emerald-500/60 text-emerald-300 px-2.5 py-1.5 rounded cursor-pointer text-xs font-mono-data"
                  >
                    {Array.from({ length: 40 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>Bank {i + 1} (480 Options)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Macro Key Conflict Warning Banner */}
              {conflictingKeys.size > 0 && (
                <div className="bg-red-950/70 border-2 border-red-500 p-3.5 rounded-xl flex items-center justify-between text-xs text-red-200 shadow-lg animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <strong className="text-red-300 uppercase font-antonio tracking-wide text-sm">Macro Key Conflict Detected:</strong>
                      <p className="text-[11px] text-red-300">
                        {conflictingKeys.size} physical keys share duplicate macro or command assignments across the controller matrix.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeconflict}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold uppercase rounded cursor-pointer transition-colors shadow-md text-xs shrink-0"
                  >
                    Deconflict Keys
                  </button>
                </div>
              )}

              {/* Visual 3x4 Tactile Keypad Grid mirroring image.png */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, idx) => {
                  const keyId = `K${idx + 1}`;
                  const assignment = hardwareMapping.keyAssignments[keyId] || 'Unassigned';
                  const isAssigned = assignment !== 'Unassigned';
                  const isInspected = inspectedKeyId === keyId;
                  const isConflicting = conflictingKeys.has(keyId);

                  return (
                    <div
                      key={keyId}
                      onClick={() => {
                        soundEngine.playToggle();
                        setInspectedKeyId(keyId);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedAction = e.dataTransfer.getData('text/plain');
                        if (droppedAction) {
                          handleKeyAssignmentChange(keyId, droppedAction);
                        }
                      }}
                      className={`relative rounded-xl p-3 flex flex-col justify-between h-28 cursor-pointer transition-all border-2 shadow-lg ${
                        isConflicting
                          ? 'bg-red-950/50 border-red-500 ring-2 ring-red-500/60 animate-pulse'
                          : isInspected
                          ? 'bg-[#182232] border-cyan-400 ring-2 ring-cyan-500/40 scale-105 z-10'
                          : isAssigned
                          ? 'bg-[#121824] border-emerald-500/70 hover:border-emerald-400 hover:bg-[#162030]'
                          : 'bg-[#0e121a] border-[#222c3d] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono-data font-bold text-xs px-2 py-0.5 rounded ${isConflicting ? 'bg-red-950 text-red-300 border border-red-600' : isAssigned ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-800 text-slate-400'}`}>
                          {keyId}
                        </span>
                        {isConflicting ? (
                          <span className="text-[9px] bg-red-950 text-red-300 border border-red-500 px-1.5 py-0.5 rounded font-bold uppercase animate-bounce">
                            CONFLICT
                          </span>
                        ) : isAssigned ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Assigned & Active" />
                        ) : null}
                      </div>

                      <div className="flex flex-col items-center justify-center text-center my-1">
                        <span className="font-antonio font-bold text-xs text-slate-100 uppercase tracking-wide truncate w-full px-1">
                          {assignment}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono-data text-slate-400 border-t border-white/5 pt-1">
                        <span>ACT: {hardwareMapping.hapticIntensity}%</span>
                        <span className={isConflicting ? 'text-red-400 font-bold' : isAssigned ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          {isConflicting ? 'CONFLICT' : isAssigned ? 'BOUND' : 'IDLE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Macro Library Drawer & Key Inspector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Macro Library Presets & User Macros Drawer */}
                <div className="bg-[#0a0d12] p-4 rounded-xl border border-emerald-500/40 shadow-lg flex flex-col gap-3 font-mono-data text-xs">
                  <div className="flex items-center gap-2 font-antonio font-bold text-sm text-emerald-300 uppercase tracking-wider pb-2 border-b border-[#2f3749]">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>MACRO LIBRARY & PRESETS (DRAG & DROP)</span>
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    Drag any macro preset or user macro directly onto any key above, or click to assign to {inspectedKeyId}.
                  </p>

                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {macroLibraryPresets.map((preset) => (
                      <div
                        key={preset.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', preset.name)}
                        onClick={() => handleKeyAssignmentChange(inspectedKeyId, preset.name)}
                        className="bg-[#121620] hover:bg-emerald-950/40 border border-[#2f3749] hover:border-emerald-500/60 p-2 rounded flex items-center justify-between cursor-grab transition-colors"
                        title="Drag onto any key above or click to assign to inspected key"
                      >
                        <div className="flex flex-col">
                          <span className="font-antonio font-bold text-slate-200 text-xs">{preset.name}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[190px]">{preset.description}</span>
                        </div>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                          PRESET
                        </span>
                      </div>
                    ))}
                    {macros.map((m) => (
                      <div
                        key={m.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', m.name)}
                        onClick={() => handleKeyAssignmentChange(inspectedKeyId, m.name)}
                        className="bg-[#121620] hover:bg-cyan-950/40 border border-cyan-500/40 hover:border-cyan-500/80 p-2 rounded flex items-center justify-between cursor-grab transition-colors"
                        title="Drag onto any key above or click to assign user macro to inspected key"
                      >
                        <div className="flex flex-col">
                          <span className="font-antonio font-bold text-cyan-200 text-xs">Macro: {m.name}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[190px]">{m.commands.length} command sequence(s)</span>
                        </div>
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded">
                          MACRO
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Inspector Card */}
                <div className="bg-[#0a0d12] p-4 rounded-xl border border-cyan-500/40 shadow-lg flex flex-col gap-3 font-mono-data text-xs">
                  <div className="flex items-center justify-between font-antonio font-bold text-sm text-cyan-300 pb-2 border-b border-[#2f3749]">
                    <span>INSPECTING KEY: {inspectedKeyId}</span>
                    <span className="text-[10px] text-slate-400">Bank {hardwareMapping.activeBank}</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">ASSIGNED COMMAND OR MACRO</label>
                    <select
                      value={hardwareMapping.keyAssignments[inspectedKeyId] || 'Unassigned'}
                      onChange={(e) => handleKeyAssignmentChange(inspectedKeyId, e.target.value)}
                      className="w-full p-2 bg-[#050608] border border-cyan-500/60 text-slate-100 rounded cursor-pointer text-xs"
                    >
                      <option value="Unassigned">-- Unassigned --</option>
                      <option value="MSD View">01. MSD Display View</option>
                      <option value="UI Builder">02. UI Builder Mode</option>
                      <option value="Token Lab">03. Token Lab</option>
                      <option value="AI Diagnostics">04. AI Diagnostics</option>
                      <option value="VoxCon Live">05. VoxConLive Uplink</option>
                      <option value="Theme Forge">06. Theme Forge</option>
                      <option value="Mute Audio">Mute Master Audio</option>
                      <option value="Predict Trends">Predict Trends Modal</option>
                      <option value="Copy Anomaly Log">Copy Anomaly Log</option>
                      <option value="Toggle Pinned Metrics">Toggle Pinned Metrics</option>
                      <option value="Emergency Reset">Emergency System Reset</option>
                      <option value="Simulate Anomaly">Simulate Anomaly Spike</option>
                      {macros.map(m => (
                        <option key={m.id} value={m.name}>Macro: {m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-[#080b12] p-3 rounded border border-[#2f3749] flex flex-col gap-1 text-[11px] text-slate-300">
                    <span className="text-cyan-400 font-bold">Hardware Specifications:</span>
                    <span>Actuation Force: <strong className="text-white">{hardwareMapping.hapticIntensity}%</strong></span>
                    <span>USB HID Latency: <strong className="text-white">1.2ms</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Rotary Knobs & Push Buttons + Haptic Intensity Slider Configuration Panel */}
          <div className="flex flex-col gap-4 bg-[#0a0d12] p-4 rounded-xl border border-emerald-500/40 shadow-lg font-mono-data text-xs">
            <div className="flex items-center gap-2 font-antonio font-bold text-sm text-emerald-300 uppercase tracking-wider pb-2 border-b border-[#2f3749]">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>CONTROLLER HARDWARE SETTINGS</span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              Adjust physical actuation force and haptic feedback intensity for all 12 keys, 2 rotary encoders (20 detent stops), and push-switches.
            </p>

            {/* Haptic Intensity Slider Control */}
            <div className="bg-[#121620] p-3.5 rounded-xl border border-emerald-500/50 flex flex-col gap-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="flex items-center justify-between font-antonio font-bold text-sm text-emerald-300">
                <span className="flex items-center gap-2">
                  <Vibrate className="w-4 h-4 text-emerald-400 animate-pulse" />
                  HAPTIC INTENSITY FEEDBACK
                </span>
                <span className="text-emerald-400 font-mono-data font-bold text-xs">
                  {hardwareMapping.hapticIntensity}%
                </span>
              </div>

              <div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={hardwareMapping.hapticIntensity}
                  onChange={(e) => handleUpdateHardwareMapping({ hapticIntensity: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0% (SILENT)</span>
                <span>50% (MODERATE DETENT)</span>
                <span>100% (MAX HAPTIC)</span>
              </div>
            </div>

            {/* Knob Alpha Config */}
            <div className="bg-[#121620] p-3.5 rounded-xl border border-[#2f3749] flex flex-col gap-3">
              <div className="flex items-center justify-between font-antonio font-bold text-sm text-emerald-300">
                <span className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full border border-emerald-500 bg-emerald-950 flex items-center justify-center text-xs">α</div>
                  KNOB ALPHA (TOP ENCODER)
                </span>
                <span className="text-[10px] text-slate-400">20 Detents</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  ROTATION SENSITIVITY ({hardwareMapping.knobAlpha.sensitivity}x Step)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={hardwareMapping.knobAlpha.sensitivity}
                  onChange={(e) =>
                    handleUpdateHardwareMapping({
                      knobAlpha: { ...hardwareMapping.knobAlpha, sensitivity: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">PUSH-DOWN CLICK BEHAVIOR</label>
                <select
                  value={hardwareMapping.knobAlpha.clickAction}
                  onChange={(e) =>
                    handleUpdateHardwareMapping({
                      knobAlpha: { ...hardwareMapping.knobAlpha, clickAction: e.target.value },
                    })
                  }
                  className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-200 rounded cursor-pointer"
                >
                  <option value="TOGGLE_ANOMALY">Toggle Thermodynamic Anomaly</option>
                  <option value="RESET_METRICS">Reset Metric History Baseline</option>
                  <option value="CYCLE_BANK">Cycle Macro Bank (+1)</option>
                  <option value="MUTE_AUDIO">Toggle Master Audio</option>
                </select>
              </div>
            </div>

            {/* Knob Beta Config */}
            <div className="bg-[#121620] p-3.5 rounded-xl border border-[#2f3749] flex flex-col gap-3">
              <div className="flex items-center justify-between font-antonio font-bold text-sm text-emerald-300">
                <span className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full border border-emerald-500 bg-emerald-950 flex items-center justify-center text-xs">β</div>
                  KNOB BETA (BOTTOM ENCODER)
                </span>
                <span className="text-[10px] text-slate-400">20 Detents</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  ROTATION SENSITIVITY ({hardwareMapping.knobBeta.sensitivity}x Step)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={hardwareMapping.knobBeta.sensitivity}
                  onChange={(e) =>
                    handleUpdateHardwareMapping({
                      knobBeta: { ...hardwareMapping.knobBeta, sensitivity: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">PUSH-DOWN CLICK BEHAVIOR</label>
                <select
                  value={hardwareMapping.knobBeta.clickAction}
                  onChange={(e) =>
                    handleUpdateHardwareMapping({
                      knobBeta: { ...hardwareMapping.knobBeta, clickAction: e.target.value },
                    })
                  }
                  className="w-full p-2 bg-[#050608] border border-[#2f3749] text-slate-200 rounded cursor-pointer"
                >
                  <option value="RESET_METRICS">Reset Metric History Baseline</option>
                  <option value="TOGGLE_ANOMALY">Toggle Thermodynamic Anomaly</option>
                  <option value="CYCLE_BANK">Cycle Macro Bank (+1)</option>
                  <option value="PREDICT_TRENDS">Open Predict Trends Modal</option>
                </select>
              </div>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-2 text-emerald-300">
                <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
                <span>USB HID HANDHELD CONTROLLER:</span>
              </span>
              <span className="text-emerald-400 font-bold font-mono-data">SYNCED & READY</span>
            </div>
          </div>
        </div>
      )}

      {/* Key Binding Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0c1018] border-2 border-emerald-500 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5 font-mono-data text-xs">
            {/* Wizard Header */}
            <div className="flex items-center justify-between border-b border-[#2f3749] pb-3">
              <div className="flex items-center gap-2 text-emerald-300 font-antonio font-bold text-base uppercase">
                <Wand2 className="w-5 h-5 text-emerald-400" />
                <span>KEY BINDING WIZARD // STEP {wizardStep} OF 3</span>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Wizard Step 1: Select Target */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <p className="text-slate-300 text-xs">
                  Step 1: Select the physical key or rotary knob control you wish to configure from Bank {hardwareMapping.activeBank}:
                </p>

                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const kId = `K${i + 1}`;
                    const isSelected = wizardTarget === kId;
                    return (
                      <button
                        key={kId}
                        type="button"
                        onClick={() => {
                          soundEngine.playToggle();
                          setWizardTarget(kId);
                        }}
                        className={`p-3 rounded-lg border text-center font-bold font-antonio text-sm cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-black border-white ring-2 ring-emerald-400'
                            : 'bg-[#121620] text-slate-200 border-[#2f3749] hover:border-emerald-500'
                        }`}
                      >
                        {kId}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playToggle();
                      setWizardTarget('Knob Alpha (α)');
                    }}
                    className={`p-3 rounded-lg border text-center font-bold font-antonio text-xs cursor-pointer ${
                      wizardTarget === 'Knob Alpha (α)' ? 'bg-emerald-600 text-black border-white' : 'bg-[#121620] text-slate-200 border-[#2f3749]'
                    }`}
                  >
                    KNOB ALPHA (α)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playToggle();
                      setWizardTarget('Knob Beta (β)');
                    }}
                    className={`p-3 rounded-lg border text-center font-bold font-antonio text-xs cursor-pointer ${
                      wizardTarget === 'Knob Beta (β)' ? 'bg-emerald-600 text-black border-white' : 'bg-[#121620] text-slate-200 border-[#2f3749]'
                    }`}
                  >
                    KNOB BETA (β)
                  </button>
                </div>

                <div className="flex justify-end pt-3 border-t border-[#2f3749]">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playChime();
                      setWizardStep(2);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-antonio uppercase rounded flex items-center gap-1 cursor-pointer"
                  >
                    <span>NEXT: PICK MACRO</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Step 2: Pick Macro or Action */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <p className="text-slate-300 text-xs">
                  Step 2: Assign a system command or macro preset to <strong className="text-emerald-300">{wizardTarget}</strong>:
                </p>

                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {macroLibraryPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playToggle();
                        setWizardAction(preset.name);
                      }}
                      className={`p-2.5 rounded border text-left flex items-center justify-between cursor-pointer transition-colors ${
                        wizardAction === preset.name
                          ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                          : 'bg-[#121620] border-[#2f3749] text-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-antonio font-bold text-sm text-slate-100">{preset.name}</span>
                        <span className="text-[10px] text-slate-400">{preset.description}</span>
                      </div>
                      {wizardAction === preset.name && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                  {macros.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playToggle();
                        setWizardAction(m.name);
                      }}
                      className={`p-2.5 rounded border text-left flex items-center justify-between cursor-pointer transition-colors ${
                        wizardAction === m.name
                          ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                          : 'bg-[#121620] border-[#2f3749] text-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-antonio font-bold text-sm text-slate-100">Macro: {m.name}</span>
                        <span className="text-[10px] text-slate-400">{m.commands.length} command steps</span>
                      </div>
                      {wizardAction === m.name && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between pt-3 border-t border-[#2f3749]">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 bg-[#121620] text-slate-300 hover:text-white font-bold font-antonio uppercase rounded cursor-pointer border border-[#2f3749]"
                  >
                    BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playChime();
                      setWizardStep(3);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-antonio uppercase rounded flex items-center gap-1 cursor-pointer"
                  >
                    <span>NEXT: TEST TRIGGER</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Step 3: Test Trigger Visually */}
            {wizardStep === 3 && (
              <div className="flex flex-col gap-4 animate-fade-in text-center items-center py-2">
                <p className="text-slate-300 text-xs">
                  Step 3: Test your new binding for <strong className="text-emerald-300">{wizardTarget}</strong> → <strong className="text-cyan-300">{wizardAction}</strong>:
                </p>

                <div className="w-full bg-[#121620] p-6 rounded-xl border border-emerald-500/50 flex flex-col items-center justify-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${wizardTestSuccess ? 'bg-emerald-500 text-black scale-110 shadow-[0_0_25px_rgba(16,185,129,0.8)]' : 'bg-emerald-950 border-2 border-emerald-500 text-emerald-300'}`}>
                    <Zap className="w-8 h-8" />
                  </div>
                  <span className="font-antonio font-bold text-sm text-slate-100 uppercase">
                    {wizardTestSuccess ? 'TRIGGER TEST SUCCESSFUL! HAPTIC PULSE FIRED' : 'PRESS TEST BUTTON TO SIMULATE HID EVENT'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime();
                    setWizardTestSuccess(true);
                  }}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold font-antonio uppercase rounded cursor-pointer shadow-lg transition-transform active:scale-95"
                >
                  SIMULATE VIRTUAL PRESS NOW
                </button>

                <div className="flex justify-between w-full pt-3 border-t border-[#2f3749]">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 bg-[#121620] text-slate-300 hover:text-white font-bold font-antonio uppercase rounded cursor-pointer border border-[#2f3749]"
                  >
                    BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playChime();
                      if (wizardTarget.startsWith('K')) {
                        handleKeyAssignmentChange(wizardTarget, wizardAction);
                      }
                      setIsWizardOpen(false);
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-antonio uppercase rounded flex items-center gap-1 cursor-pointer shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SAVE BINDING & FINISH</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exporter Section */}
      <CodeExporter manifest={manifest} />

      {/* JSON Importer Modal */}
      <ManifestImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportManifest={onUpdateManifest}
      />
    </div>
  );
};
