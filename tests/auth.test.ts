/**
 * Auth Manager Tests
 */

import { AuthManager } from '../src/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock axios at the module level
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

// Mock dependencies
jest.mock('fs');
jest.mock('inquirer');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedInquirer = require('inquirer') as jest.Mocked<typeof import('inquirer')>;

describe('AuthManager', () => {
  let authManager: AuthManager;
  const mockConfigDir = path.join(os.homedir(), '.cheddarwhizzy');
  const mockConfigFile = path.join(mockConfigDir, 'config.json');

  beforeEach(() => {
    jest.clearAllMocks();
    authManager = new AuthManager();

    // Reset the mock axios instance
    mockAxiosInstance.get.mockClear();
    mockAxiosInstance.post.mockClear();
  });

  describe('getConfig', () => {
    it('should return default config when no config file exists', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const config = authManager.getConfig();

      expect(config).toEqual({
        baseUrl: 'http://localhost:3000',
      });
    });

    it('should return config from file when it exists', () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.example.com',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = authManager.getConfig();

      expect(config).toEqual(mockConfig);
    });
  });

  describe('setApiKey', () => {
    it('should set API key successfully', async () => {
      const apiKey = 'test-api-key';
      const mockUserData = { id: 'user-1', organizationId: 'org-1' };

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock axios instance
      mockAxiosInstance.get.mockResolvedValue({ data: mockUserData });

      await authManager.setApiKey(apiKey);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        expect.stringContaining(apiKey)
      );
    });
  });

  describe('login', () => {
    it('should login successfully with provided credentials', async () => {
      const mockCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockedInquirer.prompt.mockResolvedValue(mockCredentials);
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock axios instance
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          user: { id: '1', name: 'Test User', organizationId: 'org-1' },
          apiKey: 'test-api-key',
        },
      });

      await authManager.login();

      expect(mockedInquirer.prompt).toHaveBeenCalled();
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        mockCredentials
      );
    });
  });

  describe('logout', () => {
    it('should clear stored credentials', () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.example.com',
        userId: 'user-1',
        organizationId: 'org-1',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      mockedFs.writeFileSync.mockImplementation(() => {});

      authManager.logout();

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        expect.stringContaining('"baseUrl": "https://api.example.com"')
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when API key exists', () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const isAuth = authManager.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false when no API key exists', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const isAuth = authManager.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user info when authenticated', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        organizationId: 'org-1',
        role: 'user',
      };
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock axios instance
      mockAxiosInstance.get.mockResolvedValue({ data: mockUser });

      const user = await authManager.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const user = await authManager.getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('should return list of API keys', async () => {
      const mockKeys = [
        {
          id: '1',
          name: 'Test Key',
          key: 'test-key-123',
          isActive: true,
          permissions: ['read', 'write'],
          createdAt: '2024-01-01T00:00:00Z',
          lastUsed: '2024-01-02T00:00:00Z',
        },
      ];

      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock axios for the HTTP request
      const axios = require('axios');
      axios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockKeys }),
      });

      const keys = await authManager.listApiKeys();

      expect(keys).toEqual(mockKeys);
    });
  });

  describe('createApiKey', () => {
    it('should create new API key', async () => {
      const mockKey = {
        id: '1',
        name: 'Test Key',
        key: 'test-key-123',
        isActive: true,
        permissions: ['read', 'write'],
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock axios for the HTTP request
      const axios = require('axios');
      axios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockKey }),
      });

      const key = await authManager.createApiKey('Test Key', ['read', 'write']);

      expect(key).toEqual(mockKey);
    });

    it('should handle API key creation error', async () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock axios for the HTTP request to throw an error
      const axios = require('axios');
      axios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('API key creation failed')),
      });

      await expect(authManager.createApiKey('Test Key', ['read', 'write'])).rejects.toThrow(
        'Failed to create API key'
      );
    });
  });

  describe('error handling', () => {
    it('should handle file read errors in getConfig', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const config = authManager.getConfig();

      expect(config).toEqual({
        baseUrl: 'http://localhost:3000',
      });
    });

    it('should handle invalid JSON in config file', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');

      const config = authManager.getConfig();

      expect(config).toEqual({
        baseUrl: 'http://localhost:3000',
      });
    });

    it('should handle login error', async () => {
      mockedInquirer.prompt.mockResolvedValue({
        email: 'test@example.com',
        password: 'password123',
      });

      // Mock axios for the HTTP request to throw an error
      const axios = require('axios');
      axios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Login failed')),
      });

      await expect(authManager.login()).rejects.toThrow('Authentication failed');
    });

    it('should handle getCurrentUser error', async () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock axios for the HTTP request to throw an error
      const axios = require('axios');
      axios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('User fetch failed')),
      });

      const user = await authManager.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should handle listApiKeys error', async () => {
      const mockConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock axios for the HTTP request to throw an error
      const axios = require('axios');
      axios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API keys fetch failed')),
      });

      await expect(authManager.listApiKeys()).rejects.toThrow('Failed to fetch API keys');
    });
  });

  describe('edge cases', () => {
    it('should handle empty config file', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('{}');

      const config = authManager.getConfig();

      expect(config).toEqual({});
    });

    it('should handle config with only baseUrl', () => {
      const mockConfig = {
        baseUrl: 'https://api.example.com',
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = authManager.getConfig();

      expect(config).toEqual(mockConfig);
    });

    it('should handle isAuthenticated when no API key', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const isAuth = authManager.isAuthenticated();

      expect(isAuth).toBe(false);
    });

    it('should handle getCurrentUser when not authenticated', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const user = await authManager.getCurrentUser();

      expect(user).toBeNull();
    });
  });
});
