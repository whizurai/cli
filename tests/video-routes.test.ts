/**
 * whizzy video-routes rendering.
 */

import { formatVideoRoutes } from '../src/commands/video-routes';
import type { VideoRouteTable } from '../src/core/types';

const table: VideoRouteTable = {
  version: 1,
  tierOrder: ['standard', 'directed'],
  tiers: {
    standard: { defaultModel: null, automaticModels: [] },
    directed: { defaultModel: 'bytedance/seedance-2-5', automaticModels: ['bytedance/seedance-2-5'] },
  },
  models: [
    { model: 'kling-4.0/reference-to-video', routeTier: 'standard', lifecycle: 'candidate', reach: 'explicit' },
    { model: 'bytedance/seedance-2-5', routeTier: 'directed', lifecycle: 'validated', reach: 'automatic' },
  ],
};

describe('formatVideoRoutes', () => {
  it('shows each tier default (or none) and every reachable model with its reach', () => {
    const out = formatVideoRoutes(table);
    expect(out).toMatch(/standard\s+\(no automatic model\)/);
    expect(out).toMatch(/directed\s+bytedance\/seedance-2-5/);
    expect(out).toMatch(/kling-4\.0\/reference-to-video\s+standard\s+candidate\s+explicit/);
    expect(out).toMatch(/bytedance\/seedance-2-5\s+directed\s+validated\s+automatic/);
  });
});
