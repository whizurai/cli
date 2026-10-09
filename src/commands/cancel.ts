/**
 * whiz cancel — cancel a capability run.
 *
 * Usage:
 *   whiz cancel run_abc123
 *   whiz cancel run_abc123 --json
 *
 * Takes the run id printed by `whiz run`. Cancelling marks the run and cancels
 * its workflow run best-effort; it does not yet stop work already handed to a
 * worker (platform follow-up).
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../core/api-client';
import { AuthManager } from '../auth';

export function makeCancelCommand(authManager: AuthManager): Command {
  const cmd = new Command('cancel');

  cmd
    .description('Cancel a capability run')
    .argument('<runId>', 'Run ID to cancel')
    .option('--json', 'Output the cancelled run as JSON')
    .action(async (runId: string, opts: Record<string, unknown>) => {
      try {
        const config = authManager.getConfig();
        const client = new ApiClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
        const run = await client.cancelCapabilityRun(runId);
        if (opts.json) {
          console.log(JSON.stringify(run, null, 2));
        } else {
          console.error(chalk.dim(`Run ${chalk.bold(run.id ?? runId)} is now ${run.status}.`));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });

  return cmd;
}
