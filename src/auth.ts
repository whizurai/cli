/**
 * Authentication and API Key Management
 *
 * Handles authentication, API key management, and user session management
 * for the Whizurai CLI tool.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export interface AuthConfig {
  apiKey?: string;
  baseUrl: string;
  userId?: string;
  organizationId?: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
  permissions: string[];
  isActive: boolean;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: string;
}

export class AuthManager {
  private configPath: string;
  private httpClient: AxiosInstance;

  constructor(baseUrl: string = 'http://api.whizurai.com') {
    this.configPath = path.join(os.homedir(), '.whizurai', 'config.json');
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'whizurai-cli/0.2.0',
      },
    });
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): AuthConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData) as AuthConfig;
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not load config file'), error);
    }

    return {
      baseUrl: 'http://api.whizurai.com',
    };
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: AuthConfig): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration: ${String(error)}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AuthConfig {
    return this.loadConfig();
  }

  /**
   * Set API key
   */
  async setApiKey(apiKey: string): Promise<void> {
    const config = this.loadConfig();
    config.apiKey = apiKey;

    // Verify API key by making a test request
    const spinner = ora('Verifying API key...').start();

    try {
      const response = await this.httpClient.get('/v1/auth/me', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const data = response.data as { id: string; organizationId: string };
      config.userId = data.id;
      config.organizationId = data.organizationId;
      this.saveConfig(config);

      spinner.succeed('API key verified and saved');
    } catch (error) {
      spinner.fail('Invalid API key');
      throw new Error('API key verification failed');
    }
  }

  /**
   * Login with email and password
   */
  async login(email?: string, password?: string): Promise<void> {
    const spinner = ora('Logging in...').start();

    try {
      // If credentials not provided, prompt for them
      if (!email || !password) {
        const credentials = (await inquirer.prompt([
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input: string) => input.includes('@') || 'Please enter a valid email',
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: (input: string) =>
              input.length >= 6 || 'Password must be at least 6 characters',
          },
        ])) as { email: string; password: string };

        email = credentials.email;
        password = credentials.password;
      }

      const response = await this.httpClient.post('/v1/auth/login', {
        email,
        password,
      });

      const { apiKey, user } = response.data as {
        apiKey: string;
        user: { id: string; organizationId: string; name: string };
      };

      const config = this.loadConfig();
      config.apiKey = apiKey;
      config.userId = user.id;
      config.organizationId = user.organizationId;
      this.saveConfig(config);

      spinner.succeed(`Welcome back, ${user.name}!`);
    } catch (error) {
      spinner.fail('Login failed');
      throw new Error('Authentication failed');
    }
  }

  /**
   * Logout and clear stored credentials
   */
  logout(): void {
    const config = this.loadConfig();
    delete config.apiKey;
    delete config.userId;
    delete config.organizationId;
    this.saveConfig(config);

    console.log(chalk.green('Logged out successfully'));
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    const config = this.loadConfig();

    if (!config.apiKey) {
      return null;
    }

    try {
      const response = await this.httpClient.get('/v1/auth/me', {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });

      return response.data as UserInfo;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const config = this.loadConfig();
    return !!config.apiKey;
  }

  /**
   * Get authenticated HTTP client
   */
  getAuthenticatedClient(): AxiosInstance {
    const config = this.loadConfig();

    if (!config.apiKey) {
      throw new Error('Not authenticated. Please run "whizzy auth login" first.');
    }

    return axios.create({
      baseURL: config.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'whizurai-cli/0.2.0',
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
  }

  /**
   * List API keys
   */
  async listApiKeys(): Promise<ApiKeyInfo[]> {
    const client = this.getAuthenticatedClient();

    try {
      const response = await client.get('/v1/auth/api-keys');
      return response.data as ApiKeyInfo[];
    } catch (error) {
      throw new Error('Failed to fetch API keys');
    }
  }

  /**
   * Create new API key
   */
  async createApiKey(name: string, permissions: string[] = ['read', 'write']): Promise<ApiKeyInfo> {
    const client = this.getAuthenticatedClient();

    try {
      const response = await client.post('/v1/auth/api-keys', {
        name,
        permissions,
      });

      return response.data as ApiKeyInfo;
    } catch (error) {
      throw new Error('Failed to create API key');
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    const client = this.getAuthenticatedClient();

    try {
      await client.delete(`/v1/auth/api-keys/${keyId}`);
    } catch (error) {
      throw new Error('Failed to revoke API key');
    }
  }

  /**
   * Rotate API key
   */
  async rotateApiKey(keyId: string): Promise<ApiKeyInfo> {
    const client = this.getAuthenticatedClient();

    try {
      const response = await client.post(`/v1/auth/api-keys/${keyId}/rotate`);
      return response.data as ApiKeyInfo;
    } catch (error) {
      throw new Error('Failed to rotate API key');
    }
  }
}
