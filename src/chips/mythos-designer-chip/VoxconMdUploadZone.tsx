import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  X,
  Bot,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  HelpCircle,
  Code,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { soundEngine } from '../../utils/audio';
import {
  parseMarkdownCommands,
  validateCommandDefinitions,
  evaluateCommandSchemaChecklist,
  SchemaCheckItem,
} from '../../services/voxconpack/parser';
import { VoxCommandDefinition, VoxRegistry } from '../../services/voxconpack/types';

export interface StagedMdFile {
  id: string;
  filename: string;
  content: string;
  size: number;
  parsedCommands: VoxCommandDefinition[];
  errors: string[];
  warnings: string[];
}

interface VoxconMdUploadZoneProps {
  onUploadSuccess: (uploadedCommands: string[]) => void;
  currentRole: string;
  existingRegistry?: VoxRegistry | null;
}

const AGENT_OPTIONS = [
  'ALL',
  'HITL_OPERATOR',
  'AGENTIC_AI',
  'ORCHESTRATOR',
  'ENGINEER',
  'DIAGNOSTICIAN',
  'SENTINEL',
  'NAVIGATOR',
];

const TASK_OPTIONS = [
  'GENERAL',
  'SYSTEM_CONTROL',
  'DATA_INGEST',
  'DIAGNOSTICS',
  'SECURITY',
  'TASK_DISPATCH',
  'SAFETY',
  'RECON',
];

export const VoxconMdUploadZone: React.FC<VoxconMdUploadZoneProps> = ({
  onUploadSuccess,
  currentRole,
  existingRegistry,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedMdFile[]>([]);
  const [actorPersona, setActorPersona] = useState<'HITL_OPERATOR' | 'AGENTIC_AI'>('HITL_OPERATOR');
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['ALL']);
  const [selectedTask, setSelectedTask] = useState<string>('GENERAL');
  const [customAgentInput, setCustomAgentInput] = useState('');
  const [operatorApproved, setOperatorApproved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; filename: string; agent: string; task: string; markdown: string }>>([]);
  const [inspectedFileId, setInspectedFileId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [showSchemaGuide, setShowSchemaGuide] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/voxcon/templates');
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) {
        setTemplates(data.templates);
      }
    } catch (e) {
      console.error('Failed to load command templates:', e);
    }
  };

  const processIncomingFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.name.endsWith('.md') || f.name.endsWith('.markdown') || f.type.includes('markdown') || f.type.includes('text')
    );

    if (fileArray.length === 0) {
      setStatusMessage({ text: 'Error: Only Markdown (.md) files are supported for command uploads.', type: 'error' });
      soundEngine.playAlert();
      return;
    }

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        const { commands, errors: parseErrors } = parseMarkdownCommands(text);
        const { errors: valErrors, warnings: valWarnings } = validateCommandDefinitions(commands, existingRegistry?.commands);

        const allErrors = [
          ...parseErrors.map((e) => `[Parse] ${e.rule}: ${e.message}`),
          ...valErrors.map((e) => `[Validation] ${e.rule}: ${e.message}`),
        ];

        const staged: StagedMdFile = {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          filename: file.name,
          content: text,
          size: file.size,
          parsedCommands: commands,
          errors: allErrors,
          warnings: valWarnings.map((w) => (typeof w === 'string' ? w : `${(w as any).rule || 'Warning'}: ${(w as any).message || ''}`)),
        };

        setStagedFiles((prev) => [...prev, staged]);
        soundEngine.playToggle();
      };
      reader.readAsText(file);
    });

    setStatusMessage(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
      // Reset input value so re-selecting same file triggers onChange
      e.target.value = '';
    }
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
    if (inspectedFileId === id) setInspectedFileId(null);
    if (editingFileId === id) setEditingFileId(null);
    soundEngine.playToggle();
  };

  const handleStartEditing = (file: StagedMdFile) => {
    setEditingFileId(file.id);
    setEditingContent(file.content);
    setInspectedFileId(file.id);
    soundEngine.playToggle();
  };

  const handleSaveEditing = (fileId: string) => {
    const { commands, errors: parseErrors } = parseMarkdownCommands(editingContent);
    const { errors: valErrors, warnings: valWarnings } = validateCommandDefinitions(commands, existingRegistry?.commands);

    const allErrors = [
      ...parseErrors.map((e) => `[Parse] ${e.rule}: ${e.message}`),
      ...valErrors.map((e) => `[Validation] ${e.rule}: ${e.message}`),
    ];

    setStagedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        return {
          ...f,
          content: editingContent,
          size: new Blob([editingContent]).size,
          parsedCommands: commands,
          errors: allErrors,
          warnings: valWarnings.map((w) => (typeof w === 'string' ? w : `${(w as any).rule || 'Warning'}: ${(w as any).message || ''}`)),
        };
      })
    );

    setEditingFileId(null);
    soundEngine.playChime();
  };

  const handleDownloadSampleSpec = () => {
    soundEngine.playToggle();
    const sampleMd = `## SCAN

Command ID: VOX.SCAN
Class: OBSERVE
Purpose: Initiates active sensor sweeping and optical diagnostics across designated target coordinates or system components.
Canonical forms: scan, sweep sensors, conduct scan
Aliases: initiate scan, sweep grid, scan area

Parameters:
- target: required (string) - Sensor azimuth or physical subsystem to sweep.
- bearing: optional (number) - Relative compass heading or orientation angle.
- duration: optional (number) - Scan duration in seconds.

Authority: Requires AUTHPACK authorization with OBSERVER role or higher.
Confirmation: false
Execution: Dispatches high-frequency radio and optical diagnostic sweep to workstation sensor bus.
Failure: Reports sensor calibration timeout or unreachable subsystem telemetry.
Escalation: Alerts tactical operator if critical anomalies or jamming are detected.
Response profile: COMMPACK.ACTION

Examples:
- "Scan sector four"
- "Initiate sensor sweep on engine array"
- "Scan target alpha bearing zero nine zero"
`;
    const blob = new Blob([sampleMd], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'VOX.SAMPLE_SPEC.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadTemplate = (tpl: { filename: string; markdown: string; agent: string; task: string }) => {
    const { commands, errors: parseErrors } = parseMarkdownCommands(tpl.markdown);
    const { errors: valErrors, warnings } = validateCommandDefinitions(commands, existingRegistry?.commands);

    const staged: StagedMdFile = {
      id: `${tpl.filename}-${Date.now()}`,
      filename: tpl.filename,
      content: tpl.markdown,
      size: new Blob([tpl.markdown]).size,
      parsedCommands: commands,
      errors: [...parseErrors.map((e) => e.message), ...valErrors.map((e) => e.message)],
      warnings: warnings.map((w) => (typeof w === 'string' ? w : (w as any).message || '')),
    };

    setStagedFiles((prev) => [...prev, staged]);
    setSelectedAgents([tpl.agent]);
    setSelectedTask(tpl.task);
    soundEngine.playChime();
  };

  const toggleAgent = (agent: string) => {
    soundEngine.playToggle();
    if (agent === 'ALL') {
      setSelectedAgents(['ALL']);
      return;
    }

    let updated = selectedAgents.filter((a) => a !== 'ALL');
    if (updated.includes(agent)) {
      updated = updated.filter((a) => a !== agent);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(agent);
    }
    setSelectedAgents(updated);
  };

  const handleAddCustomAgent = () => {
    const clean = customAgentInput.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!clean) return;
    if (!selectedAgents.includes(clean)) {
      setSelectedAgents((prev) => [...prev.filter((a) => a !== 'ALL'), clean]);
    }
    setCustomAgentInput('');
    soundEngine.playToggle();
  };

  const handleUploadAndCommit = async () => {
    if (stagedFiles.length === 0) {
      setStatusMessage({ text: 'No .md files staged for upload.', type: 'error' });
      return;
    }

    if (!operatorApproved) {
      setStatusMessage({
        text: 'Operator Approval Grant is required. Check the approval box to authorize activation.',
        type: 'error',
      });
      soundEngine.playAlert();
      return;
    }

    // Check for critical blocking syntax errors
    const filesWithErrors = stagedFiles.filter((f) => f.errors.length > 0);
    if (filesWithErrors.length > 0) {
      setStatusMessage({
        text: `Cannot upload: ${filesWithErrors.length} file(s) contain syntax errors. Resolve errors before activating.`,
        type: 'error',
      });
      soundEngine.playAlert();
      return;
    }

    setIsUploading(true);
    soundEngine.playChime();

    try {
      const payloadFiles = stagedFiles.map((f) => ({
        filename: f.filename,
        content: f.content,
      }));

      const res = await fetch('/api/voxcon/upload-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: payloadFiles,
          approve: true,
          author: actorPersona,
          defaultAgents: selectedAgents,
          defaultTask: selectedTask,
        }),
      });

      const data = await res.json();
      if (data.success) {
        soundEngine.playChime();
        setStatusMessage({
          text: `Success: Ingested and activated ${data.count} command(s) for agents [${selectedAgents.join(', ')}].`,
          type: 'success',
        });
        setStagedFiles([]);
        setOperatorApproved(false);
        onUploadSuccess(data.commands || []);
      } else {
        soundEngine.playAlert();
        setStatusMessage({
          text: `Upload failed: ${data.error || 'Unknown server error'}`,
          type: 'error',
        });
      }
    } catch (e: any) {
      soundEngine.playAlert();
      setStatusMessage({ text: `Network error: ${e.message}`, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="voxcon-md-upload-center" className="flex flex-col gap-3 font-mono text-xs">
      {/* 1. Actor & Operation Context Bar */}
      <div className="p-3 rounded-lg border bg-[#080d16] border-[#223048] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-blue-950/70 border border-blue-600/60 text-blue-400">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-xs tracking-wider uppercase">
                .MD COMMAND INGESTION &amp; CRUD OPS
              </span>
              <span className="px-1.5 py-0.2 text-[9px] rounded font-bold uppercase bg-emerald-950 border border-emerald-700 text-emerald-300">
                HITL / AGENTIC SYNC
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Drag-and-drop or select Markdown (.md) command specs to integrate into VOXCONPACK runtime.
            </p>
          </div>
        </div>

        {/* Actor Persona Switcher */}
        <div className="flex items-center gap-1.5 bg-[#04060a] p-1 rounded border border-[#2a3447]">
          <span className="text-[10px] text-slate-400 px-1 font-bold">AUTHOR:</span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setActorPersona('HITL_OPERATOR');
            }}
            className={`px-2 py-1 text-[10px] rounded font-bold flex items-center gap-1 cursor-pointer transition-all ${
              actorPersona === 'HITL_OPERATOR'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            HITL OPERATOR
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playToggle();
              setActorPersona('AGENTIC_AI');
            }}
            className={`px-2 py-1 text-[10px] rounded font-bold flex items-center gap-1 cursor-pointer transition-all ${
              actorPersona === 'AGENTIC_AI'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-3 h-3" />
            AGENTIC AI
          </button>
        </div>
      </div>

      {/* 2. Target Agent & Task Domain Configuration Bar */}
      <div className="p-2.5 rounded-lg border bg-[#0a101b] border-[#1d273a] flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Target Agents Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1">
              <Bot className="w-3 h-3" />
              Target Agent(s):
            </span>
            {AGENT_OPTIONS.map((agent) => {
              const isSelected = selectedAgents.includes(agent);
              return (
                <button
                  key={agent}
                  type="button"
                  onClick={() => toggleAgent(agent)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-cyan-950 text-cyan-200 border-cyan-500 shadow-sm'
                      : 'bg-[#06080c] text-slate-400 border-[#2a3447] hover:border-slate-500'
                  }`}
                >
                  {agent}
                </button>
              );
            })}

            {/* Custom agent input */}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="text"
                value={customAgentInput}
                onChange={(e) => setCustomAgentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomAgent()}
                placeholder="+ Custom Agent"
                className="px-1.5 py-0.5 text-[10px] font-mono bg-[#06080c] border border-[#2a3447] text-cyan-300 rounded focus:outline-none focus:border-cyan-400 w-24"
              />
              <button
                type="button"
                onClick={handleAddCustomAgent}
                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-bold"
              >
                ADD
              </button>
            </div>
          </div>

          {/* Task Domain Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Task Domain:
            </span>
            <select
              value={selectedTask}
              onChange={(e) => {
                soundEngine.playToggle();
                setSelectedTask(e.target.value);
              }}
              className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#06080c] border border-[#2a3447] text-amber-300 rounded focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {TASK_OPTIONS.map((task) => (
                <option key={task} value={task}>
                  {task}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Drag-and-Drop / Click Upload Area */}
      <div
        id="voxcon-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all select-none ${
          isDragOver
            ? 'bg-blue-950/40 border-cyan-400 text-cyan-200 scale-[1.005]'
            : 'bg-[#060911] border-[#223048] hover:border-slate-500 hover:bg-[#0a0f1d] text-slate-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="p-3 rounded-full bg-slate-900 border border-slate-700 text-cyan-400 shadow-inner">
          <Upload className="w-6 h-6 animate-bounce" />
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-sm text-slate-100">
            Drag &amp; Drop .md files here, or <span className="text-cyan-400 underline">browse</span>
          </span>
          <span className="text-[11px] text-slate-400">
            Supports single or multi-file uploads (e.g. <code>PURGE.md</code>, <code>DIAGNOSTICS.md</code>, or batch Markdown)
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            Accepted Formats: .md, .markdown
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800">
            Automatic Syntax &amp; Normative Validation
          </span>
        </div>
      </div>

      {/* 4. Pre-built Agent / Task Template Presets */}
      {templates.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg border bg-[#06080c] border-[#1d273a]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Pre-Crafted Agent &amp; Task Templates (Click to Stage):
            </span>
            <span className="text-[10px] text-slate-500">
              Ready for immediate activation or customization
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleLoadTemplate(tpl)}
                className="p-2 rounded border border-[#2a3447] bg-[#0c121e] hover:border-cyan-500 hover:bg-[#111a2c] text-left flex flex-col gap-1 cursor-pointer transition-all shadow-sm group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-200 group-hover:text-cyan-300 truncate">
                    {tpl.filename}
                  </span>
                  <span className="text-[9px] px-1 rounded bg-blue-950 text-blue-300 font-bold">
                    {tpl.agent}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate">{tpl.title}</span>
                <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                  <span>Task: {tpl.task}</span>
                  <span className="text-cyan-400 font-bold group-hover:underline">+ Stage</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Staged Files Ingestion Queue */}
      {stagedFiles.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-lg border bg-[#090e18] border-[#223048]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              STAGED FOR COMPILATION ({stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''})
            </span>
            <button
              type="button"
              onClick={() => {
                setStagedFiles([]);
                soundEngine.playToggle();
              }}
              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Clear Queue
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {stagedFiles.map((file) => {
              const hasErrors = file.errors.length > 0;
              return (
                <div
                  key={file.id}
                  className={`p-2.5 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-2 ${
                    hasErrors
                      ? 'bg-red-950/30 border-red-800/80 text-red-200'
                      : 'bg-[#06080c] border-[#2a3447] text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {hasErrors ? (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-100">{file.filename}</span>
                        <span className="text-[10px] text-slate-400">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                          {file.parsedCommands.length} Command{file.parsedCommands.length > 1 ? 's' : ''} detected
                        </span>
                      </div>

                      {/* Commands list */}
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {file.parsedCommands.map((cmd) => (
                          <span
                            key={cmd.id}
                            className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-cyan-300"
                          >
                            {cmd.id} ({cmd.class})
                          </span>
                        ))}
                      </div>

                      {/* Error feedback if any */}
                      {hasErrors && (
                        <div className="mt-1 text-[10px] text-red-400 space-y-0.5">
                          {file.errors.map((err, i) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStaged(file.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/50 cursor-pointer self-end md:self-center"
                    title="Remove from staging"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Upload Controls & Operator Approval */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1d273a]">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none bg-[#04060a] px-3 py-1.5 rounded border border-[#2a3447]">
              <input
                type="checkbox"
                checked={operatorApproved}
                onChange={(e) => {
                  soundEngine.playToggle();
                  setOperatorApproved(e.target.checked);
                }}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 cursor-pointer"
              />
              <span className="font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                {actorPersona === 'HITL_OPERATOR' ? 'HITL Operator Approval Grant' : 'Agentic AI Autonomous Authorization Grant'}
              </span>
            </label>

            <button
              type="button"
              disabled={isUploading || stagedFiles.length === 0 || !operatorApproved}
              onClick={handleUploadAndCommit}
              className={`px-4 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer ${
                operatorApproved && stagedFiles.length > 0 && !isUploading
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              {isUploading ? 'INGESTING & COMPILING...' : `INGEST & ACTIVATE (${stagedFiles.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`p-2.5 rounded text-xs font-mono flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700'
              : 'bg-red-950/60 text-red-300 border border-red-700'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
