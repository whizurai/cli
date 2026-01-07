/**
 * Project Management
 *
 * Handles project creation, listing, viewing, and deletion operations
 * for the Whizurai CLI tool.
 */

import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AuthManager } from './auth';

export interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    apiKey?: string;
    webhookUrl?: string;
    rateLimit?: number;
    features: string[];
  };
  stats: {
    totalRequests: number;
    totalCost: number;
    lastActivity: string;
  };
}

export interface CreateProjectOptions {
  name: string;
  description?: string | undefined;
  features?: string[] | undefined;
}

export class ProjectManager {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Get authenticated HTTP client
   */
  private getClient(): AxiosInstance {
    return this.authManager.getAuthenticatedClient();
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    const spinner = ora('Fetching projects...').start();

    try {
      const response = await this.getClient().get('/v1/projects');
      spinner.succeed(`Found ${(response.data as Project[]).length} projects`);
      return response.data as Project[];
    } catch (error) {
      spinner.fail('Failed to fetch projects');
      throw new Error('Failed to fetch projects');
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    const spinner = ora('Fetching project details...').start();

    try {
      const response = await this.getClient().get(`/v1/projects/${projectId}`);
      spinner.succeed('Project details fetched');
      return response.data as Project;
    } catch (error) {
      spinner.fail('Failed to fetch project details');
      throw new Error('Failed to fetch project details');
    }
  }

  /**
   * Create new project
   */
  async createProject(options: CreateProjectOptions): Promise<Project> {
    const spinner = ora('Creating project...').start();

    try {
      const response = await this.getClient().post('/v1/projects', {
        name: options.name,
        description: options.description,
        features: options.features || ['generate', 'enrich', 'moderate'],
      });

      spinner.succeed(`Project "${options.name}" created successfully`);
      return response.data as Project;
    } catch (error) {
      spinner.fail('Failed to create project');
      throw new Error('Failed to create project');
    }
  }

  /**
   * Update project
   */
  async updateProject(projectId: string, updates: Partial<CreateProjectOptions>): Promise<Project> {
    const spinner = ora('Updating project...').start();

    try {
      const response = await this.getClient().put(`/v1/projects/${projectId}`, updates);
      spinner.succeed('Project updated successfully');
      return response.data as Project;
    } catch (error) {
      spinner.fail('Failed to update project');
      throw new Error('Failed to update project');
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    const spinner = ora('Deleting project...').start();

    try {
      await this.getClient().delete(`/v1/projects/${projectId}`);
      spinner.succeed('Project deleted successfully');
    } catch (error) {
      spinner.fail('Failed to delete project');
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Interactive project creation
   */
  async createProjectInteractive(): Promise<Project> {
    const answers = await inquirer.prompt<CreateProjectOptions>([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        validate: (input: string) => input.trim().length > 0 || 'Project name is required',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description (optional):',
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to enable:',
        choices: [
          { name: 'Content Generation', value: 'generate' },
          { name: 'Content Enrichment', value: 'enrich' },
          { name: 'Content Moderation', value: 'moderate' },
          { name: 'Recommendations', value: 'recommend' },
          { name: 'Search', value: 'search' },
        ],
        default: ['generate', 'enrich', 'moderate'],
      },
    ]);

    return this.createProject(answers);
  }

  /**
   * Display project details in a formatted way
   */
  displayProject(project: Project): void {
    console.log(chalk.blue(`\n📁 ${project.name}`));
    console.log(chalk.gray(`ID: ${project.id}`));

    if (project.description) {
      console.log(chalk.gray(`Description: ${project.description}`));
    }

    console.log(chalk.gray(`Created: ${new Date(project.createdAt).toLocaleDateString()}`));
    console.log(chalk.gray(`Last Updated: ${new Date(project.updatedAt).toLocaleDateString()}`));

    console.log(chalk.yellow('\n📊 Statistics:'));
    console.log(chalk.gray(`  Total Requests: ${project.stats.totalRequests.toLocaleString()}`));
    console.log(chalk.gray(`  Total Cost: $${project.stats.totalCost.toFixed(2)}`));
    console.log(
      chalk.gray(`  Last Activity: ${new Date(project.stats.lastActivity).toLocaleString()}`)
    );

    console.log(chalk.yellow('\n⚙️  Settings:'));
    console.log(chalk.gray(`  Features: ${project.settings.features.join(', ')}`));
    if (project.settings.rateLimit) {
      console.log(chalk.gray(`  Rate Limit: ${project.settings.rateLimit} requests/minute`));
    }
  }

  /**
   * Display projects list in a formatted way
   */
  displayProjects(projects: Project[]): void {
    if (projects.length === 0) {
      console.log(
        chalk.yellow('No projects found. Create your first project with "whizzy project create"')
      );
      return;
    }

    console.log(chalk.blue(`\n📁 Projects (${projects.length})`));
    console.log(chalk.gray('─'.repeat(80)));

    projects.forEach((project, index) => {
      const status = project.settings.features.length > 0 ? '🟢' : '🔴';
      console.log(`${status} ${chalk.bold(project.name)}`);
      console.log(chalk.gray(`   ID: ${project.id}`));
      if (project.description) {
        console.log(chalk.gray(`   ${project.description}`));
      }
      console.log(
        chalk.gray(
          `   Requests: ${project.stats.totalRequests.toLocaleString()} | Cost: $${project.stats.totalCost.toFixed(2)}`
        )
      );

      if (index < projects.length - 1) {
        console.log(chalk.gray('─'.repeat(80)));
      }
    });
  }
}
