// VOXCONPACK Markdown Parser and Validator
// Converts Human-Maintained Markdown into Machine-Readable JSON Registry
import {
  VoxCommandClass,
  VoxCommandDefinition,
  VoxParameterDef,
  VoxRegistry,
  ValidationError,
  ValidationResult,
} from './types';

const VALID_CLASSES: VoxCommandClass[] = [
  'OBSERVE',
  'NAVIGATE',
  'CONTROL',
  'CREATE',
  'MODIFY',
  'EXTERNAL_ACTION',
  'AUTHORIZATION',
  'SAFETY',
];

const VALID_RESPONSE_PROFILES = new Set([
  'COMMPACK.ACTION',
  'COMMPACK.STATUS',
  'COMMPACK.SAFETY',
  'COMMPACK.ERROR',
  'COMMPACK.PARAM_REQUEST',
  'COMMPACK.HELP',
  'COMMPACK.CONFIRM',
  'COMMPACK.REPORT',
  'COMMPACK.OPERATIONAL',
  'COMMPACK.CONVERSATIONAL',
]);

const CANONICAL_PARAM_NAMES = new Set([
  'target',
  'source',
  'destination',
  'resource',
  'application',
  'file',
  'surface',
  'agent',
  'query',
  'text',
  'location',
  'item',
  'value',
  'duration',
  'count',
  'bearing',
  'node',
]);

export interface SchemaCheckItem {
  id: string;
  rule: string;
  label: string;
  passed: boolean;
  message?: string;
  field?: string;
}

/**
 * Evaluates an individual command definition against the normative schema checklist
 */
export function evaluateCommandSchemaChecklist(cmd: VoxCommandDefinition): SchemaCheckItem[] {
  const items: SchemaCheckItem[] = [];

  // 1. Unique Command ID Pattern
  const validId = !!cmd.id && /^VOX\.[A-Z0-9_]+$/.test(cmd.id);
  items.push({
    id: 'rule-id-pattern',
    rule: 'Unique Command ID Pattern',
    label: 'Command ID Syntax (VOX.<NAME>)',
    passed: validId,
    message: validId ? undefined : `Command ID "${cmd.id}" must match pattern "VOX.<COMMAND_NAME>"`,
    field: 'id',
  });

  // 2. Command ID Matches Canonical Command Name
  const idMatchesName = validId && cmd.id === `VOX.${cmd.command}`;
  items.push({
    id: 'rule-id-matches-name',
    rule: 'Canonical Name Alignment',
    label: 'Command ID Suffix Alignment',
    passed: idMatchesName,
    message: idMatchesName ? undefined : `Command ID "${cmd.id}" must strictly match canonical keyword "VOX.${cmd.command}"`,
    field: 'id',
  });

  // 3. Valid Command Class
  const validClass = VALID_CLASSES.includes(cmd.class);
  items.push({
    id: 'rule-class-enum',
    rule: 'Valid Command Class',
    label: 'Command Class Specification',
    passed: validClass,
    message: validClass ? undefined : `Class "${cmd.class}" is invalid. Must be one of: ${VALID_CLASSES.join(', ')}`,
    field: 'class',
  });

  // 4. Purpose Description
  const validPurpose = !!cmd.purpose && cmd.purpose.trim().length >= 8;
  items.push({
    id: 'rule-purpose',
    rule: 'Purpose Description',
    label: 'Functional Purpose Statement',
    passed: validPurpose,
    message: validPurpose ? undefined : 'Purpose must provide an explicit description (min 8 characters)',
    field: 'purpose',
  });

  // 5. AUTHPACK Authority Reference
  const validAuth = !!cmd.authority && cmd.authority.system === 'AUTHPACK' && !!cmd.authority.required && cmd.authority.required.length > 5;
  items.push({
    id: 'rule-authority',
    rule: 'Authority Reference Present',
    label: 'AUTHPACK Authority Requirement',
    passed: validAuth,
    message: validAuth ? undefined : 'Authority statement must explicitly specify AUTHPACK authorization criteria',
    field: 'authority',
  });

  // 6. Confirmation Policy
  const validConf = typeof cmd.confirmation === 'boolean';
  items.push({
    id: 'rule-confirmation',
    rule: 'Confirmation Policy',
    label: 'HITL Confirmation Statement',
    passed: validConf,
    message: validConf ? undefined : 'Confirmation policy statement must be defined',
    field: 'confirmation',
  });

  // 7. Execution Layer Action
  const validExec = !!cmd.execution && cmd.execution.trim().length >= 5;
  items.push({
    id: 'rule-execution',
    rule: 'Execution Specification',
    label: 'Target Execution Layer Action',
    passed: validExec,
    message: validExec ? undefined : 'Execution section must specify target workstation or execution layer actions',
    field: 'execution',
  });

  // 8. Failure Reporting
  const validFail = !!cmd.failure && cmd.failure.trim().length >= 5;
  items.push({
    id: 'rule-failure',
    rule: 'Failure Reporting',
    label: 'Failure Reporting Criteria',
    passed: validFail,
    message: validFail ? undefined : 'Failure section must define criteria for reporting execution anomalies',
    field: 'failure',
  });

  // 9. Escalation Protocol
  const validEsc = !!cmd.escalation && cmd.escalation.trim().length >= 3;
  items.push({
    id: 'rule-escalation',
    rule: 'Escalation Protocol',
    label: 'Escalation Procedure',
    passed: validEsc,
    message: validEsc ? undefined : 'Escalation section must define conditions for escalating to human operator',
    field: 'escalation',
  });

  // 10. COMMPACK Response Profile
  const validProfile = !!cmd.response_profile && (cmd.response_profile.startsWith('COMMPACK.') || VALID_RESPONSE_PROFILES.has(cmd.response_profile));
  items.push({
    id: 'rule-response-profile',
    rule: 'Valid Response Profile',
    label: 'COMMPACK Response Profile',
    passed: validProfile,
    message: validProfile ? undefined : `Response profile "${cmd.response_profile}" must start with COMMPACK. (e.g. COMMPACK.ACTION, COMMPACK.STATUS)`,
    field: 'response_profile',
  });

  // 11. Natural Language Spoken Examples
  const validExamples = Array.isArray(cmd.examples) && cmd.examples.length >= 1;
  items.push({
    id: 'rule-examples',
    rule: 'Natural Spoken Examples',
    label: 'Spoken Utterance Examples',
    passed: validExamples,
    message: validExamples ? undefined : 'Must declare at least one natural language spoken example utterance',
    field: 'examples',
  });

  return items;
}

/**
 * Parses Markdown source text into raw VoxCommandDefinition objects
 */
export function parseMarkdownCommands(markdown: string): {
  commands: VoxCommandDefinition[];
  errors: ValidationError[];
} {
  const commands: VoxCommandDefinition[] = [];
  const errors: ValidationError[] = [];

  // Split by "## " headers
  const sections = markdown.split(/\n(?=##\s+)/);

  for (const rawSection of sections) {
    const section = rawSection.trim();
    if (!section.startsWith('## ')) continue;

    try {
      const headerMatch = section.match(/^##\s+([A-Z0-9_]+)/);
      if (!headerMatch) {
        errors.push({
          rule: 'Canonical Command Present',
          message: 'Section header missing valid uppercase command name (e.g., "## OPEN")',
        });
        continue;
      }
      const commandName = headerMatch[1].trim();

      // Extract Command ID
      const idMatch = section.match(/Command ID:\s*(VOX\.[A-Z0-9_]+)/i);
      const commandId = idMatch ? idMatch[1].trim().toUpperCase() : `VOX.${commandName}`;

      // Extract Class
      const classMatch = section.match(/Class:\s*([A-Z_]+)/i);
      const commandClass = (classMatch ? classMatch[1].trim().toUpperCase() : 'CONTROL') as VoxCommandClass;

      // Extract Purpose
      const purposeMatch = section.match(/Purpose:\s*([\s\S]*?)(?=\n\n[A-Za-z]+:|\nCanonical forms:|\nAliases:|$)/i);
      const purpose = purposeMatch ? purposeMatch[1].trim() : '';

      // Extract Canonical forms
      const canonicalMatch = section.match(/Canonical forms:\s*([\s\S]*?)(?=\n[A-Za-z]+:|\n\n##|$)/i);
      const canonical_forms: string[] = [];
      if (canonicalMatch) {
        canonicalMatch[1]
          .split('\n')
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter(Boolean)
          .forEach((c) => canonical_forms.push(c.toUpperCase()));
      }
      if (canonical_forms.length === 0) {
        canonical_forms.push(commandName);
      }

      // Extract Aliases
      const aliasesMatch = section.match(/Aliases:\s*([\s\S]*?)(?=\nParameters:|\nExamples:|\nAuthority:|\n\n##|$)/i);
      const aliases: string[] = [];
      if (aliasesMatch) {
        aliasesMatch[1]
          .split('\n')
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter(Boolean)
          .forEach((a) => {
            if (!aliases.includes(a.toLowerCase())) {
              aliases.push(a.toLowerCase());
            }
          });
      }

      // Extract Parameters
      const paramsMatch = section.match(/Parameters:\s*([\s\S]*?)(?=\nExamples:|\nAuthority:|\nConfirmation:|\n\n##|$)/i);
      const parameters: Record<string, VoxParameterDef> = {};
      if (paramsMatch) {
        const paramLines = paramsMatch[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-'));
        for (const line of paramLines) {
          // Format: - target: required (string) - description
          // or: - target: optional (string)
          // or: - None.
          if (line.toLowerCase().includes('none')) continue;

          const pMatch = line.match(/^-\s*([a-zA-Z0-9_]+)\s*:\s*(required|optional)\s*(?:\(([a-zA-Z0-9_]+)\))?(?:\s*-\s*(.*))?/i);
          if (pMatch) {
            const pName = pMatch[1].toLowerCase();
            parameters[pName] = {
              required: pMatch[2].toLowerCase() === 'required',
              type: pMatch[3] ? pMatch[3].toLowerCase() : 'string',
              description: pMatch[4] ? pMatch[4].trim() : '',
            };
          }
        }
      }

      // Extract Examples
      const examplesMatch = section.match(/Examples:\s*([\s\S]*?)(?=\nAuthority:|\nConfirmation:|\nExecution:|\n\n##|$)/i);
      const examples: string[] = [];
      if (examplesMatch) {
        examplesMatch[1]
          .split('\n')
          .map((line) => line.replace(/^-\s*/, '').replace(/^"|"$/g, '').trim())
          .filter(Boolean)
          .forEach((ex) => examples.push(ex));
      }

      // Extract Authority
      const authorityMatch = section.match(/Authority:\s*([\s\S]*?)(?=\nConfirmation:|\nExecution:|\nFailure:|\n\n##|$)/i);
      const authorityText = authorityMatch ? authorityMatch[1].trim() : '';

      // Extract Confirmation
      const confMatch = section.match(/Confirmation:\s*([\s\S]*?)(?=\nExecution:|\nFailure:|\nEscalation:|\n\n##|$)/i);
      const confText = confMatch ? confMatch[1].trim() : '';
      const requiresConfirmation =
        confText.toLowerCase().includes('always requires') ||
        confText.toLowerCase().includes('required') && !confText.toLowerCase().includes('not required');

      // Extract Execution
      const execMatch = section.match(/Execution:\s*([\s\S]*?)(?=\nFailure:|\nEscalation:|\nResponse Profile:|\n\n##|$)/i);
      const execution = execMatch ? execMatch[1].trim() : 'Submit request to execution layer.';

      // Extract Failure
      const failureMatch = section.match(/Failure:\s*([\s\S]*?)(?=\nEscalation:|\nResponse Profile:|\n\n##|$)/i);
      const failure = failureMatch ? failureMatch[1].trim() : 'Report actual failure condition.';

      // Extract Escalation
      const escMatch = section.match(/Escalation:\s*([\s\S]*?)(?=\nResponse Profile:|\n\n##|$)/i);
      const escalation = escMatch ? escMatch[1].trim() : 'Escalate if operation exceeds available authority.';

      // Extract Response Profile
      const respMatch = section.match(/Response Profile:\s*([A-Za-z0-9_.]+)/i);
      const responseProfile = respMatch ? respMatch[1].trim() : 'COMMPACK.ACTION';

      // Extract Target Agents (e.g. "Agents: ALL" or "Target Agent: AGENTIC_AI, HITL_OPERATOR")
      const agentMatch = section.match(/(?:Target\s+)?Agents?:\s*([^\n]+)/i);
      let agents: string[] = ['ALL'];
      if (agentMatch) {
        agents = agentMatch[1]
          .split(/[,|]/)
          .map((a) => a.trim().toUpperCase())
          .filter(Boolean);
        if (agents.length === 0) agents = ['ALL'];
      }

      // Extract Task Domain (e.g. "Task Domain: SYSTEM_CONTROL" or "Task: DATA_INGEST")
      const taskMatch = section.match(/(?:Task\s+Domain|Tasks?):\s*([^\n]+)/i);
      const taskDomain = taskMatch ? taskMatch[1].trim().toUpperCase() : 'GENERAL';

      // Extract Author / Originator (e.g. "Author: HITL_OPERATOR" or "Updated By: AGENTIC_AI")
      const authorMatch = section.match(/(?:Author|Updated By|Originator):\s*([^\n]+)/i);
      const author = authorMatch ? authorMatch[1].trim() : 'HITL_OPERATOR';

      commands.push({
        id: commandId,
        command: commandName,
        class: commandClass,
        purpose,
        canonical_forms,
        aliases,
        parameters,
        examples,
        authority: {
          system: 'AUTHPACK',
          required: authorityText || 'Requires AUTHPACK authorization.',
        },
        confirmation: requiresConfirmation,
        execution,
        failure,
        escalation,
        response_profile: responseProfile,
        agents,
        taskDomain,
        author,
        isCustom: false,
      });
    } catch (err: any) {
      errors.push({
        rule: 'Parsing Error',
        message: `Failed to parse Markdown command section: ${err.message}`,
      });
    }
  }

  return { commands, errors };
}

/**
 * Validates parsed command definitions against normative requirements
 */
export function validateCommandDefinitions(
  commands: VoxCommandDefinition[],
  existingCommands?: VoxCommandDefinition[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  const seenIds = new Set<string>();
  const seenCanonical = new Set<string>();
  const aliasToCommandMap = new Map<string, string>();

  // If existing commands provided, index their aliases and IDs to prevent collision
  if (existingCommands && Array.isArray(existingCommands)) {
    for (const ec of existingCommands) {
      if (ec.command) {
        aliasToCommandMap.set(ec.command.toLowerCase(), ec.id);
      }
      if (Array.isArray(ec.canonical_forms)) {
        for (const cf of ec.canonical_forms) {
          aliasToCommandMap.set(cf.toLowerCase(), ec.id);
        }
      }
      if (Array.isArray(ec.aliases)) {
        for (const al of ec.aliases) {
          aliasToCommandMap.set(al.toLowerCase().trim(), ec.id);
        }
      }
    }
  }

  for (const cmd of commands) {
    // Immutable Anchor Protection: VOX.STOP is sacred and cannot be redefined
    if (cmd.command === 'STOP' || cmd.id === 'VOX.STOP') {
      if (cmd.isCustom) {
        errors.push({
          rule: 'Immutable Anchor Protection',
          commandId: cmd.id,
          field: 'command',
          message: 'CRITICAL SAFETY VIOLATION: VOX.STOP is an immutable safety halt anchor and cannot be altered or redefined.',
        });
      }
    }

    // 1. Unique Command ID
    if (!cmd.id || !/^VOX\.[A-Z0-9_]+$/.test(cmd.id)) {
      errors.push({
        rule: 'Unique Command ID',
        commandId: cmd.id,
        field: 'id',
        message: `Command ID "${cmd.id}" must match pattern "VOX.<COMMAND_NAME>" with uppercase alphanumeric characters.`,
      });
    } else if (seenIds.has(cmd.id)) {
      errors.push({
        rule: 'Unique Command ID',
        commandId: cmd.id,
        field: 'id',
        message: `Duplicate Command ID "${cmd.id}" detected in upload payload.`,
      });
    } else {
      seenIds.add(cmd.id);
    }

    // 2. Command ID Matches Canonical Command Name
    if (cmd.id && cmd.command && cmd.id !== `VOX.${cmd.command}`) {
      errors.push({
        rule: 'Canonical Name Alignment',
        commandId: cmd.id,
        field: 'id',
        message: `Command ID "${cmd.id}" must strictly match canonical command keyword "VOX.${cmd.command}".`,
      });
    }

    // 3. Valid Command Class
    if (!VALID_CLASSES.includes(cmd.class)) {
      errors.push({
        rule: 'Valid Command Class',
        commandId: cmd.id,
        field: 'class',
        message: `Class "${cmd.class}" is invalid. Must be one of: ${VALID_CLASSES.join(', ')}.`,
      });
    }

    // 4. Canonical Command Present
    if (!cmd.command || !/^[A-Z0-9_]+$/.test(cmd.command)) {
      errors.push({
        rule: 'Canonical Command Present',
        commandId: cmd.id,
        field: 'command',
        message: `Canonical command name "${cmd.command}" must be non-empty and uppercase.`,
      });
    } else if (seenCanonical.has(cmd.command)) {
      errors.push({
        rule: 'No Duplicate Canonical Commands',
        commandId: cmd.id,
        field: 'command',
        message: `Duplicate canonical command "${cmd.command}" found. Each command must be distinct.`,
      });
    } else {
      seenCanonical.add(cmd.command);
    }

    // 5. Purpose Present
    if (!cmd.purpose || cmd.purpose.trim().length < 8) {
      errors.push({
        rule: 'Purpose Present',
        commandId: cmd.id,
        field: 'purpose',
        message: `Command "${cmd.id}" must provide an explicit Purpose description (min 8 characters).`,
      });
    }

    // 6. Authority Reference Present
    if (!cmd.authority || cmd.authority.system !== 'AUTHPACK' || !cmd.authority.required || cmd.authority.required.length < 6) {
      errors.push({
        rule: 'Authority Reference Present',
        commandId: cmd.id,
        field: 'authority',
        message: `Command "${cmd.id}" must explicitly specify AUTHPACK authorization criteria in its Authority statement.`,
      });
    }

    // 7. Spoken Examples Present
    if (!cmd.examples || !Array.isArray(cmd.examples) || cmd.examples.length === 0) {
      errors.push({
        rule: 'Spoken Examples Present',
        commandId: cmd.id,
        field: 'examples',
        message: `Command "${cmd.id}" must define at least one natural language spoken example utterance.`,
      });
    }

    // 8. Parameter Schema Valid
    if (cmd.parameters) {
      for (const [pName, pDef] of Object.entries(cmd.parameters)) {
        if (!CANONICAL_PARAM_NAMES.has(pName)) {
          warnings.push(`Command "${cmd.id}" uses non-canonical parameter name "${pName}". Consider standard parameter list.`);
        }
        if (typeof pDef.required !== 'boolean') {
          errors.push({
            rule: 'Parameter Schema Valid',
            commandId: cmd.id,
            field: `parameters.${pName}`,
            message: `Parameter "${pName}" must declare boolean "required" property.`,
          });
        }
        if (!pDef.type) {
          errors.push({
            rule: 'Parameter Schema Valid',
            commandId: cmd.id,
            field: `parameters.${pName}`,
            message: `Parameter "${pName}" must declare a data type (e.g. string, number, boolean).`,
          });
        }
      }
    }

    // 9. No Conflicting Aliases
    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) {
        const normAlias = alias.trim().toLowerCase();
        if (!normAlias) continue;

        if (aliasToCommandMap.has(normAlias)) {
          const conflictingCmd = aliasToCommandMap.get(normAlias);
          if (conflictingCmd !== cmd.id) {
            errors.push({
              rule: 'No Conflicting Aliases',
              commandId: cmd.id,
              field: 'aliases',
              message: `Alias "${normAlias}" conflicts with command "${conflictingCmd}".`,
            });
          }
        } else {
          aliasToCommandMap.set(normAlias, cmd.id);
        }
      }
    }

    // 10. Valid Response Profile
    if (!cmd.response_profile || (!cmd.response_profile.startsWith('COMMPACK.') && !VALID_RESPONSE_PROFILES.has(cmd.response_profile))) {
      errors.push({
        rule: 'Valid Response Profile',
        commandId: cmd.id,
        field: 'response_profile',
        message: `Command "${cmd.id}" must specify a valid COMMPACK response profile (e.g. COMMPACK.ACTION, COMMPACK.STATUS).`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Compiles validated Markdown commands into the final machine-readable JSON registry
 */
export function compileCommandsToRegistry(commands: VoxCommandDefinition[], version = '1.0'): VoxRegistry {
  const aliasIndex: Record<string, string> = {};

  for (const cmd of commands) {
    // Canonical name maps to ID
    aliasIndex[cmd.command.toLowerCase()] = cmd.id;

    // Canonical forms map to ID
    for (const form of cmd.canonical_forms) {
      aliasIndex[form.toLowerCase()] = cmd.id;
    }

    // Spoken aliases map to ID
    for (const alias of cmd.aliases) {
      aliasIndex[alias.toLowerCase().trim()] = cmd.id;
    }
  }

  return {
    protocol: 'VOXCONPACK',
    version,
    status: 'ACTIVE',
    lastCompiled: new Date().toISOString(),
    commands,
    aliasIndex,
  };
}
