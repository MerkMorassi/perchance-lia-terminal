import { VoiceCommand } from '../types/voice';

export const DEFAULT_VOICE_COMMANDS: VoiceCommand[] = [
  // General Commands
  {
    id: 'cmd-click',
    name: 'click',
    description: 'Triggers a virtual click on any interactive element (buttons, tabs, inputs, cards) in the active console by its name, label, or ID.',
    args: ['targetName'],
    mode: 'all',
    example: 'click Reset Layout'
  },
  {
    id: 'cmd-adjust',
    name: 'adjust',
    description: 'Sets or adjusts a slider, knob, range input, or checkbox toggle in the active tactical workspace.',
    args: ['controlName', 'value'],
    mode: 'all',
    example: 'adjust sound level to 80'
  },
  {
    id: 'cmd-switch-theme',
    name: 'switch_theme',
    description: 'Changes the active tactical console color scheme across all displays (Noir Monochrome, Quantum Cyan, Aegis Amber, Hyperion Blue, Obsidian Void).',
    args: ['themeId'],
    mode: 'all',
    example: 'switch theme to Quantum Cyan'
  },
  {
    id: 'cmd-switch-mode',
    name: 'switch_mode',
    description: 'Changes the active workspace mode (UI Builder, Token Inspector, AI Diagnostics, Voice Control, MSD View).',
    args: ['mode'],
    mode: 'all',
    example: 'switch mode to AI Diagnostics'
  },
  {
    id: 'cmd-switch-tab',
    name: 'switch_tab',
    description: 'Changes the active view tab within the Master Systems Display dashboard (Extrapolated, Schematic, Split).',
    args: ['targetTab'],
    mode: 'all',
    example: 'switch tab to Schematic Canvas'
  },

  // AI Diagnostics Specific Commands
  {
    id: 'cmd-diag-surge',
    name: 'simulate_anomaly',
    description: 'Induces a critical electromagnetic surge or telemetry anomaly into the active display matrices.',
    args: [],
    mode: 'ai-diagnostics',
    example: 'simulate anomaly'
  },
  {
    id: 'cmd-diag-nominal',
    name: 'clear_anomaly',
    description: 'Stands down the simulated emergency system state and clears any active surge flags.',
    args: [],
    mode: 'ai-diagnostics',
    example: 'clear anomaly'
  },
  {
    id: 'cmd-diag-recalibrate',
    name: 'recalibrate_system',
    description: 'Executes a full coherent sensor sweep and purges entropy across all sub-systems.',
    args: [],
    mode: 'ai-diagnostics',
    example: 'recalibrate system'
  },

  // UI Builder Specific Commands
  {
    id: 'cmd-builder-forge',
    name: 'open_theme_forge',
    description: 'Launches the interactive Theme Forge custom stylesheet builder panel.',
    args: [],
    mode: 'ui-builder',
    example: 'open theme forge'
  },
  {
    id: 'cmd-builder-importer',
    name: 'open_importer',
    description: 'Launches the manifest schema importer to upload JSON layouts.',
    args: [],
    mode: 'ui-builder',
    example: 'open manifest importer'
  }
];
