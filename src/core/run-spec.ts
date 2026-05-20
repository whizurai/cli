/**
 * RunSpecBuilder — compiles all sources of user intent into a normalized RunSpec.
 *
 * Sources (in priority order for field merging):
 *   1. Explicit CLI flags (highest priority)
 *   2. JSON/YAML spec file (--spec or positional arg ending in .json/.yaml)
 *   3. Interactive prompts (when no flags or spec provided)
 *   4. Capability defaults from schema introspection (lowest priority)
 *
 * The builder does NOT perform asset resolution. That is done separately by
 * AssetResolver so that dry-run mode can validate the spec shape before any
 * network I/O.
 */

import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { RunSpec, Capability, CapabilityInputField } from './types';

export interface RunSpecFlags {
  /** Prompt text for the operation. */
  prompt?: string;
  /** Primary input asset (image, video, audio). */
  input?: string;
  /** Reference asset (secondary input). */
  ref?: string;
  /** Mask asset. */
  mask?: string;
  /** Provider override. */
  provider?: string;
  /** Model override. */
  model?: string;
  /** Duration in seconds (video ops). */
  duration?: number;
  /** Aspect ratio string e.g. "16:9". */
  aspect?: string;
  /** Output size e.g. "1024x1024". */
  size?: string;
  /** Quality setting. */
  quality?: string;
  /** Random seed. */
  seed?: number;
  /** Run asynchronously and return immediately. */
  async?: boolean;
  /** Poll and stream progress after submit. */
  watch?: boolean;
  /** Validate spec without submitting. */
  dryRun?: boolean;
  /** Idempotency key. */
  idempotencyKey?: string;
  /** Webhook URL for completion callback. */
  webhookUrl?: string;
  /** Output as JSON. */
  json?: boolean;
  /** Local path or directory to write artifacts. */
  output?: string;
  /** Automatically download artifacts. */
  download?: boolean;
  /** Arbitrary key=value metadata pairs. */
  meta?: string[];
}

/**
 * Build a RunSpec from:
 *  - a target (capability slug or spec file path)
 *  - CLI flags
 *  - optional capability schema for interactive prompting
 */
export async function buildRunSpec(
  target: string,
  flags: RunSpecFlags,
  capability?: Capability
): Promise<RunSpec> {
  // If target is a spec file, load and merge with flags
  if (isSpecFile(target)) {
    return buildFromSpecFile(target, flags);
  }

  // Build inputs from flags (non-interactive)
  let inputs = buildInputsFromFlags(flags, capability);

  // If interactive mode (no flags that supply required inputs), prompt
  if (capability && shouldPromptInteractively(inputs, capability)) {
    inputs = await promptInputs(inputs, capability);
  }

  const metadata = parseMetaFlags(flags.meta ?? []);

  const spec: RunSpec = {
    target,
    inputs,
    execution: {
      async: flags.async,
      watch: flags.watch,
      dryRun: flags.dryRun,
      idempotencyKey: flags.idempotencyKey,
    },
    output: {
      json: flags.json,
      path: flags.output,
      download: flags.download,
    },
    webhookUrl: flags.webhookUrl,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  if (flags.provider || flags.model) {
    spec.routing = {
      provider: flags.provider,
      model: flags.model,
    };
  }

  return spec;
}

/**
 * Load a spec file (JSON or YAML) and merge CLI flag overrides on top.
 */
export function buildFromSpecFile(
  filePath: string,
  flags: RunSpecFlags
): RunSpec {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Spec file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  let spec: RunSpec;

  try {
    spec = JSON.parse(raw) as RunSpec;
  } catch {
    throw new Error(`Failed to parse spec file: ${resolved}\nMust be valid JSON.`);
  }

  // Merge CLI flag overrides onto loaded spec
  if (flags.provider || flags.model) {
    spec.routing = {
      ...spec.routing,
      ...(flags.provider ? { provider: flags.provider } : {}),
      ...(flags.model ? { model: flags.model } : {}),
    };
  }

  if (flags.async !== undefined) spec.execution.async = flags.async;
  if (flags.watch !== undefined) spec.execution.watch = flags.watch;
  if (flags.dryRun !== undefined) spec.execution.dryRun = flags.dryRun;
  if (flags.idempotencyKey) spec.execution.idempotencyKey = flags.idempotencyKey;
  if (flags.json !== undefined) (spec.output ??= {}).json = flags.json;
  if (flags.output) (spec.output ??= {}).path = flags.output;
  if (flags.download !== undefined) (spec.output ??= {}).download = flags.download;
  if (flags.webhookUrl) spec.webhookUrl = flags.webhookUrl;

  const extraMeta = parseMetaFlags(flags.meta ?? []);
  if (Object.keys(extraMeta).length > 0) {
    spec.metadata = { ...spec.metadata, ...extraMeta };
  }

  return spec;
}

/**
 * Map CLI flags to a flat inputs object using well-known field names.
 * Capability-specific unknown flags are ignored here; capability schemas
 * map additional named args in the interactive path.
 */
function buildInputsFromFlags(
  flags: RunSpecFlags,
  capability?: Capability
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  if (flags.prompt !== undefined) inputs.prompt = flags.prompt;
  if (flags.input !== undefined) {
    // Prefer the field name from the capability schema if available
    const inputFieldName = findImageInputField(capability);
    inputs[inputFieldName] = flags.input;
  }
  if (flags.ref !== undefined) inputs.reference_image_url = flags.ref;
  if (flags.mask !== undefined) inputs.mask = flags.mask;
  if (flags.duration !== undefined) inputs.duration = flags.duration;
  if (flags.aspect !== undefined) inputs.aspect_ratio = flags.aspect;
  if (flags.size !== undefined) inputs.size = flags.size;
  if (flags.quality !== undefined) inputs.quality = flags.quality;
  if (flags.seed !== undefined) inputs.seed = flags.seed;

  return inputs;
}

/**
 * Find the primary image input field name from a capability's input contract.
 * Falls back to 'image_url' which is the most common convention.
 */
function findImageInputField(capability?: Capability): string {
  if (!capability?.inputContract) return 'image_url';

  const imageFields = [
    'image_url', 'imageUrl', 'inputImageUrl', 'baseImage', 'input_image_url', 'image',
  ];

  for (const name of imageFields) {
    if (capability.inputContract.some((f) => f.name === name)) {
      return name;
    }
  }

  return 'image_url';
}

/**
 * Determine whether we should enter interactive prompting.
 * We prompt when required fields are missing and we're in a TTY.
 */
function shouldPromptInteractively(
  inputs: Record<string, unknown>,
  capability: Capability
): boolean {
  if (!process.stdin.isTTY) return false;
  if (!capability.inputContract || capability.inputContract.length === 0) return false;

  const required = capability.inputContract.filter((f) => f.required);
  const missing = required.filter((f) => inputs[f.name] === undefined);
  return missing.length > 0;
}

/**
 * Drive an interactive prompt session based on the capability's input contract.
 * Only prompts for fields not already provided in the pre-existing inputs.
 */
async function promptInputs(
  existingInputs: Record<string, unknown>,
  capability: Capability
): Promise<Record<string, unknown>> {
  const fields = capability.inputContract ?? [];
  const inputs = { ...existingInputs };

  console.log(chalk.dim(`\n  ${capability.name} — ${capability.description ?? ''}`));
  console.log(chalk.dim('  Fill in the required fields below.\n'));

  for (const field of fields) {
    if (inputs[field.name] !== undefined) continue; // already provided

    const question = buildQuestion(field);
    const answer = await inquirer.prompt([question]);
    if (answer[field.name] !== undefined && answer[field.name] !== '') {
      inputs[field.name] = answer[field.name];
    }
  }

  return inputs;
}

/**
 * Build an inquirer question from a capability input field definition.
 */
function buildQuestion(field: CapabilityInputField): Record<string, unknown> {
  const base = {
    name: field.name,
    message: field.label ?? field.name,
  };

  if (field.enum && field.enum.length > 0) {
    return {
      ...base,
      type: 'list',
      choices: field.enum,
      default: field.default,
    };
  }

  if (field.type === 'boolean') {
    return {
      ...base,
      type: 'confirm',
      default: field.default ?? false,
    };
  }

  if (field.type === 'number' || field.type === 'integer') {
    return {
      ...base,
      type: 'input',
      default: field.default !== undefined ? String(field.default) : undefined,
      filter: (v: string) => (v === '' ? undefined : Number(v)),
      validate: (v: string) => {
        if (!field.required && v === '') return true;
        return !isNaN(Number(v)) || 'Must be a number';
      },
    };
  }

  return {
    ...base,
    type: 'input',
    default: field.default !== undefined ? String(field.default) : undefined,
    validate: field.required
      ? (v: string) => v.trim().length > 0 || `${field.name} is required`
      : undefined,
  };
}

/**
 * Check whether the given target string refers to a spec file.
 */
export function isSpecFile(target: string): boolean {
  return /\.(json|yaml|yml)$/i.test(target);
}

/**
 * Parse --meta key=value flag array into a Record.
 */
function parseMetaFlags(metaFlags: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of metaFlags) {
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (k) result[k] = v;
  }
  return result;
}

/**
 * Serialize a RunSpec to a formatted JSON string (for --generate and --dry-run output).
 */
export function serializeSpec(spec: RunSpec): string {
  return JSON.stringify(spec, null, 2);
}
