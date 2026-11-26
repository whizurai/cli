/**
 * whizzy run help text: it executes capabilities (or spec files), never a
 * workflow slug — app API keys get 403 WORKFLOW_EXECUTION_FORBIDDEN from
 * POST /v1/workflows/run.
 */

import { makeRunCommand } from '../src/commands/run';
import { AuthManager } from '../src/auth';

describe('whizzy run help', () => {
  // Commander wraps long lines; compare on single-spaced text.
  const help = makeRunCommand({} as AuthManager).helpInformation().replace(/\s+/g, ' ');

  it('describes capability execution and how workflows are reached', () => {
    expect(help).toMatch(/Execute a capability or a spec file/);
    expect(help).toMatch(/capability that wraps it/);
    expect(help).toMatch(/Capability slug \(image\.edit\) or path to a spec file/);
  });

  it('does not claim to run a workflow slug', () => {
    expect(help).not.toMatch(/workflow slug/i);
    expect(help).not.toMatch(/Execute a capability, workflow/);
  });
});
