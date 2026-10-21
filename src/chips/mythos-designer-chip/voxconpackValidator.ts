// VOXCONPACK Command Definition Schema Validator
// Validates new command proposals for schema compliance and safety before activation

import {
  VoxCommandClass,
  VoxCommandDefinition,
  ValidationError,
  ValidationResult,
} from '../services/voxconpack/types';

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
  'action',
  'name',
  'value',
  'source',
  'destination',
  'mode',
  'duration',
  'scope',
  'role',
  'user',
  'reason',
  'file',
  'param',
]);

/**
 * Validates a single new command definition before activation or creation.
 * Checks for mandatory fields, unique ID patterns, canonical name alignment, 
 * immutable anchor protection, and alias conflicts against existing registry commands.
 * 
 * @param command - The new command definition to validate.
 * @param existingCommands - The array of current registered commands to check uniqueness against.
 * @returns The validation result containing boolean flag, errors list, and warning messages.
 */
export function validateNewCommand(
  command: Partial<VoxCommandDefinition>,
  existingCommands: VoxCommandDefinition[] = []
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Anchor Protection
  const isStopCommand = command.command === 'STOP' || command.id === 'VOX.STOP';
  if (isStopCommand) {
    errors.push({
      rule: 'Immutable Anchor Protection',
      commandId: command.id || 'VOX.STOP',
      field: 'command',
      message: 'CRITICAL SAFETY VIOLATION: VOX.STOP is an immutable safety halt anchor and cannot be altered or redefined.',
    });
  }

  // 1. Unique Command ID & Pattern check
  if (!command.id) {
    errors.push({
      rule: 'Mandatory Fields',
      field: 'id',
      message: 'Command ID is a required field.',
    });
  } else if (!/^VOX\.[A-Z0-9_]+$/.test(command.id)) {
    errors.push({
      rule: 'Unique Command ID',
      commandId: command.id,
      field: 'id',
      message: `Command ID "${command.id}" must match pattern "VOX.<COMMAND_NAME>" using uppercase alphanumeric characters.`,
    });
  } else {
    // Check against existing commands
    const idCollision = existingCommands.find(c => c.id === command.id);
    if (idCollision) {
      errors.push({
        rule: 'Unique Command ID',
        commandId: command.id,
        field: 'id',
        message: `Command ID "${command.id}" already exists in the active registry.`,
      });
    }
  }

  // 2. Command Name presence & Alignment
  if (!command.command) {
    errors.push({
      rule: 'Mandatory Fields',
      field: 'command',
      message: 'Canonical command name is a required field.',
    });
  } else if (!/^[A-Z0-9_]+$/.test(command.command)) {
    errors.push({
      rule: 'Canonical Name Alignment',
      commandId: command.id,
      field: 'command',
      message: `Canonical command keyword "${command.command}" must contain only uppercase alphanumeric characters and underscores.`,
    });
  } else if (command.id && command.id !== `VOX.${command.command}`) {
    errors.push({
      rule: 'Canonical Name Alignment',
      commandId: command.id,
      field: 'id',
      message: `Command ID "${command.id}" must strictly match canonical command keyword "VOX.${command.command}".`,
    });
  }

  // 3. Command Class validation
  if (!command.class) {
    errors.push({
      rule: 'Mandatory Fields',
      field: 'class',
      message: 'Command class is a required field.',
    });
  } else if (!VALID_CLASSES.includes(command.class as VoxCommandClass)) {
    errors.push({
      rule: 'Valid Command Class',
      commandId: command.id,
      field: 'class',
      message: `Class "${command.class}" is invalid. Must be one of: ${VALID_CLASSES.join(', ')}.`,
    });
  }

  // 4. Purpose statement validation
  if (!command.purpose) {
    errors.push({
      rule: 'Mandatory Fields',
      field: 'purpose',
      message: 'Purpose description is a required field.',
    });
  } else if (command.purpose.trim().length < 8) {
    errors.push({
      rule: 'Purpose Present',
      commandId: command.id,
      field: 'purpose',
      message: `Purpose description is too brief (minimum 8 characters required).`,
    });
  }

  // 5. Authority System validation
  if (!command.authority) {
    errors.push({
      rule: 'Mandatory Fields',
      field: 'authority',
      message: 'Authority criteria is a required field.',
    });
  } else {
    if (command.authority.system !== 'AUTHPACK') {
      errors.push({
        rule: 'Authority Reference Present',
        commandId: command.id,
        field: 'authority.system',
        message: 'Authority system must be strictly set to "AUTHPACK".',
      });
    }
    if (!command.authority.required || command.authority.required.trim().length < 6) {
      errors.push({
        rule: 'Authority Reference Present',
        commandId: command.id,
        field: 'authority.required',
        message: 'Authority reference must explicitly specify required AUTHPACK permissions (min 6 characters).',
      });
    }
  }

  // 6. Spoken Examples validation
  if (!command.examples || !Array.isArray(command.examples) || command.examples.length === 0) {
    errors.push({
      rule: 'Spoken Examples Present',
      commandId: command.id,
      field: 'examples',
      message: 'Must define at least one natural language spoken example utterance.',
    });
  } else {
    const emptyExample = command.examples.some(ex => !ex || ex.trim().length === 0);
    if (emptyExample) {
      errors.push({
        rule: 'Spoken Examples Present',
        commandId: command.id,
        field: 'examples',
        message: 'All spoken examples must be non-empty text strings.',
      });
    }
  }

  // 7. Response Profile validation
  if (!command.response_profile) {
    errors.push({
      rule: 'Mandatory Fields',
      field: 'response_profile',
      message: 'Response profile is a required field.',
    });
  } else if (
    !command.response_profile.startsWith('COMMPACK.') &&
    !VALID_RESPONSE_PROFILES.has(command.response_profile)
  ) {
    errors.push({
      rule: 'Valid Response Profile',
      commandId: command.id,
      field: 'response_profile',
      message: `Response profile "${command.response_profile}" is invalid. Must specify a valid COMMPACK response profile.`,
    });
  }

  // 8. Parameter schema validations
  if (command.parameters) {
    for (const [pName, pDef] of Object.entries(command.parameters)) {
      if (!CANONICAL_PARAM_NAMES.has(pName)) {
        warnings.push(`Command parameter "${pName}" is non-canonical. Standard parameters are recommended.`);
      }
      if (pDef) {
        if (typeof pDef.required !== 'boolean') {
          errors.push({
            rule: 'Parameter Schema Valid',
            commandId: command.id,
            field: `parameters.${pName}.required`,
            message: `Parameter "${pName}" must declare boolean "required" property.`,
          });
        }
        if (!pDef.type || pDef.type.trim().length === 0) {
          errors.push({
            rule: 'Parameter Schema Valid',
            commandId: command.id,
            field: `parameters.${pName}.type`,
            message: `Parameter "${pName}" must declare a valid data type (e.g., string, number, boolean).`,
          });
        }
      } else {
        errors.push({
          rule: 'Parameter Schema Valid',
          commandId: command.id,
          field: `parameters.${pName}`,
          message: `Parameter "${pName}" definition cannot be null or undefined.`,
        });
      }
    }
  }

  // 9. Check conflicting aliases against existing registry
  if (command.aliases && Array.isArray(command.aliases)) {
    for (const alias of command.aliases) {
      const normAlias = alias.trim().toLowerCase();
      if (!normAlias) continue;

      // Check if alias conflicts with existing command's canonical command keyword or list of aliases
      for (const ec of existingCommands) {
        if (ec.id === command.id) continue; // Skip comparing to self if updating

        const isCanonicalConflict = ec.command && ec.command.toLowerCase() === normAlias;
        const isAliasConflict = ec.aliases && ec.aliases.some(a => a.toLowerCase().trim() === normAlias);

        if (isCanonicalConflict || isAliasConflict) {
          errors.push({
            rule: 'No Conflicting Aliases',
            commandId: command.id,
            field: 'aliases',
            message: `Alias "${alias}" conflicts with registered command "${ec.id}".`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
