/**
 * ChonkyTasks - List Tasks Tool
 * Lists tasks with filtering, statistics, and next task recommendation
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { Task, Subtask, ProjectData, TaskStatus, VALID_STATUSES, STATUS_COLORS, PRIORITY_COLORS } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { getNextTask, getReadyTasks, formatDependencies, calculateTaskProgress, normalizeProjectKey } from './utils.js';
import { createProjectNotFoundError } from './project-validation.js';

const listTasksSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  status: z.enum(['pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review']).optional(),
  withSubtasks: z.boolean().default(false),
  showStats: z.boolean().default(true),
  outputFormat: z.enum(['table', 'compact', 'json']).default('table')
});

export class TaskManagerListTasksTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-list-tasks';
  readonly description = 'List tasks with filtering, statistics, and next task recommendation';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")'
      },
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review'],
        description: 'Filter by task status'
      },
      withSubtasks: {
        type: 'boolean',
        default: false,
        description: 'Include subtasks in listing'
      },
      showStats: {
        type: 'boolean', 
        default: true,
        description: 'Show project statistics dashboard'
      },
      outputFormat: {
        type: 'string',
        enum: ['table', 'compact', 'json'],
        default: 'table',
        description: 'Output format'
      }
    },
    required: ['project']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = listTasksSchema.parse(context.arguments);
      
      // Get project data
      const projectKey = normalizeProjectKey(params.project);
      const projectResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'get',
          key: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager'
        }
      });
      
      if (!projectResult.success || projectResult.result === 'undefined') {
        const errorMessage = await createProjectNotFoundError(params.project, this.memoryStore, context);
        return this.error(errorMessage);
      }

      const project: ProjectData = JSON.parse(projectResult.result);
      
      // Filter tasks by status if specified
      let filteredTasks = project.tasks;
      if (params.status) {
        filteredTasks = project.tasks.filter(task => task.status === params.status);
      }

      // Return JSON format if requested
      if (params.outputFormat === 'json') {
        return this.success(
          JSON.stringify({
            project: project.name,
            totalTasks: project.tasks.length,
            filteredTasks: filteredTasks.length,
            filter: { status: params.status },
            tasks: filteredTasks
          }, null, 2),
          {
            project: project.name,
            tasks: filteredTasks,
            totalTasks: project.tasks.length
          }
        );
      }

      // Calculate statistics
      const stats = this.calculateStats(project);
      const nextTask = getNextTask(project);
      const readyTasks = getReadyTasks(project);

      // Build output
      let output = `## 📋 **${project.name}** Task List\n\n`;

      if (params.showStats) {
        output += this.renderStats(stats, nextTask, readyTasks);
      }

      if (filteredTasks.length === 0) {
        output += `### Tasks\n\nNo tasks found${params.status ? ` with status "${params.status}"` : ''}.\n\n`;
        output += `Use \`chonky-task-manager-add-task\` to create your first task.`;
        
        return this.success(output, { 
          project: project.name, 
          tasks: [], 
          stats 
        });
      }

      // Render task table
      if (params.outputFormat === 'compact') {
        output += this.renderCompactTasks(filteredTasks, params.withSubtasks, project);
      } else {
        output += this.renderTableTasks(filteredTasks, params.withSubtasks, project);
      }

      return this.success(output, {
        project: project.name,
        tasks: filteredTasks,
        stats,
        nextTask,
        readyTasks: readyTasks.length
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private calculateStats(project: ProjectData) {
    const statusCounts = {
      pending: 0,
      'in-progress': 0,
      done: 0,
      blocked: 0,
      deferred: 0,
      cancelled: 0,
      review: 0
    };

    const priorityCounts = {
      high: 0,
      medium: 0,
      low: 0
    };

    let totalSubtasks = 0;
    let completedSubtasks = 0;

    project.tasks.forEach(task => {
      statusCounts[task.status]++;
      priorityCounts[task.priority]++;
      
      totalSubtasks += task.subtasks.length;
      completedSubtasks += task.subtasks.filter(st => st.status === 'done').length;
    });

    const completion = project.tasks.length > 0 
      ? Math.round((statusCounts.done / project.tasks.length) * 100) 
      : 0;

    return {
      total: project.tasks.length,
      statusCounts,
      priorityCounts,
      completion,
      totalSubtasks,
      completedSubtasks,
      subtaskCompletion: totalSubtasks > 0 
        ? Math.round((completedSubtasks / totalSubtasks) * 100) 
        : 0
    };
  }

  private renderStats(stats: any, nextTask: Task | null, readyTasks: Task[]): string {
    let output = `### 📊 Project Statistics\n\n`;
    
    // Overall progress
    output += `**Progress:** ${stats.completion}% complete (${stats.statusCounts.done}/${stats.total} tasks)\n\n`;
    
    // Status breakdown
    output += `**Status Breakdown:**\n`;
    output += `- 🟡 Pending: ${stats.statusCounts.pending}\n`;
    output += `- 🔵 In Progress: ${stats.statusCounts['in-progress']}\n`;
    output += `- ✅ Done: ${stats.statusCounts.done}\n`;
    output += `- 🔴 Blocked: ${stats.statusCounts.blocked}\n`;
    output += `- ⏸️ Deferred: ${stats.statusCounts.deferred}\n`;
    output += `- ❌ Cancelled: ${stats.statusCounts.cancelled}\n`;
    output += `- 👀 Review: ${stats.statusCounts.review}\n\n`;

    // Priority breakdown
    output += `**Priority Breakdown:**\n`;
    output += `- 🔴 High: ${stats.priorityCounts.high}\n`;
    output += `- 🟡 Medium: ${stats.priorityCounts.medium}\n`;
    output += `- ⚪ Low: ${stats.priorityCounts.low}\n\n`;

    // Subtask progress
    if (stats.totalSubtasks > 0) {
      output += `**Subtasks:** ${stats.subtaskCompletion}% complete (${stats.completedSubtasks}/${stats.totalSubtasks})\n\n`;
    }

    // Next task recommendation
    if (nextTask) {
      const deps = nextTask.dependencies.length > 0 ? ` (depends on: ${nextTask.dependencies.join(', ')})` : '';
      output += `**🎯 Next Recommended Task:** #${nextTask.id} - ${nextTask.title}${deps}\n\n`;
    } else if (readyTasks.length === 0) {
      output += `**🎯 Next Task:** All tasks are blocked or completed\n\n`;
    } else {
      output += `**🎯 Ready Tasks:** ${readyTasks.length} tasks ready to work on\n\n`;
    }

    return output;
  }

  private renderTableTasks(tasks: Task[], withSubtasks: boolean, project: ProjectData): string {
    let output = `### 📝 Tasks\n\n`;
    
    // Table header
    output += `| ID | Status | Priority | Title | Dependencies |\n`;
    output += `|----|--------|----------|-------|-------------|\n`;

    tasks.forEach(task => {
      const statusEmoji = this.getStatusEmoji(task.status);
      const priorityEmoji = this.getPriorityEmoji(task.priority);
      const depsText = formatDependencies(project, task.dependencies);
      const progress = calculateTaskProgress(task);
      const titleWithProgress = task.subtasks.length > 0 
        ? `${task.title} (${progress}%)`
        : task.title;

      output += `| ${task.id} | ${statusEmoji} ${task.status} | ${priorityEmoji} ${task.priority} | ${titleWithProgress} | ${depsText} |\n`;

      // Add subtasks if requested
      if (withSubtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          const subStatusEmoji = this.getStatusEmoji(subtask.status);
          const subDeps = Array.isArray(subtask.dependencies) ? subtask.dependencies : [];
          const subDepsText = subDeps.length > 0 
            ? subDeps.join(', ') 
            : 'None';
          
          output += `| ${task.id}.${subtask.id} | ${subStatusEmoji} ${subtask.status} | - | ↳ ${subtask.title} | ${subDepsText} |\n`;
        });
      }
    });

    return output + '\n';
  }

  private renderCompactTasks(tasks: Task[], withSubtasks: boolean, project: ProjectData): string {
    let output = `### 📝 Tasks (Compact)\n\n`;

    tasks.forEach(task => {
      const statusEmoji = this.getStatusEmoji(task.status);
      const priorityEmoji = this.getPriorityEmoji(task.priority);
      const deps = task.dependencies.length > 0 ? ` [deps: ${task.dependencies.join(', ')}]` : '';
      
      output += `${task.id}. ${statusEmoji} ${priorityEmoji} ${task.title}${deps}\n`;

      if (withSubtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          const subStatusEmoji = this.getStatusEmoji(subtask.status);
          output += `  ${task.id}.${subtask.id}. ${subStatusEmoji} ${subtask.title}\n`;
        });
      }
    });

    return output + '\n';
  }

  private getStatusEmoji(status: TaskStatus): string {
    const emojis = {
      'pending': '🟡',
      'in-progress': '🔵', 
      'done': '✅',
      'blocked': '🔴',
      'deferred': '⏸️',
      'cancelled': '❌',
      'review': '👀'
    };
    return emojis[status] || '❓';
  }

  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      'high': '🔴',
      'medium': '🟡',
      'low': '⚪'
    };
    return emojis[priority] || '⚪';
  }
}
