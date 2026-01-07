/**
 * Project Manager Tests
 */

import { ProjectManager } from '../src/projects';
import { AuthManager } from '../src/auth';

// Mock dependencies
jest.mock('axios');
jest.mock('inquirer');

const mockedInquirer = require('inquirer') as jest.Mocked<typeof import('inquirer')>;

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let mockAuthManager: jest.Mocked<AuthManager>;

  beforeEach(() => {
    mockAuthManager = {
      getConfig: jest.fn(),
      isAuthenticated: jest.fn(),
      getCurrentUser: jest.fn(),
      getAuthenticatedClient: jest.fn(),
    } as any;

    projectManager = new ProjectManager(mockAuthManager);
    jest.clearAllMocks();
  });

  describe('listProjects', () => {
    it('should list projects successfully', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Test Project 1',
          description: 'A test project',
          organizationId: 'org-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          settings: {
            features: ['generate', 'enrich'],
          },
          stats: {
            totalRequests: 100,
            totalCost: 5.5,
            lastActivity: '2024-01-02T00:00:00Z',
          },
        },
        {
          id: '2',
          name: 'Test Project 2',
          description: 'Another test project',
          organizationId: 'org-1',
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-04T00:00:00Z',
          settings: {
            features: ['moderate'],
          },
          stats: {
            totalRequests: 50,
            totalCost: 2.25,
            lastActivity: '2024-01-04T00:00:00Z',
          },
        },
      ];

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method
      const mockGet = jest.fn().mockResolvedValue({ data: mockProjects });
      mockAuthManager.getAuthenticatedClient.mockReturnValue({
        get: mockGet,
      });

      const projects = await projectManager.listProjects();

      expect(projects).toEqual(mockProjects);
      expect(mockGet).toHaveBeenCalledWith('/v1/projects');
    });
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        description: 'A test project',
        organizationId: 'org-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        settings: {
          features: ['generate', 'enrich'],
        },
        stats: {
          totalRequests: 0,
          totalCost: 0,
          lastActivity: '2024-01-01T00:00:00Z',
        },
      };

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method
      const mockPost = jest.fn().mockResolvedValue({ data: mockProject });
      mockAuthManager.getAuthenticatedClient.mockReturnValue({
        post: mockPost,
      });

      const project = await projectManager.createProject({
        name: 'Test Project',
        description: 'A test project',
        features: ['generate', 'enrich'],
      });

      expect(project).toEqual(mockProject);
      expect(mockPost).toHaveBeenCalledWith('/v1/projects', {
        name: 'Test Project',
        description: 'A test project',
        features: ['generate', 'enrich'],
      });
    });
  });

  describe('createProjectInteractive', () => {
    it('should create project interactively', async () => {
      const mockProject = {
        id: '1',
        name: 'Interactive Project',
        description: 'Created interactively',
        features: ['generate'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      mockedInquirer.prompt.mockResolvedValue({
        name: 'Interactive Project',
        description: 'Created interactively',
        features: ['generate'],
      });

      // Mock the getAuthenticatedClient method
      const mockPost = jest.fn().mockResolvedValue({ data: mockProject });
      mockAuthManager.getAuthenticatedClient.mockReturnValue({
        post: mockPost,
      });

      const project = await projectManager.createProjectInteractive();

      expect(project).toEqual(mockProject);
      expect(mockedInquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('getProject', () => {
    it('should get project by ID successfully', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        description: 'A test project',
        features: ['generate', 'enrich'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method
      const mockGet = jest.fn().mockResolvedValue({ data: mockProject });
      mockAuthManager.getAuthenticatedClient.mockReturnValue({
        get: mockGet,
      });

      const project = await projectManager.getProject('1');

      expect(project).toEqual(mockProject);
      expect(mockGet).toHaveBeenCalledWith('/v1/projects/1');
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method
      const mockDelete = jest.fn().mockResolvedValue({ data: { success: true } });
      mockAuthManager.getAuthenticatedClient.mockReturnValue({
        delete: mockDelete,
      });

      await projectManager.deleteProject('1');

      expect(mockDelete).toHaveBeenCalledWith('/v1/projects/1');
    });
  });

  describe('displayProjects', () => {
    it('should display projects without error', () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Test Project 1',
          description: 'A test project',
          organizationId: 'org-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          settings: {
            features: ['generate', 'enrich'],
          },
          stats: {
            totalRequests: 100,
            totalCost: 5.5,
            lastActivity: '2024-01-02T00:00:00Z',
          },
        },
      ];

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      projectManager.displayProjects(mockProjects);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('displayProject', () => {
    it('should display project without error', () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        description: 'A test project',
        organizationId: 'org-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        settings: {
          features: ['generate', 'enrich'],
        },
        stats: {
          totalRequests: 100,
          totalCost: 5.5,
          lastActivity: '2024-01-02T00:00:00Z',
        },
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      projectManager.displayProject(mockProject);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle listProjects error', async () => {
      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method to throw an error
      mockAuthManager.getAuthenticatedClient.mockImplementation(() => {
        throw new Error('API request failed');
      });

      await expect(projectManager.listProjects()).rejects.toThrow('Failed to fetch projects');
    });

    it('should handle createProject error', async () => {
      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method to throw an error
      mockAuthManager.getAuthenticatedClient.mockImplementation(() => {
        throw new Error('API request failed');
      });

      await expect(
        projectManager.createProject({
          name: 'Test Project',
          description: 'A test project',
          features: ['generate'],
        })
      ).rejects.toThrow('Failed to create project');
    });

    it('should handle getProject error', async () => {
      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method to throw an error
      mockAuthManager.getAuthenticatedClient.mockImplementation(() => {
        throw new Error('API request failed');
      });

      await expect(projectManager.getProject('1')).rejects.toThrow(
        'Failed to fetch project details'
      );
    });

    it('should handle deleteProject error', async () => {
      mockAuthManager.getConfig.mockReturnValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      });

      // Mock the getAuthenticatedClient method to throw an error
      mockAuthManager.getAuthenticatedClient.mockImplementation(() => {
        throw new Error('API request failed');
      });

      await expect(projectManager.deleteProject('1')).rejects.toThrow('Failed to delete project');
    });
  });

  describe('edge cases', () => {
    it('should handle empty projects list', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      projectManager.displayProjects([]);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle project with minimal data', () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        organizationId: 'org-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        settings: {
          features: [],
        },
        stats: {
          totalRequests: 0,
          totalCost: 0,
          lastActivity: '2024-01-02T00:00:00Z',
        },
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      projectManager.displayProject(mockProject);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle createProjectInteractive with inquirer error', async () => {
      // Mock inquirer to throw an error
      const mockInquirer = require('inquirer');
      mockInquirer.prompt.mockRejectedValue(new Error('Inquirer error'));

      await expect(projectManager.createProjectInteractive()).rejects.toThrow('Inquirer error');
    });
  });
});
