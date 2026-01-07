/**
 * Development Proxy
 *
 * Handles local development proxy functionality for testing and development
 * with the Whizurai Platform.
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import chalk from 'chalk';
import { Server } from 'http';
import { AuthManager } from './auth';

export interface ProxyConfig {
  port: number;
  targetUrl: string;
  apiKey?: string;
  logLevel: 'silent' | 'info' | 'debug';
}

export class DevProxy {
  private config: ProxyConfig;
  private app: express.Application;
  private server: Server | null = null;
  private authManager: AuthManager;

  constructor(authManager: AuthManager, config: ProxyConfig) {
    this.authManager = authManager;
    this.config = config;
    this.app = express();
    this.setupProxy();
  }

  /**
   * Setup proxy middleware
   */
  private setupProxy(): void {
    // Add CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });

    // Add authentication header if available
    this.app.use((req, _res, next) => {
      const config = this.authManager.getConfig();
      if (config.apiKey) {
        req.headers.authorization = `Bearer ${config.apiKey}`;
      }
      next();
    });

    // Add request logging
    this.app.use((req, _res, next) => {
      if (this.config.logLevel === 'debug') {
        console.log(chalk.gray(`[${new Date().toISOString()}] ${req.method} ${req.path}`));
      }
      next();
    });

    // Create proxy middleware
    const proxyMiddleware = createProxyMiddleware({
      target: this.config.targetUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '', // Remove /api prefix if present
      },
      onError: (err, _req, res) => {
        console.error(chalk.red('Proxy error:'), err.message);
        res.status(500).json({ error: 'Proxy error', message: err.message });
      },
      onProxyReq: (_proxyReq, req, _res) => {
        if (this.config.logLevel === 'debug') {
          console.log(chalk.blue(`Proxying ${req.method} ${req.path} to ${this.config.targetUrl}`));
        }
      },
    });

    // Apply proxy to all routes
    this.app.use('/', proxyMiddleware);

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        proxy: true,
        target: this.config.targetUrl,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Start the proxy server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(chalk.green(`\n🚀 Development proxy started`));
          console.log(chalk.gray(`   Local: http://localhost:${this.config.port}`));
          console.log(chalk.gray(`   Target: ${this.config.targetUrl}`));
          console.log(chalk.gray(`   Log Level: ${this.config.logLevel}`));
          console.log(chalk.yellow(`\n   Press Ctrl+C to stop the proxy\n`));

          if (this.config.logLevel === 'debug') {
            console.log(chalk.blue('Proxy configuration:'));
            console.log(chalk.gray(`  Port: ${this.config.port}`));
            console.log(chalk.gray(`  Target: ${this.config.targetUrl}`));
            console.log(chalk.gray(`  Log Level: ${this.config.logLevel}`));
          }

          resolve();
        });

        this.server.on('error', (err: Error) => {
          console.error(chalk.red('Failed to start proxy:'), err.message);
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the proxy server
   */
  stop(): void {
    if (this.server) {
      this.server.close(() => {
        console.log(chalk.yellow('\n🛑 Development proxy stopped'));
      });
      this.server = null;
    }
  }

  /**
   * Get proxy status
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get proxy URL
   */
  getProxyUrl(): string {
    return `http://localhost:${this.config.port}`;
  }
}
