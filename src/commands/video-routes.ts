/**
 * whizzy video-routes — which video models each route tier can land on.
 *
 * Usage:
 *   whizzy video-routes          # table: tier defaults, then every reachable model
 *   whizzy video-routes --json   # raw GET /v1/model-router/video-routes
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../core/api-client';
import { AuthManager } from '../auth';
import type { VideoRouteTable } from '../core/types';

/** Plain-text rendering of the table (pure; tested). */
export function formatVideoRoutes(table: VideoRouteTable): string {
  const lines: string[] = [];
  lines.push('Tier defaults (cheapest tier first):');
  for (const tier of table.tierOrder) {
    lines.push(`  ${tier.padEnd(9)} ${table.tiers[tier]?.defaultModel ?? '(no automatic model)'}`);
  }
  lines.push('');
  lines.push('Reachable models:');
  for (const m of table.models) {
    lines.push(`  ${m.model.padEnd(34)} ${m.routeTier.padEnd(9)} ${m.lifecycle.padEnd(10)} ${m.reach}`);
  }
  return lines.join('\n');
}

export function makeVideoRoutesCommand(authManager: AuthManager): Command {
  return new Command('video-routes')
    .description('Show which video models each route tier can land on')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const config = authManager.getConfig();
        const client = new ApiClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
        const table = await client.getVideoRoutes();
        if (opts.json) {
          console.log(JSON.stringify(table, null, 2));
          return;
        }
        if (table.version !== 1) {
          console.error(chalk.yellow(`Unknown route table version ${table.version}; showing raw JSON.`));
          console.log(JSON.stringify(table, null, 2));
          return;
        }
        console.log(formatVideoRoutes(table));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });
}
