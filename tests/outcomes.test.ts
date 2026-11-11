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
