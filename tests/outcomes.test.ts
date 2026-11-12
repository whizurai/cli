/**
 * whizzy outcomes: input parsing, rendering, and the run --wait flow over a
 * mocked @whizurai/sdk-js client.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const mockOutcomes = {
  run: jest.fn(),
  getRun: jest.fn(),
  assets: jest.fn(),
  pollUntilDone: jest.fn(),
  workspace: jest.fn(),
  command: jest.fn(),
};
const mockCtor = jest.fn();

jest.mock('@whizurai/sdk-js', () => ({
  TERMINAL_OUTCOME_RUN_STATUSES: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
  WhizuraiClient: jest.fn().mockImplementation((cfg: unknown) => {
    mockCtor(cfg);
    return { outcomes: mockOutcomes };
  }),
}));

import {
  parseInputPairs,
  buildInputs,
  isTerminal,
  formatRun,
  formatAssets,
  formatWorkspace,
  parseCommand,
  parseExecutionPolicy,
  makeOutcomesCommand,
} from '../src/commands/outcomes';
import type { AuthManager } from '../src/auth';

const auth = {
  getConfig: () => ({ apiKey: 'sk_test_1', baseUrl: 'https://api.staging.whizur.ai' }),
} as unknown as AuthManager;

const doneRun = {
  id: 'or_1',
  status: 'SUCCEEDED',
  outcomeSlug: 'product-shot',
  outcomeVersion: '3',
  variantSlug: null,
  inputs: { prompt: 'x' },
  result: { image: 'a1' },
  errorMessage: null,
  errorCode: null,
  estimatedACU: 12,
  acuConsumed: 10,
  startedAt: '2026-11-10T00:00:00.000Z',
  completedAt: '2026-11-10T00:02:00.000Z',
};

describe('parseInputPairs / buildInputs', () => {
  it('parses JSON values when they parse and keeps strings otherwise', () => {
    expect(parseInputPairs(['prompt=a red bicycle', 'n=2', 'hd=true', 'tags=["a","b"]', 'zip="02134"', 'eq=a=b'])).toEqual({
      prompt: 'a red bicycle',
      n: 2,
      hd: true,
      tags: ['a', 'b'],
      zip: '02134',
      eq: 'a=b',
    });
  });

  it('rejects a pair with no key', () => {
    expect(() => parseInputPairs(['=x'])).toThrow(/key=value/);
    expect(() => parseInputPairs(['novalue'])).toThrow(/key=value/);
  });

  it('layers --input over --inputs-json and rejects a non-object file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whizzy-outcomes-'));
    const good = path.join(dir, 'in.json');
    fs.writeFileSync(good, JSON.stringify({ prompt: 'file', n: 1 }));
    expect(buildInputs(['n=4'], good)).toEqual({ prompt: 'file', n: 4 });
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '[1,2]');
    expect(() => buildInputs([], bad)).toThrow(/JSON object/);
  });
});

describe('rendering', () => {
  it('isTerminal follows the SDK terminal list', () => {
    expect(isTerminal({ status: 'RUNNING' })).toBe(false);
    expect(isTerminal({ status: 'CANCELLED' })).toBe(true);
  });

  it('formatRun shows status, ACU, error and result', () => {
    const out = formatRun({ ...doneRun, status: 'FAILED', errorCode: 'STEP_FAILED', errorMessage: 'boom' } as never);
    expect(out).toMatch(/Status:\s+FAILED/);
    expect(out).toMatch(/ACU:\s+10 used \(est\. 12\)/);
    expect(out).toMatch(/Error:\s+STEP_FAILED boom/);
    expect(out).toMatch(/"image": "a1"/);
  });

  it('formatAssets lists id, type, storageRef', () => {
    expect(formatAssets([])).toBe('No assets.');
    expect(
      formatAssets([{ id: 'a1', type: 'image.generated', storageRef: 's3://b/a1.png', metadata: null, tags: [], createdAt: '' }])
    ).toMatch(/a1\s+image\.generated\s+s3:\/\/b\/a1\.png/);
  });
});

describe('whizzy outcomes run --wait', () => {
  let log: jest.SpyInstance;
  let err: jest.SpyInstance;
  let exit: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });
  afterEach(() => {
    log.mockRestore();
    err.mockRestore();
    exit.mockRestore();
  });

  it('runs through the SDK, waits, and prints run + assets as JSON', async () => {
    mockOutcomes.run.mockResolvedValue({ id: 'or_1', status: 'PENDING' });
    mockOutcomes.pollUntilDone.mockResolvedValue(doneRun);
    mockOutcomes.assets.mockResolvedValue([{ id: 'a1' }]);

    await makeOutcomesCommand(auth).parseAsync(
      ['run', 'product-shot', '-i', 'prompt=a red bicycle', '--input', 'n=2', '--variant', 'square', '--wait', '--interval', '50', '--json'],
      { from: 'user' }
    );

    expect(mockCtor).toHaveBeenCalledWith({ apiKey: 'sk_test_1', baseUrl: 'https://api.staging.whizur.ai' });
    expect(mockOutcomes.run).toHaveBeenCalledWith(
      'product-shot',
      { prompt: 'a red bicycle', n: 2 },
      { variant: 'square', idempotencyKey: undefined, appId: undefined }
    );
    expect(mockOutcomes.pollUntilDone).toHaveBeenCalledWith('or_1', expect.objectContaining({ interval: 50, timeout: 600000 }));
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ outcomeRun: doneRun, assets: [{ id: 'a1' }] });
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits 1 when the run FAILED and skips the assets call', async () => {
    mockOutcomes.run.mockResolvedValue({ id: 'or_1', status: 'PENDING' });
    mockOutcomes.pollUntilDone.mockResolvedValue({ ...doneRun, status: 'FAILED', result: null });

    await makeOutcomesCommand(auth).parseAsync(['run', 'product-shot', '--wait'], { from: 'user' });

    expect(mockOutcomes.assets).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('prints the error code and purchase link on INSUFFICIENT_BALANCE', async () => {
    mockOutcomes.run.mockRejectedValue(
      Object.assign(new Error('Not enough ACU.'), {
        code: 'INSUFFICIENT_BALANCE',
        details: { details: { purchase: { url: 'https://app.whizur.ai/app/billing?intent=topup' } } },
      })
    );

    await makeOutcomesCommand(auth).parseAsync(['run', 'product-shot'], { from: 'user' });

    expect(err.mock.calls.flat().join(' ')).toMatch(/INSUFFICIENT_BALANCE: Not enough ACU\./);
    expect(err.mock.calls.flat().join(' ')).toMatch(/billing\?intent=topup/);
    expect(exit).toHaveBeenCalledWith(1);
  });
});

const slot = (status: string, extra: Record<string, unknown> = {}) => ({
  slot: 'image',
  label: 'Image',
  status,
  chosen: null,
  decision: null,
  decisionActor: null,
  selectionRevisionId: null,
  versions: [],
  active: null,
  lastFailure: null,
  next: null,
  tryAnother: null,
  ...extra,
});

const workspace = {
  runId: 'or_1',
  status: 'RUNNING',
  mode: 'review',
  controlRevision: 3,
  manifestRevision: 1,
  paused: false,
  summary: '1 shot awaiting review',
  spend: { incurredAcu: 4, outstandingAcu: 2, committedAcu: 6, reservedAcu: 40, reservationStatus: 'ACTIVE', automaticCapAcu: null },
  items: [
    {
      id: 'it_1',
      position: 0,
      number: 1,
      label: 'Shot 1',
      description: slot('Ready to review', {
        slot: 'description',
        chosen: { id: 'rev_1', number: 1, current: true },
      }),
      stages: [slot('Not generated', { next: { enabled: false, reason: 'Choose a description first' } })],
    },
  ],
  assembly: { ...slot('Not generated', { slot: 'assembly' }), readyCount: 0, requiredCount: 5, blocker: 'Shot 1 has no clip' },
  finishRemaining: { enabled: true, reason: null, estimateAcu: 30 },
};

describe('interactive runs', () => {
  let log: jest.SpyInstance;
  let err: jest.SpyInstance;
  let exit: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });
  afterEach(() => {
    log.mockRestore();
    err.mockRestore();
    exit.mockRestore();
  });

  it('parseExecutionPolicy accepts automatic/review only', () => {
    expect(parseExecutionPolicy(undefined)).toBeUndefined();
    expect(parseExecutionPolicy('review')).toBe('review');
    expect(() => parseExecutionPolicy('manual')).toThrow(/automatic, review/);
  });

  it('parseCommand requires a JSON object with an action', () => {
    expect(parseCommand('{"action":"pause","expectedControlRevision":3}')).toEqual({ action: 'pause', expectedControlRevision: 3 });
    expect(() => parseCommand('nope')).toThrow(/JSON object/);
    expect(() => parseCommand('[1]')).toThrow(/"action"/);
    expect(() => parseCommand('{"x":1}')).toThrow(/"action"/);
  });

  it('formatWorkspace shows summary, spend, slots and assembly blocker', () => {
    const out = formatWorkspace(workspace as never);
    expect(out).toMatch(/Summary:\s+1 shot awaiting review/);
    expect(out).toMatch(/4 ACU incurred, 2 outstanding of 40 reserved/);
    expect(out).toMatch(/description\s+Ready to review v1/);
    expect(out).toMatch(/image\s+Not generated — Choose a description first/);
    expect(out).toMatch(/0\/5 ready — Shot 1 has no clip/);
    expect(out).toMatch(/Finish:\s+30 ACU estimate/);
  });

  it('run --execution-policy review passes it to the SDK', async () => {
    mockOutcomes.run.mockResolvedValue({ id: 'or_1', status: 'PENDING' });
    await makeOutcomesCommand(auth).parseAsync(
      ['run', 'interactive-five-shot-story', '-i', 'idea=a fox', '--execution-policy', 'review', '--json'],
      { from: 'user' }
    );
    expect(mockOutcomes.run).toHaveBeenCalledWith(
      'interactive-five-shot-story',
      { idea: 'a fox' },
      expect.objectContaining({ executionPolicy: 'review' })
    );
  });

  it('workspace --json prints the workspace', async () => {
    mockOutcomes.workspace.mockResolvedValue(workspace);
    await makeOutcomesCommand(auth).parseAsync(['workspace', 'or_1', '--json'], { from: 'user' });
    expect(mockOutcomes.workspace).toHaveBeenCalledWith('or_1');
    expect(JSON.parse(log.mock.calls[0][0])).toEqual(workspace);
  });

  it('command sends the parsed command and the client action id', async () => {
    mockOutcomes.command.mockResolvedValue({ result: { dispatch: false }, workspace });
    await makeOutcomesCommand(auth).parseAsync(
      ['command', 'or_1', '--json', '{"action":"pause","expectedControlRevision":3}', '--client-action-id', 'action-0001'],
      { from: 'user' }
    );
    expect(mockOutcomes.command).toHaveBeenCalledWith(
      'or_1',
      { action: 'pause', expectedControlRevision: 3 },
      { clientActionId: 'action-0001' }
    );
    expect(JSON.parse(log.mock.calls[0][0]).result).toEqual({ dispatch: false });
  });

  it('command prints the code and current control revision on STATE_CHANGED', async () => {
    mockOutcomes.command.mockRejectedValue(
      Object.assign(new Error('Refresh.'), { code: 'STATE_CHANGED', details: { workspace: { controlRevision: 4 } } })
    );
    await makeOutcomesCommand(auth).parseAsync(['command', 'or_1', '--json', '{"action":"cancel"}'], { from: 'user' });
    const printed = err.mock.calls.flat().join(' ');
    expect(printed).toMatch(/STATE_CHANGED: Refresh\./);
    expect(printed).toMatch(/control revision: 4/);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
