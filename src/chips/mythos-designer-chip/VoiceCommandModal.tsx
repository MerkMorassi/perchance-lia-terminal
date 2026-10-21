import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  Terminal,
  Layers,
  Sparkles,
  HelpCircle,
  FileCode
} from 'lucide-react';
import { VoiceCommand } from '../../types/voice';
import { DEFAULT_VOICE_COMMANDS } from '../../data/defaultCommands';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: string;
  onCommandsUpdated?: () => void; // notify parent if commands list changed
}

const MODES_DISPLAY: Record<string, string> = {
  all: 'Global / All Modes',
  'ui-builder': 'UI Builder Mode',
  'token-inspector': 'Token Lab Mode',
  'ai-diagnostics': 'AI Diagnostics Mode',
  'voice-control': 'Voice Control Mode',
  'msd-view': 'MSD View Mode',
};

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  activeMode,
  onCommandsUpdated,
}) => {
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'current' | 'all'>('current');
  
  // Editor / Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<VoiceCommand | null>(null);
  
  // Form values
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMode, setFormMode] = useState('all');
  const [formArgs, setFormArgs] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formError, setFormError] = useState('');

  // Load commands from localStorage or fall back to default commands
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('voxcon-voice-commands');
      if (saved) {
        try {
          setCommands(JSON.parse(saved));
        } catch {
          setCommands(DEFAULT_VOICE_COMMANDS);
        }
      } else {
        setCommands(DEFAULT_VOICE_COMMANDS);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const saveCommandsToStorage = (updatedList: VoiceCommand[]) => {
    setCommands(updatedList);
    localStorage.setItem('voxcon-voice-commands', JSON.stringify(updatedList));
    if (onCommandsUpdated) {
      onCommandsUpdated();
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to restore all voice commands to default? Any custom voice commands will be deleted.')) {
      saveCommandsToStorage(DEFAULT_VOICE_COMMANDS);
      setSearchQuery('');
      setFilterMode('current');
      setIsFormOpen(false);
      setEditingCommand(null);
    }
  };

  const handleOpenAddForm = () => {
    setEditingCommand(null);
    setFormName('');
    setFormDesc('');
    setFormMode(activeMode || 'all');
    setFormArgs('');
    setFormExample('');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (cmd: VoiceCommand) => {
    setEditingCommand(cmd);
    setFormName(cmd.name);
    setFormDesc(cmd.description);
    setFormMode(cmd.mode);
    setFormArgs(cmd.args.join(', '));
    setFormExample(cmd.example);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleDeleteCommand = (id: string) => {
    if (window.confirm('Are you sure you want to delete this voice command?')) {
      const filtered = commands.filter((cmd) => cmd.id !== id);
      saveCommandsToStorage(filtered);
    }
  };

  const handleSaveCommand = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const normalizedName = formName.toLowerCase().trim().replace(/\s+/g, '_');
    
    if (!normalizedName) {
      setFormError('Command name is required.');
      return;
    }

    if (!formDesc.trim()) {
      setFormError('Command description is required.');
      return;
    }

    // Process arguments: comma-separated values to string array
    const processedArgs = formArgs
      .split(',')
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0);

    if (editingCommand) {
      // Edit mode
      const updatedList = commands.map((cmd) => {
        if (cmd.id === editingCommand.id) {
          return {
            ...cmd,
            name: normalizedName,
            description: formDesc.trim(),
            mode: formMode,
            args: processedArgs,
            example: formExample.trim(),
            isCustom: true,
          };
        }
        return cmd;
      });
      saveCommandsToStorage(updatedList);
    } else {
      // Create mode
      // Check if command name already exists
      const nameExists = commands.some((cmd) => cmd.name === normalizedName);
      if (nameExists) {
        setFormError(`A command named "${normalizedName}" already exists in the database.`);
        return;
      }

      const newCommand: VoiceCommand = {
        id: `cmd-${Date.now()}`,
        name: normalizedName,
        description: formDesc.trim(),
        mode: formMode,
        args: processedArgs,
        example: formExample.trim(),
        isCustom: true,
      };
      saveCommandsToStorage([...commands, newCommand]);
    }

    setIsFormOpen(false);
    setEditingCommand(null);
  };

  // Filter commands by search query and mode filter
  const filteredCommands = commands.filter((cmd) => {
    // 1. Mode Filter Check
    const matchesMode =
      filterMode === 'all' || cmd.mode === 'all' || cmd.mode === activeMode;

    if (!matchesMode) return false;

    // 2. Search Query Check
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.example.toLowerCase().includes(query) ||
      cmd.args.some((arg) => arg.toLowerCase().includes(query))
    );
  });

  return (
    <div
      id="voxcon-commands-modal-overlay"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="voxcon-commands-modal-container"
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-cyan-950/60 border border-cyan-800/80 text-cyan-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">
                VOXCON Tactical Command Database
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Sovereign operational directives mapping voice patterns to master actions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-800 border border-transparent hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Inner Layout (Main List vs Edit Form) */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-h-0">
          {isFormOpen ? (
            /* CRUD FORM: Create or Edit Command */
            <form onSubmit={handleSaveCommand} className="flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {editingCommand ? 'EDIT TACTICAL COMMAND' : 'REGISTER NEW VOICE COMMAND'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                >
                  BACK TO LIST
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-semibold">
                  ERROR: {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-cmd-name" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Command Name / Trigger Phrase *
                  </label>
                  <input
                    id="form-cmd-name"
                    type="text"
                    required
                    placeholder="e.g., engage_warp"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono font-medium focus:outline-hidden focus:border-cyan-500 text-cyan-300"
                    disabled={!!editingCommand && !editingCommand.isCustom}
                  />
                  <span className="text-[9px] text-slate-500">
                    Shorthand identifier lowercase, underscores instead of spaces. E.g. <code className="font-mono text-cyan-500/80">clear_logs</code>
                  </span>
                </div>

                {/* Target Mode */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-cmd-mode" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Application Module / Mode Context *
                  </label>
                  <select
                    id="form-cmd-mode"
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-medium focus:outline-hidden focus:border-cyan-500 text-slate-200 cursor-pointer"
                  >
                    {Object.entries(MODES_DISPLAY).map(([val, label]) => (
                      <option key={val} value={val} className="bg-slate-900">
                        {label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[9px] text-slate-500">
                    Defines if the command is general or specific to an active module.
                  </span>
                </div>

                {/* Arguments */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-cmd-args" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Required Arguments (comma-separated)
                  </label>
                  <input
                    id="form-cmd-args"
                    type="text"
                    placeholder="e.g., factor, targetId"
                    value={formArgs}
                    onChange={(e) => setFormArgs(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono focus:outline-hidden focus:border-cyan-500 text-slate-200"
                  />
                  <span className="text-[9px] text-slate-500">
                    Variables used during execution. Leave empty if no arguments are required.
                  </span>
                </div>

                {/* Example */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-cmd-example" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Phonetic Example Utterance
                  </label>
                  <input
                    id="form-cmd-example"
                    type="text"
                    placeholder="e.g., engage_warp factor=4"
                    value={formExample}
                    onChange={(e) => setFormExample(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs focus:outline-hidden focus:border-cyan-500 text-slate-300"
                  />
                  <span className="text-[9px] text-slate-500">
                    Spoken example to display in reference guide.
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="form-cmd-desc" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Operational Description / Function *
                </label>
                <textarea
                  id="form-cmd-desc"
                  required
                  rows={3}
                  placeholder="Describe the physical outcome when this command is vocally authorized..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs focus:outline-hidden focus:border-cyan-500 text-slate-200 resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 mt-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded text-xs font-semibold bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded text-xs font-semibold bg-cyan-600 border border-cyan-500 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  SAVE REGISTRATION
                </button>
              </div>
            </form>
          ) : (
            /* Main Voice Commands View */
            <>
              {/* Tool / Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search directives, triggers, parameters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md pl-9 pr-4 py-1.5 text-xs focus:outline-hidden focus:border-cyan-500 text-slate-200"
                  />
                </div>

                {/* Filter and Actions Row */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Mode Selector Toggle */}
                  <div className="flex p-0.5 roundedbg-slate-900 border border-slate-800">
                    <button
                      onClick={() => setFilterMode('current')}
                      className={`px-3 py-1 text-xs font-bold tracking-wider rounded uppercase transition-all cursor-pointer ${
                        filterMode === 'current'
                          ? 'bg-cyan-950/40 border border-cyan-800/70 text-cyan-300'
                          : 'bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                      title={`Show commands specific to active ${MODES_DISPLAY[activeMode] || activeMode}`}
                    >
                      CURRENT ({MODES_DISPLAY[activeMode]?.split(' ')[0] || activeMode})
                    </button>
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-3 py-1 text-xs font-bold tracking-wider rounded uppercase transition-all cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-cyan-950/40 border border-cyan-800/70 text-cyan-300'
                          : 'bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                      title="Show all registered commands in database"
                    >
                      ALL DIRECTIVES
                    </button>
                  </div>

                  {/* Add Command */}
                  <button
                    onClick={handleOpenAddForm}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 hover:text-emerald-100 transition-all cursor-pointer"
                    title="Register custom command voice directive"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ADD DIRECTIVE</span>
                  </button>

                  {/* Reset Defaults */}
                  <button
                    onClick={handleResetToDefaults}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                    title="Restore all default directives, deleting customs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>RESTORE DEFAULTS</span>
                  </button>
                </div>
              </div>

              {/* Commands List Grid */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1.5">
                {filteredCommands.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-slate-950/20 border border-dashed border-slate-800 rounded-lg text-slate-500">
                    <FileCode className="w-12 h-12 text-slate-600 mb-2.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">No Directives Located</span>
                    <span className="text-[10px] mt-1">Try adjusting your search criteria or register a new custom action.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                    {filteredCommands.map((cmd) => (
                      <div
                        key={cmd.id}
                        className={`p-4 bg-slate-950/40 hover:bg-slate-950/60 rounded-lg border flex flex-col gap-2.5 transition-all group ${
                          cmd.isCustom 
                            ? 'border-emerald-900/50 hover:border-emerald-700/80 shadow-[inset_0_0_8px_rgba(16,185,129,0.03)]' 
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Title & Badges */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-cyan-400 font-bold text-xs tracking-wider">
                              /{cmd.name}/
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5 text-slate-600" />
                              {MODES_DISPLAY[cmd.mode] || cmd.mode}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 select-none">
                            {cmd.isCustom ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 tracking-widest uppercase">
                                CUSTOM
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800 tracking-widest uppercase">
                                SYSTEM
                              </span>
                            )}

                            {/* CRUD actions for the card */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button
                                onClick={() => handleOpenEditForm(cmd)}
                                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800 transition-all cursor-pointer"
                                title="Edit voice command registration"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              
                              {cmd.isCustom && (
                                <button
                                  onClick={() => handleDeleteCommand(cmd.id)}
                                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-900 transition-all cursor-pointer"
                                  title="Delete custom voice directive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-slate-300 leading-relaxed min-h-[32px]">
                          {cmd.description}
                        </p>

                        {/* Params and Code block */}
                        <div className="mt-auto flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
                          {/* Args */}
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                              Arguments:
                            </span>
                            {cmd.args.length === 0 ? (
                              <span className="text-[9px] text-slate-500 font-mono font-bold uppercase italic">
                                none
                              </span>
                            ) : (
                              cmd.args.map((arg) => (
                                <span
                                  key={arg}
                                  className="text-[9px] font-mono font-bold px-1 rounded bg-cyan-950/30 text-cyan-500 border border-cyan-900/60"
                                >
                                  {arg}
                                </span>
                              ))
                            )}
                          </div>

                          {/* Example utterance */}
                          {cmd.example && (
                            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-850 p-1.5 rounded text-[10px] font-mono-data text-slate-400">
                              <Terminal className="w-3 h-3 text-cyan-600 shrink-0" />
                              <span className="truncate">
                                voice: <span className="text-slate-200">"{cmd.example}"</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/40 text-[9px] font-medium text-slate-400">
          <span>
            ACTIVE CONTEXT: {MODES_DISPLAY[activeMode]?.toUpperCase() || activeMode.toUpperCase()}
          </span>
          <span className="font-mono-data text-[10px]">
            TOTAL RECOGNISED DIRECTIVES: {commands.length}
          </span>
        </div>
      </div>
    </div>
  );
};
