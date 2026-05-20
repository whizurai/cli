/**
 * ExecutionEngine — single path through which every CLI run flows.
 *
 * Responsibilities:
 *   1. Resolve assets in the run spec
 *   2. Submit the run to the platform capability API
 *   3. Handle sync vs async execution
 *   4. Poll/watch run progress
 *   5. Stream run output to the terminal
 *   6. Download artifacts when requested
 *
 * The engine knows nothing about specific capabilities or command syntax.
 * It only operates on the normalized RunSpec type.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import type { RunSpec, Run, Artifact, PollOptions } from './types';
import { ApiClient } from './api-client';
import { AssetResolver } from './asset-resolver';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export interface ExecutionResult {
  run: Run;
  artifacts: Artifact[];
  /** Wall clock time in ms */
  elapsedMs: number;
}

export class ExecutionEngine {
  private client: ApiClient;
  private resolver: AssetResolver;

  constructor(client: ApiClient) {
    this.client = client;
    this.resolver = new AssetResolver({
      uploadFn: (filePath) => this.client.uploadFile(filePath),
      lookupArtifactFn: (id) => this.client.lookupArtifact(id),
    });
  }

  /**
   * Execute a normalized RunSpec end-to-end.
   *
   * For dry-run mode, validates and prints the resolved spec without
   * submitting. For async mode, submits and returns immediately with the
   * pending run. For watch mode, polls until completion and streams updates.
   */
  async execute(spec: RunSpec): Promise<ExecutionResult> {
    const startMs = Date.now();

    // Step 1: Resolve assets
    const resolvedInputs = await this.resolver.resolveInputs(spec.inputs);
    const resolvedSpec = { ...spec, inputs: resolvedInputs };

    // Step 2: Dry run — validate and print, do not submit
    if (resolvedSpec.execution.dryRun) {
      return this.handleDryRun(resolvedSpec, startMs);
    }

    // Step 3: Submit
    const spinner = ora({ text: 'Submitting run…', stream: process.stderr }).start();
    let run: Run;

    try {
      const response = await this.client.executeCapability(resolvedSpec.target, {
        input: resolvedSpec.inputs,
        idempotencyKey: resolvedSpec.execution.idempotencyKey,
        webhookUrl: resolvedSpec.webhookUrl,
        routing: resolvedSpec.routing,
        metadata: resolvedSpec.metadata,
      });
      run = response.run;
      spinner.succeed(`Run submitted: ${chalk.bold(run.id)}`);
    } catch (err) {
      spinner.fail('Run submission failed');
      throw err;
    }

    // Step 4: Async — return immediately
    if (resolvedSpec.execution.async && !resolvedSpec.execution.watch) {
      return {
        run,
        artifacts: [],
        elapsedMs: Date.now() - startMs,
      };
    }

    // Step 5: Poll until done (watch or default-sync)
    const completed = await this.poll(run.id, {
      timeoutMs: 600_000,
      onUpdate: resolvedSpec.execution.watch
        ? (r) => this.printRunUpdate(r)
        : undefined,
    });

    // Step 6: Fetch final artifacts
    const artifacts = await this.fetchArtifacts(completed);

    // Step 7: Download artifacts if requested
    if (resolvedSpec.output?.download && resolvedSpec.output.path) {
      await this.downloadArtifacts(artifacts, resolvedSpec.output.path);
    }

    return {
      run: completed,
      artifacts,
      elapsedMs: Date.now() - startMs,
    };
  }

  /**
   * Poll run until it reaches a terminal state.
   */
  async poll(runId: string, opts: PollOptions = {}): Promise<Run> {
    const intervalMs = opts.intervalMs ?? 2_000;
    const timeoutMs = opts.timeoutMs ?? 600_000;
    const deadline = Date.now() + timeoutMs;

    let delay = intervalMs;

    while (true) {
      const run = await this.client.getRun(runId);

      if (opts.onUpdate) opts.onUpdate(run);

      if (TERMINAL_STATUSES.has(run.status)) {
        return run;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Run ${runId} did not complete within ${Math.round(timeoutMs / 1000)}s. ` +
          `Use "whiz watch ${runId}" to continue monitoring.`
        );
      }

      await sleep(delay);
      // Exponential backoff, capped at 10s
      delay = Math.min(delay * 1.5, 10_000);
    }
  }

  /**
   * Print formatted run status to stderr (non-JSON output paths).
   */
  printResult(result: ExecutionResult): void {
    const { run, artifacts, elapsedMs } = result;

    if (run.status === 'succeeded') {
      console.error(
        chalk.green('✓') + ` Run ${chalk.bold(run.id)} succeeded in ${formatDuration(elapsedMs)}`
      );
    } else if (run.status === 'failed') {
      console.error(
        chalk.red('✗') + ` Run ${chalk.bold(run.id)} failed: ${run.error?.message ?? 'unknown error'}`
      );
    } else {
      console.error(
        chalk.yellow('~') + ` Run ${chalk.bold(run.id)}: ${run.status}`
      );
    }

    if (artifacts.length > 0) {
      console.error(chalk.dim(`\n  Artifacts (${artifacts.length}):`));
      for (const a of artifacts) {
        const line = a.url
          ? `  ${chalk.cyan(a.type ?? 'file')}  ${a.url}`
          : `  ${chalk.cyan(a.type ?? 'file')}  ${a.id}`;
        console.error(line);
      }
    }
  }

  /**
   * Print JSON result to stdout.
   */
  printJsonResult(result: ExecutionResult): void {
    console.log(JSON.stringify(result, null, 2));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async handleDryRun(spec: RunSpec, startMs: number): Promise<ExecutionResult> {
    console.log(chalk.dim('--- dry run (no submission) ---'));
    console.log(JSON.stringify(spec, null, 2));

    const spinner = ora({ text: 'Validating against platform…', stream: process.stderr }).start();
    let validation: Awaited<ReturnType<ApiClient['dryRunCapability']>>;
    try {
      validation = await this.client.dryRunCapability(spec.target, spec.inputs);
    } catch (err) {
      spinner.fail('Dry-run validation request failed');
      throw err;
    }

    if (validation.valid) {
      spinner.succeed('Validation passed');
      if (validation.resolvedInputs) {
        console.error(chalk.dim('\nResolved inputs:'));
        console.error(JSON.stringify(validation.resolvedInputs, null, 2));
      }
      if (typeof validation.estimatedCost === 'number') {
        console.error(chalk.dim(`Estimated cost: ${validation.estimatedCost}`));
      }
      if (validation.warnings?.length) {
        console.error(chalk.yellow('Warnings:'));
        console.error(JSON.stringify(validation.warnings, null, 2));
      }
    } else {
      spinner.fail('Validation failed');
      if (validation.errors?.length) {
        console.error(chalk.red('Errors:'));
        console.error(JSON.stringify(validation.errors, null, 2));
      }
    }

    return {
      run: {
        id: 'dry-run',
        status: validation.valid ? 'succeeded' : 'failed',
        input: spec.inputs,
        createdAt: new Date().toISOString(),
        ...(validation.errors?.length
          ? { error: { message: 'Dry-run validation failed', details: validation.errors } }
          : {}),
      } as Run,
      artifacts: [],
      elapsedMs: Date.now() - startMs,
    };
  }

  private printRunUpdate(run: Run): void {
    const icon = statusIcon(run.status);
    process.stderr.write(`\r${icon} ${run.status.padEnd(12)} ${chalk.dim(run.id)}`);
    if (TERMINAL_STATUSES.has(run.status)) {
      process.stderr.write('\n');
    }
  }

  private async fetchArtifacts(run: Run): Promise<Artifact[]> {
    if (run.artifacts && run.artifacts.length > 0) {
      return run.artifacts;
    }
    try {
      return await this.client.getRunArtifacts(run.id);
    } catch {
      return [];
    }
  }

  private async downloadArtifacts(artifacts: Artifact[], outputPath: string): Promise<void> {
    const dir = fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()
      ? outputPath
      : path.dirname(outputPath);

    fs.mkdirSync(dir, { recursive: true });

    for (const artifact of artifacts) {
      if (!artifact.url) continue;
      const ext = guessExtension(artifact.type, artifact.url);
      const filename = artifact.name ?? `${artifact.id}${ext}`;
      const dest = path.join(dir, filename);

      await downloadFile(artifact.url, dest);
      console.error(chalk.dim(`  Downloaded: ${dest}`));
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'succeeded': return chalk.green('✓');
    case 'failed': return chalk.red('✗');
    case 'cancelled': return chalk.yellow('⊘');
    case 'running': return chalk.blue('⟳');
    default: return chalk.dim('○');
  }
}

function guessExtension(type?: string, url?: string): string {
  if (url) {
    const m = url.match(/\.([a-z0-9]{2,5})(\?.*)?$/i);
    if (m) return `.${m[1]}`;
  }
  if (type?.startsWith('image')) return '.jpg';
  if (type?.startsWith('video')) return '.mp4';
  if (type?.startsWith('audio')) return '.mp3';
  return '.bin';
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}
