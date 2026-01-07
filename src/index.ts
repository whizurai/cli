#!/usr/bin/env node

/**
 * Whizurai CLI Tool
 *
 * Command-line interface for interacting with the Whizurai Platform,
 * managing projects, and performing common operations.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import dotenv from 'dotenv';

// Import our modules
import { AuthManager } from './auth';
import { ProjectManager } from './projects';
import { UsageManager } from './usage';
import { DevProxy } from './dev-proxy';
import { ScaffoldManager } from './scaffold';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('whizzy')
  .description('Whizurai CLI - Command-line interface for the Whizurai Platform')
  .version('0.2.0');

// Global options
program
  .option('-k, --api-key <key>', 'API key for authentication')
  .option('-u, --base-url <url>', 'Base URL for the API', 'http://api.whizurai.com')
  .option('-v, --verbose', 'Enable verbose logging');

// Initialize managers
const authManager = new AuthManager();
const projectManager = new ProjectManager(authManager);
const usageManager = new UsageManager(authManager);
const scaffoldManager = new ScaffoldManager();

// Health check command
program
  .command('health')
  .description('Check the health of the Whizurai Platform')
  .action(async (options: { baseUrl: string }) => {
    const spinner = ora('Checking platform health...').start();

    try {
      const response = await axios.get(`${options.baseUrl}/health`);
      spinner.succeed('Platform is healthy!');
      console.log(chalk.green(JSON.stringify(response.data, null, 2)));
    } catch (error) {
      spinner.fail('Platform health check failed');
      console.error(chalk.red('Error:', (error as Error).message));
      process.exit(1);
    }
  });

// Authentication commands
const authCommand = program.command('auth').description('Manage authentication and API keys');

authCommand
  .command('login')
  .description('Login with email and password')
  .action(async () => {
    try {
      await authManager.login();
    } catch (error) {
      console.error(chalk.red('Login failed:', (error as Error).message));
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Logout and clear stored credentials')
  .action(() => {
    authManager.logout();
  });

authCommand
  .command('status')
  .description('Show current authentication status')
  .action(async () => {
    const user = await authManager.getCurrentUser();
    if (user) {
      console.log(chalk.green(`✅ Authenticated as ${user.name} (${user.email})`));
      console.log(chalk.gray(`Organization: ${user.organizationId}`));
    } else {
      console.log(chalk.yellow('❌ Not authenticated'));
      console.log(chalk.gray('Run "whizzy auth login" to authenticate'));
    }
  });

authCommand
  .command('set-key <key>')
  .description('Set API key directly')
  .action(async (key: string) => {
    try {
      await authManager.setApiKey(key);
    } catch (error) {
      console.error(chalk.red('Failed to set API key:', (error as Error).message));
      process.exit(1);
    }
  });

authCommand
  .command('list-keys')
  .description('List all API keys')
  .action(async () => {
    try {
      const keys = await authManager.listApiKeys();
      console.log(chalk.blue('\n🔑 API Keys'));
      console.log(chalk.gray('─'.repeat(60)));

      keys.forEach((key) => {
        const status = key.isActive ? '🟢' : '🔴';
        console.log(`${status} ${chalk.bold(key.name)}`);
        console.log(chalk.gray(`   ID: ${key.id}`));
        console.log(chalk.gray(`   Key: ${key.key.substring(0, 8)}...`));
        console.log(chalk.gray(`   Created: ${new Date(key.createdAt).toLocaleDateString()}`));
        console.log(chalk.gray(`   Permissions: ${key.permissions.join(', ')}`));
        if (key.lastUsed) {
          console.log(chalk.gray(`   Last Used: ${new Date(key.lastUsed).toLocaleString()}`));
        }
        console.log(chalk.gray('─'.repeat(60)));
      });
    } catch (error) {
      console.error(chalk.red('Failed to list API keys:', (error as Error).message));
      process.exit(1);
    }
  });

authCommand
  .command('create-key <name>')
  .description('Create new API key')
  .option('-p, --permissions <permissions>', 'Comma-separated permissions', 'read,write')
  .action(async (name: string, options: { permissions: string }) => {
    try {
      const permissions = options.permissions.split(',').map((p) => p.trim());
      const key = await authManager.createApiKey(name, permissions);

      console.log(chalk.green(`\n✅ API key created successfully!`));
      console.log(chalk.yellow(`\n🔑 Your API Key:`));
      console.log(chalk.bold(key.key));
      console.log(chalk.red(`\n⚠️  Keep this key secure! It won't be shown again.`));
    } catch (error) {
      console.error(chalk.red('Failed to create API key:', (error as Error).message));
      process.exit(1);
    }
  });

// Project management commands
const projectCommand = program.command('project').description('Manage projects');

projectCommand
  .command('list')
  .description('List all projects')
  .action(async () => {
    try {
      const projects = await projectManager.listProjects();
      projectManager.displayProjects(projects);
    } catch (error) {
      console.error(chalk.red('Failed to list projects:', (error as Error).message));
      process.exit(1);
    }
  });

projectCommand
  .command('create [name]')
  .description('Create a new project')
  .option('-d, --description <description>', 'Project description')
  .option('-f, --features <features>', 'Comma-separated features')
  .action(async (name?: string, options: { description?: string; features?: string } = {}) => {
    try {
      let project;
      if (name) {
        const features = options.features
          ? options.features.split(',').map((f) => f.trim())
          : undefined;
        project = await projectManager.createProject({
          name,
          description: options.description || undefined,
          features: features || undefined,
        });
      } else {
        project = await projectManager.createProjectInteractive();
      }

      projectManager.displayProject(project);
    } catch (error) {
      console.error(chalk.red('Failed to create project:', (error as Error).message));
      process.exit(1);
    }
  });

projectCommand
  .command('show <id>')
  .description('Show project details')
  .action(async (id: string) => {
    try {
      const project = await projectManager.getProject(id);
      projectManager.displayProject(project);
    } catch (error) {
      console.error(chalk.red('Failed to get project:', (error as Error).message));
      process.exit(1);
    }
  });

projectCommand
  .command('delete <id>')
  .description('Delete a project')
  .action(async (id: string) => {
    try {
      const { confirm } = (await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to delete this project?',
          default: false,
        },
      ])) as { confirm: boolean };

      if (confirm) {
        await projectManager.deleteProject(id);
        console.log(chalk.green('Project deleted successfully'));
      } else {
        console.log(chalk.yellow('Project deletion cancelled'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to delete project:', (error as Error).message));
      process.exit(1);
    }
  });

// Usage monitoring commands
const usageCommand = program.command('usage').description('View usage statistics and analytics');

usageCommand
  .command('stats')
  .description('Show usage statistics')
  .option('-p, --project <id>', 'Filter by project ID')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
  .action(async (options: { project?: string; start?: string; end?: string } = {}) => {
    try {
      const filters = {
        projectId: options.project,
        startDate: options.start,
        endDate: options.end,
      };
      const stats = await usageManager.getUsageStats(filters);
      usageManager.displayUsageStats(stats);
    } catch (error) {
      console.error(chalk.red('Failed to get usage stats:', (error as Error).message));
      process.exit(1);
    }
  });

usageCommand
  .command('realtime')
  .description('Show real-time usage metrics')
  .action(async () => {
    try {
      const metrics = await usageManager.getRealtimeMetrics();
      usageManager.displayRealtimeMetrics(metrics);
    } catch (error) {
      console.error(chalk.red('Failed to get real-time metrics:', (error as Error).message));
      process.exit(1);
    }
  });

usageCommand
  .command('cost')
  .description('Show cost breakdown')
  .option('-p, --project <id>', 'Filter by project ID')
  .action(async (options: { project?: string } = {}) => {
    try {
      const filters = {
        projectId: options.project,
      };
      const breakdown = await usageManager.getCostBreakdown(filters);
      usageManager.displayCostBreakdown(breakdown);
    } catch (error) {
      console.error(chalk.red('Failed to get cost breakdown:', (error as Error).message));
      process.exit(1);
    }
  });

usageCommand
  .command('alerts')
  .description('Show usage alerts')
  .action(async () => {
    try {
      const alerts = await usageManager.getUsageAlerts();
      usageManager.displayUsageAlerts(alerts);
    } catch (error) {
      console.error(chalk.red('Failed to get usage alerts:', (error as Error).message));
      process.exit(1);
    }
  });

// Development proxy commands
const proxyCommand = program.command('proxy').description('Start development proxy server');

proxyCommand
  .command('start')
  .description('Start the development proxy')
  .option('-p, --port <port>', 'Port to run proxy on', '8080')
  .option('-t, --target <url>', 'Target URL to proxy to', 'http://api.whizurai.com')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .action(async (options: { port: string; target: string; logLevel: string }) => {
    try {
      const proxy = new DevProxy(authManager, {
        port: parseInt(options.port),
        targetUrl: options.target,
        logLevel: options.logLevel as 'silent' | 'info' | 'debug',
      });

      await proxy.start();

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down proxy...'));
        proxy.stop();
        process.exit(0);
      });

      // Keep the process alive
      await new Promise(() => {});
    } catch (error) {
      console.error(chalk.red('Failed to start proxy:', (error as Error).message));
      process.exit(1);
    }
  });

// Scaffolding commands
const scaffoldCommand = program
  .command('scaffold')
  .description('Create sample applications and project templates');

scaffoldCommand
  .command('list')
  .description('List available templates')
  .action(() => {
    scaffoldManager.displayTemplates();
  });

scaffoldCommand
  .command('create <name>')
  .description('Create a new project from template')
  .option('-t, --template <template>', 'Template to use')
  .option('-o, --output <dir>', 'Output directory', '.')
  .option('-f, --features <features>', 'Comma-separated features')
  .action(
    async (name: string, options: { template?: string; output: string; features?: string }) => {
      try {
        let template;
        if (options.template) {
          template = scaffoldManager.listTemplates().find((t) => t.name === options.template);
          if (!template) {
            console.error(chalk.red(`Template "${options.template}" not found`));
            process.exit(1);
          }
        } else {
          template = await scaffoldManager.selectTemplate();
        }

        const features = options.features
          ? options.features.split(',').map((f) => f.trim())
          : undefined;

        scaffoldManager.createProject({
          template: template.name,
          projectName: name,
          outputDir: options.output,
          features: features || undefined,
        });
      } catch (error) {
        console.error(chalk.red('Failed to create project:', (error as Error).message));
        process.exit(1);
      }
    }
  );

// Generate command
program
  .command('generate <prompt>')
  .description('Generate content using AI models')
  .option('-m, --model <model>', 'AI model to use')
  .option('-t, --temperature <temp>', 'Temperature for generation', '0.7')
  .option('-l, --max-tokens <tokens>', 'Maximum tokens to generate', '1000')
  .action(
    async (
      prompt: string,
      options: { baseUrl: string; model?: string; temperature: string; maxTokens: string }
    ) => {
      const spinner = ora('Generating content...').start();

      try {
        const response = await axios.post(`${options.baseUrl}/v1/generate`, {
          prompt,
          model: options.model,
          temperature: parseFloat(options.temperature),
          maxTokens: parseInt(options.maxTokens),
        });

        spinner.succeed('Content generated successfully!');
        console.log(chalk.green((response.data as { content: string }).content));
      } catch (error) {
        spinner.fail('Content generation failed');
        console.error(chalk.red('Error:', (error as Error).message));
        process.exit(1);
      }
    }
  );

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    console.log(chalk.blue('Welcome to Whizurai Interactive Mode!'));
    console.log(chalk.gray('Type "exit" to quit.\n'));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { command } = await inquirer.prompt<{ command: string }>([
        {
          type: 'input',
          name: 'command',
          message: 'whizzy>',
          validate: (input: string) => input.trim().length > 0 || 'Please enter a command',
        },
      ]);

      if (command.toLowerCase() === 'exit') {
        console.log(chalk.blue('Goodbye!'));
        break;
      }

      try {
        // Parse and execute command
        const args = command.trim().split(' ');
        await program.parseAsync(['node', 'whizzy', ...args]);
      } catch (error) {
        console.error(chalk.red('Error:', (error as Error).message));
      }
    }
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('Invalid command. Use --help to see available commands.'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

export default program;
