/**
 * whiz generate — produce a reproducible run spec manifest.
 *
 * Usage:
 *   whiz generate image.edit                    # scaffold a spec from schema
 *   whiz generate image.edit > spec.json        # save to file
 *   whiz generate image.edit --format yaml      # YAML output (future)
 *   whiz generate image.edit \
 *     --input cat.png --prompt "cinematic" \
 *     --provider kieai --model kling-v2-6       # spec from flags
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../core/api-client';
import { AuthManager } from '../auth';
import { buildRunSpec, serializeSpec } from '../core/run-spec';
import type { RunSpecFlags } from '../core/run-spec';
import type { RunSpec, Capability, CapabilityInputField } from '../core/types';

export function makeGenerateCommand(authManager: AuthManager): Command {
  const cmd = new Command('generate');

  cmd
    .description('Generate a run spec manifest for a capability')
    .argument('<target>', 'Capability slug or workflow slug')
    .option('-p, --prompt <text>', 'Prompt text')
    .option('-i, --input <asset>', 'Primary input asset')
    .option('--ref <asset>', 'Reference asset')
    .option('--mask <asset>', 'Mask asset')
    .option('--provider <name>', 'Provider override')
    .option('--model <name>', 'Model override')
    .option('--duration <seconds>', 'Duration (video operations)', parseFloat)
    .option('--aspect <ratio>', 'Aspect ratio e.g. 16:9')
    .option('--size <value>', 'Output size e.g. 1024x1024')
    .option('--quality <value>', 'Quality setting')
    .option('--seed <number>', 'Random seed', parseInt)
    .option('--watch', 'Include --watch flag in generated spec')
    .option('--async', 'Include --async flag in generated spec')
    .option('--webhook-url <url>', 'Include webhook URL in generated spec')
    .option('--meta <key=value>', 'Metadata key=value pair (repeatable)', collect, [])
    .option('--with-comments', 'Include field descriptions as inline JSON comments (best-effort)')
    .action(async (target: string, opts: Record<string, unknown>) => {
      try {
        const config = authManager.getConfig();
        const client = new ApiClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });

        // Fetch capability schema
        let capability: Capability | undefined;
        try {
          capability = await client.getCapability(target);
        } catch {
          // Unknown target — generate a minimal template
        }

        const flags: RunSpecFlags = {
          prompt: opts.prompt as string | undefined,
          input: opts.input as string | undefined,
          ref: opts.ref as string | undefined,
          mask: opts.mask as string | undefined,
          provider: opts.provider as string | undefined,
          model: opts.model as string | undefined,
          duration: opts.duration as number | undefined,
          aspect: opts.aspect as string | undefined,
          size: opts.size as string | undefined,
          quality: opts.quality as string | undefined,
          seed: opts.seed as number | undefined,
          async: opts.async as boolean | undefined,
          watch: opts.watch as boolean | undefined,
          webhookUrl: opts.webhookUrl as string | undefined,
          meta: opts.meta as string[],
        };

        // Build spec — use placeholder values for fields not provided
        const spec = await buildGenerateSpec(target, flags, capability);

        if (opts.withComments && capability) {
          console.log(buildAnnotatedSpec(spec, capability));
        } else {
          console.log(serializeSpec(spec));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });

  return cmd;
}

// ─── Spec builder for generate mode ──────────────────────────────────────────

async function buildGenerateSpec(
  target: string,
  flags: RunSpecFlags,
  capability?: Capability
): Promise<RunSpec> {
  // Use buildRunSpec but skip interactive prompting (stdin is probably a pipe)
  const spec = await buildRunSpec(target, flags, undefined);

  // Fill in placeholder values for required fields not yet provided
  if (capability?.inputContract) {
    for (const field of capability.inputContract) {
      if (spec.inputs[field.name] !== undefined) continue;

      spec.inputs[field.name] = getPlaceholder(field);
    }
  }

  // Strip undefined values for clean output
  spec.execution = stripUndefined(spec.execution) as RunSpec['execution'];

  return spec;
}

/**
 * Return a placeholder value for a field, based on its type and constraints.
 */
function getPlaceholder(field: CapabilityInputField): unknown {
  if (field.default !== undefined) return field.default;
  if (field.enum && field.enum.length > 0) return field.enum[0];

  switch (field.type) {
    case 'string':
      return field.name.includes('url') || field.name.includes('image')
        ? 'https://example.com/image.jpg'
        : `<${field.name}>`;
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

/**
 * Build a spec JSON string with inline comments documenting each field.
 * JSON doesn't support comments natively so this produces a best-effort
 * human-readable format using // lines before each field.
 *
 * For actual tooling use, prefer the plain JSON output.
 */
function buildAnnotatedSpec(spec: RunSpec, capability: Capability): string {
  const fieldDocs: Record<string, string> = {};
  for (const field of capability.inputContract ?? []) {
    const parts = [
      field.type,
      field.required ? 'required' : 'optional',
      field.description ?? '',
      field.enum ? `enum: ${JSON.stringify(field.enum)}` : '',
    ].filter(Boolean);
    fieldDocs[field.name] = parts.join('  |  ');
  }

  const lines = JSON.stringify(spec, null, 2).split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const keyMatch = line.match(/^(\s*)"([^"]+)":/);
    if (keyMatch && fieldDocs[keyMatch[2]]) {
      output.push(`${keyMatch[1]}// ${fieldDocs[keyMatch[2]]}`);
    }
    output.push(line);
  }

  return output.join('\n');
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
