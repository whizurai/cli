/**
 * whiz run — primary execution command.
 *
 * Usage:
 *   whiz run image.edit                          # interactive mode
 *   whiz run image.edit --input cat.png --prompt "cinematic"
 *   whiz run spec.json                           # execute a manifest
 *   whiz run image.edit --dry-run               # validate without submitting
 *   whiz run image.edit --watch                  # stream progress
 *   whiz run image.edit --async                  # return run ID immediately
 *   whiz run video:multi-shot --input start.png \
 *        --shots shots.json --subject hero_pet=a.jpg,b.jpg
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { RunSpecFlags } from '../core/run-spec';
import { buildRunSpec } from '../core/run-spec';
import { ApiClient } from '../core/api-client';
import { ExecutionEngine } from '../core/execution-engine';
import { AuthManager } from '../auth';

export function makeRunCommand(authManager: AuthManager): Command {
  const cmd = new Command('run');

  cmd
    .description('Execute a capability, workflow, or spec file')
    .argument('<target>', 'Capability slug (image.edit), workflow slug, or path to a spec file')
    .option('-p, --prompt <text>', 'Prompt text')
    .option('-i, --input <asset>', 'Primary input asset: local file path, URL, or asset_id:xxx')
    .option('--ref <asset>', 'Reference asset')
    .option('--mask <asset>', 'Mask asset')
    .option('--provider <name>', 'Provider override')
    .option('--model <name>', 'Model override')
    .option('--duration <seconds>', 'Duration (video operations)', parseFloat)
    .option('--aspect <ratio>', 'Aspect ratio e.g. 16:9')
    .option('--size <value>', 'Output size e.g. 1024x1024')
    .option('--quality <value>', 'Quality setting')
    .option('--seed <number>', 'Random seed', parseInt)
    .option('--async', 'Submit and return immediately without waiting')
    .option('--watch', 'Stream run progress to terminal')
    .option('--dry-run', 'Validate and print spec without submitting')
    .option('--shots <file>', 'JSON file with an ordered shot list (multi-shot capabilities)')
    .option(
      '--subject <token=urls>',
      'Named subject to keep consistent across shots, e.g. hero_pet=a.jpg,b.jpg (repeatable)',
      collect,
      [],
    )
    .option('--idempotency-key <key>', 'Idempotency key for deduplication')
    .option('--webhook-url <url>', 'Callback URL on run completion')
    .option('--json', 'Output full JSON result to stdout')
    .option('-o, --output <path>', 'Path to write downloaded artifacts')
    .option('--download', 'Automatically download artifacts on completion')
    .option('--meta <key=value>', 'Metadata key=value pair (repeatable)', collect, [])
    .action(async (target: string, opts: Record<string, unknown>) => {
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
        dryRun: opts.dryRun as boolean | undefined,
        shots: opts.shots as string | undefined,
        subject: (opts.subject as string[] | undefined)?.length
          ? (opts.subject as string[])
          : undefined,
        idempotencyKey: opts.idempotencyKey as string | undefined,
        webhookUrl: opts.webhookUrl as string | undefined,
        json: opts.json as boolean | undefined,
        output: opts.output as string | undefined,
        download: opts.download as boolean | undefined,
        meta: opts.meta as string[],
      };

      try {
        const config = authManager.getConfig();
        const client = new ApiClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });
        const engine = new ExecutionEngine(client);

        // Fetch capability schema for interactive prompting (best-effort)
        let capability;
        if (!isSpecFile(target)) {
          try {
            capability = await client.getCapability(target);
          } catch {
            // No capability found — proceed without schema (workflow slug or unknown)
          }
        }

        const spec = await buildRunSpec(target, flags, capability);
        const result = await engine.execute(spec);

        if (flags.json) {
          engine.printJsonResult(result);
        } else {
          engine.printResult(result);
        }

        if (result.run.status === 'failed') {
          process.exit(1);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });

  return cmd;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSpecFile(target: string): boolean {
  return /\.(json|yaml|yml)$/i.test(target);
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
