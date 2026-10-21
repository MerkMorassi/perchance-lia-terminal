import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AppMode,
  MSDLayoutManifest,
  MSDNode,
  MetricKey,
  SystemMetric,
  ThemeId,
} from './types/msd';
import { DEFAULT_LAYOUT_MANIFEST, TEMPLATE_PRESETS } from './constants/templates';
import { THEMES } from './constants/themes';
import { ArchHeader } from './components/common/ArchHeader';
import { LeftPillarElbow } from './components/common/LeftPillarElbow';
import { BottomRunner } from './components/common/BottomRunner';
import { ModernAppHeader } from './components/layout/ModernAppHeader';
import { ModernAppSidebar } from './components/layout/ModernAppSidebar';
import { ModernDashboardView } from './components/layout/ModernDashboardView';
import { ModernBottomBar } from './components/layout/ModernBottomBar';
import { SchematicCanvas } from './components/msd/SchematicCanvas';
import { TelemetryPanel } from './components/msd/TelemetryPanel';
import { VisualStudio } from './components/builder/VisualStudio';
import { TokenInspector } from './components/tokens/TokenInspector';
import { MythOSDiagnosticConsole } from './components/ai/MythOSDiagnosticConsole';
import { VoiceControlModule } from './components/voice/VoiceControlModule';
import { IntegrityViolationModal } from "./components/common/IntegrityViolationModal";
import { SaveToast } from "./components/common/SaveToast";
import { ThemeForgeModal } from './components/theme/ThemeForgeModal';
import { soundEngine } from './utils/audio';
import { useLiveVoiceControl } from './hooks/useLiveVoiceControl';
import { executeVoiceDomClick, executeVoiceDomAdjust } from './utils/voiceDomController';
import { useMCFValidator } from './hooks/useMCFValidator';

import { VoxconTranscriptionDisplay } from './components/voice/VoxconTranscriptionDisplay';

export default function App() {
  const [manifest, setManifest] = useState<MSDLayoutManifest>(() => {
    const savedDefaultKey = localStorage.getItem('mythos_default_template_preset');
    if (savedDefaultKey) {
      if (savedDefaultKey.startsWith('custom-')) {
        const themeId = savedDefaultKey.replace('custom-', '') as ThemeId;
        if (THEMES[themeId]) {
          return {
            ...(TEMPLATE_PRESETS.modernCloudDashboard || DEFAULT_LAYOUT_MANIFEST),
            theme: themeId,
            name: `${THEMES[themeId].name} Synthesized Template`,
          };
        }
      }
      let preset = TEMPLATE_PRESETS[savedDefaultKey];
      if (!preset) {
        preset = Object.values(TEMPLATE_PRESETS).find(
          (p) => p.layoutId === savedDefaultKey || p.name.toLowerCase() === savedDefaultKey.toLowerCase()
        );
      }
      if (preset) {
        return {
          ...preset,
          theme: preset.theme && THEMES[preset.theme as ThemeId] ? (preset.theme as ThemeId) : 'noir-dark',
        };
      }
    }
    return {
      ...(TEMPLATE_PRESETS.modernCloudDashboard || DEFAULT_LAYOUT_MANIFEST),
      theme: 'noir-dark',
    };
  });
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    const savedDefaultKey = localStorage.getItem('mythos_default_template_preset');
    if (savedDefaultKey) {
      if (savedDefaultKey.startsWith('custom-')) {
        const themeId = savedDefaultKey.replace('custom-', '') as ThemeId;
        if (THEMES[themeId]) return themeId;
      }
      let preset = TEMPLATE_PRESETS[savedDefaultKey];
      if (!preset) {
        preset = Object.values(TEMPLATE_PRESETS).find(
          (p) => p.layoutId === savedDefaultKey || p.name.toLowerCase() === savedDefaultKey.toLowerCase()
        );
      }
      if (preset && preset.theme && THEMES[preset.theme as ThemeId]) {
        return preset.theme as ThemeId;
      }
    }
    return 'noir-dark';
  });
  const [appMode, setAppMode] = useState<AppMode>('msd-view');
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'schematic' | 'split'>('dashboard');
  const [selectedNode, setSelectedNode] = useState<MSDNode | null>(null);
  const [anomalySimulated, setAnomalySimulated] = useState<boolean>(false);
  const [isThemeForgeOpen, setIsThemeForgeOpen] = useState<boolean>(false);
  const [isSaveToastVisible, setIsSaveToastVisible] = useState<boolean>(false);
  const theme = THEMES[currentTheme] || THEMES['noir-dark'];

  // MCF Validator Hook
  useMCFValidator(() => {
    console.error('[App] MCF Bundle Hash Mismatch Detected!');
    setAnomalySimulated(true);
  });


  const isModernArchetype = Boolean(
    manifest.layoutArchetype && manifest.layoutArchetype !== 'lcars-classic'
  );

  const handleSelectTemplate = (templateKey: string) => {
    // Handle custom themes if prefixed with custom-
    if (templateKey.startsWith('custom-')) {
      const themeId = templateKey.replace('custom-', '') as ThemeId;
      if (THEMES[themeId]) {
        soundEngine.playChime();
        setCurrentTheme(themeId);
        setManifest((prev) => ({
          ...prev,
          theme: themeId,
          name: `${THEMES[themeId].name} Synthesized Template`,
        }));
      }
      return;
    }

    // Direct key match in TEMPLATE_PRESETS
    let preset = TEMPLATE_PRESETS[templateKey];
    if (!preset) {
      // Lookup by layoutId or name match
      preset = Object.values(TEMPLATE_PRESETS).find(
        (p) => p.layoutId === templateKey || p.name.toLowerCase() === templateKey.toLowerCase()
      );
    }

    if (preset) {
      soundEngine.playChime();
      setManifest(preset);
      if (preset.theme && THEMES[preset.theme as ThemeId]) {
        setCurrentTheme(preset.theme as ThemeId);
      }
    }
  };

  // Live System Metrics state with real-time drift
  const [metrics, setMetrics] = useState<Record<MetricKey, SystemMetric>>({
    coherenceFactor: {
      key: 'coherenceFactor',
      label: 'COHERENCE FACTOR (Φ)',
      value: 0.998,
      unit: 'Φ',
      min: 0,
      max: 1.0,
      nominalRange: [0.95, 1.0],
      status: 'nominal',
      history: [0.99, 0.995, 0.998, 0.997, 0.998],
    },
    meanEntropyDensity: {
      key: 'meanEntropyDensity',
      label: 'ENTROPY DENSITY (ρS)',
      value: 0.042,
      unit: 'ρS',
      min: 0,
      max: 1.0,
      nominalRange: [0.01, 0.15],
      status: 'nominal',
      history: [0.04, 0.042, 0.041, 0.043, 0.042],
    },
    warpFieldFlux: {
      key: 'warpFieldFlux',
      label: 'WARP FIELD FLUX',
      value: 147.4,
      unit: 'mC',
      min: 0,
      max: 300,
      nominalRange: [100, 200],
      status: 'nominal',
      history: [145, 146, 147, 147.4],
    },
    plasmaFlowRate: {
      key: 'plasmaFlowRate',
      label: 'PLASMA FLOW PRESSURE',
      value: 88.2,
      unit: 'kPa',
      min: 0,
      max: 150,
      nominalRange: [60, 110],
      status: 'nominal',
      history: [85, 87, 88.2],
    },
    shieldHarmonics: {
      key: 'shieldHarmonics',
      label: 'SHIELD HARMONICS',
      value: 247.8,
      unit: 'MHz',
      min: 100,
      max: 500,
      nominalRange: [200, 300],
      status: 'nominal',
      history: [240, 245, 247.8],
    },
    coolantPressure: {
      key: 'coolantPressure',
      label: 'COOLANT PRESSURE',
      value: 412.0,
      unit: 'bar',
      min: 0,
      max: 600,
      nominalRange: [350, 500],
      status: 'nominal',
      history: [410, 412],
    },
    coreTemperature: {
      key: 'coreTemperature',
      label: 'CORE TEMPERATURE',
      value: 3420,
      unit: 'K',
      min: 1000,
      max: 8000,
      nominalRange: [2500, 4500],
      status: 'nominal',
      history: [3400, 3420],
    },
    subspaceBandwidth: {
      key: 'subspaceBandwidth',
      label: 'SUBSPACE BANDWIDTH',
      value: 98.4,
      unit: 'TB/s',
      min: 0,
      max: 200,
      nominalRange: [80, 150],
      status: 'nominal',
      history: [95, 98.4],
    },
  });

  // Real-time metric fluctuation loop
  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          const key = k as MetricKey;
          const m = next[key];
          const delta = (Math.random() - 0.49) * (m.max - m.min) * 0.01;
          let newVal = Math.min(m.max, Math.max(m.min, m.value + delta));

          if (anomalySimulated && (key === 'meanEntropyDensity' || key === 'coreTemperature')) {
            newVal = Math.min(m.max, m.value + (m.max - m.min) * 0.05);
          }

          let status: 'nominal' | 'warning' | 'critical' = 'nominal';
          if (newVal < m.nominalRange[0] || newVal > m.nominalRange[1]) {
            status = 'warning';
          }
          if (newVal > m.nominalRange[1] * 1.25) {
            status = 'critical';
          }

          next[key] = {
            ...m,
            value: newVal,
            status,
            history: [...m.history.slice(-12), newVal],
          };
        });
        return next;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, [anomalySimulated]);

  // Update specific metric
  const handleUpdateMetric = (key: string, newValue: number) => {
    setMetrics((prev) => {
      const metricKey = key as MetricKey;
      if (!prev[metricKey]) return prev;
      return {
        ...prev,
        [metricKey]: {
          ...prev[metricKey],
          value: newValue,
        },
      };
    });
  };

  // Toggle Anomaly Simulation
  const handleToggleAnomaly = () => {
    const nextAnomaly = !anomalySimulated;
    setAnomalySimulated(nextAnomaly);
    if (nextAnomaly) {
      setMetrics((prev) => ({
        ...prev,
        meanEntropyDensity: { ...prev.meanEntropyDensity, value: 0.84, status: 'critical' },
        coreTemperature: { ...prev.coreTemperature, value: 7120, status: 'critical' },
        coherenceFactor: { ...prev.coherenceFactor, value: 0.421, status: 'critical' },
      }));
    } else {
      setMetrics((prev) => ({
        ...prev,
        meanEntropyDensity: { ...prev.meanEntropyDensity, value: 0.042, status: 'nominal' },
        coreTemperature: { ...prev.coreTemperature, value: 3420, status: 'nominal' },
        coherenceFactor: { ...prev.coherenceFactor, value: 0.998, status: 'nominal' },
      }));
    }
  };

  // Sovereign Architecture Protocol Anchors
  const runIngest = () => { console.log('[Sovereign Protocol] runIngest executed'); };
  const runExport = () => { console.log('[Sovereign Protocol] runExport executed'); };
  const runImport = () => { console.log('[Sovereign Protocol] runImport executed'); };
  const runChat = () => { setAppMode('ai-diagnostics'); };
  const stageFiles = () => { console.log('[Sovereign Protocol] stageFiles executed'); };
  const saveParams = () => { 
    localStorage.setItem('mythos_manifest', JSON.stringify(manifest)); 
    setIsSaveToastVisible(true);
  };
  const loadSavedParams = () => {
    try {
      const saved = localStorage.getItem('mythos_manifest');
      if (saved) setManifest(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  };

  // Tactical Voice Order Execution Dispatcher
  const handleExecuteVoiceCommand = async (name: string, args: Record<string, unknown>) => {
    console.log('[App] Tactical Voice Order Received:', name, args);
    soundEngine.playChime();

    if (name === 'switchMode') {
      const mode = args.mode as AppMode;
      if (mode && ['msd-view', 'ui-builder', 'token-inspector', 'ai-diagnostics', 'voice-control'].includes(mode)) {
        setAppMode(mode);
      }
    } else if (name === 'switchTheme') {
      const themeId = args.themeId as ThemeId;
      if (themeId && ['noir-dark', 'quantum-cyan', 'aegis-amber', 'hyperion-blue', 'obsidian-void'].includes(themeId)) {
        setCurrentTheme(themeId);
      }
    } else if (name === 'setAnomalySimulation') {
      const active = Boolean(args.active);
      setAnomalySimulated(active);
      if (active) {
        soundEngine.playAlert();
        setMetrics((prev) => ({
          ...prev,
          meanEntropyDensity: { ...prev.meanEntropyDensity, value: 0.84, status: 'critical' },
          coreTemperature: { ...prev.coreTemperature, value: 7120, status: 'critical' },
          coherenceFactor: { ...prev.coherenceFactor, value: 0.421, status: 'critical' },
        }));
      } else {
        setMetrics((prev) => ({
          ...prev,
          meanEntropyDensity: { ...prev.meanEntropyDensity, value: 0.042, status: 'nominal' },
          coreTemperature: { ...prev.coreTemperature, value: 3420, status: 'nominal' },
          coherenceFactor: { ...prev.coherenceFactor, value: 0.998, status: 'nominal' },
        }));
      }
    } else if (name === 'selectSchematic') {
      const schematic = args.schematicType as any;
      if (schematic) {
        setManifest((prev) => ({
          ...prev,
          msdCanvas: {
            ...prev.msdCanvas,
            schematicType: schematic,
          },
        }));
      }
    } else if (name === 'selectSubsystemNode') {
      const q = String(args.query || '').toLowerCase();
      const node = manifest.msdCanvas.nodes.find(
        (n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
      );
      if (node) {
        setSelectedNode(node);
      }
    } else if (name === 'setDefaultPreset' || name === 'setDefaultDashboardPreset') {
      const templateKey = String(args.templateKey || args.presetKey || '');
      if (templateKey) {
        handleSelectTemplate(templateKey);
        try {
          localStorage.setItem('mythos_default_template_preset', templateKey);
        } catch (e) {
          console.warn(e);
        }
      }
    } else if (name === 'changeVoice') {
      const v = String(args.voiceName || '');
      const allowedFemaleOrNeutralVoices = [
        'Zephyr', 'Kore', 'Aoede', 'Leda', 'Despina', 'Erinome', 
        'Laomedeia', 'Sulafat', 'Achernar', 'Schedar', 'Callirrhoe', 
        'Autonoe', 'Achird', 'Vindemiatrix'
      ];
      if (allowedFemaleOrNeutralVoices.includes(v)) {
        try {
          localStorage.setItem('mythos_voice', v);
        } catch (e) {
          console.warn(e);
        }
      }
    } else if (name === 'recalibrateSystem') {
      setAnomalySimulated(false);
      setMetrics((prev) => ({
        ...prev,
        coherenceFactor: { ...prev.coherenceFactor, value: 0.999, status: 'nominal' },
        meanEntropyDensity: { ...prev.meanEntropyDensity, value: 0.035, status: 'nominal' },
        shieldHarmonics: { ...prev.shieldHarmonics, value: 250.0, status: 'nominal' },
        plasmaFlowRate: { ...prev.plasmaFlowRate, value: 85.0, status: 'nominal' },
        coreTemperature: { ...prev.coreTemperature, value: 3400, status: 'nominal' },
      }));
    } else if (name === 'loadHostAsset') {
      const rawPath = String(args.filePath || '');
      if (rawPath) {
        try {
          const res = await fetch(`/api/host/asset?path=${encodeURIComponent(rawPath)}`);
          const data = await res.json();
          if (data.dataUrl) {
            setManifest((prev) => ({
              ...prev,
              msdCanvas: {
                ...prev.msdCanvas,
                customImage: data.dataUrl,
                hostAssetPath: rawPath,
              },
            }));
            soundEngine.playToggle();
            setAppMode('msd-view');
          }
        } catch (err) {
          console.error('[App] Failed to load host asset:', err);
        }
      }
    } else if (name === 'executePythonScript') {
      const scriptName = String(args.scriptName || '');
      const scriptArgs = String(args.arguments || '');
      try {
        const res = await fetch('/api/host/execute-python', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: scriptName, args: scriptArgs }),
        });
        const data = await res.json();
        soundEngine.playBeep(920, 'sine', 0.08, 0.08);
        console.log('[Host Execute Python Output]', data);
      } catch (err) {
        console.error('[App] Failed to execute Python script:', err);
      }
    } else if (name === 'switchDashboardTab') {
      const targetTab = String(args.targetTab || 'dashboard') as 'dashboard' | 'schematic' | 'split';
      if (['dashboard', 'schematic', 'split'].includes(targetTab)) {
        setAppMode('msd-view');
        setDashboardTab(targetTab);
      }
    } else if (name === 'clickElement') {
      const target = String(args.targetName || '');
      if (target) {
        executeVoiceDomClick(target);
      }
    } else if (name === 'adjustControl') {
      const control = String(args.controlName || '');
      const action = (args.action as any) || 'set';
      const val = typeof args.value === 'number' ? args.value : undefined;
      if (control) {
        executeVoiceDomAdjust(control, action, val);
      }
    } else if (name === 'queryNetworkNode') {
      const node = String(args.nodeAddress || '');
      const port = Number(args.port || 8000);
      try {
        const res = await fetch('/api/host/status');
        const data = await res.json();
        soundEngine.playToggle();
        console.log('[Host Query Network Node Status]', { node, port, data });
      } catch (err) {
        console.error('[App] Failed to query network node:', err);
      }
    }
  };

  const handleClearCustomImage = () => {
    soundEngine.playToggle();
    setManifest((prev) => ({
      ...prev,
      msdCanvas: {
        ...prev.msdCanvas,
        customImage: undefined,
        hostAssetPath: undefined,
      },
    }));
  };

  const activeNavId = manifest.navigation.find((n) => n.active)?.id || manifest.navigation[0]?.id;

  // Persistent Live Voice Control Hook: maintains active connection and mic stream across all tabs
  const voiceControl = useLiveVoiceControl({
    onExecuteCommand: handleExecuteVoiceCommand,
  });

  const handleSelectNav = (id: string) => {
    setManifest((prev) => ({
      ...prev,
      navigation: prev.navigation.map((n) => ({
        ...n,
        active: n.id === id,
      })),
    }));
  };

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col p-2 sm:p-4 gap-3 max-w-[1600px] mx-auto overflow-x-hidden font-sans transition-colors duration-300"
      style={{ backgroundColor: theme.colors.bgObsidian }}
    >
      <IntegrityViolationModal isVisible={anomalySimulated} onOverride={() => setAnomalySimulated(false)} />
      <SaveToast isVisible={isSaveToastVisible} onClose={() => setIsSaveToastVisible(false)} />
      
      {/* Top Header - Persists across all themes with live voice control synchronization */}
      <ModernAppHeader
        headerData={manifest.header}
        currentTheme={currentTheme}
        onThemeChange={(t) => {
          setCurrentTheme(t);
          setManifest((prev) => ({ ...prev, theme: t }));
        }}
        appMode={appMode}
        onAppModeChange={setAppMode}
        onOpenThemeForge={() => setIsThemeForgeOpen(true)}
        onSelectTemplate={handleSelectTemplate}
        currentTemplateId={manifest.layoutId}
        voiceActive={voiceControl.isConnected}
        voiceConnecting={voiceControl.isConnecting}
        voiceMicActive={voiceControl.isMicActive}
        voiceSpeaking={voiceControl.isSpeaking}
        onConnectVoice={voiceControl.connect}
        onToggleVoiceMic={voiceControl.toggleMic}
        onDisconnectVoice={voiceControl.disconnect}
        lastExecutedOrder={voiceControl.executedOrders[0] || null}
      />

      {/* Main Grid Content Workspace */}
      <div className="flex-grow flex flex-col md:flex-row gap-3 items-stretch w-full">
        {/* Left Sidebar Frame */}
        {isModernArchetype ? (
          <ModernAppSidebar
            navigationItems={manifest.navigation}
            activeNavId={activeNavId}
            onSelectNav={handleSelectNav}
            currentTheme={currentTheme}
            anomalySimulated={anomalySimulated}
            onToggleAnomaly={handleToggleAnomaly}
            metrics={metrics}
            transcripts={voiceControl.transcripts}
          />
        ) : (
          <LeftPillarElbow
            navigationItems={manifest.navigation}
            activeNavId={activeNavId}
            onSelectNav={handleSelectNav}
            currentTheme={currentTheme}
            geometryParams={manifest.geometryParams}
            anomalySimulated={anomalySimulated}
            onToggleAnomaly={handleToggleAnomaly}
            transcripts={voiceControl.transcripts}
          />
        )}

        {/* Center / Right Content Workspace */}
        <main className="flex-grow flex flex-col gap-3 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${appMode}-${dashboardTab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-grow flex flex-col gap-3 min-w-0 h-full w-full"
            >
              {appMode === 'msd-view' && (
                isModernArchetype ? (
                  <ModernDashboardView
                    manifest={manifest}
                    metrics={metrics}
                    currentTheme={currentTheme}
                    selectedNode={selectedNode}
                    onSelectNode={setSelectedNode}
                    anomalySimulated={anomalySimulated}
                    onUpdateMetric={handleUpdateMetric}
                    onClearCustomImage={handleClearCustomImage}
                    activeTab={dashboardTab}
                    onTabChange={setDashboardTab}
                  />
                ) : (
                  <div className="flex flex-col lg:flex-row gap-3 w-full">
                    <SchematicCanvas
                      canvasConfig={manifest.msdCanvas}
                      metrics={metrics}
                      currentTheme={currentTheme}
                      selectedNode={selectedNode}
                      onSelectNode={setSelectedNode}
                      anomalySimulated={anomalySimulated}
                      onClearCustomImage={handleClearCustomImage}
                    />
                    <TelemetryPanel
                      metrics={metrics}
                      selectedNode={selectedNode}
                      onCloseSelectedNode={() => setSelectedNode(null)}
                      onUpdateMetric={handleUpdateMetric}
                      currentTheme={currentTheme}
                      anomalySimulated={anomalySimulated}
                    />
    </div>
                )
              )}

              {appMode === 'ui-builder' && (
                <VisualStudio
                  manifest={manifest}
                  onUpdateManifest={setManifest}
                  currentTheme={currentTheme}
                  onThemeChange={(t) => {
                    setCurrentTheme(t);
                    setManifest((prev) => ({ ...prev, theme: t }));
                  }}
                  onOpenThemeForge={() => setIsThemeForgeOpen(true)}
                />
              )}

              {appMode === 'token-inspector' && (
                <TokenInspector
                  currentTheme={currentTheme}
                  onThemeChange={(t) => {
                    setCurrentTheme(t);
                    setManifest((prev) => ({ ...prev, theme: t }));
                  }}
                  onOpenThemeForge={() => setIsThemeForgeOpen(true)}
                />
              )}

              {appMode === 'ai-diagnostics' && (
                <MythOSDiagnosticConsole
                  metrics={metrics}
                  manifest={manifest}
                  anomalySimulated={anomalySimulated}
                  onInduceAnomaly={handleToggleAnomaly}
                />
              )}

              {appMode === 'voice-control' && (
                <VoiceControlModule
                  currentTheme={currentTheme}
                  onExecuteCommand={handleExecuteVoiceCommand}
                  activeMode={appMode}
                  anomalySimulated={anomalySimulated}
                  voiceControl={voiceControl}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
    </div>

      {/* Base Framing Bottom Runner */}
      {isModernArchetype ? (
        <ModernBottomBar
          currentTheme={currentTheme}
          stardate={manifest.header.stardate}
          archetype={manifest.layoutArchetype}
          onRefreshData={() => {
            setSelectedNode(null);
            setAnomalySimulated(false);
          }}
        />
      ) : (
        <BottomRunner
          currentTheme={currentTheme}
          stardate={manifest.header.stardate}
          onRefreshData={() => {
            setSelectedNode(null);
            setAnomalySimulated(false);
          }}
        />
      )}

      {/* Multimodal Sketch & Asset-to-Theme Transformation Modal */}
      <ThemeForgeModal
        isOpen={isThemeForgeOpen}
        onClose={() => setIsThemeForgeOpen(false)}
        onThemeActivated={(newThemeId) => {
          setCurrentTheme(newThemeId);
          setManifest((prev) => ({ ...prev, theme: newThemeId }));
        }}
        onTemplateActivated={(newTemplate) => {
          setManifest(newTemplate);
          if (newTemplate.theme && THEMES[newTemplate.theme as ThemeId]) {
            setCurrentTheme(newTemplate.theme as ThemeId);
          }
        }}
        currentThemeId={currentTheme}
      />
    </div>
  );
}
