// VOXCONPACK Engine
// Interface Protocol: Translates human voice/text into Normalized Machine-Readable Command Intents
import { NormalizedCommand, VoxCommandDefinition, VoxRegistry } from './types';
import compiledRegistry from '../../../VOXCONPACK/compiled/registry.json';

export class VoxconEngine {
  private registry: VoxRegistry;
  private commandMap: Map<string, VoxCommandDefinition>;

  constructor(customRegistry?: VoxRegistry) {
    this.registry = customRegistry || (compiledRegistry as unknown as VoxRegistry);
    this.commandMap = new Map();
    for (const cmd of this.registry.commands) {
      this.commandMap.set(cmd.id, cmd);
    }
  }

  public getRegistry(): VoxRegistry {
    return this.registry;
  }

  public updateRegistry(newRegistry: VoxRegistry): void {
    this.registry = newRegistry;
    this.commandMap.clear();
    for (const cmd of this.registry.commands) {
      this.commandMap.set(cmd.id, cmd);
    }
  }

  /**
   * Normalizes raw spoken input into structured command intent
   */
  public normalize(rawInput: string, context?: Record<string, unknown>): NormalizedCommand {
    const raw = (rawInput || '').trim();
    if (!raw) {
      return {
        id: 'VOX.UNKNOWN',
        command: 'UNKNOWN',
        class: 'OBSERVE',
        parameters: {},
        rawInput: '',
        status: 'UNKNOWN',
      };
    }

    // Strip common wake words and conversational introductory filler
    const cleaned = this.cleanSpokenFiller(raw);

    // 1. Check for material ambiguity (e.g. "open it", "close that", "do it", "delete it")
    const ambiguityCheck = this.detectAmbiguity(cleaned, context);
    if (ambiguityCheck) {
      return ambiguityCheck;
    }

    // 2. Exact or Alias Matching
    const matched = this.matchCommandAndExtract(cleaned, raw, context);
    return matched;
  }

  private cleanSpokenFiller(text: string): string {
    let s = text.toLowerCase().trim();

    // Strip wake words
    s = s.replace(/^(computer|mythos|voxcon|jarvis|hey computer|alexa|siri|system)[,\s]+/i, '');

    // Strip courteous conversational prefixes
    s = s.replace(/^(please|could you|can you|would you|kindly|i want to|i need to|let us|lets)\s+/i, '');

    return s.trim();
  }

  private detectAmbiguity(cleaned: string, context?: Record<string, unknown>): NormalizedCommand | null {
    const tokens = cleaned.split(/\s+/);
    const firstWord = tokens[0];
    const secondWord = tokens[1];

    // Check for ambiguous references like "it", "that", "this", "them" without explicit unambiguous context
    const ambiguousPronouns = ['it', 'that', 'this', 'them', 'one'];

    if (tokens.length <= 2 && ambiguousPronouns.includes(secondWord)) {
      if (['open', 'launch', 'bring'].includes(firstWord)) {
        return {
          id: 'VOX.OPEN',
          command: 'OPEN',
          class: 'NAVIGATE',
          parameters: { target: 'AMBIGUOUS' },
          rawInput: cleaned,
          status: 'REQUIRES_CLARIFICATION',
          clarificationPrompt: 'Ambiguous target reference. Specify application, surface, or file name to open.',
        };
      }
      if (['close', 'dismiss'].includes(firstWord)) {
        return {
          id: 'VOX.CLOSE',
          command: 'CLOSE',
          class: 'NAVIGATE',
          parameters: { target: 'AMBIGUOUS' },
          rawInput: cleaned,
          status: 'REQUIRES_CLARIFICATION',
          clarificationPrompt: 'Ambiguous target reference. Specify window, surface, or modal to close.',
        };
      }
      if (['select', 'pick', 'choose'].includes(firstWord)) {
        return {
          id: 'VOX.SELECT',
          command: 'SELECT',
          class: 'NAVIGATE',
          parameters: { item: 'AMBIGUOUS' },
          rawInput: cleaned,
          status: 'REQUIRES_CLARIFICATION',
          clarificationPrompt: 'Ambiguous selection target. Specify subsystem or item name.',
        };
      }
    }

    // Single word ambiguous command "open" or "delete" without target
    if (['open', 'launch'].includes(cleaned)) {
      return {
        id: 'VOX.OPEN',
        command: 'OPEN',
        class: 'NAVIGATE',
        parameters: {},
        rawInput: cleaned,
        status: 'REQUIRES_CLARIFICATION',
        clarificationPrompt: 'Specify target surface or application to open.',
      };
    }

    return null;
  }

  private matchCommandAndExtract(cleaned: string, rawInput: string, context?: Record<string, unknown>): NormalizedCommand {
    const aliasIndex = this.registry.aliasIndex;

    // Check direct match in alias index
    if (aliasIndex[cleaned]) {
      const commandId = aliasIndex[cleaned];
      const cmdDef = this.commandMap.get(commandId);
      if (cmdDef) {
        return {
          id: cmdDef.id,
          command: cmdDef.command,
          class: cmdDef.class,
          parameters: {},
          rawInput,
          status: 'RECOGNIZED',
        };
      }
    }

    // Match multi-word aliases and commands with parameters
    // Sort aliases by length descending so longer matching phrases match first
    const sortedAliases = Object.keys(aliasIndex).sort((a, b) => b.length - a.length);

    for (const alias of sortedAliases) {
      // Check if input starts with or contains alias
      if (cleaned.startsWith(alias)) {
        const commandId = aliasIndex[alias];
        const cmdDef = this.commandMap.get(commandId);
        if (!cmdDef) continue;

        const remainder = cleaned.slice(alias.length).trim();
        const params = this.extractParameters(cmdDef, remainder, cleaned, context);

        return {
          id: cmdDef.id,
          command: cmdDef.command,
          class: cmdDef.class,
          target: (params.target as string) || (params.item as string) || (params.resource as string),
          parameters: params,
          context: context || {},
          rawInput,
          status: 'RECOGNIZED',
        };
      }
    }

    // Parameter search for commands whose alias or keyword appears in the phrase
    // e.g. "what's the system status" -> VOX.STATUS
    for (const cmd of this.registry.commands) {
      if (cleaned.includes(cmd.command.toLowerCase())) {
        const remainder = cleaned.replace(cmd.command.toLowerCase(), '').trim();
        const params = this.extractParameters(cmd, remainder, cleaned, context);
        return {
          id: cmd.id,
          command: cmd.command,
          class: cmd.class,
          target: (params.target as string) || (params.item as string) || (params.resource as string),
          parameters: params,
          context: context || {},
          rawInput,
          status: 'RECOGNIZED',
        };
      }
    }

    // Default unrecognized
    return {
      id: 'VOX.UNKNOWN',
      command: 'UNKNOWN',
      class: 'OBSERVE',
      parameters: { query: rawInput },
      rawInput,
      status: 'UNKNOWN',
      clarificationPrompt: `Unrecognized command intent for input: "${rawInput}".`,
    };
  }

  private extractParameters(
    cmdDef: VoxCommandDefinition,
    remainder: string,
    fullCleaned: string,
    context?: Record<string, unknown>
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    let target = remainder.replace(/^(the|a|an|to|for|at|of)\s+/i, '').trim();

    // Map known targets / surfaces
    const surfaceMap: Record<string, string> = {
      dashboard: 'DASHBOARD',
      'rag browser': 'RAG_BROWSER',
      'vs code': 'VS_CODE',
      'vscode': 'VS_CODE',
      'mythos dashboard': 'DASHBOARD',
      'modern dashboard': 'DASHBOARD',
      'voice control': 'VOXCONPACK',
      'voxconpack': 'VOXCONPACK',
      'ai diagnostics': 'AI_DIAGNOSTICS',
      'token inspector': 'TOKEN_INSPECTOR',
      'ui builder': 'UI_BUILDER',
      'schematic': 'SCHEMATIC',
      'telemetry': 'TELEMETRY',
      'logs': 'LOGS',
    };

    const targetLower = target.toLowerCase();
    if (surfaceMap[targetLower]) {
      target = surfaceMap[targetLower];
    } else if (target) {
      target = target.toUpperCase().replace(/\s+/g, '_');
    }

    if (cmdDef.parameters) {
      if (cmdDef.parameters.target) {
        if (target) {
          params.target = target;
        } else if (cmdDef.parameters.target.required) {
          // If required but missing
          // Keep empty so AUTHPACK or validation notices
        }
      }

      if (cmdDef.parameters.item && target) {
        params.item = target;
      }

      if (cmdDef.parameters.resource && target) {
        params.resource = target;
      }

      if (cmdDef.parameters.destination) {
        const destMatch = fullCleaned.match(/(?:to|towards)\s+([a-zA-Z0-9_\-]+)/i);
        if (destMatch) {
          params.destination = destMatch[1].toUpperCase();
        }
      }

      if (cmdDef.parameters.query) {
        const queryMatch = fullCleaned.match(/(?:for|about|on)\s+(.*)/i);
        params.query = queryMatch ? queryMatch[1].trim() : remainder;
      }

      if (cmdDef.parameters.value) {
        const valMatch = fullCleaned.match(/(?:to|value|as)\s+([0-9a-zA-Z_\-\.]+)/i);
        if (valMatch) {
          params.value = valMatch[1];
        }
      }
    }

    return params;
  }
}

export const voxconEngine = new VoxconEngine();
