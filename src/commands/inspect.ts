/**
 * whiz inspect — introspect capability schemas and contracts.
 *
 * Usage:
 *   whiz inspect image.edit            # full capability details + input schema
 *   whiz inspect                       # list all published capabilities
 *   whiz inspect --category video      # filter by category
 *   whiz inspect image.edit --json     # output raw JSON
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../core/api-client';
import { AuthManager } from '../auth';
import type { Capability, CapabilityInputField } from '../core/types';

export function makeInspectCommand(authManager: AuthManager): Command {
  const cmd = new Command('inspect');

  cmd
    .description('Inspect capability schemas and contracts')
    .argument('[target]', 'Capability slug or ID (omit to list all)')
    .option('--category <cat>', 'Filter capabilities by category (when listing)')
    .option('--status <status>', 'Filter by status: draft|published|deprecated', 'published')
    .option('--search <query>', 'Search capabilities by name/description')
    .option('--json', 'Output raw JSON')
    .action(async (target: string | undefined, opts: Record<string, unknown>) => {
      try {
        const config = authManager.getConfig();
        const client = new ApiClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });

        if (target) {
          await inspectOne(client, target, { json: opts.json as boolean });
        } else {
          await inspectList(client, {
            category: opts.category as string | undefined,
            status: opts.status as string,
            search: opts.search as string | undefined,
            json: opts.json as boolean,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Error:'), message);
        process.exit(1);
      }
    });

  return cmd;
}

// ─── Inspect a single capability ─────────────────────────────────────────────

async function inspectOne(
  client: ApiClient,
  target: string,
  opts: { json?: boolean }
): Promise<void> {
  const capability = await client.getCapability(target);

  if (opts.json) {
    console.log(JSON.stringify(capability, null, 2));
    return;
  }

  printCapabilityDetail(capability);
}

function printCapabilityDetail(cap: Capability): void {
  console.log();
  console.log(chalk.bold(`  ${cap.name}`));
  console.log(chalk.dim(`  ${cap.slug}`));
  if (cap.description) {
    console.log(`\n  ${cap.description}`);
  }

  console.log();
  console.log(
    chalk.dim('  Status:  ') + statusBadge(cap.status) +
    chalk.dim('   Version: ') + cap.version +
    (cap.category ? chalk.dim('   Category: ') + cap.category : '')
  );

  if (cap.tags && cap.tags.length > 0) {
    console.log(chalk.dim('  Tags:    ') + cap.tags.join(', '));
  }

  if (cap.workflows?.primary) {
    const wf = cap.workflows.primary;
    console.log(
      chalk.dim('  Workflow:') + ` ${wf.workflowSlug ?? wf.workflowId}` +
      (wf.workflowVersion ? chalk.dim(` v${wf.workflowVersion}`) : '')
    );
  }

  // Input contract
  const fields = cap.inputContract ?? [];
  if (fields.length > 0) {
    console.log();
    console.log(chalk.bold('  Inputs'));
    console.log(chalk.dim('  ' + '─'.repeat(56)));
    printInputFields(fields);
  } else if (cap.inputSchema) {
    console.log();
    console.log(chalk.bold('  Input Schema'));
    console.log(chalk.dim('  ' + '─'.repeat(56)));
    console.log(JSON.stringify(cap.inputSchema, null, 4)
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n'));
  }

  // Output schema
  if (cap.outputSchema) {
    console.log();
    console.log(chalk.bold('  Output Schema'));
    console.log(chalk.dim('  ' + '─'.repeat(56)));
    console.log(JSON.stringify(cap.outputSchema, null, 4)
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n'));
  }

  console.log();
  console.log(chalk.dim(`  Run with: whiz run ${cap.slug}`));
  console.log(chalk.dim(`  Generate manifest: whiz generate ${cap.slug}`));
  console.log();
}

function printInputFields(fields: CapabilityInputField[]): void {
  for (const f of fields) {
    const req = f.required ? chalk.red('*') : chalk.dim(' ');
    const typePart = chalk.cyan(f.type ?? 'string');
    const defaultPart = f.default !== undefined
      ? chalk.dim(` = ${JSON.stringify(f.default)}`)
      : '';
    const enumPart = f.enum && f.enum.length > 0
      ? chalk.dim(` [${f.enum.slice(0, 5).map((e) => JSON.stringify(e)).join(', ')}${f.enum.length > 5 ? ', …' : ''}]`)
      : '';

    console.log(`  ${req} ${chalk.bold(f.name.padEnd(24))} ${typePart}${defaultPart}${enumPart}`);
    if (f.description) {
      console.log(`      ${chalk.dim(f.description)}`);
    }
  }
}

// ─── List capabilities ────────────────────────────────────────────────────────

async function inspectList(
  client: ApiClient,
  opts: { category?: string; status?: string; search?: string; json?: boolean }
): Promise<void> {
  const response = await client.listCapabilities({
    status: opts.status,
    category: opts.category,
    search: opts.search,
    limit: 100,
  });

  const { capabilities, total } = response;

  if (opts.json) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  if (capabilities.length === 0) {
    console.log(chalk.yellow('No capabilities found.'));
    return;
  }

  console.log();
  const heading = opts.category ? `Capabilities — ${opts.category}` : 'Capabilities';
  console.log(chalk.bold(`  ${heading}`));
  if (total !== undefined) {
    console.log(chalk.dim(`  ${total} total`));
  }
  console.log(chalk.dim('  ' + '─'.repeat(60)));

  // Group by category
  const grouped = groupBy(capabilities, (c) => c.category ?? 'Other');
  for (const [cat, caps] of Object.entries(grouped).sort()) {
    console.log();
    console.log(chalk.dim(`  ${cat}`));
    for (const cap of caps) {
      const badge = statusBadge(cap.status);
      console.log(`    ${chalk.bold(cap.slug.padEnd(40))} ${badge}`);
      if (cap.description) {
        console.log(`    ${chalk.dim(cap.description)}`);
      }
    }
  }

  console.log();
  console.log(chalk.dim(`  Use "whiz inspect <slug>" to view input schema.`));
  console.log();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  switch (status) {
    case 'published': return chalk.green('published');
    case 'draft': return chalk.yellow('draft');
    case 'deprecated': return chalk.red('deprecated');
    default: return chalk.dim(status);
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
