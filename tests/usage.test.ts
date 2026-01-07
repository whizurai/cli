/**
 * Usage Manager Tests
 */

import { UsageManager } from '../src/usage';
import { AuthManager } from '../src/auth';

// Mock dependencies
jest.mock('axios');

describe('UsageManager', () => {
  let usageManager: UsageManager;
  let mockAuthManager: jest.Mocked<AuthManager>;

  beforeEach(() => {
    mockAuthManager = {
      getConfig: jest.fn(),
      isAuthenticated: jest.fn(),
      getCurrentUser: jest.fn(),
    } as any;

    usageManager = new UsageManager(mockAuthManager);
    jest.clearAllMocks();
  });

  describe('getUsageStats', () => {
    it('should get usage statistics successfully', async () => {
      const mockStats = {
        totalRequests: 1000,
        totalCost: 25.5,
        requestsByProject: {
          'project-1': 600,
          'project-2': 400,
        },
        costByProject: {
          'project-1': 15.3,
          'project-2': 10.2,
        },
        requestsByDate: {
          '2024-01-01': 100,
          '2024-01-02': 150,
        },
        costByDate: {
          '2024-01-01': 2.5,
          '2024-01-02': 3.75,
        },
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getClient method to return a mocked axios instance
      const mockAxios = {
        get: jest.fn().mockResolvedValue({ data: mockStats }),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      const filters = {
        projectId: 'project-1',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const stats = await usageManager.getUsageStats(filters);

      expect(stats).toEqual(mockStats);
      expect(mockAxios.get).toHaveBeenCalledWith(expect.stringContaining('/v1/usage'));
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should get real-time metrics successfully', async () => {
      const mockMetrics = {
        currentRequests: 50,
        currentCost: 1.25,
        requestsPerMinute: 10,
        costPerMinute: 0.25,
        activeProjects: 3,
        topModels: [
          { model: 'gpt-4', requests: 30, cost: 0.75 },
          { model: 'gpt-3.5-turbo', requests: 20, cost: 0.5 },
        ],
        timestamp: '2024-01-01T12:00:00Z',
      };

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getClient method to return a mocked axios instance
      const mockAxios = {
        get: jest.fn().mockResolvedValue({ data: mockMetrics }),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      const metrics = await usageManager.getRealtimeMetrics();

      expect(metrics).toEqual(mockMetrics);
      expect(mockAxios.get).toHaveBeenCalledWith('/v1/usage/realtime');
    });
  });

  describe('getCostBreakdown', () => {
    it('should get cost breakdown successfully', async () => {
      const mockBreakdown = {
        totalCost: 25.5,
        costByProject: {
          'project-1': 15.3,
          'project-2': 10.2,
        },
        costByModel: {
          'gpt-4': 20.0,
          'gpt-3.5-turbo': 5.5,
        },
        costByFeature: {
          generate: 15.0,
          enrich: 8.0,
          moderate: 2.5,
        },
        costByDate: {
          '2024-01-01': 2.5,
          '2024-01-02': 3.75,
        },
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getClient method to return a mocked axios instance
      const mockAxios = {
        get: jest.fn().mockResolvedValue({ data: mockBreakdown }),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      const filters = {
        projectId: 'project-1',
      };

      const breakdown = await usageManager.getCostBreakdown(filters);

      expect(breakdown).toEqual(mockBreakdown);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/v1/usage/cost-breakdown')
      );
    });
  });

  describe('getUsageAlerts', () => {
    it('should get usage alerts successfully', async () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'cost_threshold',
          message: 'Project "Test Project" has exceeded its monthly cost limit',
          projectId: 'project-1',
          threshold: 100.0,
          currentValue: 125.5,
          severity: 'warning',
          createdAt: '2024-01-01T12:00:00Z',
        },
        {
          id: '2',
          type: 'rate_limit',
          message: 'High request rate detected for project "Test Project"',
          projectId: 'project-1',
          threshold: 1000,
          currentValue: 1200,
          severity: 'error',
          createdAt: '2024-01-01T13:00:00Z',
        },
      ];

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getClient method to return a mocked axios instance
      const mockAxios = {
        get: jest.fn().mockResolvedValue({ data: mockAlerts }),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      const alerts = await usageManager.getUsageAlerts();

      expect(alerts).toEqual(mockAlerts);
      expect(mockAxios.get).toHaveBeenCalledWith('/v1/usage/alerts');
    });
  });

  describe('displayUsageStats', () => {
    it('should display usage stats without error', () => {
      const mockStats = {
        totalRequests: 1000,
        totalCost: 25.5,
        requestsByProject: {
          'project-1': 600,
          'project-2': 400,
        },
        costByProject: {
          'project-1': 15.3,
          'project-2': 10.2,
        },
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayUsageStats(mockStats);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('displayRealtimeMetrics', () => {
    it('should display real-time metrics without error', () => {
      const mockMetrics = {
        currentRequests: 50,
        currentCost: 1.25,
        requestsPerMinute: 10,
        costPerMinute: 0.25,
        averageResponseTime: 150,
        activeProjects: 3,
        topModels: [
          { model: 'gpt-4', requests: 30, cost: 0.75 },
          { model: 'gpt-3.5-turbo', requests: 20, cost: 0.5 },
        ],
        timestamp: '2024-01-01T12:00:00Z',
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayRealtimeMetrics(mockMetrics);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('displayCostBreakdown', () => {
    it('should display cost breakdown without error', () => {
      const mockBreakdown = {
        totalCost: 25.5,
        breakdown: [
          { service: 'generate', cost: 15.0, percentage: 58.8, requests: 100 },
          { service: 'enrich', cost: 8.0, percentage: 31.4, requests: 50 },
          { service: 'moderate', cost: 2.5, percentage: 9.8, requests: 25 },
        ],
        costByProject: {
          'project-1': 15.3,
          'project-2': 10.2,
        },
        costByModel: {
          'gpt-4': 20.0,
          'gpt-3.5-turbo': 5.5,
        },
        costByFeature: {
          generate: 15.0,
          enrich: 8.0,
          moderate: 2.5,
        },
        costByDate: {
          '2024-01-01': 2.5,
          '2024-01-02': 3.75,
        },
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayCostBreakdown(mockBreakdown);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('displayUsageAlerts', () => {
    it('should display usage alerts without error', () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'cost_threshold',
          message: 'Project "Test Project" has exceeded its monthly cost limit',
          projectId: 'project-1',
          severity: 'warning',
          createdAt: '2024-01-01T12:00:00Z',
        },
      ];

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayUsageAlerts(mockAlerts);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle getUsageStats error', async () => {
      const mockAxios = {
        get: jest.fn().mockRejectedValue(new Error('API request failed')),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      await expect(usageManager.getUsageStats({})).rejects.toThrow(
        'Failed to fetch usage statistics'
      );
    });

    it('should handle getRealtimeMetrics error', async () => {
      const mockAxios = {
        get: jest.fn().mockRejectedValue(new Error('API request failed')),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      await expect(usageManager.getRealtimeMetrics()).rejects.toThrow(
        'Failed to fetch real-time metrics'
      );
    });

    it('should handle getCostBreakdown error', async () => {
      const mockAxios = {
        get: jest.fn().mockRejectedValue(new Error('API request failed')),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      await expect(usageManager.getCostBreakdown({})).rejects.toThrow(
        'Failed to fetch cost breakdown'
      );
    });

    it('should handle getUsageAlerts error', async () => {
      const mockAxios = {
        get: jest.fn().mockRejectedValue(new Error('API request failed')),
      };
      jest.spyOn(usageManager as any, 'getClient').mockReturnValue(mockAxios);

      await expect(usageManager.getUsageAlerts()).rejects.toThrow('Failed to fetch usage alerts');
    });
  });

  describe('edge cases', () => {
    it('should handle empty usage stats', () => {
      const mockStats = {
        totalRequests: 0,
        totalCost: 0,
        requestsByProject: {},
        costByProject: {},
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayUsageStats(mockStats);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty real-time metrics', () => {
      const mockMetrics = {
        currentRequests: 0,
        currentCost: 0,
        requestsPerMinute: 0,
        costPerMinute: 0,
        averageResponseTime: 0,
        activeProjects: 0,
        topModels: [],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayRealtimeMetrics(mockMetrics);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty cost breakdown', () => {
      const mockBreakdown = {
        totalCost: 0,
        costByProject: {},
        costByModel: {},
        costByFeature: {},
        breakdown: [],
        period: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayCostBreakdown(mockBreakdown);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty usage alerts', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      usageManager.displayUsageAlerts([]);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
