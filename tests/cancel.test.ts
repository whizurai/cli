import axios from 'axios';
import { ApiClient } from '../src/core/api-client';
import { makeCancelCommand } from '../src/commands/cancel';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeHttp() {
  return { post: jest.fn(), get: jest.fn(), interceptors: { response: { use: jest.fn() } } };
}

describe('capability run cancel', () => {
  it('ApiClient posts to the capability-run cancel route', async () => {
    const http = makeHttp();
    http.post.mockResolvedValue({ data: { id: 'r1', status: 'cancelled' } });
    mockedAxios.create.mockReturnValue(http as never);
    const run = await new ApiClient({ apiKey: 'k', baseUrl: 'http://x' }).cancelCapabilityRun('r1');
    expect(http.post).toHaveBeenCalledWith('/v1/capabilities/capability-runs/r1/cancel');
    expect(run.status).toBe('cancelled');
  });

  it('the command prints JSON and exits 1 on failure', async () => {
    const http = makeHttp();
    http.post.mockResolvedValueOnce({ data: { id: 'r1', status: 'cancelled' } });
    mockedAxios.create.mockReturnValue(http as never);
    const auth = { getConfig: () => ({ apiKey: 'k', baseUrl: 'http://x' }) } as never;
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await makeCancelCommand(auth).parseAsync(['node', 'cancel', 'r1', '--json']);
    expect(JSON.parse(String(log.mock.calls[0][0])).status).toBe('cancelled');

    http.post.mockRejectedValueOnce(new Error('Resource not found'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await makeCancelCommand(auth).parseAsync(['node', 'cancel', 'nope']);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); err.mockRestore(); exit.mockRestore();
  });
});
