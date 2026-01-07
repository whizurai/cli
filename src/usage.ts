/**
 * Usage Monitoring and Analytics
 *
 * Handles usage monitoring, analytics, and reporting operations
 * for the Whizurai CLI tool.
 */

import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { AuthManager } from './auth';

export interface RealtimeMetrics {
  currentRequests: number;
  currentCost: number;
  requestsPerMinute: number;
  costPerMinute: number;
  averageResponseTime: number;
  activeProjects: number;
  topModels: {
    model: string;
    requests: number;
    cost: number;
  }[];
  timestamp: string;
}

export interface CostBreakdown {
  totalCost: number;
  breakdown: {
    service: string;
    cost: number;
    percentage: number;
    requests: number;
  }[];
  costByProject: {
    [projectId: string]: number;
  };
  costByModel: {
    [model: string]: number;
  };
  costByFeature: {
    [feature: string]: number;
  };
  costByDate: {
    [date: string]: number;
  };
  period: {
    start: string;
    end: string;
  };
}

export interface UsageAlert {
  id: string;
  type: 'cost' | 'requests' | 'errors';
  threshold: number;
  current: number;
  status: 'active' | 'triggered' | 'resolved';
  message: string;
  createdAt: string;
  projectId?: string;
}

export interface UsageStats {
  period: string;
  totalRequests: number;
  totalCost: number;
  requestsByService: {
    [service: string]: number;
  };
  costByService: {
    [service: string]: number;
  };
  requestsByDay: {
    date: string;
    requests: number;
    cost: number;
  }[];
  topModels: {
    model: string;
    requests: number;
    cost: number;
  }[];
  errors: {
    code: string;
    count: number;
    percentage: number;
  }[];
}

export interface UsageFilters {
  projectId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  service?: string | undefined;
  model?: string | undefined;
}

export class UsageManager {
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
   * Get usage statistics
   */
  async getUsageStats(filters: UsageFilters = {}): Promise<UsageStats> {
    const spinner = ora('Fetching usage statistics...').start();

    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.service) params.append('service', filters.service);
      if (filters.model) params.append('model', filters.model);

      const response = await this.getClient().get(`/v1/usage?${params.toString()}`);
      spinner.succeed('Usage statistics fetched');
      return response.data as UsageStats;
    } catch (error) {
      spinner.fail('Failed to fetch usage statistics');
      throw new Error('Failed to fetch usage statistics');
    }
  }

  /**
   * Get real-time usage metrics
   */
  async getRealtimeMetrics(): Promise<{
    currentRequests: number;
    currentCost: number;
    requestsPerMinute: number;
    averageResponseTime: number;
  }> {
    const spinner = ora('Fetching real-time metrics...').start();

    try {
      const response = await this.getClient().get('/v1/usage/realtime');
      spinner.succeed('Real-time metrics fetched');
      return response.data as RealtimeMetrics;
    } catch (error) {
      spinner.fail('Failed to fetch real-time metrics');
      throw new Error('Failed to fetch real-time metrics');
    }
  }

  /**
   * Get cost breakdown by service
   */
  async getCostBreakdown(filters: UsageFilters = {}): Promise<{
    totalCost: number;
    breakdown: {
      service: string;
      cost: number;
      percentage: number;
      requests: number;
    }[];
  }> {
    const spinner = ora('Fetching cost breakdown...').start();

    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await this.getClient().get(`/v1/usage/cost-breakdown?${params.toString()}`);
      spinner.succeed('Cost breakdown fetched');
      return response.data as CostBreakdown;
    } catch (error) {
      spinner.fail('Failed to fetch cost breakdown');
      throw new Error('Failed to fetch cost breakdown');
    }
  }

  /**
   * Get usage alerts
   */
  async getUsageAlerts(): Promise<
    {
      id: string;
      type: 'cost' | 'requests' | 'errors';
      threshold: number;
      current: number;
      status: 'active' | 'triggered' | 'resolved';
      message: string;
      createdAt: string;
    }[]
  > {
    const spinner = ora('Fetching usage alerts...').start();

    try {
      const response = await this.getClient().get('/v1/usage/alerts');
      spinner.succeed('Usage alerts fetched');
      return response.data as UsageAlert[];
    } catch (error) {
      spinner.fail('Failed to fetch usage alerts');
      throw new Error('Failed to fetch usage alerts');
    }
  }

  /**
   * Display usage statistics in a formatted way
   */
  displayUsageStats(stats: UsageStats): void {
    console.log(chalk.blue(`\n📊 Usage Statistics - ${stats.period}`));
    console.log(chalk.gray('─'.repeat(60)));

    console.log(chalk.yellow('📈 Overview:'));
    console.log(chalk.gray(`  Total Requests: ${stats.totalRequests.toLocaleString()}`));
    console.log(chalk.gray(`  Total Cost: $${stats.totalCost.toFixed(2)}`));

    if (stats.requestsByService && Object.keys(stats.requestsByService).length > 0) {
      console.log(chalk.yellow('\n🔧 By Service:'));
      Object.entries(stats.requestsByService).forEach(([service, requests]) => {
        const cost = stats.costByService[service] || 0;
        const percentage = ((requests / stats.totalRequests) * 100).toFixed(1);
        console.log(
          chalk.gray(
            `  ${service}: ${requests.toLocaleString()} requests (${percentage}%) - $${cost.toFixed(2)}`
          )
        );
      });
    }

    if (stats.topModels && stats.topModels.length > 0) {
      console.log(chalk.yellow('\n🤖 Top Models:'));
      stats.topModels.slice(0, 5).forEach((model, index) => {
        console.log(
          chalk.gray(
            `  ${index + 1}. ${model.model}: ${model.requests.toLocaleString()} requests - $${model.cost.toFixed(2)}`
          )
        );
      });
    }

    if (stats.errors && stats.errors.length > 0) {
      console.log(chalk.yellow('\n❌ Error Summary:'));
      stats.errors.forEach((error) => {
        console.log(
          chalk.gray(`  ${error.code}: ${error.count} errors (${error.percentage.toFixed(1)}%)`)
        );
      });
    }
  }

  /**
   * Display real-time metrics
   */
  displayRealtimeMetrics(metrics: {
    currentRequests: number;
    currentCost: number;
    requestsPerMinute: number;
    averageResponseTime: number;
  }): void {
    console.log(chalk.blue('\n⚡ Real-time Metrics'));
    console.log(chalk.gray('─'.repeat(40)));

    console.log(chalk.gray(`Current Requests: ${metrics.currentRequests.toLocaleString()}`));
    console.log(chalk.gray(`Current Cost: $${metrics.currentCost.toFixed(2)}`));
    console.log(chalk.gray(`Requests/Minute: ${metrics.requestsPerMinute.toFixed(1)}`));
    console.log(chalk.gray(`Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`));
  }

  /**
   * Display cost breakdown
   */
  displayCostBreakdown(breakdown: {
    totalCost: number;
    breakdown: {
      service: string;
      cost: number;
      percentage: number;
      requests: number;
    }[];
  }): void {
    console.log(chalk.blue(`\n💰 Cost Breakdown - Total: $${breakdown.totalCost.toFixed(2)}`));
    console.log(chalk.gray('─'.repeat(60)));

    breakdown.breakdown.forEach((item) => {
      const barLength = Math.round((item.percentage / 100) * 30);
      const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
      console.log(chalk.gray(`${item.service.padEnd(15)} ${bar} ${item.percentage.toFixed(1)}%`));
      console.log(
        chalk.gray(`  $${item.cost.toFixed(2)} (${item.requests.toLocaleString()} requests)`)
      );
    });
  }

  /**
   * Display usage alerts
   */
  displayUsageAlerts(
    alerts: {
      id: string;
      type: 'cost' | 'requests' | 'errors';
      threshold: number;
      current: number;
      status: 'active' | 'triggered' | 'resolved';
      message: string;
      createdAt: string;
    }[]
  ): void {
    if (alerts.length === 0) {
      console.log(chalk.green('\n✅ No active alerts'));
      return;
    }

    console.log(chalk.blue(`\n🚨 Usage Alerts (${alerts.length})`));
    console.log(chalk.gray('─'.repeat(60)));

    alerts.forEach((alert) => {
      const statusIcon =
        alert.status === 'triggered' ? '🔴' : alert.status === 'active' ? '🟡' : '🟢';
      const typeIcon = alert.type === 'cost' ? '💰' : alert.type === 'requests' ? '📊' : '❌';

      console.log(`${statusIcon} ${typeIcon} ${alert.message}`);
      console.log(chalk.gray(`  Current: ${alert.current} | Threshold: ${alert.threshold}`));
      console.log(chalk.gray(`  Created: ${new Date(alert.createdAt).toLocaleString()}`));
      console.log(chalk.gray('─'.repeat(60)));
    });
  }
}
