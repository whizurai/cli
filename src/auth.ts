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
        const saved = JSON.parse(configData) as AuthConfig;
        // Env var always wins over saved config
        if (process.env.WHIZ_API_URL) saved.baseUrl = process.env.WHIZ_API_URL;
        return saved;
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not load config file'), error);
    }

    return {
      baseUrl: process.env.WHIZ_API_URL ?? 'https://api.whizurai.com',
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
   * Build an axios client bound to the *current* config's baseUrl.
   * Use this for any auth-verification call so we hit the configured
   * server (local / staging / prod), not the constructor default.
   */
  private clientForCurrentConfig(): AxiosInstance {
    const config = this.loadConfig();
    return axios.create({
      baseURL: config.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'whizurai-cli/0.2.0',
      },
    });
  }

  /**
   * Set API key.
   *
   * Verification: pings `/v1/capabilities?limit=1` with the key as a
   * Bearer token. This is the same auth scheme `whizzy inspect/run/watch`
   * use and matches what the platform's API-key middleware accepts.
   *
   * (We deliberately do NOT hit `/v1/auth/me` here — that route is JWT/session
   * only and is not part of the API-key auth surface.)
   */
  async setApiKey(apiKey: string, opts: { skipVerify?: boolean } = {}): Promise<void> {
    const config = this.loadConfig();
    config.apiKey = apiKey;

    if (opts.skipVerify) {
      this.saveConfig(config);
      console.log(chalk.green('API key saved (verification skipped)'));
      return;
    }

    const spinner = ora(`Verifying API key against ${config.baseUrl}...`).start();

    try {
      await this.clientForCurrentConfig().get('/v1/capabilities', {
        params: { limit: 1 },
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      this.saveConfig(config);
      spinner.succeed('API key verified and saved');
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      const hint =
        status === 401 || status === 403
          ? 'key was rejected by the server'
          : status
            ? `server returned HTTP ${status}`
            : 'could not reach the server (is the platform running on the configured URL?)';
      spinner.fail(`Invalid API key — ${hint}`);
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
   * Get current user info.
   *
   * The platform exposes no API-key-callable identity endpoint, so we ping
   * `/v1/capabilities?limit=1` to confirm the configured key is valid and
   * return a minimal stub. Callers that need real user/email/org info should
   * use `/auth/me` with a session JWT — out of scope for the API-key CLI flow.
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    const config = this.loadConfig();

    if (!config.apiKey) {
      return null;
    }

    try {
      await this.clientForCurrentConfig().get('/v1/capabilities', {
        params: { limit: 1 },
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });

      const keyTail = config.apiKey.slice(-4);
      return {
        id: config.userId ?? 'api-key',
        email: '',
        name: `API key …${keyTail}`,
        organizationId: config.organizationId ?? '',
        role: 'apikey',
      };
    } catch {
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
   * Persist a base URL override to the config file.
   */
  setBaseUrl(url: string): void {
    const config = this.loadConfig();
    config.baseUrl = url.replace(/\/$/, '');
    this.saveConfig(config);
    console.log(chalk.green(`API URL set to ${config.baseUrl}`));
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
