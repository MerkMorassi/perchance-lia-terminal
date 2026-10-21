// VOXCONPACK Execution Pipeline Orchestrator
// Connects Human Voice -> VOXCONPACK -> AUTHPACK -> EXECUTION -> COMMPACK -> AUDIT
import { voxconEngine } from './voxconEngine';
import { authpackService } from './authpackService';
import { commpackService } from './commpackService';
import { auditLogger } from './auditLogger';
import {
  AuthpackDecision,
  CommpackProfile,
  CommpackStructuredResult,
  NormalizedCommand,
  VoxAuditRecord,
} from './types';

export interface PipelineExecutionResult {
  rawInput: string;
  normalized: NormalizedCommand;
  authDecision: AuthpackDecision;
  executionResult: { status: 'COMPLETE' | 'FAILED' | 'HALTED' | 'SKIPPED'; details: string } | null;
  commpackOutput: CommpackStructuredResult;
  auditRecord: VoxAuditRecord;
}

export type ActionExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ success: boolean; message: string }>;

export class VoxconPipeline {
  private customExecutor?: ActionExecutor;

  public setExecutor(executor: ActionExecutor): void {
    this.customExecutor = executor;
  }

  /**
   * Processes human input through the entire authoritative chain
   */
  public async processInput(
    rawInput: string,
    source: 'VOICE' | 'TEXT' | 'TEST_SUITE' = 'VOICE',
    context?: Record<string, unknown>,
    commpackProfile?: CommpackProfile
  ): Promise<PipelineExecutionResult> {
    const timestamp = new Date().toISOString();

    // 1. VOXCONPACK Normalization (Interface Layer - Identifies Intent)
    const normalized = voxconEngine.normalize(rawInput, context);

    // 2. AUTHPACK Evaluation (Authority Boundary - Determines Permission)
    const authDecision = authpackService.evaluate(normalized);

    // 3. Execution Layer (Only executes if AUTHORIZED)
    let executionResult: { status: 'COMPLETE' | 'FAILED' | 'HALTED' | 'SKIPPED'; details: string } | null = null;

    if (authDecision.verdict === 'AUTHORIZED') {
      if (normalized.id === 'VOX.STOP' || normalized.class === 'SAFETY') {
        // Immediate Safety Halt
        executionResult = {
          status: 'HALTED',
          details: 'Emergency safety halt executed. Active routines terminated.',
        };
      } else if (this.customExecutor) {
        try {
          const res = await this.customExecutor(normalized.command, {
            ...normalized.parameters,
            id: normalized.id,
            target: normalized.target,
          });
          executionResult = {
            status: res.success ? 'COMPLETE' : 'FAILED',
            details: res.message,
          };
        } catch (err: any) {
          executionResult = {
            status: 'FAILED',
            details: err.message || 'Execution error encountered in workstation layer.',
          };
        }
      } else {
        executionResult = {
          status: 'COMPLETE',
          details: `Command ${normalized.id} executed successfully.`,
        };
      }
    } else {
      executionResult = {
        status: 'SKIPPED',
        details: `Execution skipped. Authority verdict: ${authDecision.verdict} (${authDecision.reason})`,
      };
    }

    // 4. COMMPACK Response Profile Synthesis (Presentation Layer - Normative Communication)
    const commpackOutput = commpackService.synthesizeResponse(
      normalized,
      authDecision,
      executionResult,
      commpackProfile
    );

    // 5. Mandatory Audit Logging & Provenance Trace
    const auditRecord = auditLogger.record({
      timestamp,
      source,
      raw_input: rawInput,
      normalized_command: normalized,
      target: normalized.target,
      parameters: normalized.parameters,
      authority_result: authDecision,
      execution_result: executionResult,
      response_profile: commpackProfile || commpackService.getProfile(),
      commpack_output: commpackOutput,
    });

    return {
      rawInput,
      normalized,
      authDecision,
      executionResult,
      commpackOutput,
      auditRecord,
    };
  }
}

export const voxconPipeline = new VoxconPipeline();
