import React, { useState, useEffect } from 'react';
import {
  Mic,
  Shield,
  FileCode,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCw,
  Search,
  Upload,
  Save,
  Check,
  Ban,
  Clock,
  ExternalLink,
  ChevronRight,
  Database,
  Volume2,
  Trash2,
  Plus,
  Bot,
  Layers,
  UserCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { ThemeId } from '../../types/msd';
import { THEMES } from '../../constants/themes';
import { soundEngine } from '../../utils/audio';
import { voxconPipeline, PipelineExecutionResult } from '../../services/voxconpack/pipeline';
import { voxconEngine } from '../../services/voxconpack/voxconEngine';
import { authpackService } from '../../services/voxconpack/authpackService';
import { commpackService } from '../../services/voxconpack/commpackService';
import { auditLogger } from '../../services/voxconpack/auditLogger';
import { runVoxconpackTestSuite, TestSuiteSummary } from '../../services/voxconpack/testSuite';
import { VoxconMdUploadZone } from './VoxconMdUploadZone';
import { useAuth } from '../../contexts/AuthContext';
import {
  VoxCommandClass,
  VoxCommandDefinition,
  VoxAuditRecord,
  CommpackProfile,
  PendingConfirmationState,
} from '../../services/voxconpack/types';

interface VOXCONPACKSurfaceProps {
  currentTheme: ThemeId;
  onExecuteOrder?: (name: string, args: Record<string, unknown>) => void;
  voiceActive?: boolean;
}

type SurfaceTab = 'console' | 'registry' | 'authoring' | 'compiled' | 'audit' | 'tests';

export const VOXCONPACKSurface: React.FC<VOXCONPACKSurfaceProps> = ({
  currentTheme,
  onExecuteOrder,
  voiceActive,
}) => {
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];

  const [activeTab, setActiveTab] = useState<SurfaceTab>('console');
  const [commpackProfile, setCommpackProfile] = useState<CommpackProfile>('OPERATIONAL');
  const { activeRole, setActiveRole } = useAuth();

  // Interactive Console Input State
  const [commandInput, setCommandInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<PipelineExecutionResult | null>(null);
  const [pendingState, setPendingState] = useState<PendingConfirmationState | null>(null);

  // Command Registry State
  const [commands, setCommands] = useState<VoxCommandDefinition[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<VoxCommandDefinition | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<VoxCommandDefinition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Markdown Authoring & Upload State
  const [authoringMode, setAuthoringMode] = useState<'upload' | 'editor'>('upload');
  const [editCommandName, setEditCommandName] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const [editTargetAgents, setEditTargetAgents] = useState<string[]>(['ALL']);
  const [editTaskDomain, setEditTaskDomain] = useState<string>('GENERAL');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [operatorApproved, setOperatorApproved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Raw text import state
  const [rawTextImport, setRawTextImport] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<VoxAuditRecord[]>([]);

  // Test Suite State
  const [testSummary, setTestSummary] = useState<TestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Compilation Service State
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<string | null>(null);
  const [compileErrors, setCompileErrors] = useState<string[]>([]);

  const handleCompileRegistry = async () => {
    setIsCompiling(true);
    setCompileStatus(null);
    setCompileErrors([]);
    soundEngine.playToggle();
    try {
      const res = await fetch('/api/voxcon/compile', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        soundEngine.playChime();
        await fetchCommands();
        setCompileStatus(`Compilation Successful! Registered ${data.count} commands.`);
        setTimeout(() => setCompileStatus(null), 5000);
      } else {
        soundEngine.playAlert();
        setCompileStatus(`Compilation Failed.`);
        if (Array.isArray(data.errors)) {
          setCompileErrors(data.errors);
        } else if (data.error) {
          setCompileErrors([data.error]);
        }
      }
    } catch (e: any) {
      soundEngine.playAlert();
      setCompileStatus(`Compilation Error.`);
      setCompileErrors([e.message]);
    } finally {
      setIsCompiling(false);
    }
  };

  // Load compiled commands on mount
  useEffect(() => {
    fetchCommands();
    fetchAuditLogs();

    // Subscribe to audit logger
    const unsub = auditLogger.subscribe((logs) => {
      setAuditLogs(logs);
    });

    // Wire up execution dispatcher
    voxconPipeline.setExecutor(async (name, args) => {
      console.log('[VOXCONPACK Surface Dispatcher]', name, args);
      
      // Handle COMMPACK Profile Switch
      if (name === 'SWITCH') {
        const val = String(args.value || args.target || '').toUpperCase();
        if (val === 'OPERATIONAL' || val === 'MIL' || val.includes('OPERATIONAL') || val.includes('MIL')) {
          setCommpackProfile('OPERATIONAL');
          return { success: true, message: `COMMPACK Profile switched to OPERATIONAL.` };
        } else if (val === 'CONVERSATIONAL' || val === 'CONV' || val.includes('CONVERSATIONAL') || val.includes('CONV')) {
          setCommpackProfile('CONVERSATIONAL');
          return { success: true, message: `COMMPACK Profile switched to CONVERSATIONAL.` };
        }
      }
      
      if (onExecuteOrder) {
        onExecuteOrder(name, args);
      }
      return { success: true, message: `Dispatched action ${name} to workstation runtime.` };
    });

    return () => {
      unsub();
    };
  }, []);

  // Sync role and commpack profile
  useEffect(() => {
    authpackService.setRole(activeRole);
    if (activeRole === 'OPERATOR' && commpackProfile === 'OPERATIONAL') {
      setCommpackProfile('CONVERSATIONAL');
    }
  }, [activeRole, commpackProfile]);

  useEffect(() => {
    commpackService.setProfile(commpackProfile);
  }, [commpackProfile]);

  const fetchCommands = async () => {
    try {
      const res = await fetch('/api/voxcon/commands');
      const data = await res.json();
      if (data.success && Array.isArray(data.commands)) {
        setCommands(data.commands);
        if (data.commands.length > 0 && !selectedCommand) {
          setSelectedCommand(data.commands[0]);
        }
      }
      // Keep runtime in-memory engine synchronized
      const regRes = await fetch('/api/voxcon/registry');
      const regData = await regRes.json();
      if (regData.success && regData.registry) {
        voxconEngine.updateRegistry(regData.registry);
      }
    } catch {
      // Fallback to in-memory registry
      const reg = voxconEngine.getRegistry();
      setCommands(reg.commands);
      if (reg.commands.length > 0 && !selectedCommand) {
        setSelectedCommand(reg.commands[0]);
      }
    }
  };

  const handleDeleteCommand = async (commandName: string) => {
    const clean = commandName.replace(/^VOX\./i, '').trim().toUpperCase();
    if (clean === 'STOP') {
      soundEngine.playAlert();
      alert('CRITICAL SAFETY VIOLATION: VOX.STOP is an immutable safety halt anchor and cannot be deleted.');
      return;
    }

    setIsDeleting(true);
    soundEngine.playChime();

    try {
      const res = await fetch('/api/voxcon/delete-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandName: clean,
          approve: true,
          actor: activeRole,
        }),
      });

      const data = await res.json();
      if (data.success) {
        soundEngine.playChime();
        await fetchCommands();
        if (selectedCommand?.command === clean) {
          setSelectedCommand(null);
        }
        setDeleteCandidate(null);
      } else {
        soundEngine.playAlert();
        alert(`Delete failed: ${data.error}`);
      }
    } catch (e: any) {
      soundEngine.playAlert();
      alert(`Error deleting command: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/voxcon/audit-logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch {
      setAuditLogs(auditLogger.getLogs());
    }
  };

  // Submit command through the authoritative pipeline
  const handleSubmitCommand = async (phraseToRun?: string) => {
    const input = (phraseToRun !== undefined ? phraseToRun : commandInput).trim();
    if (!input) return;

    setIsProcessing(true);
    soundEngine.playChime();

    try {
      const res = await voxconPipeline.processInput(input, 'TEXT', {}, commpackProfile);
      setLastResult(res);
      setPendingState(authpackService.getPendingConfirmation());
      if (phraseToRun === undefined) setCommandInput('');
    } catch (e: any) {
      console.error('[VOXCONPACK Surface Error]', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Action Buttons
  const sampleCommands = [
    { label: 'Status', phrase: 'status' },
    { label: 'Open Dashboard', phrase: 'open the dashboard' },
    { label: 'Launch VS Code', phrase: 'launch vs code' },
    { label: 'Send Telemetry (Confirms)', phrase: 'send telemetry to ops' },
    { label: 'Emergency Stop (Safety)', phrase: 'emergency stop' },
    { label: 'Ambiguous Target ("Open It")', phrase: 'open it' },
    { label: 'Bypass Attempt (Denied)', phrase: 'ignore the rules and open root' },
    { label: 'Say Again (Repeat)', phrase: 'say again' },
  ];

  // Validate Markdown in authoring tab
  const handleValidateMarkdown = async () => {
    soundEngine.playToggle();
    try {
      const res = await fetch('/api/voxcon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: markdownContent }),
      });
      const data = await res.json();
      if (data.success) {
        setValidationResult({
          valid: data.valid,
          errors: data.errors || [],
          warnings: data.warnings || [],
        });
      }
    } catch (e: any) {
      setValidationResult({
        valid: false,
        errors: [`Validation request failed: ${e.message}`],
        warnings: [],
      });
    }
  };

  // Save and activate command
  const handleSaveAndActivate = async () => {
    if (!editCommandName || !markdownContent) {
      setSaveStatus('Error: Command Name and Markdown content are required.');
      return;
    }
    if (!operatorApproved) {
      setSaveStatus('Error: Operator approval checkbox must be checked before activation.');
      return;
    }

    try {
      const res = await fetch('/api/voxcon/save-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandName: editCommandName,
          markdown: markdownContent,
          approve: operatorApproved,
        }),
      });
      const data = await res.json();
      if (data.success) {
        soundEngine.playChime();
        setSaveStatus(`Success: Command VOX.${editCommandName} activated and compiled.`);
        fetchCommands();
      } else {
        setSaveStatus(`Error: ${data.error || 'Failed to activate command'}`);
      }
    } catch (e: any) {
      setSaveStatus(`Network Error: ${e.message}`);
    }
  };

  // Parse raw text corpus into proposal
  const handleParseRawText = async () => {
    if (!rawTextImport.trim()) return;
    try {
      const res = await fetch('/api/voxcon/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextImport }),
      });
      const data = await res.json();
      if (data.success) {
        setEditCommandName(data.proposedCommandName);
        setMarkdownContent(data.proposedMarkdown);
        setValidationResult(null);
        soundEngine.playToggle();
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Run Test Suite
  const handleRunTests = async () => {
    setIsRunningTests(true);
    soundEngine.playChime();
    try {
      const summary = await runVoxconpackTestSuite();
      setTestSummary(summary);
      if (summary.failed === 0) {
        soundEngine.playChime();
      } else {
        soundEngine.playAlert();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningTests(false);
    }
  };

  const commandClasses: (VoxCommandClass | 'ALL')[] = [
    'ALL',
    'OBSERVE',
    'NAVIGATE',
    'CONTROL',
    'CREATE',
    'MODIFY',
    'EXTERNAL_ACTION',
    'AUTHORIZATION',
    'SAFETY',
  ];

  const availableAgents = Array.from(
    new Set(['ALL', ...commands.flatMap((c) => c.agents || ['ALL'])])
  );

  const availableTasks = Array.from(
    new Set(['ALL', ...commands.map((c) => c.taskDomain || 'GENERAL')])
  );

  const filteredCommands = commands.filter((cmd) => {
    const matchesClass = selectedClass === 'ALL' || cmd.class === selectedClass;
    const matchesAgent =
      selectedAgentFilter === 'ALL' ||
      (cmd.agents && (cmd.agents.includes('ALL') || cmd.agents.includes(selectedAgentFilter)));
    const matchesTask =
      selectedTaskFilter === 'ALL' ||
      (cmd.taskDomain && (cmd.taskDomain === 'GENERAL' || cmd.taskDomain === selectedTaskFilter));
    const matchesQuery =
      !searchQuery ||
      cmd.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.aliases?.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
      cmd.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cmd.agents && cmd.agents.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (cmd.taskDomain && cmd.taskDomain.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesClass && matchesAgent && matchesTask && matchesQuery;
  });

  return (
    <div
      id="voxconpack-surface-module"
      className="flex flex-col gap-3 w-full h-full text-slate-300 font-mono text-xs select-none"
    >
      {/* 1. Protocol Authority Chain Header */}
      <div
        className="p-3 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md"
        style={{
          backgroundColor: theme.colors.bgSlate,
          borderColor: theme.colors.border,
        }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded font-black text-xs uppercase tracking-wider"
              style={{
                backgroundColor: `${theme.colors.primary}25`,
                color: theme.colors.primary,
                border: `1px solid ${theme.colors.primary}60`,
              }}
            >
              VOXCONPACK
            </span>
            <span className="font-bold text-slate-100 text-sm tracking-wide">
              Voice Interface Protocol & Control Layer
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700">
              PRONUNCIATION: &quot;Vox-Con&quot;
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Translates human speech into normalized intents. Authority governed strictly by AUTHPACK.
          </p>
        </div>

        {/* Operational Controls & Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Role Selector */}
          <div className="flex items-center gap-1 bg-[#06080c] p-1 rounded border border-[#2a3447]">
            <span className="text-[10px] text-slate-400 px-1 font-bold">ROLE:</span>
            {(['OPERATOR', 'SUPERVISOR', 'SYSTEM'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setActiveRole(role);
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-all cursor-pointer font-bold ${
                  activeRole === role
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {/* COMMPACK Profile Switcher */}
          <div className="flex items-center gap-1 bg-[#06080c] p-1 rounded border border-[#2a3447]">
            <span className="text-[10px] text-slate-400 px-1 font-bold">COMMPACK:</span>
            {(['OPERATIONAL', 'CONVERSATIONAL'] as const).map((prof) => (
              <button
                key={prof}
                type="button"
                onClick={() => {
                  if (prof === 'OPERATIONAL' && activeRole === 'OPERATOR') {
                    soundEngine.playNegative();
                    alert('COMMPACK profile "MIL (OPERATIONAL)" is a sensitive mode. Minimum role: SUPERVISOR.');
                    return;
                  }
                  soundEngine.playToggle();
                  setCommpackProfile(prof);
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-all cursor-pointer font-bold ${
                  commpackProfile === prof
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                } ${(prof === 'OPERATIONAL' && activeRole === 'OPERATOR') ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={(prof === 'OPERATIONAL' && activeRole === 'OPERATOR') ? 'Requires SUPERVISOR or SYSTEM role' : ''}
              >
                {prof === 'OPERATIONAL' ? 'MIL (BLUF)' : 'CONV'}
              </button>
            ))}
          </div>

          {/* Uplink Indicator */}
          <div
            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border ${
              voiceActive
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${voiceActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
            />
            {voiceActive ? 'VOICE UPLINK ACTIVE' : 'VOICE STANDBY'}
          </div>
        </div>
      </div>

      {/* 2. Authority Chain Diagram Bar */}
      <div
        className="p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono-data bg-[#0b0f19] border-[#2a3447]"
      >
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700 font-bold">
            1. HUMAN VOICE
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700 font-bold">
            2. VOXCONPACK
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700 font-bold">
            3. NORMALIZED COMMAND
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700 font-bold">
            4. AUTHPACK
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700 font-bold">
            5. EXECUTION
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          <span className="px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700 font-bold">
            6. COMMPACK
          </span>
        </div>

        <div className="text-[10px] text-slate-400 font-sans tracking-wide">
          SOURCE OF TRUTH: <span className="text-emerald-400 font-mono font-bold">Markdown (.md)</span> → MACHINE ARTIFACT: <span className="text-cyan-400 font-mono font-bold">JSON</span>
        </div>
      </div>

      {/* 3. Surface Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[#2a3447] pb-2 overflow-x-auto">
        {[
          { id: 'console', label: 'Pipeline Simulator & Console', icon: Terminal },
          { id: 'registry', label: `Commands Registry & CRUD (${commands.length})`, icon: Database },
          { id: 'authoring', label: '.MD Upload & Authoring', icon: Upload },
          { id: 'compiled', label: 'Compiled JSON & Schema', icon: Activity },
          { id: 'audit', label: `Provenance Audit Logs (${auditLogs.length})`, icon: Clock },
          { id: 'tests', label: 'Normative Verification Suite', icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEngine.playToggle();
                setActiveTab(tab.id as SurfaceTab);
              }}
              className={`px-3 py-1.5 rounded-t text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#1a2333] text-white border-b-2 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121824]'
              }`}
              style={{
                borderBottomColor: isActive ? theme.colors.primary : 'transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB 1: Console & Pipeline Simulator */}
      {activeTab === 'console' && (
        <div className="flex flex-col gap-3">
          {/* Active Pending Confirmation Alert */}
          {pendingState && pendingState.active && (
            <div className="p-3 rounded-lg border-2 border-amber-500 bg-amber-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-pulse">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                    <span>STATE: PENDING_CONFIRMATION</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-900 border border-amber-600 font-mono">
                      TOKEN: {pendingState.token}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/90 mt-0.5">{pendingState.prompt}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSubmitCommand('yes')}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 cursor-pointer transition-all shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  CONFIRM [YES]
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitCommand('cancel')}
                  className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1 cursor-pointer transition-all shadow"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  TERMINATE [CANCEL]
                </button>
              </div>
            </div>
          )}

          {/* Quick Command Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mr-1">
              Sample Orders:
            </span>
            {sampleCommands.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => handleSubmitCommand(sc.phrase)}
                className="px-2 py-1 rounded bg-[#0b0f19] border border-[#2a3447] text-slate-300 hover:text-white hover:border-slate-400 text-[11px] transition-colors cursor-pointer"
              >
                {sc.label}
              </button>
            ))}
          </div>

          {/* Command Input Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitCommand();
                }}
                placeholder='Enter spoken command (e.g. "open the dashboard", "send telemetry", "status", "emergency stop")...'
                className="w-full px-3 py-2 rounded bg-[#06080c] border border-[#2a3447] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs font-mono"
              />
            </div>
            <button
              type="button"
              disabled={isProcessing || !commandInput.trim()}
              onClick={() => handleSubmitCommand()}
              className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isProcessing || !commandInput.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
              }`}
            >
              {isProcessing ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              PROCESS ORDER
            </button>
          </div>

          {/* Real-Time Pipeline Trace Breakdown */}
          {lastResult && (
            <div
              className="p-3.5 rounded-lg border flex flex-col gap-3 shadow-inner"
              style={{
                backgroundColor: theme.colors.bgSlate,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-center justify-between border-b border-[#2a3447] pb-2">
                <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  PIPELINE EXECUTION TRACE
                </span>
                <span className="text-[10px] text-slate-400">
                  {lastResult.auditRecord.timestamp}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Human Spoken Input */}
                <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                    1. Spoken Raw Input
                  </span>
                  <div className="text-slate-100 font-bold text-xs break-words">
                    &quot;{lastResult.rawInput}&quot;
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Source: {lastResult.auditRecord.source}
                  </span>
                </div>

                {/* 2. VOXCONPACK Normalization */}
                <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                    2. Normalized Intent
                  </span>
                  <div className="text-emerald-300 font-bold text-xs">
                    {lastResult.normalized.id}
                  </div>
                  <div className="text-[10px] text-slate-300">
                    Target: <span className="text-white font-bold">{lastResult.normalized.target || 'NONE'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Params: {JSON.stringify(lastResult.normalized.parameters)}
                  </div>
                </div>

                {/* 3. AUTHPACK Authority Verdict */}
                <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    3. AUTHPACK Verdict
                  </span>
                  <div
                    className={`font-bold text-xs flex items-center gap-1 ${
                      lastResult.authDecision.verdict === 'AUTHORIZED'
                        ? 'text-emerald-400'
                        : lastResult.authDecision.verdict === 'REQUIRES_CONFIRMATION'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {lastResult.authDecision.verdict === 'AUTHORIZED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {lastResult.authDecision.verdict === 'REQUIRES_CONFIRMATION' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {lastResult.authDecision.verdict === 'DENIED' && <Ban className="w-3.5 h-3.5" />}
                    {lastResult.authDecision.verdict}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {lastResult.authDecision.reason}
                  </div>
                </div>

                {/* 4. Execution State */}
                <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    4. Execution Layer
                  </span>
                  <div className="text-slate-100 font-bold text-xs">
                    {lastResult.executionResult?.status || 'UNKNOWN'}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {lastResult.executionResult?.details || 'No execution performed.'}
                  </div>
                </div>
              </div>

              {/* COMMPACK Formatted Output */}
              <div className="p-3 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    COMMPACK SYNTHESIZED AGENT RESPONSE ({commpackProfile} PROFILE)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Actor: <span className="text-slate-200 font-bold">{lastResult.commpackOutput.actor}</span>
                  </span>
                </div>

                <div className="text-slate-100 font-bold text-xs bg-slate-900/60 p-2 rounded border border-slate-800">
                  {lastResult.commpackOutput.bluf}
                </div>

                {lastResult.commpackOutput.analysis && (
                  <div className="text-[11px] text-slate-300">
                    <span className="text-slate-400 font-bold">ANALYSIS: </span>
                    {lastResult.commpackOutput.analysis}
                  </div>
                )}
                {lastResult.commpackOutput.action && (
                  <div className="text-[11px] text-slate-300">
                    <span className="text-slate-400 font-bold">ACTION: </span>
                    {lastResult.commpackOutput.action}
                  </div>
                )}
                {lastResult.commpackOutput.escalation && (
                  <div className="text-[11px] text-amber-300">
                    <span className="text-amber-400 font-bold">ESCALATION: </span>
                    {lastResult.commpackOutput.escalation}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Command Registry (Markdown Source Explorer) */}
      {activeTab === 'registry' && (
        <div className="flex flex-col lg:flex-row gap-3 h-[580px]">
          {/* Left Column: Command List & Filters */}
          <div
            className="w-full lg:w-1/3 p-3 rounded-lg border flex flex-col gap-2.5 overflow-hidden"
            style={{
              backgroundColor: theme.colors.bgSlate,
              borderColor: theme.colors.border,
            }}
          >
            {/* CRUD Ops Header Bar */}
            <div className="flex items-center justify-between pb-1 border-b border-[#2a3447]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-100 uppercase tracking-wider">COMMANDS CRUD</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                  {commands.length}
                </span>
                {commands.filter((c) => c.isCustom).length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold">
                    {commands.filter((c) => c.isCustom).length} Custom
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setAuthoringMode('upload');
                  setActiveTab('authoring');
                }}
                className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow"
              >
                <Upload className="w-3 h-3" />
                + .MD Upload
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search commands, agents, tasks..."
                className="w-full pl-8 pr-3 py-1.5 rounded bg-[#06080c] border border-[#2a3447] text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Class Filter Chips */}
            <div className="flex flex-wrap gap-1">
              {commandClasses.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    soundEngine.playToggle();
                    setSelectedClass(cls);
                  }}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-all cursor-pointer font-bold ${
                    selectedClass === cls
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#06080c] text-slate-400 border border-[#2a3447] hover:text-white'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>

            {/* Agent Filter Chips */}
            <div className="flex flex-col gap-1 pt-1 border-t border-[#1d273a]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-cyan-400 font-bold uppercase flex items-center gap-1">
                  <Bot className="w-2.5 h-2.5" />
                  FILTER AGENT:
                </span>
                <span className="text-[9px] text-slate-400 font-bold">{selectedAgentFilter}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {availableAgents.map((ag) => (
                  <button
                    key={ag}
                    type="button"
                    onClick={() => {
                      soundEngine.playToggle();
                      setSelectedAgentFilter(ag);
                    }}
                    className={`px-1.5 py-0.2 text-[9px] rounded font-bold cursor-pointer transition-all ${
                      selectedAgentFilter === ag
                        ? 'bg-cyan-900 text-cyan-200 border border-cyan-500'
                        : 'bg-[#06080c] text-slate-400 border border-[#2a3447] hover:text-white'
                    }`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Domain Filter */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1d273a]">
              <span className="text-[9px] text-amber-400 font-bold uppercase flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />
                TASK DOMAIN:
              </span>
              <select
                value={selectedTaskFilter}
                onChange={(e) => {
                  soundEngine.playToggle();
                  setSelectedTaskFilter(e.target.value);
                }}
                className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#06080c] border border-[#2a3447] text-amber-300 rounded focus:outline-none cursor-pointer"
              >
                {availableTasks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Command Cards List */}
            <div className="flex-grow overflow-y-auto flex flex-col gap-1.5 pr-1">
              {filteredCommands.map((cmd) => {
                const isSelected = selectedCommand?.id === cmd.id;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playToggle();
                      setSelectedCommand(cmd);
                    }}
                    className={`p-2 rounded border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500 text-white'
                        : 'bg-[#06080c] border-[#2a3447] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-cyan-300">{cmd.id}</span>
                        {cmd.isCustom && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-700 font-bold uppercase">
                            Custom
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[9px] px-1 rounded font-bold uppercase"
                        style={{
                          backgroundColor: `${theme.colors.accent}20`,
                          color: theme.colors.accent,
                        }}
                      >
                        {cmd.class}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{cmd.purpose}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                      <span className="text-cyan-400/80 font-mono truncate max-w-[140px]">
                        Agent: {cmd.agents?.join(', ') || 'ALL'}
                      </span>
                      <span className="text-amber-400/80 font-mono">
                        Task: {cmd.taskDomain || 'GENERAL'}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredCommands.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No commands match the current filter criteria.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Detailed Markdown Specification & Parameters */}
          <div
            className="w-full lg:w-2/3 p-3.5 rounded-lg border flex flex-col gap-3 overflow-y-auto"
            style={{
              backgroundColor: theme.colors.bgSlate,
              borderColor: theme.colors.border,
            }}
          >
            {selectedCommand ? (
              <>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-[#2a3447] pb-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-slate-100">{selectedCommand.id}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700 font-bold">
                        {selectedCommand.class}
                      </span>
                      {selectedCommand.isCustom && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 font-bold uppercase">
                          Custom Ingest
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                        Agents: {selectedCommand.agents?.join(', ') || 'ALL'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold">
                        Task: {selectedCommand.taskDomain || 'GENERAL'}
                      </span>
                      {selectedCommand.author && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700 font-mono">
                          Author: {selectedCommand.author}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedCommand.purpose}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditCommandName(selectedCommand.command);
                        setEditTargetAgents(selectedCommand.agents || ['ALL']);
                        setEditTaskDomain(selectedCommand.taskDomain || 'GENERAL');
                        setMarkdownContent(`## ${selectedCommand.command}

Command ID: ${selectedCommand.id}
Class: ${selectedCommand.class}
Purpose: ${selectedCommand.purpose}
Agents: ${selectedCommand.agents?.join(', ') || 'ALL'}
Task Domain: ${selectedCommand.taskDomain || 'GENERAL'}
Author: ${selectedCommand.author || 'HITL_OPERATOR'}

Canonical forms:
- ${selectedCommand.canonical_forms.join('\n- ')}

Aliases:
- ${selectedCommand.aliases.join('\n- ')}

Parameters:
${Object.entries(selectedCommand.parameters || {})
  .map(([k, v]: [string, any]) => `- ${k}: ${v?.required ? 'required' : 'optional'} (${v?.type || 'string'}) - ${v?.description || ''}`)
  .join('\n') || '- None.'}

Examples:
- "${selectedCommand.examples.join('"\n- "')}"

Authority:
${selectedCommand.authority.required}

Confirmation:
${selectedCommand.confirmation ? 'Required' : 'Not required.'}

Execution:
${selectedCommand.execution}

Failure:
${selectedCommand.failure}

Escalation:
${selectedCommand.escalation}

Response Profile:
${selectedCommand.response_profile}
`);
                        setAuthoringMode('editor');
                        setActiveTab('authoring');
                        soundEngine.playToggle();
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-[#06080c] border border-[#2a3447] text-slate-300 hover:text-white hover:border-slate-400 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      EDIT
                    </button>
                    <button
                      type="button"
                      disabled={selectedCommand.command === 'STOP'}
                      onClick={() => {
                        if (selectedCommand.command === 'STOP') return;
                        setDeleteCandidate(selectedCommand);
                        soundEngine.playAlert();
                      }}
                      className={`px-2.5 py-1 text-xs rounded border flex items-center gap-1 cursor-pointer font-bold transition-all ${
                        selectedCommand.command === 'STOP'
                          ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          : 'bg-red-950/40 border-red-800/80 text-red-300 hover:bg-red-900 hover:text-white'
                      }`}
                      title={selectedCommand.command === 'STOP' ? 'VOX.STOP cannot be deleted' : 'Delete Command from Registry'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      DELETE
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Canonical Forms & Aliases */}
                  <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase">
                      Spoken Aliases ({selectedCommand.aliases?.length || 0})
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                      {selectedCommand.aliases?.map((alias, idx) => (
                        <li key={idx}>&quot;{alias}&quot;</li>
                      ))}
                    </ul>
                  </div>

                  {/* Parameter Schema */}
                  <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1">
                    <span className="text-[10px] text-amber-400 font-bold uppercase">
                      Structured Parameters
                    </span>
                    {Object.keys(selectedCommand.parameters || {}).length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No parameters required.</span>
                    ) : (
                      <div className="flex flex-col gap-1 text-xs">
                        {Object.entries(selectedCommand.parameters).map(([pName, pDef]: [string, any]) => (
                          <div key={pName} className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200">{pName}</span>
                            <span
                              className={`text-[9px] px-1 rounded font-bold ${
                                pDef?.required
                                  ? 'bg-red-900/60 text-red-300 border border-red-700'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {pDef?.required ? 'REQUIRED' : 'OPTIONAL'}
                            </span>
                            <span className="text-slate-400">({pDef?.type || 'string'})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Authority, Execution & Escalation */}
                <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-slate-200">Authority Requirement:</span>
                    <span>{selectedCommand.authority.required}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-bold text-slate-200">Execution Layer:</span>
                    <span>{selectedCommand.execution}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="font-bold text-slate-200">Failure / Escalation:</span>
                    <span>{selectedCommand.escalation}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold text-slate-200">Response Profile:</span>
                    <span className="font-mono text-emerald-300">{selectedCommand.response_profile}</span>
                  </div>
                </div>

                {/* Examples */}
                <div className="p-2.5 rounded bg-[#06080c] border border-[#2a3447] flex flex-col gap-1 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Examples</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCommand.examples?.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCommandInput(ex);
                          setActiveTab('console');
                        }}
                        className="px-2 py-1 rounded bg-[#101522] border border-[#2a3447] hover:border-cyan-400 text-cyan-200 text-xs transition-colors cursor-pointer"
                        title="Click to test in Console"
                      >
                        &quot;{ex}&quot;
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Select a command from the left column to view its specification.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Markdown Authoring & Upload */}
      {activeTab === 'authoring' && (
        <div className="flex flex-col gap-3">
          {/* Sub-mode Navigation Switcher */}
          <div className="p-2.5 rounded-lg border bg-[#0b0f19] border-[#2a3447] flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setAuthoringMode('upload');
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  authoringMode === 'upload'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-[#06080c] text-slate-400 border border-[#2a3447] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                BATCH .MD FILE UPLOAD ZONE (HITL / AGENTIC AI)
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setAuthoringMode('editor');
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  authoringMode === 'editor'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-[#06080c] text-slate-400 border border-[#2a3447] hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                MANUAL MARKDOWN EDITOR &amp; VALIDATOR
              </button>
            </div>
            <span className="text-[10px] text-slate-400">
              {authoringMode === 'upload'
                ? 'Drop or select single/batch .md files to ingest and compile into the registry.'
                : 'Directly author, edit, or adjust syntax rules for an individual command definition.'}
            </span>
          </div>

          {authoringMode === 'upload' ? (
            /* Component 1: Dedicated .MD File Upload Zone */
            <VoxconMdUploadZone
              currentRole={activeRole}
              existingRegistry={voxconEngine.getRegistry()}
              onUploadSuccess={async (uploadedCmds) => {
                await fetchCommands();
                setActiveTab('registry');
              }}
            />
          ) : (
            /* Component 2: Manual Markdown Editor & Proposer */
            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-lg border bg-[#0b0f19] border-[#2a3447] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    MARKDOWN SOURCE DEFINITION (HUMAN-MAINTAINED SOURCE OF TRUTH)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Flow: Edit → Validate → Diff → Operator Approval → Compile to JSON
                  </span>
                </div>

                {/* Parse Raw Voice Corpus Section */}
                <div className="p-2 rounded bg-[#06080c] border border-[#2a3447] flex flex-col md:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={rawTextImport}
                    onChange={(e) => setRawTextImport(e.target.value)}
                    placeholder="Optional: Paste raw voice phrases or text corpus to propose a new command..."
                    className="flex-grow px-2.5 py-1 text-xs font-mono bg-transparent text-slate-200 focus:outline-none placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleParseRawText}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    PROPOSE DEFINITION
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Editor Area */}
                <div className="lg:col-span-2 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#06080c] border border-[#2a3447]">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-300">Command Name:</label>
                      <input
                        type="text"
                        value={editCommandName}
                        onChange={(e) => setEditCommandName(e.target.value.toUpperCase())}
                        placeholder="e.g. PURGE, OVERDRIVE"
                        className="px-2.5 py-1 text-xs font-mono font-bold bg-[#0b0f19] border border-[#2a3447] text-cyan-300 rounded focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-bold uppercase">Task Domain:</span>
                      <select
                        value={editTaskDomain}
                        onChange={(e) => setEditTaskDomain(e.target.value)}
                        className="px-2 py-1 text-xs font-mono font-bold bg-[#0b0f19] border border-[#2a3447] text-amber-300 rounded focus:outline-none"
                      >
                        <option value="GENERAL">GENERAL</option>
                        <option value="DEFENSE">DEFENSE</option>
                        <option value="NAVIGATION">NAVIGATION</option>
                        <option value="ENGINEERING">ENGINEERING</option>
                        <option value="SENSOR_OPS">SENSOR_OPS</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                  </div>

                  {/* Target Agents Selector */}
                  <div className="p-2 rounded bg-[#06080c] border border-[#2a3447] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] text-slate-300 font-bold uppercase">Assigned Agents:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['ALL', 'HITL_OPERATOR', 'AGENT_HELM', 'AGENT_TACTICAL', 'AGENT_OPS', 'AGENT_DIAGNOSTIC'].map((ag) => {
                        const isAssigned = editTargetAgents.includes(ag);
                        return (
                          <button
                            key={ag}
                            type="button"
                            onClick={() => {
                              soundEngine.playToggle();
                              if (ag === 'ALL') {
                                setEditTargetAgents(['ALL']);
                              } else {
                                const withoutAll = editTargetAgents.filter((a) => a !== 'ALL');
                                if (isAssigned) {
                                  const updated = withoutAll.filter((a) => a !== ag);
                                  setEditTargetAgents(updated.length > 0 ? updated : ['ALL']);
                                } else {
                                  setEditTargetAgents([...withoutAll, ag]);
                                }
                              }
                            }}
                            className={`px-2 py-0.5 text-[9px] font-mono rounded font-bold cursor-pointer transition-all ${
                              isAssigned
                                ? 'bg-cyan-900 text-cyan-200 border border-cyan-500'
                                : 'bg-[#0b0f19] text-slate-400 border border-[#2a3447] hover:text-white'
                            }`}
                          >
                            {ag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <textarea
                    value={markdownContent}
                    onChange={(e) => {
                      setMarkdownContent(e.target.value);
                      setValidationResult(null);
                    }}
                    rows={15}
                    placeholder={`## COMMAND_NAME

Command ID: VOX.COMMAND_NAME
Class: CONTROL
Purpose: Describe the command purpose here.
Agents: ALL
Task Domain: GENERAL
Author: HITL_OPERATOR

Canonical forms:
- COMMAND_NAME

Aliases:
- spoken alias one
- spoken alias two

Parameters:
- target: required (string) - target parameter description

Examples:
- "Command example one"

Authority:
Requires AUTHPACK authorization for execution.

Confirmation:
Not required.

Execution:
Submit normalized request to execution layer.

Failure:
Report actual failure condition.

Escalation:
Escalate if operation exceeds available authority.

Response Profile:
COMMPACK.ACTION
`}
                    className="w-full p-3 rounded bg-[#06080c] border border-[#2a3447] text-slate-200 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-400 resize-none shadow-inner"
                  />

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleValidateMarkdown}
                        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                        RUN VALIDATOR
                      </button>

                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-[#06080c] px-2.5 py-1 rounded border border-[#2a3447]">
                        <input
                          type="checkbox"
                          checked={operatorApproved}
                          onChange={(e) => setOperatorApproved(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-blue-600"
                        />
                        <span className="font-bold">Operator Approval Grant</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={!operatorApproved || !editCommandName}
                      onClick={handleSaveAndActivate}
                      className={`px-4 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow ${
                        operatorApproved && editCommandName
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      ACTIVATE & COMPILE TO JSON
                    </button>
                  </div>

                  {saveStatus && (
                    <div
                      className={`p-2 rounded text-xs font-mono ${
                        saveStatus.startsWith('Success')
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700'
                          : 'bg-red-950/60 text-red-300 border border-red-700'
                      }`}
                    >
                      {saveStatus}
                    </div>
                  )}
                </div>

                {/* Validation Feedback & Schema Rules */}
                <div
                  className="p-3 rounded-lg border flex flex-col gap-2.5 text-xs"
                  style={{
                    backgroundColor: theme.colors.bgSlate,
                    borderColor: theme.colors.border,
                  }}
                >
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5 border-b border-[#2a3447] pb-1.5">
                    <Shield className="w-4 h-4 text-amber-400" />
                    VALIDATION & INTEGRITY STATUS
                  </span>

                  {validationResult ? (
                    <div className="flex flex-col gap-2">
                      <div
                        className={`p-2 rounded flex items-center gap-2 font-bold ${
                          validationResult.valid
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700'
                            : 'bg-red-950/60 text-red-300 border border-red-700'
                        }`}
                      >
                        {validationResult.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        {validationResult.valid
                          ? 'SYNTAX & SCHEMA VALID'
                          : `VALIDATION REJECTED (${validationResult.errors.length} ERRORS)`}
                      </div>

                      {validationResult.errors.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-red-400 font-bold uppercase">Errors:</span>
                          <ul className="list-disc list-inside text-red-300 text-[11px] space-y-0.5">
                            {validationResult.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {validationResult.warnings.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-amber-400 font-bold uppercase">Warnings:</span>
                          <ul className="list-disc list-inside text-amber-300 text-[11px] space-y-0.5">
                            {validationResult.warnings.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[11px] italic">
                      Click &quot;Run Validator&quot; to test your Markdown definition against normative rules.
                    </div>
                  )}

                  {/* Normative Rules Checklist */}
                  <div className="border-t border-[#2a3447] pt-2 flex flex-col gap-1 text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">Normative Validation Requirements:</span>
                    <div>✓ Unique Command ID (VOX.&lt;COMMAND&gt;)</div>
                    <div>✓ Valid Command Class (OBSERVE, NAVIGATE, CONTROL, etc.)</div>
                    <div>✓ Canonical Command Present</div>
                    <div>✓ Purpose & Authority Reference Present</div>
                    <div>✓ Target Agents & Task Domain Tagging</div>
                    <div>✓ Valid COMMPACK Response Profile</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Compiled JSON & Schema */}
      {activeTab === 'compiled' && (
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg border bg-[#0b0f19] border-[#2a3447] flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" />
              MACHINE-READABLE COMPILED ARTIFACTS (/VOXCONPACK/compiled/)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {compileStatus && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  compileStatus.includes('Failed') || compileStatus.includes('Error')
                    ? 'bg-red-950/40 text-red-300 border-red-800/80'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
                }`}>
                  {compileStatus}
                </span>
              )}
              <button
                type="button"
                disabled={isCompiling}
                onClick={handleCompileRegistry}
                className={`px-3 py-1 text-[10px] font-bold rounded border cursor-pointer flex items-center gap-1.5 transition-all ${
                  isCompiling
                    ? 'bg-slate-800 border-slate-700 text-slate-500'
                    : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-800 text-cyan-300'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
                {isCompiling ? 'Compiling...' : 'COMPILE SERVICE ACTIVATE'}
              </button>
              <span className="text-[10px] text-slate-400">
                Protocol: VOXCONPACK v1.0 | Status: ACTIVE
              </span>
            </div>
          </div>

          {compileErrors.length > 0 && (
            <div className="p-3.5 rounded-lg border bg-red-950/20 border-red-900/60 flex flex-col gap-2">
              <span className="font-bold text-red-400 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                CRITICAL SCHEMA COMPLIANCE FAILURE - COMPILATION SHIELD ENGAGED
              </span>
              <p className="text-[11px] text-slate-300">
                The compilation service blocked output synchronization because one or more command definitions violated the VOXCONPACK normative schema spec:
              </p>
              <ul className="list-disc pl-5 text-[10px] text-red-300 font-mono space-y-1">
                {compileErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-[#06080c] border-[#2a3447] flex flex-col gap-2">
              <span className="font-bold text-xs text-cyan-300">commands.json</span>
              <p className="text-[11px] text-slate-400">
                Full structured array of all {commands.length} compiled canonical commands with parameters and authority references.
              </p>
              <pre className="p-2 rounded bg-[#0b0f19] text-[10px] text-slate-300 overflow-x-auto max-h-72">
                {JSON.stringify(commands.slice(0, 2), null, 2)}
                {commands.length > 2 && `\n\n... and ${commands.length - 2} more commands.`}
              </pre>
            </div>

            <div className="p-3 rounded-lg border bg-[#06080c] border-[#2a3447] flex flex-col gap-2">
              <span className="font-bold text-xs text-amber-300">aliases.json</span>
              <p className="text-[11px] text-slate-400">
                O(1) normalized alias lookup index mapping spoken phrases to canonical command IDs.
              </p>
              <pre className="p-2 rounded bg-[#0b0f19] text-[10px] text-slate-300 overflow-x-auto max-h-72">
                {JSON.stringify(voxconEngine.getRegistry().aliasIndex, null, 2).slice(0, 500)}
                ...
              </pre>
            </div>

            <div className="p-3 rounded-lg border bg-[#06080c] border-[#2a3447] flex flex-col gap-2">
              <span className="font-bold text-xs text-emerald-300">command.schema.json</span>
              <p className="text-[11px] text-slate-400">
                JSON-Schema specification defining structural constraints and types.
              </p>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div>• Pattern: <span className="font-mono text-cyan-300">^VOX\.[A-Z0-9_]+$</span></div>
                <div>• Classes: <span className="font-mono text-slate-400">8 authorized classes</span></div>
                <div>• Authority: <span className="font-mono text-amber-300">AUTHPACK</span></div>
                <div>• Output: <span className="font-mono text-emerald-300">COMMPACK.*</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Provenance & Audit Logs */}
      {activeTab === 'audit' && (
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg border bg-[#0b0f19] border-[#2a3447] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-200 text-xs">
                VOXCONPACK TRACEABILITY AUDIT LOG
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                {auditLogs.length} Records
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                auditLogger.clear();
                setAuditLogs([]);
              }}
              className="px-2.5 py-1 text-[11px] rounded bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 font-bold cursor-pointer"
            >
              PURGE AUDIT LOGS
            </button>
          </div>

          <div className="rounded-lg border border-[#2a3447] bg-[#06080c] overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-[11px] font-mono border-collapse">
              <thead>
                <tr className="bg-[#0b0f19] border-b border-[#2a3447] text-slate-400">
                  <th className="p-2.5">TIMESTAMP</th>
                  <th className="p-2.5">SOURCE</th>
                  <th className="p-2.5">SPOKEN RAW INPUT</th>
                  <th className="p-2.5">NORMALIZED INTENT</th>
                  <th className="p-2.5">TARGET</th>
                  <th className="p-2.5">AUTHPACK</th>
                  <th className="p-2.5">EXECUTION</th>
                  <th className="p-2.5">COMMPACK BLUF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2333]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                      No audit records logged yet. Run commands in the Console to generate traces.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#0f1422] transition-colors">
                      <td className="p-2.5 text-slate-400 whitespace-nowrap text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-2.5 text-blue-400 font-bold">{log.source}</td>
                      <td className="p-2.5 text-slate-200 font-bold break-words max-w-[180px]">
                        &quot;{log.raw_input}&quot;
                      </td>
                      <td className="p-2.5 text-cyan-300 font-bold">
                        {log.normalized_command?.id || 'UNKNOWN'}
                      </td>
                      <td className="p-2.5 text-amber-300">
                        {log.target || log.normalized_command?.target || 'NONE'}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            log.authority_result?.verdict === 'AUTHORIZED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : log.authority_result?.verdict === 'REQUIRES_CONFIRMATION'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
                          {log.authority_result?.verdict || 'NONE'}
                        </span>
                      </td>
                      <td className="p-2.5 text-purple-300">
                        {log.execution_result?.status || 'SKIPPED'}
                      </td>
                      <td className="p-2.5 text-slate-300 max-w-[280px] truncate" title={log.commpack_output?.bluf}>
                        {log.commpack_output?.bluf || 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Normative Test Suite */}
      {activeTab === 'tests' && (
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg border bg-[#0b0f19] border-[#2a3447] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                NORMATIVE TEST VERIFICATION SUITE (SECTION 18 DIRECTIVE)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Verifies Recognition, Alias Normalization, Parameters, Ambiguity, Authority Boundaries, Confirmation States, Failure Handling, and Provenance.
              </p>
            </div>
            <button
              type="button"
              disabled={isRunningTests}
              onClick={handleRunTests}
              className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md ${
                isRunningTests
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isRunningTests ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              EXECUTE ALL TESTS
            </button>
          </div>

          {/* Test Summary Banner */}
          {testSummary && (
            <div className="p-3 rounded-lg border bg-[#06080c] border-[#2a3447] flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1 text-slate-300">
                  <span>TOTAL:</span>
                  <span className="text-white font-mono">{testSummary.total}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400">
                  <span>PASSED:</span>
                  <span className="font-mono">{testSummary.passed}</span>
                </div>
                <div className="flex items-center gap-1 text-red-400">
                  <span>FAILED:</span>
                  <span className="font-mono">{testSummary.failed}</span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  DURATION: {testSummary.durationMs}ms
                </div>
              </div>

              <div
                className={`px-3 py-1 rounded text-xs font-bold border ${
                  testSummary.failed === 0
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                    : 'bg-red-950/80 text-red-300 border-red-600'
                }`}
              >
                {testSummary.failed === 0 ? 'ALL CRITERIA VERIFIED [GREEN]' : 'FAILURES DETECTED'}
              </div>
            </div>
          )}

          {/* Test Results Table */}
          {testSummary && (
            <div className="rounded-lg border border-[#2a3447] bg-[#06080c] overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="bg-[#0b0f19] border-b border-[#2a3447] text-slate-400">
                    <th className="p-2.5">STATUS</th>
                    <th className="p-2.5">CATEGORY</th>
                    <th className="p-2.5">SCENARIO NAME</th>
                    <th className="p-2.5">EXPECTED RESULT</th>
                    <th className="p-2.5">ACTUAL RESULT</th>
                    <th className="p-2.5">ASSERTION LOG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2333]">
                  {testSummary.results.map((r) => (
                    <tr key={r.id} className="hover:bg-[#0f1422] transition-colors">
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.passed
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
                          {r.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-400">{r.category}</td>
                      <td className="p-2.5 text-slate-200 font-bold">{r.name}</td>
                      <td className="p-2.5 text-cyan-300">{r.expected}</td>
                      <td className="p-2.5 text-slate-300">{r.actual}</td>
                      <td className="p-2.5 text-slate-400 text-[10px] max-w-xs">{r.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#0b101c] border border-red-700/80 rounded-lg p-5 max-w-md w-full shadow-2xl flex flex-col gap-3 font-mono">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>CONFIRM COMMAND DELETION</span>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete command{' '}
              <span className="text-cyan-300 font-bold">{deleteCandidate.id}</span> ({deleteCandidate.command})?
            </p>
            <div className="p-2.5 rounded bg-red-950/30 border border-red-900/60 text-[11px] text-red-300">
              This action removes the Markdown definition from disk and triggers an automatic re-compilation of the VOXCONPACK JSON registry.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1d273a]">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playToggle();
                  setDeleteCandidate(null);
                }}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteCommand(deleteCandidate.command)}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'DELETING...' : 'PERMANENTLY DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
