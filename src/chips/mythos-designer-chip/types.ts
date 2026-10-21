// VOXCONPACK Type System
// Interface Protocol for Human Voice to Normalized Machine-Readable Command Intents

export type VoxCommandClass =
  | 'OBSERVE'
  | 'NAVIGATE'
  | 'CONTROL'
  | 'CREATE'
  | 'MODIFY'
  | 'EXTERNAL_ACTION'
  | 'AUTHORIZATION'
  | 'SAFETY';

export interface VoxParameterDef {
  required: boolean;
  type: string;
  description: string;
}

export interface VoxCommandDefinition {
  id: string; // e.g. "VOX.OPEN"
  command: string; // "OPEN"
  class: VoxCommandClass;
  purpose: string;
  canonical_forms: string[];
  aliases: string[];
  parameters: Record<string, VoxParameterDef>;
  examples: string[];
  authority: {
    system: 'AUTHPACK';
    required: string;
    notes?: string;
  };
  confirmation: boolean;
  execution: string;
  failure: string;
  escalation: string;
  response_profile: string;
  // Multi-Agent & Task metadata
  agents?: string[]; // e.g. ["ALL"] or ["AGENTIC_AI", "HITL_OPERATOR", "SENTINEL", "ENGINEER"]
  taskDomain?: string; // e.g. "GENERAL", "DATA_INGEST", "SYSTEM_CONTROL", "DIAGNOSTICS", "SAFETY"
  author?: string; // "HITL_OPERATOR" | "AGENTIC_AI" | "SYSTEM"
  updatedAt?: string;
  isCustom?: boolean;
}

export interface VoxRegistry {
  protocol: 'VOXCONPACK';
  version: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'MAINTENANCE';
  lastCompiled: string;
  commands: VoxCommandDefinition[];
  aliasIndex: Record<string, string>; // lowercase alias -> command id
}

// Normalized Command Intent structure (strictly separates COMMAND, TARGET, PARAMETERS, CONTEXT)
export interface NormalizedCommand {
  id: string; // "VOX.OPEN"
  command: string; // "OPEN"
  class: VoxCommandClass;
  target?: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
  rawInput: string;
  status: 'RECOGNIZED' | 'REQUIRES_CLARIFICATION' | 'AMBIGUOUS' | 'UNKNOWN';
  clarificationPrompt?: string;
}

// Authority Evaluation verdict from AUTHPACK
export type AuthpackVerdict = 'AUTHORIZED' | 'DENIED' | 'REQUIRES_HITL' | 'REQUIRES_CONFIRMATION';

export interface AuthpackDecision {
  verdict: AuthpackVerdict;
  reason: string;
  actor: string; // e.g. "AUTHPACK" or "HITL"
  timestamp: string;
  requiredConfirmationToken?: string;
}

// Active Pending Confirmation state
export interface PendingConfirmationState {
  active: boolean;
  token: string;
  command: NormalizedCommand;
  prompt: string;
  timestamp: string;
  expiresAt: number; // epoch ms
}

// COMMPACK Execution & Response Profiles
export type CommpackProfile = 'CONVERSATIONAL' | 'OPERATIONAL';

export interface CommpackStructuredResult {
  executionState:
    | 'AUTHORIZED'
    | 'DENIED'
    | 'REQUIRES_CONFIRMATION'
    | 'REQUIRES_CLARIFICATION'
    | 'FAILED'
    | 'COMPLETE'
    | 'CANCELLED'
    | 'UNKNOWN';
  bluf: string;
  spokenSummary: string;
  analysis?: string;
  evidence?: string;
  action?: string;
  escalation?: string;
  actor: string;
}

// Audit Log & Provenance Record
export interface VoxAuditRecord {
  id: string;
  timestamp: string;
  source: 'VOICE' | 'TEXT' | 'TEST_SUITE' | 'EXTERNAL';
  raw_input: string;
  normalized_command: NormalizedCommand | null;
  target?: string;
  parameters: Record<string, unknown>;
  authority_result: AuthpackDecision | null;
  execution_result: {
    status: 'COMPLETE' | 'FAILED' | 'HALTED' | 'SKIPPED';
    details: string;
  } | null;
  response_profile: CommpackProfile;
  commpack_output: CommpackStructuredResult;
}

// Validation Error
export interface ValidationError {
  rule: string;
  commandId?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}
