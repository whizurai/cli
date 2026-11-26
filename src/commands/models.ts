/**
 * whizzy models — the model catalogue: every model a caller may pass as `model`.
 *
 * Usage:
 *   whizzy models                          # every operation: default, then each model
 *   whizzy models --operation image_edit   # one operation
 *   whizzy models --json                   # raw GET /v1/model-router/catalog
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../core/api-client';
import { AuthManager } from '../auth';
import { CATALOG_OPERATIONS, type CatalogOperation, type CatalogPrice, type ModelCatalog } from '../core/types';

/** "$0.09/image (2026-11-25)", "$1.25/Mtok in (…)", "local (…)". */
export function formatCatalogPrice(price: CatalogPrice): string {
  const at = `(${price.pricedAt})`;
  if (price.unit === 'none') return `local ${at}`;
  const unit = price.unit === 'image' ? 'image' : 'Mtok in';
  return `$${price.usd}/${unit} ${at}`;
}

/** Plain-text rendering of the catalogue (pure; tested). `*` marks each operation's default. */
export function formatModelCatalog(catalog: ModelCatalog): string {
  const lines: string[] = [`Model catalogue ${catalog.version} (* = default)`];
  for (const op of catalog.operations) {
    lines.push('');
    lines.push(`${op.operation} (default: ${op.default})`);
    for (const m of op.models) {
      const mark = m.id === op.default ? '*' : ' ';
      lines.push(
        `  ${mark} ${m.id.padEnd(26)} ${m.label.padEnd(26)} ${m.provider.padEnd(7)} ${m.lifecycle.padEnd(10)} ` +
          `${m.quality.padEnd(9)} ${formatCatalogPrice(m.price)}`,
      );
    }
  }
  return lines.join('\n');
}

export function makeModelsCommand(authManager: AuthManager): Command {
  return new Command('models')
    .description('Show the model catalogue: models a run may name as `model`, per operation')
    .option('--operation <operation>', `Only one operation (${CATALOG_OPERATIONS.join(' | ')})`)
    .option('--json', 'Output raw JSON')
    .action(async (opts: { operation?: string; json?: boolean }) => {
      try {
        if (opts.operation && !(CATALOG_OPERATIONS as readonly string[]).includes(opts.operation)) {
          console.error(chalk.red('Error:'), `--operation must be one of ${CATALOG_OPERATIONS.join(', ')}`);
          process.exit(1);
        }
        const config = authManager.getConfig();
        const client = new ApiClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
        const catalog = await client.getModelCatalog(opts.operation as CatalogOperation | undefined);
        if (opts.json) {
          console.log(JSON.stringify(catalog, null, 2));
          return;
        }
        console.log(formatModelCatalog(catalog));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });
}
