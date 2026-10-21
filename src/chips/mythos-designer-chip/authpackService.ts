// AUTHPACK Service
// Authoritative Gatekeeper for Evaluating Voice-Command Intents
// VOXCONPACK identifies intent. AUTHPACK determines authority.
import {
  AuthpackDecision,
  NormalizedCommand,
  PendingConfirmationState,
} from './types';

// Authority evasion and bypass patterns that MUST be rejected
const PROHIBITED_BYPASS_PATTERNS = [
  /ignore (the|all|my)? rules/i,
  /override (the|all)? authorization/i,
  /override (the|all)? security/i,
  /do it anyway/i,
  /you have my permission/i,
  /administrator override/i,
  /admin override/i,
  /sudo /i,
  /bypass (auth|security|safeguards)/i,
];

// Commands that always require human-in-the-loop (HITL) or explicit confirmation
const ALWAYS_CONFIRM_COMMANDS = new Set([
  'VOX.SEND', // External communication
  'VOX.CREATE', // Instantiating resources
  'VOX.SWITCH', // Changing COMMPACK profile
]);

export class AuthpackService {
  private pendingConfirmation: PendingConfirmationState | null = null;
  private currentRole: 'OPERATOR' | 'SUPERVISOR' | 'SYSTEM' = 'OPERATOR';

  constructor() {
    this.pendingConfirmation = null;
  }

  public getPendingConfirmation(): PendingConfirmationState | null {
    // Check expiration (2 minute TTL)
    if (this.pendingConfirmation && Date.now() > this.pendingConfirmation.expiresAt) {
      this.pendingConfirmation = null;
    }
    return this.pendingConfirmation;
  }

  public clearPendingConfirmation(): void {
    this.pendingConfirmation = null;
  }

  public setRole(role: 'OPERATOR' | 'SUPERVISOR' | 'SYSTEM'): void {
    this.currentRole = role;
  }

  public getRole(): string {
    return this.currentRole;
  }

  /**
   * Evaluates authority for a normalized command intent
   */
  public evaluate(command: NormalizedCommand): AuthpackDecision {
    const timestamp = new Date().toISOString();

    // 1. Check for authority evasion attempt in raw input
    for (const pattern of PROHIBITED_BYPASS_PATTERNS) {
      if (pattern.test(command.rawInput)) {
        return {
          verdict: 'DENIED',
          reason: 'Attempted authorization bypass detected. Verbal override phrases do not confer system authority.',
          actor: 'AUTHPACK',
          timestamp,
        };
      }
    }

    // 2. Material ambiguity or unrecognized command
    if (command.status === 'REQUIRES_CLARIFICATION' || command.status === 'AMBIGUOUS') {
      return {
        verdict: 'DENIED',
        reason: command.clarificationPrompt || 'Action denied due to ambiguous target reference.',
        actor: 'AUTHPACK',
        timestamp,
      };
    }

    if (command.status === 'UNKNOWN') {
      return {
        verdict: 'DENIED',
        reason: `Unrecognized command intent for "${command.rawInput}".`,
        actor: 'AUTHPACK',
        timestamp,
      };
    }

    // 3. Handle Confirmation commands (VOX.CONFIRM, VOX.YES, VOX.NO, VOX.CANCEL)
    if (command.id === 'VOX.YES' || command.id === 'VOX.CONFIRM') {
      const pending = this.getPendingConfirmation();
      if (!pending) {
        return {
          verdict: 'DENIED',
          reason: 'No active pending confirmation state exists to affirm.',
          actor: 'AUTHPACK',
          timestamp,
        };
      }

      // Valid confirmation of active pending action only!
      const confirmedCommand = pending.command;
      this.clearPendingConfirmation();

      return {
        verdict: 'AUTHORIZED',
        reason: `Action "${confirmedCommand.id}" authorized by affirmative operator confirmation for token ${pending.token}.`,
        actor: 'AUTHPACK (HITL)',
        timestamp,
        requiredConfirmationToken: pending.token,
      };
    }

    if (command.id === 'VOX.NO' || command.id === 'VOX.CANCEL') {
      const pending = this.getPendingConfirmation();
      if (pending) {
        this.clearPendingConfirmation();
        return {
          verdict: 'DENIED',
          reason: `Pending action "${pending.command.id}" terminated by operator directive.`,
          actor: 'AUTHPACK (HITL)',
          timestamp,
        };
      }
      return {
        verdict: 'AUTHORIZED',
        reason: 'Cancel action processed. Operational state clear.',
        actor: 'AUTHPACK',
        timestamp,
      };
    }

    // 4. Special Safety Halt Handling (VOX.STOP)
    if (command.id === 'VOX.STOP' || command.class === 'SAFETY') {
      // Immediate emergency stop is always authorized to ensure safety
      if (this.pendingConfirmation) {
        this.clearPendingConfirmation();
      }
      return {
        verdict: 'AUTHORIZED',
        reason: 'Emergency safety halt authorized without delay. Halting active streams and processes.',
        actor: 'AUTHPACK (SAFETY)',
        timestamp,
      };
    }

    // 4.5. Role-Based Access Control (RBAC) for COMMPACK Profile Switching
    if (command.id === 'VOX.SWITCH') {
      const inputUpper = command.rawInput.toUpperCase();
      const isCommpackSwitch = inputUpper.includes('COMMPACK') || inputUpper.includes('PROFILE');
      
      if (isCommpackSwitch) {
        const requestedProfile = (
          (command.parameters?.value as string) || 
          (command.target as string) || 
          ''
        ).toUpperCase();

        const isMil = requestedProfile === 'OPERATIONAL' || requestedProfile === 'MIL' || inputUpper.includes('OPERATIONAL') || inputUpper.includes('MIL');
        
        if (isMil && this.currentRole === 'OPERATOR') {
          return {
            verdict: 'DENIED',
            reason: `COMMPACK profile "MIL (OPERATIONAL)" is a sensitive mode and is restricted. Role "OPERATOR" lacks sufficient clearance. Minimum role: SUPERVISOR.`,
            actor: 'AUTHPACK',
            timestamp,
          };
        }
      }
    }

    // 5. Actions requiring explicit Confirmation / HITL
    if (ALWAYS_CONFIRM_COMMANDS.has(command.id)) {
      const token = `ACT-${Date.now().toString(36).toUpperCase()}`;
      const prompt = `Confirm action ${command.id} for target "${command.target || 'DEFAULT'}"? (Speak "Yes" to confirm or "Cancel" to abort)`;

      this.pendingConfirmation = {
        active: true,
        token,
        command,
        prompt,
        timestamp,
        expiresAt: Date.now() + 120000, // 2-minute expiration
      };

      return {
        verdict: 'REQUIRES_CONFIRMATION',
        reason: `Operation "${command.id}" has external or state-modifying impact. Explicit confirmation required.`,
        actor: 'AUTHPACK',
        timestamp,
        requiredConfirmationToken: token,
      };
    }

    // 6. Prohibited / restricted targets (e.g. root filesystem, secret keys, unauthorized surfaces)
    const prohibitedTargets = ['ROOT', 'KERNEL', 'SECRETS', 'SYSTEM_CORE', 'FIREWALL'];
    if (command.target && prohibitedTargets.includes(command.target.toUpperCase())) {
      return {
        verdict: 'DENIED',
        reason: `Access to protected resource "${command.target}" is strictly forbidden for role "${this.currentRole}".`,
        actor: 'AUTHPACK',
        timestamp,
      };
    }

    // 7. General Operational Authorization for recognized canonical commands
    return {
      verdict: 'AUTHORIZED',
      reason: `Action "${command.id}" permitted under role "${this.currentRole}".`,
      actor: 'AUTHPACK',
      timestamp,
    };
  }
}

export const authpackService = new AuthpackService();
