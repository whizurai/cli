/**
 * whiz watch — poll and stream the progress of a previously submitted run.
 *
 * Usage:
 *   whiz watch run_abc123
 *   whiz watch run_abc123 --json
 *   whiz watch run_abc123 --output ./results --download
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiClient } from '../core/api-client';
import { ExecutionEngine } from '../core/execution-engine';
import { AuthManager } from '../auth';

export function makeWatchCommand(authManager: AuthManager): Command {
  const cmd = new Command('watch');

  cmd
    .description('Watch an in-progress or pending run until completion')
    .argument('<runId>', 'Run ID to watch')
    .option('--json', 'Output full JSON result on completion')
    .option('-o, --output <path>', 'Path to write downloaded artifacts')
    .option('--download', 'Automatically download artifacts on completion')
    .option('--timeout <seconds>', 'Watch timeout in seconds (default: 600)', parseInt)
    .action(async (runId: string, opts: Record<string, unknown>) => {
      try {
        const config = authManager.getConfig();
        const client = new ApiClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });
        const engine = new ExecutionEngine(client);

        // Check initial state
        const spinner = ora({ text: `Fetching run ${runId}…`, stream: process.stderr }).start();
        let run;
        try {
          run = await client.getRun(runId);
          spinner.stop();
        } catch (err) {
          spinner.fail();
          throw err;
        }

        const terminal = new Set(['succeeded', 'failed', 'cancelled']);

        if (terminal.has(run.status)) {
          const artifacts = await client.getRunArtifacts(runId);
          const result = { run, artifacts, elapsedMs: 0 };
          if (opts.json) {
            engine.printJsonResult(result);
          } else {
            console.error(chalk.dim(`Run ${runId} is already ${run.status}.`));
            engine.printResult(result);
          }
          if (run.status === 'failed') process.exit(1);
          return;
        }

        // Stream progress
        console.error(chalk.dim(`Watching run ${chalk.bold(runId)}…  (Ctrl+C to detach)`));
        const timeoutMs = ((opts.timeout as number | undefined) ?? 600) * 1000;
        const startMs = Date.now();

        const completed = await engine.poll(runId, {
          timeoutMs,
          onUpdate: (r) => {
            const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
            process.stderr.write(`\r  ${statusLine(r.status)}  ${chalk.dim(elapsed + 's')}  `);
            if (terminal.has(r.status)) process.stderr.write('\n');
          },
        });

        const artifacts = await client.getRunArtifacts(runId);

        if (opts.download && opts.output) {
          // Use engine's internal download via the full execute path is not available here,
          // so we emit a note; artifact download is handled inside ExecutionEngine.execute().
          console.error(
            chalk.dim(
              `\n  Artifact download is supported via "whiz run … --watch --download --output ${opts.output}"`
            )
          );
        }

        const result = { run: completed, artifacts, elapsedMs: Date.now() - startMs };
        if (opts.json) {
          engine.printJsonResult(result);
        } else {
          engine.printResult(result);
        }

        if (completed.status === 'failed') process.exit(1);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });

  return cmd;
}

function statusLine(status: string): string {
  switch (status) {
    case 'running': return chalk.blue('running ');
    case 'pending': return chalk.dim('pending ');
    case 'succeeded': return chalk.green('succeeded');
    case 'failed': return chalk.red('failed  ');
    case 'cancelled': return chalk.yellow('cancelled');
    default: return chalk.dim(status);
  }
}
