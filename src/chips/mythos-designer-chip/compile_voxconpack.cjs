const fs = require('fs');
const path = require('path');

const commandsMdPath = path.join(__dirname, '../VOXCONPACK/COMMANDS.md');
const commandsDir = path.join(__dirname, '../VOXCONPACK/commands');
const compiledDir = path.join(__dirname, '../VOXCONPACK/compiled');

if (!fs.existsSync(commandsDir)) {
  fs.mkdirSync(commandsDir, { recursive: true });
}
if (!fs.existsSync(compiledDir)) {
  fs.mkdirSync(compiledDir, { recursive: true });
}

const markdown = fs.readFileSync(commandsMdPath, 'utf8');

// Parse markdown
const sections = markdown.split(/\n(?=##\s+)/);
const commands = [];
const aliasIndex = {};

for (const rawSection of sections) {
  const section = rawSection.trim();
  if (!section.startsWith('## ')) continue;

  const headerMatch = section.match(/^##\s+([A-Z0-9_]+)/);
  if (!headerMatch) continue;
  const commandName = headerMatch[1].trim();

  const idMatch = section.match(/Command ID:\s*(VOX\.[A-Z0-9_]+)/i);
  const commandId = idMatch ? idMatch[1].trim().toUpperCase() : `VOX.${commandName}`;

  const classMatch = section.match(/Class:\s*([A-Z_]+)/i);
  const commandClass = classMatch ? classMatch[1].trim().toUpperCase() : 'CONTROL';

  const purposeMatch = section.match(/Purpose:\s*([\s\S]*?)(?=\n\n[A-Za-z]+:|\nCanonical forms:|\nAliases:|$)/i);
  const purpose = purposeMatch ? purposeMatch[1].trim() : '';

  const canonicalMatch = section.match(/Canonical forms:\s*([\s\S]*?)(?=\n[A-Za-z]+:|\n\n##|$)/i);
  const canonical_forms = [];
  if (canonicalMatch) {
    canonicalMatch[1]
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean)
      .forEach((c) => canonical_forms.push(c.toUpperCase()));
  }
  if (canonical_forms.length === 0) canonical_forms.push(commandName);

  const aliasesMatch = section.match(/Aliases:\s*([\s\S]*?)(?=\nParameters:|\nExamples:|\nAuthority:|\n\n##|$)/i);
  const aliases = [];
  if (aliasesMatch) {
    aliasesMatch[1]
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean)
      .forEach((a) => {
        const lower = a.toLowerCase();
        if (!aliases.includes(lower)) aliases.push(lower);
      });
  }

  const paramsMatch = section.match(/Parameters:\s*([\s\S]*?)(?=\nExamples:|\nAuthority:|\nConfirmation:|\n\n##|$)/i);
  const parameters = {};
  if (paramsMatch) {
    const paramLines = paramsMatch[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-'));
    for (const line of paramLines) {
      if (line.toLowerCase().includes('none')) continue;
      const pMatch = line.match(/^-\s*([a-zA-Z0-9_]+)\s*:\s*(required|optional)\s*(?:\(([a-zA-Z0-9_]+)\))?(?:\s*-\s*(.*))?/i);
      if (pMatch) {
        parameters[pMatch[1].toLowerCase()] = {
          required: pMatch[2].toLowerCase() === 'required',
          type: pMatch[3] ? pMatch[3].toLowerCase() : 'string',
          description: pMatch[4] ? pMatch[4].trim() : '',
        };
      }
    }
  }

  const examplesMatch = section.match(/Examples:\s*([\s\S]*?)(?=\nAuthority:|\nConfirmation:|\nExecution:|\n\n##|$)/i);
  const examples = [];
  if (examplesMatch) {
    examplesMatch[1]
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').replace(/^"|"$/g, '').trim())
      .filter(Boolean)
      .forEach((ex) => examples.push(ex));
  }

  const authorityMatch = section.match(/Authority:\s*([\s\S]*?)(?=\nConfirmation:|\nExecution:|\nFailure:|\n\n##|$)/i);
  const authorityText = authorityMatch ? authorityMatch[1].trim() : 'Requires AUTHPACK authorization.';

  const confMatch = section.match(/Confirmation:\s*([\s\S]*?)(?=\nExecution:|\nFailure:|\nEscalation:|\n\n##|$)/i);
  const confText = confMatch ? confMatch[1].trim() : '';
  const requiresConfirmation =
    confText.toLowerCase().includes('always requires') ||
    (confText.toLowerCase().includes('required') && !confText.toLowerCase().includes('not required'));

  const execMatch = section.match(/Execution:\s*([\s\S]*?)(?=\nFailure:|\nEscalation:|\nResponse Profile:|\n\n##|$)/i);
  const execution = execMatch ? execMatch[1].trim() : 'Submit request to execution layer.';

  const failureMatch = section.match(/Failure:\s*([\s\S]*?)(?=\nEscalation:|\nResponse Profile:|\n\n##|$)/i);
  const failure = failureMatch ? failureMatch[1].trim() : 'Report actual failure condition.';

  const escMatch = section.match(/Escalation:\s*([\s\S]*?)(?=\nResponse Profile:|\n\n##|$)/i);
  const escalation = escMatch ? escMatch[1].trim() : 'Escalate if operation exceeds available authority.';

  const respMatch = section.match(/Response Profile:\s*([A-Za-z0-9_.]+)/i);
  const responseProfile = respMatch ? respMatch[1].trim() : 'COMMPACK.ACTION';

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
      system: 'AUTHPACK',
      required: authorityText,
    },
    confirmation: requiresConfirmation,
    execution,
    failure,
    escalation,
    response_profile: responseProfile,
  };

  commands.push(cmdDef);

  // Write individual markdown definition to VOXCONPACK/commands/<COMMAND>.md
  const individualMd = section.trim() + '\n';
  fs.writeFileSync(path.join(commandsDir, `${commandName}.md`), individualMd);

  // Index aliases
  aliasIndex[commandName.toLowerCase()] = commandId;
  for (const form of canonical_forms) {
    aliasIndex[form.toLowerCase()] = commandId;
  }
  for (const alias of aliases) {
    aliasIndex[alias.toLowerCase().trim()] = commandId;
  }
}

const registry = {
  protocol: 'VOXCONPACK',
  version: '1.0',
  status: 'ACTIVE',
  lastCompiled: new Date().toISOString(),
  commands,
  aliasIndex,
};

// Write compiled JSON files
fs.writeFileSync(path.join(compiledDir, 'commands.json'), JSON.stringify(commands, null, 2));
fs.writeFileSync(path.join(compiledDir, 'aliases.json'), JSON.stringify(aliasIndex, null, 2));
fs.writeFileSync(path.join(compiledDir, 'registry.json'), JSON.stringify(registry, null, 2));

console.log(`[VOXCONPACK] Successfully compiled ${commands.length} commands into JSON artifacts.`);
