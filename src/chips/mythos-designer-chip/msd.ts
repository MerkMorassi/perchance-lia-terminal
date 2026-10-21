export type ThemeId = 
  | 'noir-dark'
  | 'quantum-cyan' 
  | 'aegis-amber' 
  | 'hyperion-blue' 
  | 'obsidian-void'
  | (string & {});

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  era: string;
  colors: {
    bgObsidian: string;
    bgSlate: string;
    border: string;
    primary: string;
    secondary: string;
    accent: string;
    alert: string;
    gold: string;
    live: string;
    text: string;
    textMuted: string;
  };
  archHeaderClass: string;
  elbowClass: string;
  pillboxPrimaryClass: string;
  pillboxSecondaryClass: string;
  glowColor: string;
  layoutArchetype?: LayoutArchetype;
  borderRadius?: string;
  borderStyle?: string;
  fonts?: {
    display?: string;
    mono?: string;
    body?: string;
  };
  source?: {
    type: 'sketch' | 'css' | 'screenshot' | 'swatch' | 'multi-asset';
    summary?: string;
    assetCount?: number;
    previewThumbnail?: string;
    timestamp?: string;
  };
  extractedPalette?: Array<{
    hex: string;
    label: string;
    role: string;
  }>;
  designNotes?: string;
  isCustom?: boolean;
}

export type MetricKey = 
  | 'coherenceFactor' 
  | 'meanEntropyDensity' 
  | 'warpFieldFlux' 
  | 'plasmaFlowRate' 
  | 'shieldHarmonics' 
  | 'coolantPressure' 
  | 'coreTemperature' 
  | 'subspaceBandwidth';

export interface SystemMetric {
  key: MetricKey;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  nominalRange: [number, number];
  status: 'nominal' | 'warning' | 'critical';
  history: number[];
}

export interface MSDNode {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  metricKey: MetricKey;
  icon?: string;
  description?: string;
  targetSection?: string;
  status?: 'nominal' | 'warning' | 'critical' | 'standby';
  customValue?: number;
}

export type SchematicType = 
  | 'quantum_core' 
  | 'bridge_command' 
  | 'neural_lattice' 
  | 'thermo_array';

export interface MSDCanvasConfig {
  schematicAsset: string;
  schematicType: SchematicType;
  customSvg?: string;
  customImage?: string;
  hostAssetPath?: string;
  nodes: MSDNode[];
  overlayType?: 'none' | 'thermodynamic' | 'coherence' | 'entropy_density' | 'shield_harmonics';
}

export interface MSDHeader {
  title: string;
  authorizationCode: string;
  stardate: string;
  subTitle?: string;
}

export interface MSDNavigationItem {
  id: string;
  label: string;
  target: string;
  active?: boolean;
  color?: string;
}

export interface GeometryParams {
  outerElbowRadius: number;
  innerElbowRadius: number;
  padding: number;
  barGap: number;
}

export type LayoutArchetype = 
  | 'lcars-arch' 
  | 'modern-dashboard' 
  | 'tactical-hud' 
  | 'terminal-matrix' 
  | 'minimalist-grid' 
  | 'aerospace-telemetry';

export interface ExtrapolatedKpiCard {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  change?: string;
  isPositive?: boolean;
  metricKey?: MetricKey;
  status?: 'nominal' | 'warning' | 'critical';
}

export interface ExtrapolatedWidget {
  id: string;
  title: string;
  type: 'metric-chart' | 'data-table' | 'status-grid' | 'event-log' | 'gauge-cluster' | 'schematic-embed';
  colSpan?: 1 | 2 | 3 | 4;
  description?: string;
  data?: any;
}

export interface MSDMacroCommand {
  id: string;
  action: string;
  label: string;
  payload?: string;
}

export interface MSDMacro {
  id: string;
  name: string;
  hotkey: string; // e.g. 'F1', 'K1', 'MACRO-1'
  commands: MSDMacroCommand[];
}

export interface RotaryKnobConfig {
  sensitivity: number;
  clickAction: string;
  stops: number;
}

export interface HardwareMappingConfig {
  keyAssignments: Record<string, string>;
  knobAlpha: RotaryKnobConfig;
  knobBeta: RotaryKnobConfig;
  activeBank: number;
  hapticIntensity: number;
}

export interface MSDLayoutManifest {
  $schema: string;
  layoutId: string;
  name?: string;
  theme: ThemeId;
  layoutArchetype?: LayoutArchetype;
  header: MSDHeader;
  navigation: MSDNavigationItem[];
  msdCanvas: MSDCanvasConfig;
  geometryParams?: GeometryParams;
  kpiCards?: ExtrapolatedKpiCard[];
  widgets?: ExtrapolatedWidget[];
  macros?: MSDMacro[];
  hardwareMapping?: HardwareMappingConfig;
  designRationale?: string;
}

export type AppMode = 'msd-view' | 'ui-builder' | 'token-inspector' | 'ai-diagnostics' | 'voice-control';
