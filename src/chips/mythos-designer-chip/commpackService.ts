// COMMPACK Service
// Protocol Layer for Communicating Agent Findings and Operational Responses
// Governs voice/written presentation without conferring authority.
import {
  AuthpackDecision,
  CommpackProfile,
  CommpackStructuredResult,
  NormalizedCommand,
} from './types';

export class CommpackService {
  private activeProfile: CommpackProfile = 'OPERATIONAL';

  public getProfile(): CommpackProfile {
    return this.activeProfile;
  }

  public setProfile(profile: CommpackProfile): void {
    this.activeProfile = profile;
  }

  /**
   * Translates execution and authority states into structured COMMPACK responses
   */
  public synthesizeResponse(
    command: NormalizedCommand,
    authDecision: AuthpackDecision,
    executionResult?: { status: 'COMPLETE' | 'FAILED' | 'HALTED' | 'SKIPPED'; details: string } | null,
    overrideProfile?: CommpackProfile
  ): CommpackStructuredResult {
    const profile = overrideProfile || this.activeProfile;

    // 1. Ambiguity or Clarification Required
    if (command.status === 'REQUIRES_CLARIFICATION' || command.status === 'AMBIGUOUS') {
      const prompt = command.clarificationPrompt || 'Target reference is ambiguous. Clarification required.';
      if (profile === 'OPERATIONAL') {
        return {
          executionState: 'REQUIRES_CLARIFICATION',
          bluf: `BLUF: Command interpretation suspended due to ambiguous target reference.`,
          spokenSummary: prompt,
          analysis: `Input "${command.rawInput}" contains multiple possible target bindings.`,
          evidence: `Normalized Command: ${command.id}, Target: UNRESOLVED`,
          action: `Operator must specify the designated surface or item name directly.`,
          actor: 'VOXCONPACK',
        };
      } else {
        return {
          executionState: 'REQUIRES_CLARIFICATION',
          bluf: prompt,
          spokenSummary: prompt,
          actor: 'VOXCONPACK',
        };
      }
    }

    // 2. Unrecognized Intent
    if (command.status === 'UNKNOWN') {
      if (profile === 'OPERATIONAL') {
        return {
          executionState: 'FAILED',
          bluf: `BLUF: VOXCONPACK failed to recognize spoken command intent.`,
          spokenSummary: `Command unrecognized for input: "${command.rawInput}". Say "Help" for available commands.`,
          analysis: `No canonical command or alias matched input tokens.`,
          evidence: `Raw tokens: "${command.rawInput}"`,
          action: `Restate command using canonical vocabulary or review VOXCONPACK command guide.`,
          actor: 'VOXCONPACK',
        };
      } else {
        return {
          executionState: 'FAILED',
          bluf: `I did not understand that command. Say "Help" for a list of available voice directives.`,
          spokenSummary: `I did not understand that command. Say "Help" for a list of available voice directives.`,
          actor: 'VOXCONPACK',
        };
      }
    }

    // 3. Authorization Denied
    if (authDecision.verdict === 'DENIED') {
      if (profile === 'OPERATIONAL') {
        return {
          executionState: 'DENIED',
          bluf: `BLUF: AUTHPACK denied directive ${command.id}.`,
          spokenSummary: `Directive ${command.id} denied by AUTHPACK. ${authDecision.reason}`,
          analysis: authDecision.reason,
          evidence: `Intent: ${command.id}, Raw: "${command.rawInput}"`,
          action: `Verify operational authorization credentials before retrying.`,
          escalation: `Escalate to supervisor if higher authorization level is required.`,
          actor: authDecision.actor,
        };
      } else {
        return {
          executionState: 'DENIED',
          bluf: `Action denied: ${authDecision.reason}`,
          spokenSummary: `I cannot perform that action. ${authDecision.reason}`,
          actor: authDecision.actor,
        };
      }
    }

    // 4. Requires Confirmation (HITL)
    if (authDecision.verdict === 'REQUIRES_CONFIRMATION' || authDecision.verdict === 'REQUIRES_HITL') {
      const prompt = `Confirm action ${command.id} for target "${command.target || 'SYSTEM'}"? Say "Yes" to confirm or "Cancel" to abort.`;
      if (profile === 'OPERATIONAL') {
        return {
          executionState: 'REQUIRES_CONFIRMATION',
          bluf: `BLUF: AUTHPACK requires human-in-the-loop confirmation before executing ${command.id}.`,
          spokenSummary: prompt,
          analysis: authDecision.reason,
          evidence: `Token: ${authDecision.requiredConfirmationToken || 'PENDING'}, Command: ${command.id}`,
          action: `Operator must confirm ("Yes") or cancel ("Cancel") to proceed.`,
          actor: authDecision.actor,
        };
      } else {
        return {
          executionState: 'REQUIRES_CONFIRMATION',
          bluf: prompt,
          spokenSummary: prompt,
          actor: authDecision.actor,
        };
      }
    }

    // 5. Execution Result Handling
    if (executionResult) {
      if (executionResult.status === 'FAILED') {
        if (profile === 'OPERATIONAL') {
          return {
            executionState: 'FAILED',
            bluf: `BLUF: Execution failed for directive ${command.id}.`,
            spokenSummary: `Execution failed for directive ${command.id}. ${executionResult.details}`,
            analysis: executionResult.details,
            evidence: `Command: ${command.id}, Target: ${command.target || 'NONE'}`,
            action: `Check subsystem state and error logs.`,
            actor: 'EXECUTION_LAYER',
          };
        } else {
          return {
            executionState: 'FAILED',
            bluf: `Execution failed: ${executionResult.details}`,
            spokenSummary: `Execution failed: ${executionResult.details}`,
            actor: 'EXECUTION_LAYER',
          };
        }
      }

      if (executionResult.status === 'HALTED') {
        return {
          executionState: 'COMPLETE',
          bluf: `BLUF: Emergency safety halt executed. Active processes terminated.`,
          spokenSummary: `Emergency safety halt executed. All active processes and streams halted.`,
          analysis: executionResult.details,
          evidence: `Safety directive VOX.STOP executed by operator command.`,
          action: `System in safe standby state. Awaiting operator directive.`,
          actor: 'SAFETY_HALT',
        };
      }
    }

    // 6. Authorized and Completed
    const targetLabel = command.target ? ` [${command.target}]` : '';
    if (profile === 'OPERATIONAL') {
      return {
        executionState: 'COMPLETE',
        bluf: `BLUF: Directive ${command.id}${targetLabel} executed successfully.`,
        spokenSummary: `Directive ${command.id}${targetLabel} executed successfully.`,
        analysis: `AUTHPACK approved directive. Execution layer verified complete.`,
        evidence: `Command ID: ${command.id}, Target: ${command.target || 'NONE'}, Status: EXECUTED`,
        action: `Subsystem returned to nominal monitoring.`,
        actor: 'AGENT',
      };
    } else {
      return {
        executionState: 'COMPLETE',
        bluf: `Executed ${command.command.toLowerCase()}${command.target ? ' ' + command.target.toLowerCase() : ''}.`,
        spokenSummary: `Executed ${command.command.toLowerCase()}${command.target ? ' ' + command.target.toLowerCase() : ''}.`,
        actor: 'AGENT',
      };
    }
  }
}

export const commpackService = new CommpackService();
