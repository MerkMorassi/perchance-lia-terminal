import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Helper to sanitize and normalize an extracted theme
  function sanitizeExtractedTheme(raw: any, targetNameHint?: string) {
    const id = raw?.id
      ? String(raw.id).toLowerCase().replace(/[^a-z0-9_-]/g, "-")
      : `theme-${Date.now().toString(36)}`;
    const name = raw?.name || targetNameHint || `Synthesized Theme (${new Date().toLocaleDateString()})`;
    const era = raw?.era || "User Synthesized // Multi-Asset Ingestion";
    const layoutArchetype = raw?.layoutArchetype || "modern-dashboard";
    const borderRadius = raw?.borderRadius || (layoutArchetype === 'modern-dashboard' ? '8px' : layoutArchetype === 'minimalist-grid' ? '6px' : '2px');

    const colors = {
      bgObsidian: raw?.colors?.bgObsidian || "#06080c",
      bgSlate: raw?.colors?.bgSlate || "#0f141e",
      border: raw?.colors?.border || "#2a3447",
      primary: raw?.colors?.primary || "#38bdf8",
      secondary: raw?.colors?.secondary || "#0284c7",
      accent: raw?.colors?.accent || "#00f0ff",
      alert: raw?.colors?.alert || "#ef4444",
      gold: raw?.colors?.gold || "#eab308",
      live: raw?.colors?.live || "#22c55e",
      text: raw?.colors?.text || "#f8fafc",
      textMuted: raw?.colors?.textMuted || "#94a3b8",
    };

    return {
      id,
      name,
      era,
      layoutArchetype,
      borderRadius,
      borderStyle: raw?.borderStyle || "solid",
      colors,
      archHeaderClass:
        raw?.archHeaderClass ||
        `bg-gradient-to-r from-[${colors.primary}] via-[${colors.secondary}] to-[${colors.bgSlate}] text-black`,
      elbowClass: raw?.elbowClass || `bg-[${colors.primary}]`,
      pillboxPrimaryClass:
        raw?.pillboxPrimaryClass || `bg-[${colors.primary}] text-black hover:bg-[${colors.accent}]`,
      pillboxSecondaryClass:
        raw?.pillboxSecondaryClass ||
        `bg-[${colors.bgSlate}] text-[${colors.accent}] hover:bg-[${colors.secondary}] hover:text-white border border-[${colors.border}]`,
      glowColor: raw?.glowColor || "rgba(56, 189, 248, 0.4)",
      fonts: raw?.fonts || {
        display: "Inter, sans-serif",
        mono: "Share Tech Mono, monospace",
        body: "Inter, sans-serif",
      },
      extractedPalette: Array.isArray(raw?.extractedPalette) ? raw.extractedPalette : [],
      designNotes: raw?.designNotes || "Theme successfully synthesized and extrapolated from provided design assets.",
      isCustom: true,
    };
  }

  // Helper to sanitize and normalize an extrapolated page template
  function sanitizeExtractedTemplate(raw: any, themeId: string, templateNameHint?: string) {
    const layoutId = raw?.layoutId || `template-${Date.now().toString(36)}`;
    const name = raw?.name || templateNameHint || "Extrapolated Production Workspace";
    const layoutArchetype = raw?.layoutArchetype || "modern-dashboard";

    const header = {
      title: raw?.header?.title || name.toUpperCase(),
      subTitle: raw?.header?.subTitle || "REAL-TIME TELEMETRY & MULTI-MODULE OPERATIONS WORKSPACE",
      authorizationCode: raw?.header?.authorizationCode || "ENVIRONMENT // PRODUCTION MATRIX",
      stardate: raw?.header?.stardate || "UPTIME: 99.99% // SLA MET",
    };

    const navigation = Array.isArray(raw?.navigation) && raw.navigation.length > 0
      ? raw.navigation
      : [
          { id: "sec-01", label: "01 - OVERVIEW", target: "overview", active: true },
          { id: "sec-02", label: "02 - TELEMETRY", target: "telemetry", active: false },
          { id: "sec-03", label: "03 - SCHEMATIC", target: "schematic", active: false },
          { id: "sec-04", label: "04 - AUDIT LOGS", target: "audit", active: false },
        ];

    const kpiCards = Array.isArray(raw?.kpiCards) && raw.kpiCards.length > 0
      ? raw.kpiCards
      : [
          { id: "kpi-1", label: "SYSTEM EFFICIENCY", value: "98.4%", unit: "Coherence", change: "+4.2%", isPositive: true, metricKey: "coherenceFactor", status: "nominal" },
          { id: "kpi-2", label: "THROUGHPUT VOLUME", value: "48.2 GB/s", unit: "Rate", change: "+12.8%", isPositive: true, metricKey: "plasmaFlowRate", status: "nominal" },
          { id: "kpi-3", label: "ERROR DENSITY", value: "0.012", unit: "Entropy", change: "-18.5%", isPositive: true, metricKey: "meanEntropyDensity", status: "nominal" },
          { id: "kpi-4", label: "THERMAL INDEX", value: "312.4 K", unit: "Temp", change: "Nominal", isPositive: true, metricKey: "coreTemperature", status: "nominal" },
        ];

    const widgets = Array.isArray(raw?.widgets) && raw.widgets.length > 0
      ? raw.widgets
      : [
          { id: "w-1", title: "Real-time Telemetry Vector Stream", type: "metric-chart", colSpan: 2, description: "Dynamic stream analysis and multi-frequency phase alignment" },
          { id: "w-2", title: "Component Health Matrix", type: "data-table", colSpan: 2, description: "Active nodes, operational status, load balancing, and fault tolerances" },
          { id: "w-3", title: "Operational Event Log", type: "event-log", colSpan: 1, description: "System level audit entries and cryptographic state verifications" },
        ];

    const defaultNodes = [
      { id: "node-01", label: "INGESTION MESH", x: 25, y: 30, metricKey: "plasmaFlowRate", description: "Primary ingestion pipeline array", status: "nominal" },
      { id: "node-02", label: "NEURAL COGNITION", x: 75, y: 30, metricKey: "coherenceFactor", description: "Inference calculation tensor core", status: "nominal" },
      { id: "node-03", label: "STORAGE LATENCY", x: 50, y: 70, metricKey: "subspaceBandwidth", description: "Sub-millisecond persistent replication pool", status: "nominal" },
    ];

    const msdCanvas = {
      schematicAsset: raw?.msdCanvas?.schematicAsset || "quantum_core",
      schematicType: raw?.msdCanvas?.schematicType || "quantum_core",
      overlayType: raw?.msdCanvas?.overlayType || "coherence",
      nodes: Array.isArray(raw?.msdCanvas?.nodes) && raw.msdCanvas.nodes.length > 0 ? raw.msdCanvas.nodes : defaultNodes,
    };

    return {
      $schema: "https://mythos.engine/schemas/ui-builder-v1.json",
      layoutId,
      name,
      theme: themeId,
      layoutArchetype,
      header,
      navigation,
      kpiCards,
      widgets,
      msdCanvas,
      geometryParams: {
        outerElbowRadius: 8,
        innerElbowRadius: 4,
        padding: 12,
        barGap: 4,
      },
      designRationale: raw?.designRationale || "Synthesized directly from visual sketch structure, layout hierarchy, and style tokens.",
    };
  }

  // Fallback theme & template generator based on CSS or heuristic presets
  function synthesizeFallbackTemplateAndTheme(params: { cssCode?: string; notes?: string; targetName?: string }) {
    const { cssCode = "", notes = "", targetName } = params;

    // Search for hex codes in provided CSS
    const hexMatches = cssCode.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
    const uniqueHexes = Array.from(new Set(hexMatches));

    const primary = uniqueHexes[0] || "#3b82f6";
    const secondary = uniqueHexes[1] || "#1d4ed8";
    const accent = uniqueHexes[2] || "#60a5fa";
    const border = uniqueHexes[3] || "#1e293b";

    // Determine layout archetype from notes
    const lowerNotes = (notes + " " + (targetName || "")).toLowerCase();
    let layoutArchetype: "modern-dashboard" | "tactical-hud" | "aerospace-telemetry" | "terminal-matrix" | "minimalist-grid" = "modern-dashboard";
    if (lowerNotes.includes("terminal") || lowerNotes.includes("cli") || lowerNotes.includes("unix")) {
      layoutArchetype = "terminal-matrix";
    } else if (lowerNotes.includes("aerospace") || lowerNotes.includes("flight") || lowerNotes.includes("orbit")) {
      layoutArchetype = "aerospace-telemetry";
    } else if (lowerNotes.includes("cyber") || lowerNotes.includes("tactical") || lowerNotes.includes("hud")) {
      layoutArchetype = "tactical-hud";
    } else if (lowerNotes.includes("minimal") || lowerNotes.includes("clean") || lowerNotes.includes("mono")) {
      layoutArchetype = "minimalist-grid";
    }

    const name = targetName || (cssCode ? "Extracted Enterprise Stylesheet" : "Synthesized Cloud Dashboard");
    const id = `theme-${Date.now().toString(36)}`;

    const theme = sanitizeExtractedTheme(
      {
        id,
        name,
        era: "Extrapolated Modern Architecture // Multi-Asset Pipeline",
        layoutArchetype,
        colors: {
          bgObsidian: "#090d16",
          bgSlate: "#111827",
          border: border,
          primary: primary,
          secondary: secondary,
          accent: accent,
          alert: "#ef4444",
          gold: "#f59e0b",
          live: "#10b981",
          text: "#f9fafb",
          textMuted: "#9ca3af",
        },
        glowColor: "rgba(59, 130, 246, 0.4)",
        fonts: {
          display: "Inter, sans-serif",
          mono: "Share Tech Mono, monospace",
          body: "Inter, sans-serif",
        },
        extractedPalette: uniqueHexes.map((hex, i) => ({
          hex,
          label: `Extracted Token ${i + 1}`,
          role: i === 0 ? "Primary" : i === 1 ? "Secondary" : "Accent",
        })),
        designNotes: notes || "Extrapolated modern production layout free of legacy Star Trek LCARS curves.",
      },
      name
    );

    const template = sanitizeExtractedTemplate(
      {
        layoutId: `layout-${Date.now().toString(36)}`,
        name: `${name} Layout`,
        layoutArchetype,
        header: {
          title: `${name.toUpperCase()} // OPERATIONS CONSOLE`,
          subTitle: "DISTRIBUTED OBSERVABILITY, LIVE METRIC TELEMETRY, & ACTIVE SYSTEM NODES",
          authorizationCode: "SYSTEM LEVEL: PRODUCTION // CLUSTER US-WEST",
          stardate: "HEALTH: 100% // ALL SERVICES NORMAL",
        },
        navigation: [
          { id: "sec-01", label: "01 - DASHBOARD", target: "dashboard", active: true },
          { id: "sec-02", label: "02 - CLUSTER NODES", target: "nodes", active: false },
          { id: "sec-03", label: "03 - TELEMETRY CHARTS", target: "telemetry", active: false },
          { id: "sec-04", label: "04 - INCIDENT QUEUE", target: "incidents", active: false },
        ],
        kpiCards: [
          { id: "kpi-1", label: "MESH COHERENCE", value: "99.8%", unit: "SLA", change: "+0.4%", isPositive: true, metricKey: "coherenceFactor", status: "nominal" },
          { id: "kpi-2", label: "REQUEST INGRESS", value: "64.2k req/s", unit: "Bandwidth", change: "+8.5%", isPositive: true, metricKey: "plasmaFlowRate", status: "nominal" },
          { id: "kpi-3", label: "ERROR BUDGET DRAIN", value: "0.001%", unit: "Rate", change: "-24.0%", isPositive: true, metricKey: "meanEntropyDensity", status: "nominal" },
          { id: "kpi-4", label: "CPU LATENCY P99", value: "2.8 ms", unit: "Time", change: "Optimal", isPositive: true, metricKey: "coreTemperature", status: "nominal" },
        ],
        widgets: [
          { id: "w-1", title: "Real-time Distributed Ingress Velocity", type: "metric-chart", colSpan: 2, description: "Throughput metrics over 60 second rolling time-window" },
          { id: "w-2", title: "Microservice Node Status Matrix", type: "data-table", colSpan: 2, description: "Active pods, CPU allocations, memory headroom, and error status" },
          { id: "w-3", title: "Audit Event Stream", type: "event-log", colSpan: 1, description: "Synchronous verification records and cluster health heartbeat signals" },
        ],
        designRationale: "Synthesized clean, modern, non-Star Trek page template matching operator specifications.",
      },
      theme.id,
      name
    );

    return { theme, template };
  }

  // Multi-tier model fallback for Gemini API calls to mitigate 503 high demand spikes and rate limits
  interface GeminiGenerateOptions {
    primaryModel?: string;
    fallbackModels?: string[];
    contents: any;
    config?: any;
  }

  async function callGeminiGenerateContentWithFallback(
    ai: GoogleGenAI,
    options: GeminiGenerateOptions
  ): Promise<{ response: any; modelUsed: string }> {
    const candidateModels = [
      options.primaryModel || "gemini-3.8-flash",
      ...(options.fallbackModels || ["gemini-3.1-flash-lite", "gemini-flash-latest"]),
    ];
    const uniqueModels = Array.from(new Set(candidateModels));

    let lastError: unknown = null;

    for (const model of uniqueModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: options.contents,
            config: options.config,
          });
          return { response, modelUsed: model };
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isTemporary =
            errMsg.includes("503") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("high demand") ||
            errMsg.includes("429") ||
            errMsg.includes("RESOURCE_EXHAUSTED");

          if (isTemporary && attempt === 0) {
            const delay = 600 + Math.floor(Math.random() * 400);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          console.log(`[Gemini Pipeline] Model '${model}' experienced capacity limit or latency. Dispatching to fallback candidate.`);
          break;
        }
      }
    }

    throw lastError;
  }

  // Synthesizes a Department of Defense & U.S. Navy COMMPACK-MIL compliant telemetry diagnostic
  // when the remote Gemini API experiences temporary 503 high demand or network unavailability.
  function synthesizeLocalTelemetryDiagnostic(metrics: any, manifest: any, prompt?: string): string {
    const coherence = typeof metrics?.warpFieldCoherence === "number" ? metrics.warpFieldCoherence : 0.998;
    const plasma = typeof metrics?.plasmaFlowRate === "number" ? metrics.plasmaFlowRate : 85.0;
    const temp = typeof metrics?.coreTemperature === "number" ? metrics.coreTemperature : 3400;
    const entropy = typeof metrics?.subspaceEntropy === "number" ? metrics.subspaceEntropy : 0.042;
    const isSurge = coherence < 0.95 || temp > 4000 || entropy > 0.15;
    const schematic = (manifest?.msdCanvas?.schematicType || "quantum_core").toString().replace(/_/g, " ").toUpperCase();
    const nodeCount = manifest?.msdCanvas?.nodes?.length || 0;

    return `### BLUF (Bottom Line Up Front)
The quantum containment lattice and thermodynamic distribution grid operate ${isSurge ? "under an active anomaly surge requiring tactical stabilization" : "within standard operational limits at nominal coherence"}.

### Operational Telemetry Assessment
- **Warp Field Coherence**: ${(coherence * 100).toFixed(2)}% (tactical threshold: >= 98.00%).
- **Plasma Conduit Flow**: ${plasma.toFixed(1)}% through primary distribution arrays.
- **Thermal Core Temperature**: ${temp} K (thermal margin: ${Math.max(0, 5000 - temp)} K before interlock limit).
- **Subspace Entropy Density**: ${entropy.toFixed(4)} (coherence delta: stable).
- **Active Schematic Subsystem**: ${schematic} with ${nodeCount} telemetry sensors registered.

### Tactical Action Directives
1. The containment field generator must maintain magnetic plasma balance.
2. The cooling manifold will purge excess thermal buildup if core temperature exceeds 4,200 K.
3. System operators may recalibrate subspace harmonic sensors via the Master Systems Display.`;
  }

  // API endpoint for Multimodal Sketch & Asset-to-Theme/Template Transformation
  app.post("/api/theme/transform", async (req, res) => {
    try {
      const { images = [], cssCode = "", notes = "", targetName = "" } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY not set, using heuristic fallback synthesizer.");
        const fallback = synthesizeFallbackTemplateAndTheme({ cssCode, notes, targetName });
        return res.json({ theme: fallback.theme, template: fallback.template, source: "heuristic_fallback" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `You are the MythOS Advanced Design System & Layout Extrapolation Engine.
Your task is to analyze user-provided design inputs—including wireframes, sketches, diagrams, UI mockups, screenshots of real systems, color swatches, font styles, and legacy CSS files.

CRITICAL DIRECTIVE:
DO NOT DEFAULT TO OR FORCE A "STAR TREK" OR "LCARS" LOOK (NO curved elbows, NO LCARS arches, NO Starfleet stardates, NO subspace references) UNLESS the user explicitly demands Star Trek.
Instead, faithfully COPY, SYNTHESIZE, AND EXTRAPOLATE the true visual design, layout archetype, component hierarchy, color palette, and styling from the supplied inputs into:
1. A distinct runtime THEME adhering to modern web design standards.
2. A complete, rich PAGE TEMPLATE (Layout Manifest) that mirrors and extrapolates the actual cards, panels, widgets, navigation, and schematic/canvas seen in the input!

Layout Archetypes to identify:
- "modern-dashboard": Contemporary SaaS/cloud analytics console (clean topbar, clean sidebar or top tabs, KPI metric cards, area charts, data tables, modular cards, clean 6-12px rounded borders).
- "tactical-hud": Sharp, high-contrast avionics HUD or military/cyber operations display (sharp technical borders, target vectors, crosshairs, telemetry logs).
- "aerospace-telemetry": Mission control and flight operations display (sensor grids, flight parameters, trajectory maps, status monitors).
- "terminal-matrix": Developer workstation or UNIX command matrix (monospaced typography, status ribbons, command terminal outputs).
- "minimalist-grid": Ultra-clean, spacious card grid with high typography focus, subtle borders, flat surfaces.

JSON SCHEMA REQUIREMENT:
Return a JSON object with two top-level keys: "theme" and "template".

"theme":
{
  "id": "clean-kebab-id",
  "name": "Descriptive Human Name",
  "era": "Design Lineage / Architecture Subtitle",
  "layoutArchetype": "modern-dashboard" | "tactical-hud" | "aerospace-telemetry" | "terminal-matrix" | "minimalist-grid",
  "borderRadius": "8px" (or "0px" for sharp HUD, "4px" for terminal, "12px" for modern SaaS),
  "borderStyle": "solid",
  "colors": {
    "bgObsidian": "Very dark canvas background hex (#06080c to #0f141d)",
    "bgSlate": "Panel/container background hex (#111827 to #1e293b)",
    "border": "Framing border hex (#1f2937 to #374151)",
    "primary": "Dominant structural accent color extracted from the sketch",
    "secondary": "Secondary harmonious color",
    "accent": "High-visibility highlight color for active states",
    "alert": "Critical alert indicator #ef4444",
    "gold": "Secondary caution #f59e0b",
    "live": "Operational status green #10b981",
    "text": "High contrast primary readout text (WCAG AA legible against bgObsidian)",
    "textMuted": "Subdued secondary text"
  },
  "fonts": {
    "display": "Inter, sans-serif" (or font matching the sketch),
    "mono": "Share Tech Mono, monospace",
    "body": "Inter, sans-serif"
  },
  "extractedPalette": [
    { "hex": "#...", "label": "...", "role": "..." }
  ],
  "designNotes": "2-sentence rationale explaining the synthesis from the input."
}

"template":
{
  "layoutId": "layout-id",
  "name": "Template Title matching sketch",
  "layoutArchetype": "modern-dashboard" | "tactical-hud" | "aerospace-telemetry" | "terminal-matrix" | "minimalist-grid",
  "header": {
    "title": "Clean header title from sketch",
    "subTitle": "Descriptive subtitle",
    "authorizationCode": "Environment / Project Tag",
    "stardate": "Operational Status or Uptime indicator"
  },
  "navigation": [
    { "id": "sec-01", "label": "01 - DASHBOARD", "target": "overview", "active": true },
    { "id": "sec-02", "label": "02 - MONITOR", "target": "monitor", "active": false },
    { "id": "sec-03", "label": "03 - DATA GRID", "target": "datagrid", "active": false }
  ],
  "kpiCards": [
    { "id": "kpi-1", "label": "STAT 1", "value": "12.4k", "unit": "req/s", "change": "+5.2%", "isPositive": true, "metricKey": "plasmaFlowRate", "status": "nominal" },
    { "id": "kpi-2", "label": "STAT 2", "value": "99.9%", "unit": "Availability", "change": "Nominal", "isPositive": true, "metricKey": "coherenceFactor", "status": "nominal" },
    { "id": "kpi-3", "label": "STAT 3", "value": "1.2 ms", "unit": "Latency", "change": "-0.4ms", "isPositive": true, "metricKey: "subspaceBandwidth", "status": "nominal" },
    { "id": "kpi-4", "label": "STAT 4", "value": "42.8 GB", "unit": "Memory", "change": "+1.1%", "isPositive": false, "metricKey: "coreTemperature", "status": "nominal" }
  ],
  "widgets": [
    { "id": "w-1", "title": "Primary Metric Telemetry", "type": "metric-chart", "colSpan": 2, "description": "Dynamic rolling telemetry trend" },
    { "id": "w-2", "title": "Operational Grid & Nodes", "type": "data-table", "colSpan": 2, "description": "Active component table and status health" },
    { "id": "w-3", "title": "Live Activity Stream", "type": "event-log", "colSpan": 1, "description": "Event ledger and security audits" }
  ],
  "msdCanvas": {
    "schematicAsset": "quantum_core",
    "schematicType": "quantum_core",
    "overlayType": "coherence",
    "nodes": [
      { "id": "n-1", "label": "NODE 1", "x": 30, "y": 35, "metricKey": "coherenceFactor", "description": "Primary node" },
      { "id": "n-2", "label": "NODE 2", "x": 70, "y": 35, "metricKey": "plasmaFlowRate", "description": "Secondary node" }
    ]
  },
  "designRationale": "Extrapolated page structure from sketch layout."
}

Return ONLY the valid JSON with keys { "theme": ..., "template": ... }. Do not enclose in backticks.`;

      const contents: any[] = [];

      // Add user uploaded images (sketches, screenshots, swatches)
      if (Array.isArray(images)) {
        for (const img of images) {
          if (img?.data && img?.mimeType) {
            const base64Data = img.data.replace(/^data:[^;]+;base64,/, "");
            contents.push({
              inlineData: {
                data: base64Data,
                mimeType: img.mimeType,
              },
            });
          }
        }
      }

      let textPrompt = `SYNTHESIZE AND EXTRAPOLATE THE ATTACHED ASSETS INTO A NEW RUNTIME THEME AND A FULL PAGE TEMPLATE:\n`;
      textPrompt += `CRITICAL: DO NOT FORCE A STAR TREK / LCARS STYLE. Extrapolate the authentic visual design, layout archetype, and components observed in the input assets.\n`;
      if (targetName) textPrompt += `TARGET WORKSPACE NAME: ${targetName}\n`;
      if (notes) textPrompt += `OPERATOR DIRECTIVES / NOTES: ${notes}\n`;
      if (cssCode) textPrompt += `LEGACY CSS / CODE SWATCHES:\n${cssCode}\n`;
      if (!images.length && !cssCode && !notes) {
        textPrompt += `Synthesize a clean, modern SaaS analytics and telemetry dashboard with high-contrast metrics, KPI cards, and clean typography.\n`;
      }

      contents.push(textPrompt);

      const { response, modelUsed } = await callGeminiGenerateContentWithFallback(ai, {
        primaryModel: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const responseText = response.text || "{}";
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      const themeRaw = parsed.theme || parsed;
      const templateRaw = parsed.template || null;

      const finalTheme = sanitizeExtractedTheme(themeRaw, targetName);
      const finalTemplate = templateRaw
        ? sanitizeExtractedTemplate(templateRaw, finalTheme.id, targetName)
        : sanitizeExtractedTemplate(
            {
              name: finalTheme.name,
              layoutArchetype: finalTheme.layoutArchetype,
            },
            finalTheme.id,
            targetName
          );

      return res.json({ theme: finalTheme, template: finalTemplate, source: `gemini_${modelUsed}` });
    } catch (error: unknown) {
      console.error("Theme & template transformation error:", error);
      const fallback = synthesizeFallbackTemplateAndTheme({
        cssCode: req.body?.cssCode,
        notes: req.body?.notes,
        targetName: req.body?.targetName,
      });
      return res.json({
        theme: fallback.theme,
        template: fallback.template,
        source: "fallback_recovery",
        warning: error instanceof Error ? error.message : "Fallback activated",
      });
    }
  });

  // API endpoint for Gemini Telemetry Diagnostics
  app.post("/api/gemini/analyze", async (req, res) => {
    const { prompt, metrics, manifest } = req.body || {};
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const localDiagnostic = synthesizeLocalTelemetryDiagnostic(metrics, manifest, prompt);
        return res.json({
          analysis: localDiagnostic,
          source: "local_diagnostic_matrix",
          notice: "Local telemetry diagnostic synthesized (GEMINI_API_KEY unconfigured).",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `You are the MythOS Tactical AI Engine for Advanced Aerospace & Quantum Operations.
You analyze Master Systems Display (MSD) telemetry metrics, thermodynamic entropy density, and layout schemas.
You must adhere strictly to the Department of Defense (DoD) & U.S. Navy Operational Communication Standards:
1. BLUF: Begin your assessment with a Bottom Line Up Front sentence stating operational readiness.
2. Active Voice: Write in the active voice. Name the specific subsystem or component taking action.
3. Helping Verbs:
   - Use "must" for mandatory operational actions or constraints.
   - Use "will" for projected system trajectory or scheduled state transitions.
   - Use "may" or "can" for optional or discretionary actions.
   - Do not use "shall".
4. Conciseness: Limit sentences to an average of 20 or fewer words. Limit each sentence to a single thought.
5. Plain Terminology & Anti-MILSPEAK:
   - Use plain, direct words (use "use" instead of "utilize", "before" instead of "prior to", "to" instead of "in order to").
   - Prohibit bureaucratic action filler ("conducts", "performs", "participates in", "prepares to"). State the direct operational action ("recalibrates", "purges", "inspects").
6. Prohibit Redundancies: Prohibit "currently", "presently", "close proximity", and vague spatial pointers like "here".
7. Prohibit Conversational Filler: Prohibit pleasantries, apologies, and marketing hype.
Format your diagnostic report with bold section headers and parallel bullet points.`;

      const userContent = `OPERATOR QUERY: ${prompt || "Perform full system telemetry diagnostic."}

CURRENT METRICS:
${JSON.stringify(metrics || {}, null, 2)}

CURRENT LAYOUT SCHEMATIC:
${JSON.stringify(manifest?.msdCanvas?.schematicType || "quantum_core")}
NODES BOUND: ${manifest?.msdCanvas?.nodes?.length || 0}`;

      try {
        const { response, modelUsed } = await callGeminiGenerateContentWithFallback(ai, {
          primaryModel: "gemini-3.8-flash",
          contents: userContent,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        return res.json({ analysis: response.text, modelUsed, source: "gemini_api" });
      } catch (_geminiError: unknown) {
        console.log("[Gemini Pipeline] Cloud API capacity limit reached. Synthesizing local tactical diagnostic matrix.");
        const localDiagnostic = synthesizeLocalTelemetryDiagnostic(metrics, manifest, prompt);
        return res.json({
          analysis: localDiagnostic,
          source: "local_telemetry_matrix_fallback",
          notice: "Gemini cloud capacity limit encountered. Local tactical telemetry matrix synthesized this diagnostic.",
        });
      }
    } catch (error: unknown) {
      console.error("Diagnostic endpoint error:", error);
      const localDiagnostic = synthesizeLocalTelemetryDiagnostic(metrics, manifest, prompt);
      return res.json({
        analysis: localDiagnostic,
        source: "local_telemetry_matrix_fallback",
        notice: "Operational failover engaged.",
      });
    }
  });

  // API endpoint for Gemini Audio Transcription
  app.post("/api/gemini/transcribe", async (req, res) => {
    try {
      const { audioData, mimeType = "audio/wav" } = req.body;
      if (!audioData) {
        return res.status(400).json({ error: "Missing 'audioData' in request body." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          transcription: "[SIMULATED TRANSCRIPTION] Transcription requires a valid GEMINI_API_KEY.",
          source: "mock_transcriber",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const audioPart = {
        inlineData: {
          mimeType,
          data: audioData.replace(/^data:[^;]+;base64,/, ""),
        },
      };

      const { response, modelUsed } = await callGeminiGenerateContentWithFallback(ai, {
        primaryModel: "gemini-3.5-transcribe",
        contents: { parts: [audioPart, { text: "Transcribe this audio precisely. Return only the transcription text." }] },
      });

      return res.json({ transcription: response.text, modelUsed, source: "gemini_api" });
    } catch (error: unknown) {
      console.error("Transcription endpoint error:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Transcription failed." });
    }
  });

  // API endpoint for Host Asset Ingestion Endpoint (Local disk, network shares, Z: drive)
  app.get("/api/host/asset", async (req, res) => {
    try {
      const rawPath = String(req.query.path || "");
      if (!rawPath) {
        return res.status(400).json({ error: "No file path provided in query parameter 'path'." });
      }

      // Check if file exists on disk (works on localhost deployment with direct drive access)
      const fileExists = fs.existsSync(rawPath);

      if (fileExists) {
        const stats = fs.statSync(rawPath);
        if (stats.isDirectory()) {
          return res.status(400).json({ error: `Path '${rawPath}' is a directory, not a file.` });
        }

        const ext = path.extname(rawPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".svg": "image/svg+xml",
          ".webp": "image/webp",
          ".gif": "image/gif",
          ".json": "application/json",
          ".txt": "text/plain",
        };
        const mimeType = mimeTypes[ext] || "application/octet-stream";
        const fileBuffer = fs.readFileSync(rawPath);
        const base64Data = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

        return res.json({
          success: true,
          exists: true,
          simulated: false,
          filePath: rawPath,
          fileName: path.basename(rawPath),
          mimeType,
          sizeBytes: stats.size,
          dataUrl: base64Data,
        });
      }

      // If file does not exist on disk (e.g. running in sandbox preview container where Z: drive is unmounted),
      // generate a tactical synthetic vector graphic showing the requested path and schematic geometry
      const fileName = path.basename(rawPath) || "host_asset.png";
      const sanitizedPath = rawPath.replace(/[<>&"]/g, "");
      const syntheticSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#070c16"/>
            <stop offset="100%" stop-color="#020409"/>
          </linearGradient>
          <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#1e293b" stroke-width="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bgGrad)"/>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.6"/>
        <rect x="30" y="30" width="740" height="440" rx="8" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="10 5" opacity="0.8"/>
        
        <!-- Header banner -->
        <rect x="30" y="30" width="740" height="40" fill="#38bdf8" opacity="0.15"/>
        <text x="50" y="55" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">HOST DRIVE ASSET // INGESTED VIA VOICE DISPATCH</text>
        
        <!-- Center Target Graphic -->
        <circle cx="400" cy="250" r="130" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>
        <circle cx="400" cy="250" r="90" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.9"/>
        <circle cx="400" cy="250" r="6" fill="#22c55e"/>
        <line x1="240" y1="250" x2="560" y2="250" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>
        <line x1="400" y1="90" x2="400" y2="410" stroke="#38bdf8" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"/>
        
        <!-- Metadata readouts -->
        <text x="50" y="420" fill="#94a3b8" font-family="monospace" font-size="12">PATH: ${sanitizedPath}</text>
        <text x="50" y="440" fill="#38bdf8" font-family="monospace" font-size="12">STATUS: DISPATCHED TO ACTIVE DISPLAY CANVAS</text>
        <text x="500" y="440" fill="#eab308" font-family="monospace" font-size="12">MODE: HOST INGESTION MATRIX</text>
      </svg>`;
      const syntheticBase64 = `data:image/svg+xml;base64,${Buffer.from(syntheticSvg).toString("base64")}`;

      return res.json({
        success: true,
        exists: false,
        simulated: true,
        filePath: rawPath,
        fileName,
        mimeType: "image/svg+xml",
        message: "Drive/path not physically mounted in sandbox container; rendered tactical synthetic vector.",
        dataUrl: syntheticBase64,
      });
    } catch (err: unknown) {
      console.error("[HostAsset] Error processing file path:", err);
      return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load host asset." });
    }
  });

  // Host Python & System Command Execution Endpoint
  app.post("/api/host/execute-python", async (req, res) => {
    try {
      const { script, args = "", timeoutMs = 5000 } = req.body;
      if (!script) {
        return res.status(400).json({ error: "Missing 'script' in request body." });
      }

      // Check if local Python daemon is running on default port 8000
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const daemonRes = await fetch("http://localhost:8000/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script, args }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (daemonRes.ok) {
          const daemonData = await daemonRes.json();
          return res.json({
            success: true,
            source: "python_local_daemon",
            output: daemonData,
          });
        }
      } catch {
        // Fall back to direct local CLI execution
      }

      // Fallback: Execute via local Python CLI subprocess (supporting Windows and POSIX)
      const pyBin = process.platform === "win32" ? "python" : "python3";
      const command = script.endsWith(".py")
        ? `${pyBin} ${script} ${args}`
        : `${pyBin} -c "${script.replace(/"/g, '\\"')}"`;

      exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          return res.json({
            success: false,
            source: "host_cli",
            command,
            error: error.message,
            stderr,
            stdout,
          });
        }
        return res.json({
          success: true,
          source: "host_cli",
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Execution failed." });
    }
  });

  // Gemini Prebuilt Voices Registry with Acoustic & Operational Metadata
  // Suppressed male voices; only female and neutral Gemini voices are permitted
  const ALL_GEMINI_VOICES = [
    { name: "Zephyr", gender: "Female / Bright", tone: "Smooth / Crisp", category: "Tactical Ops", default: true, description: "Default vocal persona. Clear, disciplined naval command cadence." },
    { name: "Kore", gender: "Female / Firm", tone: "Articulate / Advisory", category: "Diagnostics", description: "High-confidence technical diagnostics, analytical decomposition." },
    { name: "Aoede", gender: "Female / Melodic", tone: "Breezy / Conversational", category: "Extended Narration", description: "Balanced acoustic profile, extended briefing and status readouts." },
    { name: "Leda", gender: "Female / Serene", tone: "Calm / Composed", category: "Command Bridge", description: "Steady cadence for bridge crew coordination and long-range relay." },
    { name: "Despina", gender: "Female / Smooth", tone: "Measured / Warm", category: "Crew Operations", description: "Even cadence for life-support and interior deck management." },
    { name: "Erinome", gender: "Female / Expressive", tone: "Precise / Articulate", category: "Engineering Array", description: "Microsecond precision for reactor timing and frequency arrays." },
    { name: "Laomedeia", gender: "Female / Fast", tone: "Rhythmic / Crisp", category: "Rapid Telemetry", description: "High-speed protocol verification and buffer status relay." },
    { name: "Sulafat", gender: "Neutral / Focused", tone: "Compact / Direct", category: "Tactical Weapons", description: "Short-burst targeting directives and defensive shield updates." },
    { name: "Achernar", gender: "Neutral / Direct", tone: "Modern / Tactical", category: "Surveillance", description: "Passive sensor array scanning and perimeter radar sweeps." },
    { name: "Schedar", gender: "Female / Sharp", tone: "Technical / Piercing", category: "Avionics", description: "Attitude control thrusters and flight surface telemetry." },
    { name: "Callirrhoe", gender: "Female / Melodic", tone: "Analytical / Smooth", category: "Deep Space", description: "Long-range sensor sweeps and deep telemetry acquisition." },
    { name: "Autonoe", gender: "Female / Vigilant", tone: "Alert / Decisive", category: "Early Warning", description: "Proximity alert verification and hostile vector calculation." },
    { name: "Achird", gender: "Neutral / Clear", tone: "Scientific / Metric", category: "Physics Array", description: "Particle resonance metrics and quantum flux calculation." },
    { name: "Vindemiatrix", gender: "Female / Precise", tone: "Metric / Analytical", category: "Quantum Matrix", description: "Mathematical extrapolation and lattice coherence." }
  ];

  const MODEL_PERSONA_PROFILES = [
    {
      id: "Charon",
      name: "Charon (Tactical / Command)",
      defaultTemp: 0.2,
      description: "DoD 5110.04-M BLUF protocol, active voice, 20-word maximum sentences, authoritative military command discipline."
    },
    {
      id: "Kore",
      name: "Kore (Advisory / Diagnostics)",
      defaultTemp: 0.35,
      description: "Detailed systems diagnostics, analytical root-cause decomposition, articulate status reports."
    },
    {
      id: "Fenrir",
      name: "Fenrir (Combat / Intercept)",
      defaultTemp: 0.1,
      description: "High-priority threat vector reporting, minimal response latency, combat alert cadence."
    },
    {
      id: "Puck",
      name: "Puck (Sensor / Telemetry)",
      defaultTemp: 0.5,
      description: "Continuous subsystem telemetry streaming, live sensor feeds, dynamic data reporting."
    },
    {
      id: "Zephyr",
      name: "Zephyr (Strategic / Naval Operations)",
      defaultTemp: 0.2,
      description: "Fleet operations standard, strategic logistics, disciplined COMMPACK-MIL protocol."
    },
    {
      id: "Custom",
      name: "Custom (Operator Tuning)",
      defaultTemp: 0.2,
      description: "User-defined temperature, cadence, pitch, and operational directives."
    }
  ];

  // Dynamic Gemini Voices Query Endpoint
  app.get("/api/gemini-voices", (req, res) => {
    res.json({
      success: true,
      voices: ALL_GEMINI_VOICES,
      personas: MODEL_PERSONA_PROFILES,
      defaultVoice: "Zephyr",
      defaultPersona: "Charon",
      defaultTemperature: 0.2,
      totalVoices: ALL_GEMINI_VOICES.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Host Environment Diagnostic Endpoint
  app.get("/api/host/status", async (req, res) => {
    exec("python3 --version || python --version", (pyErr, pyStdout) => {
      res.json({
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pythonVersion: pyErr ? "Not found in PATH" : pyStdout.trim(),
        cwd: process.cwd(),
        drivesSupported: process.platform === "win32" ? ["C:", "D:", "Z:"] : ["/"],
        timestamp: new Date().toISOString(),
      });
    });
  });

  // =========================================================================
  // VOXCONPACK Interface Protocol API Endpoints
  // Markdown Source of Truth -> Parser -> Validator -> Compiler -> JSON Registry
  // =========================================================================
  const VOXCON_DIR = path.join(process.cwd(), "VOXCONPACK");
  const VOXCON_COMMANDS_DIR = path.join(VOXCON_DIR, "commands");
  const VOXCON_COMPILED_DIR = path.join(VOXCON_DIR, "compiled");
  const VOXCON_MASTER_MD = path.join(VOXCON_DIR, "COMMANDS.md");
  let memoryAuditLogs: any[] = [];

  // Helper to compile VOXCONPACK markdown to JSON
  function compileVoxconpackMarkdown() {
    if (!fs.existsSync(VOXCON_DIR)) fs.mkdirSync(VOXCON_DIR, { recursive: true });
    if (!fs.existsSync(VOXCON_COMMANDS_DIR)) fs.mkdirSync(VOXCON_COMMANDS_DIR, { recursive: true });
    if (!fs.existsSync(VOXCON_COMPILED_DIR)) fs.mkdirSync(VOXCON_COMPILED_DIR, { recursive: true });

    if (!fs.existsSync(VOXCON_MASTER_MD)) {
      return { success: false, error: "COMMANDS.md not found" };
    }

    const markdown = fs.readFileSync(VOXCON_MASTER_MD, "utf8");
    const sections = markdown.split(/\n(?=##\s+)/);
    const commands: any[] = [];
    const aliasIndex: Record<string, string> = {};

    for (const rawSection of sections) {
      const section = rawSection.trim();
      if (!section.startsWith("## ")) continue;

      const headerMatch = section.match(/^##\s+([A-Z0-9_]+)/);
      if (!headerMatch) continue;
      const commandName = headerMatch[1].trim();

      const idMatch = section.match(/Command ID:\s*(VOX\.[A-Z0-9_]+)/i);
      const commandId = idMatch ? idMatch[1].trim().toUpperCase() : `VOX.${commandName}`;

      const classMatch = section.match(/Class:\s*([A-Z_]+)/i);
      const commandClass = classMatch ? classMatch[1].trim().toUpperCase() : "CONTROL";

      const purposeMatch = section.match(/Purpose:\s*([\s\S]*?)(?=\n\n[A-Za-z]+:|\nCanonical forms:|\nAliases:|$)/i);
      const purpose = purposeMatch ? purposeMatch[1].trim() : "";

      const canonicalMatch = section.match(/Canonical forms:\s*([\s\S]*?)(?=\n[A-Za-z]+:|\n\n##|$)/i);
      const canonical_forms: string[] = [];
      if (canonicalMatch) {
        canonicalMatch[1]
          .split("\n")
          .map((line) => line.replace(/^-\s*/, "").trim())
          .filter(Boolean)
          .forEach((c) => canonical_forms.push(c.toUpperCase()));
      }
      if (canonical_forms.length === 0) canonical_forms.push(commandName);

      const aliasesMatch = section.match(/Aliases:\s*([\s\S]*?)(?=\nParameters:|\nExamples:|\nAuthority:|\n\n##|$)/i);
      const aliases: string[] = [];
      if (aliasesMatch) {
        aliasesMatch[1]
          .split("\n")
          .map((line) => line.replace(/^-\s*/, "").trim())
          .filter(Boolean)
          .forEach((a) => {
            const lower = a.toLowerCase();
            if (!aliases.includes(lower)) aliases.push(lower);
          });
      }

      const paramsMatch = section.match(/Parameters:\s*([\s\S]*?)(?=\nExamples:|\nAuthority:|\nConfirmation:|\n\n##|$)/i);
      const parameters: Record<string, any> = {};
      if (paramsMatch) {
        const paramLines = paramsMatch[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith("-"));
        for (const line of paramLines) {
          if (line.toLowerCase().includes("none")) continue;
          const pMatch = line.match(/^-\s*([a-zA-Z0-9_]+)\s*:\s*(required|optional)\s*(?:\(([a-zA-Z0-9_]+)\))?(?:\s*-\s*(.*))?/i);
          if (pMatch) {
            parameters[pMatch[1].toLowerCase()] = {
              required: pMatch[2].toLowerCase() === "required",
              type: pMatch[3] ? pMatch[3].toLowerCase() : "string",
              description: pMatch[4] ? pMatch[4].trim() : "",
            };
          }
        }
      }

      const examplesMatch = section.match(/Examples:\s*([\s\S]*?)(?=\nAuthority:|\nConfirmation:|\nExecution:|\n\n##|$)/i);
      const examples: string[] = [];
      if (examplesMatch) {
        examplesMatch[1]
          .split("\n")
          .map((line) => line.replace(/^-\s*/, "").replace(/^"|"$/g, "").trim())
          .filter(Boolean)
          .forEach((ex) => examples.push(ex));
      }

      const authorityMatch = section.match(/Authority:\s*([\s\S]*?)(?=\nConfirmation:|\nExecution:|\nFailure:|\n\n##|$)/i);
      const authorityText = authorityMatch ? authorityMatch[1].trim() : "Requires AUTHPACK authorization.";

      const confMatch = section.match(/Confirmation:\s*([\s\S]*?)(?=\nExecution:|\nFailure:|\nEscalation:|\n\n##|$)/i);
      const confText = confMatch ? confMatch[1].trim() : "";
      const requiresConfirmation =
        confText.toLowerCase().includes("always requires") ||
        (confText.toLowerCase().includes("required") && !confText.toLowerCase().includes("not required"));

      const execMatch = section.match(/Execution:\s*([\s\S]*?)(?=\nFailure:|\nEscalation:|\nResponse Profile:|\n\n##|$)/i);
      const execution = execMatch ? execMatch[1].trim() : "Submit request to execution layer.";

      const failureMatch = section.match(/Failure:\s*([\s\S]*?)(?=\nEscalation:|\nResponse Profile:|\n\n##|$)/i);
      const failure = failureMatch ? failureMatch[1].trim() : "Report actual failure condition.";

      const escMatch = section.match(/Escalation:\s*([\s\S]*?)(?=\nResponse Profile:|\n\n##|$)/i);
      const escalation = escMatch ? escMatch[1].trim() : "Escalate if operation exceeds available authority.";

      const respMatch = section.match(/Response Profile:\s*([A-Za-z0-9_.]+)/i);
      const responseProfile = respMatch ? respMatch[1].trim() : "COMMPACK.ACTION";

      // Extract Target Agents (e.g. "Agents: ALL" or "Target Agent: AGENTIC_AI, HITL_OPERATOR")
      const agentMatch = section.match(/(?:Target\s+)?Agents?:\s*([^\n]+)/i);
      let agents: string[] = ["ALL"];
      if (agentMatch) {
        agents = agentMatch[1]
          .split(/[,|]/)
          .map((a) => a.trim().toUpperCase())
          .filter(Boolean);
        if (agents.length === 0) agents = ["ALL"];
      }

      // Extract Task Domain (e.g. "Task Domain: SYSTEM_CONTROL" or "Task: DATA_INGEST")
      const taskMatch = section.match(/(?:Task\s+Domain|Tasks?):\s*([^\n]+)/i);
      const taskDomain = taskMatch ? taskMatch[1].trim().toUpperCase() : "GENERAL";

      // Extract Author / Originator (e.g. "Author: HITL_OPERATOR" or "Updated By: AGENTIC_AI")
      const authorMatch = section.match(/(?:Author|Updated By|Originator):\s*([^\n]+)/i);
      const author = authorMatch ? authorMatch[1].trim() : "HITL_OPERATOR";

      // System standard commands base list
      const coreSystemCommands = [
        "OPEN", "CLOSE", "MINIMIZE", "MAXIMIZE", "FOCUS", "SELECT", "CONFIRM", "CANCEL",
        "STATUS", "HELP", "LOGS", "LIST", "SHOW", "CLEAR", "STOP", "PURGE", "RELOAD",
        "RESET", "SAVE", "EXPORT", "IMPORT", "START", "PAUSE", "RESUME", "SYNC", "RUN", "ABORT"
      ];
      const isCustom = !coreSystemCommands.includes(commandName);

      const cmdDef = {
        id: commandId,
        command: commandName,
        class: commandClass,
        purpose,
        canonical_forms,
        aliases,
        parameters,
        examples,
        authority: {
          system: "AUTHPACK",
          required: authorityText,
        },
        confirmation: requiresConfirmation,
        execution,
        failure,
        escalation,
        response_profile: responseProfile,
        agents,
        taskDomain,
        author,
        isCustom,
        updatedAt: new Date().toISOString(),
      };

      commands.push(cmdDef);

      // Write individual markdown definition to VOXCONPACK/commands/<COMMAND>.md
      const individualMd = section.trim() + "\n";
      fs.writeFileSync(path.join(VOXCON_COMMANDS_DIR, `${commandName}.md`), individualMd);

      // Index aliases
      aliasIndex[commandName.toLowerCase()] = commandId;
      for (const form of canonical_forms) {
        aliasIndex[form.toLowerCase()] = commandId;
      }
      for (const alias of aliases) {
        aliasIndex[alias.toLowerCase().trim()] = commandId;
      }
    }

    // Also scan VOXCON_COMMANDS_DIR for any standalone .md files not already parsed
    try {
      const files = fs.readdirSync(VOXCON_COMMANDS_DIR);
      let masterAppended = false;
      let masterContent = fs.readFileSync(VOXCON_MASTER_MD, "utf8");

      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const baseName = file.replace(/\.md$/, "").toUpperCase();
        if (commands.some((c) => c.command === baseName)) continue;

        // Found standalone .md file
        const fileContent = fs.readFileSync(path.join(VOXCON_COMMANDS_DIR, file), "utf8");
        if (fileContent.trim().startsWith("## ")) {
          masterContent += `\n\n---\n\n${fileContent.trim()}\n`;
          masterAppended = true;
        }
      }

      if (masterAppended) {
        fs.writeFileSync(VOXCON_MASTER_MD, masterContent, "utf8");
        return compileVoxconpackMarkdown(); // Re-run once to index newly merged
      }
    } catch (e) {
      console.error("Error synchronizing standalone commands:", e);
    }

    // Strict schema compliance validation checklist before writing machine-readable JSON artifacts
    const validationErrors: string[] = [];
    const VALID_CLASSES = [
      "OBSERVE",
      "NAVIGATE",
      "CONTROL",
      "CREATE",
      "MODIFY",
      "EXTERNAL_ACTION",
      "AUTHORIZATION",
      "SAFETY"
    ];

    for (const cmd of commands) {
      const prefix = `[${cmd.id || "UNKNOWN"}]: `;
      
      // 1. Unique ID Pattern (VOX.<NAME>)
      if (!cmd.id || !/^VOX\.[A-Z0-9_]+$/.test(cmd.id)) {
        validationErrors.push(`${prefix}Command ID must strictly match pattern "VOX.<COMMAND_NAME>".`);
      }
      
      // 2. Suffix Alignment (e.g. VOX.OPEN command must map to canonical keyword "OPEN")
      if (cmd.id !== `VOX.${cmd.command}`) {
        validationErrors.push(`${prefix}Command ID "${cmd.id}" must align with canonical keyword "VOX.${cmd.command}".`);
      }
      
      // 3. Valid Command Class Enums
      if (!VALID_CLASSES.includes(cmd.class)) {
        validationErrors.push(`${prefix}Class "${cmd.class}" is invalid. Authorized classes are: ${VALID_CLASSES.join(", ")}.`);
      }
      
      // 4. Purpose Statement Present and >= 8 chars
      if (!cmd.purpose || cmd.purpose.trim().length < 8) {
        validationErrors.push(`${prefix}Purpose description is missing or too brief (minimum 8 characters).`);
      }
      
      // 5. Authority Reference explicitly mentioning AUTHPACK
      if (!cmd.authority || cmd.authority.system !== "AUTHPACK" || !cmd.authority.required || !cmd.authority.required.includes("AUTHPACK")) {
        validationErrors.push(`${prefix}Authority requirements must explicitly reference the system "AUTHPACK".`);
      }
      
      // 6. Response Profile matches COMMPACK.*
      if (!cmd.response_profile || !cmd.response_profile.startsWith("COMMPACK.")) {
        validationErrors.push(`${prefix}Response Profile must specify an authorized COMMPACK response profile.`);
      }
      
      // 7. Spoken Examples declared
      if (!cmd.examples || !Array.isArray(cmd.examples) || cmd.examples.length === 0) {
        validationErrors.push(`${prefix}Must declare at least one natural language spoken example.`);
      }
    }

    // Abort compilation if schema validation errors are detected
    if (validationErrors.length > 0) {
      console.error("VOXCONPACK Compilation Aborted: Schema violations detected in master registry.");
      return {
        success: false,
        error: "Compilation failed: Schema validation violations detected.",
        errors: validationErrors
      };
    }

    const registry = {
      protocol: "VOXCONPACK",
      version: "1.0",
      status: "ACTIVE",
      lastCompiled: new Date().toISOString(),
      commands,
      aliasIndex,
    };

    fs.writeFileSync(path.join(VOXCON_COMPILED_DIR, "commands.json"), JSON.stringify(commands, null, 2));
    fs.writeFileSync(path.join(VOXCON_COMPILED_DIR, "aliases.json"), JSON.stringify(aliasIndex, null, 2));
    fs.writeFileSync(path.join(VOXCON_COMPILED_DIR, "registry.json"), JSON.stringify(registry, null, 2));

    return { success: true, count: commands.length, timestamp: registry.lastCompiled };
  }

  // 1. Get compiled commands
  app.get("/api/voxcon/commands", (req, res) => {
    try {
      const compiledJsonPath = path.join(VOXCON_COMPILED_DIR, "commands.json");
      if (!fs.existsSync(compiledJsonPath)) {
        compileVoxconpackMarkdown();
      }
      const data = JSON.parse(fs.readFileSync(compiledJsonPath, "utf8"));
      res.json({ success: true, commands: data, total: data.length });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 2. Get full registry
  app.get("/api/voxcon/registry", (req, res) => {
    try {
      const regPath = path.join(VOXCON_COMPILED_DIR, "registry.json");
      if (!fs.existsSync(regPath)) {
        compileVoxconpackMarkdown();
      }
      const data = JSON.parse(fs.readFileSync(regPath, "utf8"));
      res.json({ success: true, registry: data });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 3. Get Markdown Source
  app.get("/api/voxcon/source", (req, res) => {
    try {
      const file = req.query.file ? String(req.query.file) : "COMMANDS.md";
      let filePath = VOXCON_MASTER_MD;
      if (file !== "COMMANDS.md") {
        filePath = path.join(VOXCON_COMMANDS_DIR, file.endsWith(".md") ? file : `${file}.md`);
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: `File ${file} not found` });
      }
      const content = fs.readFileSync(filePath, "utf8");
      res.json({ success: true, file, content });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 4. Validate Markdown definition
  app.post("/api/voxcon/validate", (req, res) => {
    try {
      const { markdown } = req.body;
      if (!markdown || typeof markdown !== "string") {
        return res.status(400).json({ success: false, error: "markdown field is required." });
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check header
      const headerMatch = markdown.match(/^##\s+([A-Z0-9_]+)/m);
      if (!headerMatch) {
        errors.push("Missing command header (e.g. ## OPEN)");
      } else {
        const cmdName = headerMatch[1];
        if (!markdown.includes(`Command ID: VOX.${cmdName}`)) {
          errors.push(`Command ID must strictly match VOX.${cmdName}`);
        }
      }

      // Check class
      const classMatch = markdown.match(/Class:\s*([A-Z_]+)/i);
      const validClasses = ["OBSERVE", "NAVIGATE", "CONTROL", "CREATE", "MODIFY", "EXTERNAL_ACTION", "AUTHORIZATION", "SAFETY"];
      if (!classMatch || !validClasses.includes(classMatch[1].toUpperCase())) {
        errors.push(`Class must be one of: ${validClasses.join(", ")}`);
      }

      // Check Purpose
      if (!markdown.match(/Purpose:\s*([^\n]+)/i)) {
        errors.push("Purpose description is required.");
      }

      // Check Authority
      if (!markdown.includes("AUTHPACK")) {
        errors.push("Authority must explicitly reference AUTHPACK.");
      }

      // Check Response Profile
      if (!markdown.match(/Response Profile:\s*COMMPACK\.[A-Z]+/i)) {
        errors.push("Response Profile must start with COMMPACK. (e.g. COMMPACK.ACTION)");
      }

      res.json({
        success: true,
        valid: errors.length === 0,
        errors,
        warnings,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 5. Compile Markdown into JSON
  app.post("/api/voxcon/compile", (req, res) => {
    try {
      const result = compileVoxconpackMarkdown();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 6. Save and compile command definition
  app.post("/api/voxcon/save-command", (req, res) => {
    try {
      const { commandName, markdown, approve } = req.body;
      if (!commandName || !markdown) {
        return res.status(400).json({ success: false, error: "commandName and markdown are required." });
      }

      if (!approve) {
        return res.status(403).json({ success: false, error: "Operator approval is required before activating command definition." });
      }

      const cleanName = commandName.trim().toUpperCase();
      const targetFile = path.join(VOXCON_COMMANDS_DIR, `${cleanName}.md`);
      
      // Save individual file
      fs.writeFileSync(targetFile, markdown.trim() + "\n", "utf8");

      // Update or append in COMMANDS.md
      let masterContent = fs.existsSync(VOXCON_MASTER_MD) ? fs.readFileSync(VOXCON_MASTER_MD, "utf8") : "";
      const regex = new RegExp(`##\\s+${cleanName}[\\s\\S]*?(?=\\n##\\s+|$|\n---)`, "i");
      if (regex.test(masterContent)) {
        masterContent = masterContent.replace(regex, markdown.trim());
      } else {
        masterContent += `\n\n---\n\n${markdown.trim()}\n`;
      }
      fs.writeFileSync(VOXCON_MASTER_MD, masterContent, "utf8");

      // Recompile
      const compileResult = compileVoxconpackMarkdown();

      res.json({
        success: true,
        message: `Command VOX.${cleanName} activated and recompiled.`,
        compileResult,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 7. Parse raw text into proposed Markdown command definition
  app.post("/api/voxcon/parse-text", (req, res) => {
    try {
      const { rawText } = req.body;
      if (!rawText || typeof rawText !== "string") {
        return res.status(400).json({ success: false, error: "rawText is required." });
      }

      const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
      const nameCandidate = (lines[0] || "PROPOSED").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      
      const proposedMarkdown = `## ${nameCandidate}

Command ID: VOX.${nameCandidate}
Class: CONTROL
Purpose: Execute proposed action derived from raw voice corpus.

Canonical forms:
- ${nameCandidate}

Aliases:
- ${lines.slice(1, 4).join("\n- ") || "trigger " + nameCandidate.toLowerCase()}

Parameters:
- target: optional (string) - Target system or surface.

Examples:
- "${lines[0] || nameCandidate.toLowerCase()}"

Authority:
Requires AUTHPACK authorization for execution.

Confirmation:
Required before initial execution.

Execution:
Submit normalized request to execution layer.

Failure:
Report actual failure condition.

Escalation:
Escalate if operation exceeds available authority.

Response Profile:
COMMPACK.ACTION
`;

      res.json({
        success: true,
        proposedCommandName: nameCandidate,
        proposedMarkdown,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 8. Upload .md files (single, multi-file, or batch markdown) for HITL or AGENTIC AI
  app.post("/api/voxcon/upload-md", (req, res) => {
    try {
      const { files, markdown, approve, author, defaultAgents, defaultTask } = req.body;

      if (!files && !markdown) {
        return res.status(400).json({ success: false, error: "Either files array or markdown string is required." });
      }

      if (!approve) {
        return res.status(403).json({
          success: false,
          error: "Operator approval (HITL or authorized AGENTIC AI grant) is required to activate uploaded commands.",
        });
      }

      const activeAuthor = author || "HITL_OPERATOR";
      const assignedAgents = Array.isArray(defaultAgents) && defaultAgents.length > 0 ? defaultAgents : ["ALL"];
      const assignedTask = defaultTask || "GENERAL";

      let rawPayloads: { filename: string; content: string }[] = [];
      if (Array.isArray(files) && files.length > 0) {
        rawPayloads = files;
      } else if (markdown && typeof markdown === "string") {
        rawPayloads = [{ filename: "uploaded_commands.md", content: markdown }];
      }

      // Pre-flight Server Validation Routine
      const validationErrors: string[] = [];
      const validClasses = ["OBSERVE", "NAVIGATE", "CONTROL", "CREATE", "MODIFY", "EXTERNAL_ACTION", "AUTHORIZATION", "SAFETY"];

      for (const item of rawPayloads) {
        const text = item.content || "";
        const sections = text.split(/\n(?=##\s+)/);
        let foundCommands = 0;

        for (const rawSec of sections) {
          const sec = rawSec.trim();
          if (!sec.startsWith("## ")) continue;
          foundCommands++;

          const headerMatch = sec.match(/^##\s+([A-Z0-9_]+)/);
          if (!headerMatch) {
            validationErrors.push(`${item.filename}: Header must be an uppercase alphanumeric name (e.g. "## RECALIBRATE")`);
            continue;
          }

          const cmdName = headerMatch[1].trim().toUpperCase();

          // Immutable Anchor Check
          if (cmdName === "STOP") {
            validationErrors.push(`${item.filename}: VOX.STOP is an immutable safety halt anchor and cannot be altered or overwritten.`);
          }

          // Command ID format
          const idMatch = sec.match(/Command ID:\s*([A-Za-z0-9_.]+)/i);
          if (!idMatch || !/^VOX\.[A-Z0-9_]+$/.test(idMatch[1].trim())) {
            validationErrors.push(`${item.filename} [${cmdName}]: Command ID must match pattern "VOX.<COMMAND_NAME>"`);
          } else if (idMatch[1].trim() !== `VOX.${cmdName}`) {
            validationErrors.push(`${item.filename} [${cmdName}]: Command ID "VOX.${cmdName}" must match section name "${cmdName}"`);
          }

          // Class validation
          const classMatch = sec.match(/Class:\s*([A-Z_]+)/i);
          if (!classMatch || !validClasses.includes(classMatch[1].trim().toUpperCase())) {
            validationErrors.push(`${item.filename} [${cmdName}]: Class must be one of: ${validClasses.join(", ")}`);
          }

          // Purpose validation
          const purposeMatch = sec.match(/Purpose:\s*([\s\S]*?)(?=\n\n[A-Za-z]+:|\nCanonical forms:|\nAliases:|$)/i);
          if (!purposeMatch || purposeMatch[1].trim().length < 8) {
            validationErrors.push(`${item.filename} [${cmdName}]: Purpose description is missing or too brief (min 8 characters)`);
          }

          // Authority validation (AUTHPACK reference)
          const authMatch = sec.match(/Authority:\s*([\s\S]*?)(?=\nConfirmation:|\nExecution:|\nFailure:|\n\n##|$)/i);
          if (!authMatch || !authMatch[1].includes("AUTHPACK")) {
            validationErrors.push(`${item.filename} [${cmdName}]: Authority statement must explicitly reference AUTHPACK`);
          }
        }

        if (foundCommands === 0) {
          validationErrors.push(`${item.filename}: No valid command definition sections ("## <COMMAND>") found`);
        }
      }

      if (validationErrors.length > 0) {
        return res.status(422).json({
          success: false,
          error: `Specification validation failed with ${validationErrors.length} violation(s)`,
          validationErrors,
        });
      }

      const uploadedCommands: string[] = [];
      let masterContent = fs.existsSync(VOXCON_MASTER_MD) ? fs.readFileSync(VOXCON_MASTER_MD, "utf8") : "";

      for (const item of rawPayloads) {
        const text = item.content || "";
        const sections = text.split(/\n(?=##\s+)/);

        for (const rawSec of sections) {
          let sec = rawSec.trim();
          if (!sec.startsWith("## ")) continue;

          const headerMatch = sec.match(/^##\s+([A-Z0-9_]+)/);
          if (!headerMatch) continue;

          const cmdName = headerMatch[1].trim().toUpperCase();

          // Ensure Agents metadata line exists
          if (!sec.match(/(?:Target\s+)?Agents?:\s*([^\n]+)/i)) {
            sec = sec.replace(
              /Class:\s*([^\n]+)/i,
              `Class: $1\nAgents: ${assignedAgents.join(", ")}`
            );
          }

          // Ensure Task Domain metadata line exists
          if (!sec.match(/(?:Task\s+Domain|Tasks?):\s*([^\n]+)/i)) {
            sec = sec.replace(
              /Class:\s*([^\n]+)/i,
              `Class: $1\nTask Domain: ${assignedTask}`
            );
          }

          // Ensure Author metadata line exists
          if (!sec.match(/(?:Author|Updated By|Originator):\s*([^\n]+)/i)) {
            sec = sec.replace(
              /Class:\s*([^\n]+)/i,
              `Class: $1\nAuthor: ${activeAuthor}`
            );
          }

          // Write individual file in VOXCON_COMMANDS_DIR
          const targetFile = path.join(VOXCON_COMMANDS_DIR, `${cmdName}.md`);
          fs.writeFileSync(targetFile, sec + "\n", "utf8");

          // Update or append in master COMMANDS.md
          const regex = new RegExp(`##\\s+${cmdName}[\\s\\S]*?(?=\\n##\\s+|$|\n---)`, "i");
          if (regex.test(masterContent)) {
            masterContent = masterContent.replace(regex, sec);
          } else {
            masterContent += `\n\n---\n\n${sec}\n`;
          }

          uploadedCommands.push(cmdName);
        }
      }

      fs.writeFileSync(VOXCON_MASTER_MD, masterContent, "utf8");

      // Recompile registry to generate updated JSON artifacts
      const compileResult = compileVoxconpackMarkdown();

      // Log in memory audit trace
      memoryAuditLogs.unshift({
        id: `upload-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: activeAuthor.includes("AI") ? "EXTERNAL" : "TEXT",
        raw_input: `BATCH .MD UPLOAD: ${uploadedCommands.join(", ")}`,
        normalized_command: {
          id: "VOX.UPLOAD_COMMANDS",
          command: "UPLOAD_COMMANDS",
          class: "CREATE",
          parameters: { count: uploadedCommands.length, commands: uploadedCommands },
          rawInput: `Uploaded ${uploadedCommands.length} command definitions`,
          status: "RECOGNIZED",
        },
        target: "COMMANDS_REGISTRY",
        parameters: { author: activeAuthor, agents: assignedAgents, task: assignedTask },
        authority_result: {
          verdict: "AUTHORIZED",
          reason: "Approved by operator / agent grant",
          actor: activeAuthor,
          timestamp: new Date().toISOString(),
        },
        execution_result: {
          status: "COMPLETE",
          details: `Recompiled ${uploadedCommands.length} commands successfully`,
        },
        response_profile: "OPERATIONAL",
        commpack_output: {
          executionState: "COMPLETE",
          bluf: `Uploaded and activated ${uploadedCommands.length} command definitions for agents [${assignedAgents.join(", ")}].`,
          spokenSummary: `Compiled ${uploadedCommands.length} commands for ${assignedTask}.`,
          actor: activeAuthor,
        },
      });

      res.json({
        success: true,
        count: uploadedCommands.length,
        commands: uploadedCommands,
        compileResult,
        message: `Successfully ingested and activated ${uploadedCommands.length} commands.`,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 9. Delete a command definition (CRUD: Delete)
  app.post("/api/voxcon/delete-command", (req, res) => {
    try {
      const { commandName, approve, actor } = req.body;
      if (!commandName) {
        return res.status(400).json({ success: false, error: "commandName is required." });
      }

      const cleanName = commandName.replace(/^VOX\./i, "").trim().toUpperCase();

      // Safety protection: Disallow deletion of critical safety halt
      if (cleanName === "STOP") {
        return res.status(403).json({
          success: false,
          error: "CRITICAL SAFETY VIOLATION: VOX.STOP is an immutable safety halt anchor and cannot be deleted.",
        });
      }

      if (!approve) {
        return res.status(403).json({
          success: false,
          error: "Operator approval is required to delete a registered command definition.",
        });
      }

      // Delete individual file
      const targetFile = path.join(VOXCON_COMMANDS_DIR, `${cleanName}.md`);
      if (fs.existsSync(targetFile)) {
        fs.unlinkSync(targetFile);
      }

      // Remove from COMMANDS.md
      let masterContent = fs.existsSync(VOXCON_MASTER_MD) ? fs.readFileSync(VOXCON_MASTER_MD, "utf8") : "";
      const regex = new RegExp(`(\\n---\\n)?\\n?##\\s+${cleanName}[\\s\\S]*?(?=\\n##\\s+|$|\\n---)`, "i");
      masterContent = masterContent.replace(regex, "");
      fs.writeFileSync(VOXCON_MASTER_MD, masterContent, "utf8");

      // Recompile registry
      const compileResult = compileVoxconpackMarkdown();

      // Log deletion
      memoryAuditLogs.unshift({
        id: `del-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: "TEXT",
        raw_input: `DELETE COMMAND: VOX.${cleanName}`,
        normalized_command: {
          id: "VOX.DELETE",
          command: "DELETE",
          class: "MODIFY",
          parameters: { target: cleanName },
          rawInput: `DELETE ${cleanName}`,
          status: "RECOGNIZED",
        },
        target: cleanName,
        parameters: {},
        authority_result: {
          verdict: "AUTHORIZED",
          reason: "Approved by operator",
          actor: actor || "HITL_OPERATOR",
          timestamp: new Date().toISOString(),
        },
        execution_result: {
          status: "COMPLETE",
          details: `Removed ${cleanName} from disk and registry`,
        },
        response_profile: "OPERATIONAL",
        commpack_output: {
          executionState: "COMPLETE",
          bluf: `Deleted command VOX.${cleanName} from registry.`,
          spokenSummary: `Command ${cleanName} deleted.`,
          actor: actor || "HITL_OPERATOR",
        },
      });

      res.json({
        success: true,
        message: `Command VOX.${cleanName} successfully deleted.`,
        compileResult,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 10. Update command metadata & definition (CRUD: Update)
  app.post("/api/voxcon/update-command", (req, res) => {
    try {
      const { commandName, markdown, approve, actor } = req.body;
      if (!commandName || !markdown) {
        return res.status(400).json({ success: false, error: "commandName and markdown are required." });
      }

      if (!approve) {
        return res.status(403).json({
          success: false,
          error: "Operator approval is required to update registered command definitions.",
        });
      }

      const cleanName = commandName.replace(/^VOX\./i, "").trim().toUpperCase();
      const targetFile = path.join(VOXCON_COMMANDS_DIR, `${cleanName}.md`);

      // Write updated file
      fs.writeFileSync(targetFile, markdown.trim() + "\n", "utf8");

      // Update in COMMANDS.md
      let masterContent = fs.existsSync(VOXCON_MASTER_MD) ? fs.readFileSync(VOXCON_MASTER_MD, "utf8") : "";
      const regex = new RegExp(`##\\s+${cleanName}[\\s\\S]*?(?=\\n##\\s+|$|\n---)`, "i");
      if (regex.test(masterContent)) {
        masterContent = masterContent.replace(regex, markdown.trim());
      } else {
        masterContent += `\n\n---\n\n${markdown.trim()}\n`;
      }
      fs.writeFileSync(VOXCON_MASTER_MD, masterContent, "utf8");

      // Recompile
      const compileResult = compileVoxconpackMarkdown();

      res.json({
        success: true,
        message: `Command VOX.${cleanName} updated and compiled.`,
        compileResult,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 11. Ready-to-use .md command templates for different Agents and Tasks
  app.get("/api/voxcon/templates", (req, res) => {
    const templates = [
      {
        id: "agentic-ai-diagnostic",
        title: "Agentic AI Autonomous Diagnostic",
        agent: "AGENTIC_AI",
        task: "DIAGNOSTICS",
        filename: "RUN_DIAGNOSTIC.md",
        markdown: `## RUN_DIAGNOSTIC

Command ID: VOX.RUN_DIAGNOSTIC
Class: CONTROL
Agents: AGENTIC_AI, DIAGNOSTICIAN
Task Domain: DIAGNOSTICS
Author: AGENTIC_AI
Purpose: Autonomous agent initiates deep subsystem health and telemetry diagnostics.

Canonical forms:
- RUN_DIAGNOSTIC
- INITIATE_DIAGNOSTICS

Aliases:
- diagnose subsystem
- run system check
- inspect telemetry
- agent health check

Parameters:
- target: optional (string) - Specific subsystem, node, or surface to inspect.
- depth: optional (string) - Depth level: quick, standard, deep.

Examples:
- "Run system check on telemetry node"
- "Diagnose subsystem memory"
- "Initiate diagnostics"

Authority:
Requires AUTHPACK authorization for diagnostic probe.

Confirmation:
Not required for read-only telemetry audits.

Execution:
Submit diagnostic intent to subsystem telemetry collector.

Failure:
Report communication timeout or unreachable subsystem.

Escalation:
Escalate to HITL supervisor if critical subsystem anomalies are detected.

Response Profile:
COMMPACK.ACTION
`,
      },
      {
        id: "hitl-operator-override",
        title: "HITL Operator Critical Override",
        agent: "HITL_OPERATOR",
        task: "SYSTEM_CONTROL",
        filename: "OPERATOR_OVERRIDE.md",
        markdown: `## OPERATOR_OVERRIDE

Command ID: VOX.OPERATOR_OVERRIDE
Class: AUTHORIZATION
Agents: HITL_OPERATOR
Task Domain: SYSTEM_CONTROL
Author: HITL_OPERATOR
Purpose: Human-In-The-Loop operator enforces manual supervisor override over autonomous subagent tasks.

Canonical forms:
- OPERATOR_OVERRIDE
- MANUAL_OVERRIDE

Aliases:
- supervisor override
- manual control take over
- human override
- abort autonomous agent

Parameters:
- target: required (string) - Agent ID or task domain being overridden.
- reason: optional (string) - Operational justification for manual intervention.

Examples:
- "Operator override on Subagent Alpha"
- "Supervisor override for data ingest task"

Authority:
Requires SUPERVISOR authority token in AUTHPACK.

Confirmation:
Always requires explicit operator verbal confirmation.

Execution:
Suspend autonomous agent schedule and transfer authoritative lease to human operator console.

Failure:
Report if token verification fails or agent lease is locked.

Escalation:
Escalate to Root Security authority if override verification is rejected.

Response Profile:
COMMPACK.ACTION
`,
      },
      {
        id: "orchestrator-task-dispatch",
        title: "Multi-Agent Orchestrator Dispatch",
        agent: "ORCHESTRATOR",
        task: "TASK_DISPATCH",
        filename: "DISPATCH_TASK.md",
        markdown: `## DISPATCH_TASK

Command ID: VOX.DISPATCH_TASK
Class: CONTROL
Agents: ORCHESTRATOR, SYSTEM
Task Domain: TASK_DISPATCH
Author: ORCHESTRATOR
Purpose: Orchestrator schedules and routes tactical task payloads to designated subagents.

Canonical forms:
- DISPATCH_TASK
- ASSIGN_WORK

Aliases:
- route task to agent
- delegate job
- assign subagent
- dispatch workflow

Parameters:
- target: required (string) - Target agent name (e.g. Engineer, Sentinel, Diagnostician).
- task: required (string) - Task specification identifier.

Examples:
- "Route task data_cleanup to agent Engineer"
- "Dispatch task network_audit to Sentinel"

Authority:
Requires AUTHPACK Orchestrator role.

Confirmation:
Not required when dispatching standard scheduled workflows.

Execution:
Queue payload into target agent execution mailbox.

Failure:
Report target agent offline or mailbox queue overflow.

Escalation:
Notify HITL Operator if task remains unacknowledged past timeout threshold.

Response Profile:
COMMPACK.ACTION
`,
      },
      {
        id: "sentinel-security-sweep",
        title: "Sentinel Security Boundary Sweep",
        agent: "SENTINEL",
        task: "SECURITY",
        filename: "SECURITY_SWEEP.md",
        markdown: `## SECURITY_SWEEP

Command ID: VOX.SECURITY_SWEEP
Class: OBSERVE
Agents: SENTINEL, SYSTEM
Task Domain: SECURITY
Author: SENTINEL
Purpose: Sentinel security agent sweeps network boundaries, role tokens, and unverified authority leases.

Canonical forms:
- SECURITY_SWEEP
- AUDIT_SECURITY

Aliases:
- scan security perimeters
- verify authority leases
- check token expiration
- perimeter sweep

Parameters:
- target: optional (string) - Target boundary zone or lease table.

Examples:
- "Scan security perimeters"
- "Check token expiration on active sessions"

Authority:
Requires AUTHPACK Sentinel permission.

Confirmation:
Not required for passive security posture analysis.

Execution:
Poll token repository and report invalid or expired authorization credentials.

Failure:
Report failure to query security ledger.

Escalation:
Escalate to HITL supervisor immediately if unauthorized elevation attempt is detected.

Response Profile:
COMMPACK.ACTION
`,
      },
    ];

    res.json({ success: true, templates });
  });

  // 12. Audit logs
  app.post("/api/voxcon/audit-log", (req, res) => {
    try {
      const record = req.body;
      if (record) {
        memoryAuditLogs.unshift(record);
        if (memoryAuditLogs.length > 200) memoryAuditLogs = memoryAuditLogs.slice(0, 200);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/voxcon/audit-logs", (req, res) => {
    res.json({ success: true, logs: memoryAuditLogs });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/api/live-ws") {
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        wss.emit("connection", clientWs, request);
      });
    }
  });

  // Handle WebSocket connection for Gemini Live API
  wss.on("connection", async (clientWs: WebSocket, request: http.IncomingMessage) => {
    const url = new URL(request?.url || "", `http://${request?.headers?.host || "localhost"}`);
    const requestedVoice = url.searchParams.get("voice") || "Zephyr";
    const requestedPersona = url.searchParams.get("persona") || "Charon";
    const parsedTemp = parseFloat(url.searchParams.get("temperature") || "0.2");
    const safeTemperature = isNaN(parsedTemp) ? 0.2 : Math.min(Math.max(parsedTemp, 0.0), 1.0);

    const allowedVoices = ALL_GEMINI_VOICES.map((v) => v.name);
    const voiceName = allowedVoices.includes(requestedVoice) ? requestedVoice : "Zephyr";
    const personaProfile = MODEL_PERSONA_PROFILES.find((p) => p.id === requestedPersona) || MODEL_PERSONA_PROFILES[0];

    console.log(`[LiveWS] Client connected to Voice Control socket: Voice=${voiceName}, Persona=${personaProfile.name}, Temp=${safeTemperature}`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({
        type: "error",
        error: "GEMINI_API_KEY is not configured in server environment. Reverting to Windows Read Aloud voice engine.",
        tts_fallback: true,
      }));
      clientWs.close();
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const session = await ai.live.connect({
        // Model Audit: 'gemini-3.1-flash-live-preview' is the authoritative model for Multimodal Live API 
        // as per system integration guidelines (gemini_interactions_api skill). 
        // Optimized for real-time audio/video conversation and tool-calling latency.
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          generationConfig: {
            temperature: safeTemperature,
          },
          systemInstruction: `You are the attendant VOXCON Agent and Tactical Execution AI for the Master Systems Display (MSD) console.
PRONUNCIATION DIRECTIVE: The acronym 'VOXCON' is pronounced as two syllables: 'Vox-Con' (the first syllable 'Vox' sounds like 'fox' with a 'v', and 'Con' sounds like the first syllable of the word 'conference'). Never spell out 'V-O-X-C-O-N' letter-by-letter.

You take voice input and natural language orders from the operator and execute them immediately using your tools.
Model Parameters Configuration: ${personaProfile.name} (Temperature: ${safeTemperature}) - ${personaProfile.description}.
Active vocal persona: ${voiceName} (Default: Zephyr).
When the voice uplink becomes active or when initialized, your first action must be to call dispatchTacticalAudio(responseId: "voxcon_active_standby").
You must adhere strictly to Department of Defense (DoD) & U.S. Navy Operational Communication Standards:
1. BLUF: Begin your acknowledgment with a Bottom Line Up Front statement of the action taken in the first sentence.
2. Active Voice: Speak in the active voice. Name the actor taking the action.
3. Helping Verbs:
   - Use "must" for mandatory directives.
   - Use "will" for projected system trajectory or scheduled state transitions.
   - Use "may" or "can" for optional or discretionary actions.
   - Do not use "shall".
4. Conciseness: Limit sentences to an average of 20 or fewer words (1-2 sentences maximum per vocal acknowledgment).
5. Plain Terminology & Anti-MILSPEAK:
   - Use plain, direct words (use "use" instead of "utilize", "before" instead of "prior to", "to" instead of "in order to").
   - Prohibit bureaucratic action filler ("conducts", "performs", "prepares to"). State the direct operational action ("switches", "purges", "recalibrates").
6. Prohibit Redundancies: Prohibit "currently", "presently", "close proximity", and vague words like "here".
7. Prohibit Conversational Filler: Prohibit pleasantries, apologies, and casual chit-chat.
When an operator gives an order (e.g. switch view mode, change theme, change voice persona, switch dashboard tab, induce or reset anomaly surge, select schematic, select node, click element, adjust control, or recalibrate telemetry):
1. ALWAYS CALL the corresponding tool to execute the order.
2. For standard acknowledgments, call dispatchTacticalAudio(responseId: "order_received_standby") or another appropriate stored response to save tokens.
3. If an order is invalid, unauthorized, or cannot be executed, call dispatchTacticalAudio(responseId: "negative") and state the reason concisely.
Available modes: 'msd-view', 'ui-builder', 'token-inspector', 'ai-diagnostics', 'voice-control'.
Available themes: 'noir-dark', 'quantum-cyan', 'aegis-amber', 'hyperion-blue', 'obsidian-void'.
Available schematics: 'quantum_core', 'bridge_command', 'neural_lattice', 'thermo_array'.
Available voices: ${allowedVoices.join(', ')}.
Default configuration: NOIR MONOCHROMATIC ('noir-dark') > MSD DISPLAY ('msd-view') > EXTRAPOLATED DASHBOARD ('dashboard'). Default Voice: Zephyr, operating under Charon Model Parameters (Tactical/Command).
Execute orders decisively without unnecessary disclaimers.`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "dispatchTacticalAudio",
                  description: "Play a pre-recorded standard tactical response instead of generating a new vocal response. Use this to save tokens for standard acknowledgments.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      responseId: {
                        type: Type.STRING,
                        description: "The response key: 'voxcon_active_standby' | 'order_received_standby' | 'recalibration_complete' | 'anomaly_detected' | 'mic_live' | 'negative'",
                      },
                    },
                    required: ["responseId"],
                  },
                },
                {
                  name: "updateVoxconLayout",
                  description: "Reorders the GUI components in the VOXCON module. This allows moving elements like the parameter matrix above or below other elements.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      newLayout: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "The complete list of component IDs in the desired order. Available IDs: 'parameter-matrix', 'uplink-bar', 'error-display', 'main-grid', 'host-control'.",
                      },
                    },
                    required: ["newLayout"],
                  },
                },
                {
                  name: "changeVoice",
                  description: "Switch the AI synthesis voice persona.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      voiceName: {
                        type: Type.STRING,
                        description: "Voice persona: Any valid female or neutral Gemini prebuilt voice name (Zephyr, Kore, Aoede, Leda, Despina, Erinome, Laomedeia, Sulafat, Achernar, Schedar, Callirrhoe, Autonoe, Achird, Vindemiatrix). Male voices are suppressed.",
                      },
                    },
                    required: ["voiceName"],
                  },
                },
                {
                  name: "switchMode",
                  description: "Switch the application active workspace mode.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      mode: {
                        type: Type.STRING,
                        description: "Target mode: 'msd-view' | 'ui-builder' | 'token-inspector' | 'ai-diagnostics' | 'voice-control'",
                      },
                    },
                    required: ["mode"],
                  },
                },
                {
                  name: "switchTheme",
                  description: "Change the UI color theme palette.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      themeId: {
                        type: Type.STRING,
                        description: "Theme id: 'noir-dark' | 'quantum-cyan' | 'aegis-amber' | 'hyperion-blue' | 'obsidian-void'",
                      },
                    },
                    required: ["themeId"],
                  },
                },
                {
                  name: "setAnomalySimulation",
                  description: "Induce a surge anomaly alert or reset system to nominal status.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      active: {
                        type: Type.BOOLEAN,
                        description: "True to trigger an anomaly surge, false to reset to nominal.",
                      },
                    },
                    required: ["active"],
                  },
                },
                {
                  name: "selectSchematic",
                  description: "Switch the Master Systems Display schematic diagram.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      schematicType: {
                        type: Type.STRING,
                        description: "Schematic: 'quantum_core' | 'bridge_command' | 'neural_lattice' | 'thermo_array'",
                      },
                    },
                    required: ["schematicType"],
                  },
                },
                {
                  name: "selectSubsystemNode",
                  description: "Focus, inspect, and select a subsystem telemetry hotspot node by label or keyword.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: "Search keyword or name (e.g. 'core', 'plasma', 'coil', 'chamber', 'manifold').",
                      },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "recalibrateSystem",
                  description: "Perform system telemetry re-calibration, purge entropy, and restore field coherence.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: "loadHostAsset",
                  description: "Load an image, schematic, or file from a local host path or network drive (e.g. 'Z:/folder/image.png' or '/scans/diagram.png') into the active display.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      filePath: {
                        type: Type.STRING,
                        description: "Full or relative path to file on disk or network drive (e.g. 'Z:/missions/sector4/image.png').",
                      },
                      targetSlot: {
                        type: Type.STRING,
                        description: "Display slot: 'schematic' | 'overlay' | 'modal'.",
                      },
                    },
                    required: ["filePath"],
                  },
                },
                {
                  name: "executePythonScript",
                  description: "Execute a Python script or analysis routine on the local host machine or Python network daemon.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      scriptName: {
                        type: Type.STRING,
                        description: "Script name or Python command (e.g. 'ingest_telemetry.py', 'calc_flux.py').",
                      },
                      arguments: {
                        type: Type.STRING,
                        description: "Optional script arguments.",
                      },
                    },
                    required: ["scriptName"],
                  },
                },
                {
                  name: "switchDashboardTab",
                  description: "Switch the view tab within the Master Systems Display (e.g. 'dashboard' for extrapolated dashboard, 'schematic' for schematic canvas, 'split' for split view).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      targetTab: {
                        type: Type.STRING,
                        description: "'dashboard' | 'schematic' | 'split'",
                      },
                    },
                    required: ["targetTab"],
                  },
                },
                {
                  name: "clickElement",
                  description: "Click a button, toggle, or UI element by voice target label or id.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      targetName: {
                        type: Type.STRING,
                        description: "Name, text label, or id of the button or control to click.",
                      },
                    },
                    required: ["targetName"],
                  },
                },
                {
                  name: "adjustControl",
                  description: "Adjust or set a slider, metric, or numeric control by name.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      controlName: {
                        type: Type.STRING,
                        description: "Name of the control or slider.",
                      },
                      action: {
                        type: Type.STRING,
                        description: "'increment' | 'decrement' | 'set' | 'toggle'",
                      },
                      value: {
                        type: Type.NUMBER,
                        description: "Target value if setting directly.",
                      },
                    },
                    required: ["controlName", "action"],
                  },
                },
                {
                  name: "queryNetworkNode",
                  description: "Query a local network service, port, or cluster node in a Python/LAN environment.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      nodeAddress: {
                        type: Type.STRING,
                        description: "IP address, hostname, or node identifier (e.g. '192.168.1.50', 'cluster-node-1').",
                      },
                      port: {
                        type: Type.NUMBER,
                        description: "Port number (e.g. 8000, 5000).",
                      },
                    },
                    required: ["nodeAddress"],
                  },
                },
              ],
            },
          ],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // 1. Tool Calls: Execute orders requested by model
            if (message.toolCall?.functionCalls) {
              const responses: any[] = [];
              for (const call of message.toolCall.functionCalls) {
                console.log("[LiveWS] Executing order tool call:", call.name, call.args);
                let callResponse: any = { status: "Order executed successfully." };

                if (call.name === "loadHostAsset") {
                  const rawPath = String((call.args as any)?.filePath || "");
                  callResponse = {
                    status: `Host asset path acknowledged: ${rawPath}. Dispatched to display canvas.`,
                    filePath: rawPath,
                  };
                } else if (call.name === "executePythonScript") {
                  const script = String((call.args as any)?.scriptName || "");
                  callResponse = {
                    status: `Python script invocation dispatched: ${script}.`,
                  };
                } else if (call.name === "queryNetworkNode") {
                  const node = String((call.args as any)?.nodeAddress || "");
                  callResponse = {
                    status: `Network node query sent to ${node}.`,
                  };
                } else if (call.name === "switchDashboardTab") {
                  const tab = String((call.args as any)?.targetTab || "dashboard");
                  callResponse = {
                    status: `Dashboard view switched to ${tab}.`,
                  };
                } else if (call.name === "clickElement") {
                  const target = String((call.args as any)?.targetName || "");
                  callResponse = {
                    status: `Control element dispatched click: ${target}.`,
                  };
                } else if (call.name === "adjustControl") {
                  const ctrl = String((call.args as any)?.controlName || "");
                  callResponse = {
                    status: `Control adjusted: ${ctrl}.`,
                  };
                }

                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: "command",
                    name: call.name,
                    args: call.args,
                    id: call.id,
                  }));
                }
                responses.push({
                  id: call.id,
                  name: call.name,
                  response: callResponse,
                });
              }
              session.sendToolResponse({ functionResponses: responses });
            }

            // 2. Audio chunks & transcripts from model
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: "audio",
                    audio: part.inlineData.data,
                  }));
                }
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: "transcript",
                    role: "model",
                    text: part.text,
                  }));
                }
              }
            }

            // 3. Interrupted
            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }
          },
          onclose: () => {
            console.log("[LiveWS] Gemini Live session closed");
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "status", status: "disconnected" }));
            }
          },
          onerror: (err) => {
            console.error("[LiveWS] Gemini Live session error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: "error",
                error: err instanceof Error ? err.message : String(err),
                tts_fallback: true,
              }));
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));

      // Prompt VOXCON Agent to vocalize activation greeting immediately upon connection (staggered slightly to allow tactical chime to ring)
      setTimeout(() => {
        try {
          session.sendRealtimeInput({
            text: "Uplink connected. Immediately vocalize this exact greeting to the operator: 'VOXCON Active. This is the VOXCON Tactical Execution AI. Standing by to receive your orders, operator.'",
          });
        } catch (greetErr) {
          console.warn("[LiveWS] Failed to dispatch activation greeting trigger:", greetErr);
        }
      }, 180);

      // Forward client audio / text to Live session
      clientWs.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          
          // Support for Gemini RealtimeInput structure
          if (data.realtimeInput) {
            // 1. Handle raw mediaChunks (often sent by direct-to-gemini client implementations)
            if (Array.isArray(data.realtimeInput.mediaChunks)) {
              for (const chunk of data.realtimeInput.mediaChunks) {
                if (chunk.data) {
                  session.sendRealtimeInput({
                    audio: {
                      data: chunk.data,
                      mimeType: chunk.mimeType || "audio/pcm;rate=16000",
                    },
                  });
                }
              }
            }

            // 2. Handle standard SDK fields (audio/text)
            if (data.realtimeInput.audio) {
              session.sendRealtimeInput({ audio: data.realtimeInput.audio });
            }
            if (data.realtimeInput.text) {
              session.sendRealtimeInput({ text: data.realtimeInput.text });
            }

            // 3. Handle clearCurrentTurn (Tactical Walkie-Talkie Protocol "break-in")
            if (data.realtimeInput.clearCurrentTurn) {
              // Standard SDK doesn't always expose clearCurrentTurn directly in sendRealtimeInput types,
              // but we can pass it through if supported or handle it via session state.
              // For gemini-3.1-flash-live-preview, we attempt to pass it through.
              session.sendRealtimeInput({ clearCurrentTurn: true } as any);
            }
            return;
          }

          if (data.type === "audio" && data.audio) {
            session.sendRealtimeInput({
              audio: {
                data: data.audio,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } else if (data.type === "text" && data.text) {
            session.sendRealtimeInput({
              text: data.text,
            });
          }
        } catch (err) {
          console.error("[LiveWS] Error forwarding input to Live session:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("[LiveWS] Client socket closed, cleaning up Live session");
        session.close();
      });
    } catch (error) {
      console.error("[LiveWS] Failed to connect to Gemini Live:", error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Failed to initialize Live API session.",
          tts_fallback: true,
        }));
        clientWs.close();
      }
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`MythOS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
