/**
 * whizzy outcomes — run a published outcome by slug, check a run, list its assets.
 *
 * Usage:
 *   whizzy outcomes run <slug> --input prompt="a red bicycle" [--input n=2] [--inputs-json inputs.json]
 *                              [--variant v] [--idempotency-key k] [--app-id a]
 *                              [--execution-policy automatic|review]
 *                              [--wait [--interval ms] [--timeout ms]] [--json]
 *   whizzy outcomes status <runId> [--json]
 *   whizzy outcomes assets <runId> [--json]
 *   whizzy outcomes workspace <runId> [--json]                  (interactive runs)
 *   whizzy outcomes command <runId> --json '<command>' [--client-action-id k]
 *
 * Talks to the platform through @whizurai/sdk-js (`client.outcomes`).
 */

import fs from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { WhizuraiClient, TERMINAL_OUTCOME_RUN_STATUSES } from '@whizurai/sdk-js';
import type {
  InteractiveCommand,
  InteractiveSlotView,
  InteractiveWorkspace,
  OutcomeExecutionPolicy,
  OutcomeRun,
  OutcomeRunAsset,
  OutcomeRunHandle,
} from '@whizurai/sdk-js';
import { AuthManager } from '../auth';

/**
 * `key=value` → `{ key: value }`. The value is parsed as JSON when it parses
 * (`n=2` → 2, `flag=true` → true, `tags=["a"]` → array), else kept as a string.
 * Quote a JSON string to force a string: `zip='"02134"'`.
 */
export function parseInputPairs(pairs: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq <= 0) throw new Error(`--input expects key=value, got "${pair}"`);
    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
    out[key] = value;
  }
  return out;
}

/** `--inputs-json` file first, then each `--input` on top. */
export function buildInputs(pairs: string[], jsonFile?: string): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (jsonFile) {
    const parsed = JSON.parse(fs.readFileSync(jsonFile, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`--inputs-json ${jsonFile} must hold a JSON object`);
    }
    base = parsed as Record<string, unknown>;
  }
  return { ...base, ...parseInputPairs(pairs) };
}

export function isTerminal(run: Pick<OutcomeRun, 'status'>): boolean {
  return TERMINAL_OUTCOME_RUN_STATUSES.includes(run.status);
}

export function formatHandle(h: OutcomeRunHandle): string {
  return [
    `Run:      ${h.id}`,
    `Outcome:  ${h.outcomeSlug} v${h.outcomeVersion}${h.variantSlug ? ` (${h.variantSlug})` : ''}`,
    `Status:   ${h.status}`,
    `Est. ACU: ${h.estimatedACU ?? 'unknown'}`,
    `Poll:     whizzy outcomes status ${h.id}`,
  ].join('\n');
}

export function formatRun(r: OutcomeRun): string {
  const lines = [
    `Run:       ${r.id}`,
    `Outcome:   ${r.outcomeSlug} v${r.outcomeVersion}${r.variantSlug ? ` (${r.variantSlug})` : ''}`,
    `Status:    ${r.status}`,
    ...(r.interactive ? [`Mode:      interactive (whizzy outcomes workspace ${r.id})`] : []),
    `Started:   ${r.startedAt}`,
    `Completed: ${r.completedAt ?? '-'}`,
    `ACU:       ${r.acuConsumed ?? '-'} used (est. ${r.estimatedACU ?? 'unknown'})`,
  ];
  if (r.errorCode || r.errorMessage) lines.push(`Error:     ${r.errorCode ?? ''} ${r.errorMessage ?? ''}`.trimEnd());
  if (r.result) lines.push('Result:', JSON.stringify(r.result, null, 2));
  return lines.join('\n');
}

export function formatAssets(assets: OutcomeRunAsset[]): string {
  if (assets.length === 0) return 'No assets.';
  return assets.map((a) => `${a.id}  ${a.type.padEnd(22)} ${a.storageRef}`).join('\n');
}

const EXECUTION_POLICIES: readonly OutcomeExecutionPolicy[] = ['automatic', 'review'];

export function parseExecutionPolicy(value: string | undefined): OutcomeExecutionPolicy | undefined {
  if (value === undefined) return undefined;
  if (!(EXECUTION_POLICIES as readonly string[]).includes(value)) {
    throw new Error(`--execution-policy must be one of ${EXECUTION_POLICIES.join(', ')}, got "${value}"`);
  }
  return value as OutcomeExecutionPolicy;
}

/** `--json '<command>'` → an InteractiveCommand. The server validates the shape; this checks it is one. */
export function parseCommand(raw: string): InteractiveCommand {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('--json must be a JSON object, e.g. \'{"action":"pause"}\'');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof (parsed as { action?: unknown }).action !== 'string') {
    throw new Error('--json must be a JSON object with an "action"');
  }
  return parsed as InteractiveCommand;
}

function slotLine(name: string, slot: InteractiveSlotView): string {
  const chosen = slot.chosen ? ` v${slot.chosen.number}${slot.chosen.current ? '' : ' (out of date)'}` : '';
  const next = slot.next && !slot.next.enabled && slot.next.reason ? ` — ${slot.next.reason}` : '';
  return `    ${name.padEnd(12)} ${slot.status}${chosen}${next}`;
}

export function formatWorkspace(w: InteractiveWorkspace): string {
  const lines = [
    `Run:       ${w.runId}`,
    `Status:    ${w.status}${w.paused ? ' (paused)' : ''} · ${w.mode}`,
    `Summary:   ${w.summary}`,
    `Revision:  control ${w.controlRevision}, manifest ${w.manifestRevision}`,
    `Spend:     ${w.spend.incurredAcu} ACU incurred, ${w.spend.outstandingAcu} outstanding` +
      (w.spend.reservedAcu != null ? ` of ${w.spend.reservedAcu} reserved` : ''),
  ];
  for (const item of w.items) {
    lines.push(`  ${item.label} (${item.id})`);
    lines.push(slotLine('description', item.description));
    for (const stage of item.stages) lines.push(slotLine(stage.slot, stage));
  }
  lines.push(`Assembly:  ${w.assembly.status} · ${w.assembly.readyCount}/${w.assembly.requiredCount} ready` +
    (w.assembly.blocker ? ` — ${w.assembly.blocker}` : ''));
  if (w.finishRemaining) {
    lines.push(`Finish:    ${w.finishRemaining.enabled ? `${w.finishRemaining.estimateAcu} ACU estimate` : w.finishRemaining.reason ?? 'unavailable'}`);
  }
  return lines.join('\n');
}

function makeClient(authManager: AuthManager): WhizuraiClient {
  const config = authManager.getConfig();
  if (!config.apiKey) {
    throw new Error('No API key. Run `whizzy auth set-key <key>` or set WHIZ_API_KEY.');
  }
  return new WhizuraiClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
}

function fail(err: unknown): never {
  const e = err as {
    message?: string;
    code?: string;
    details?: { details?: { purchase?: { url?: string } }; workspace?: { controlRevision?: number } };
  };
  console.error(chalk.red('Error:'), e?.code ? `${e.code}: ${e.message}` : e?.message ?? String(err));
  const purchase = e?.details?.details?.purchase?.url;
  if (purchase) console.error(`Add ACU: ${purchase}`);
  const control = e?.details?.workspace?.controlRevision;
  if (control !== undefined) console.error(`Current control revision: ${control} (whizzy outcomes workspace for the rest)`);
  process.exit(1);
}

const collect = (value: string, prev: string[]): string[] => [...prev, value];

export function makeOutcomesCommand(authManager: AuthManager): Command {
  const cmd = new Command('outcomes').description('Run published outcomes and read their results');

  cmd
    .command('run <slug>')
    .description('Start a run of a published outcome')
    .option('-i, --input <key=value>', 'Input field (repeatable; value parsed as JSON when it parses)', collect, [])
    .option('--inputs-json <file>', 'JSON object of inputs (each --input overrides a key)')
    .option('--variant <slug>', 'Variant to run (default variant when omitted)')
    .option('--idempotency-key <key>', 'Replays the same run for the same key and inputs')
    .option('--app-id <id>', "App to bill (defaults to the API key's app)")
    .option('--execution-policy <policy>', '`review` authorizes only the first step (interactive outcomes); `automatic` runs it all')
    .option('-w, --wait', 'Poll until the run finishes, then print the result and assets')
    .option('--interval <ms>', 'Poll interval with --wait', '2000')
    .option('--timeout <ms>', 'Give up waiting after this long', '600000')
    .option('--json', 'Output raw JSON')
    .action(async (slug: string, opts: {
      input: string[];
      inputsJson?: string;
      variant?: string;
      idempotencyKey?: string;
      appId?: string;
      executionPolicy?: string;
      wait?: boolean;
      interval: string;
      timeout: string;
      json?: boolean;
    }) => {
      try {
        const inputs = buildInputs(opts.input, opts.inputsJson);
        const executionPolicy = parseExecutionPolicy(opts.executionPolicy);
        const client = makeClient(authManager);
        const handle = await client.outcomes.run(slug, inputs, {
          variant: opts.variant,
          idempotencyKey: opts.idempotencyKey,
          appId: opts.appId,
          ...(executionPolicy && { executionPolicy }),
        });
        if (!opts.wait) {
          console.log(opts.json ? JSON.stringify({ outcomeRun: handle }, null, 2) : formatHandle(handle));
          return;
        }
        if (!opts.json) console.error(chalk.dim(`Started ${handle.id} (${handle.status})`));
        let last = handle.status as string;
        const run = await client.outcomes.pollUntilDone(handle.id, {
          interval: Number(opts.interval),
          timeout: Number(opts.timeout),
          onUpdate: (r) => {
            if (!opts.json && r.status !== last) console.error(chalk.dim(`  ${r.status}`));
            last = r.status;
          },
        });
        const assets = run.status === 'SUCCEEDED' ? await client.outcomes.assets(run.id) : [];
        if (opts.json) {
          console.log(JSON.stringify({ outcomeRun: run, assets }, null, 2));
        } else {
          console.log(formatRun(run));
          if (run.status === 'SUCCEEDED') console.log(`Assets:\n${formatAssets(assets)}`);
        }
        if (run.status !== 'SUCCEEDED') process.exit(1);
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('status <runId>')
    .description('Show an outcome run: status, result, error, ACU')
    .option('--json', 'Output raw JSON')
    .action(async (runId: string, opts: { json?: boolean }) => {
      try {
        const run = await makeClient(authManager).outcomes.getRun(runId);
        console.log(opts.json ? JSON.stringify({ outcomeRun: run }, null, 2) : formatRun(run));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('assets <runId>')
    .description("List an outcome run's delivered assets")
    .option('--json', 'Output raw JSON')
    .action(async (runId: string, opts: { json?: boolean }) => {
      try {
        const assets = await makeClient(authManager).outcomes.assets(runId);
        console.log(opts.json ? JSON.stringify({ assets }, null, 2) : formatAssets(assets));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('workspace <runId>')
    .description("Show an interactive run's workspace: items, versions, freshness, next actions, spend")
    .option('--json', 'Output raw JSON')
    .action(async (runId: string, opts: { json?: boolean }) => {
      try {
        const workspace = await makeClient(authManager).outcomes.workspace(runId);
        console.log(opts.json ? JSON.stringify(workspace, null, 2) : formatWorkspace(workspace));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('command <runId>')
    .description('Send one interactive command (edit, choose, generate, finish, pause, cancel, retry); prints {result, workspace}')
    .requiredOption('--json <command>', `The command as JSON, e.g. '{"action":"pause"}'`)
    .option('--client-action-id <key>', 'Idempotency key; generated when omitted (previews take none). Reuse it to replay safely')
    .action(async (runId: string, opts: { json: string; clientActionId?: string }) => {
      try {
        const command = parseCommand(opts.json);
        const response = await makeClient(authManager).outcomes.command(runId, command, {
          clientActionId: opts.clientActionId,
        });
        console.log(JSON.stringify(response, null, 2));
      } catch (err) {
        fail(err);
      }
    });

  return cmd;
}
