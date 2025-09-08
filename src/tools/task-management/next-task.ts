/**
 * ChonkyTasks - Next Task Tool
 * Find the next recommended task to work on
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { Task, ProjectData } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { getNextTask, getReadyTasks, formatDependencies, normalizeProjectKey } from './utils.js';

const nextTaskSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  showAlternatives: z.boolean().default(true),
  includeBlocked: z.boolean().default(false)
});

export class TaskManagerNextTaskTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-next-task';
  readonly description = 'Find the next recommended task to work on based on dependencies and priority';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")'
      },
      showAlternatives: {
        type: 'boolean',
        default: true,
        description: 'Show alternative ready tasks'
      },
      includeBlocked: {
        type: 'boolean',
        default: false,
        description: 'Include information about blocked tasks'
      }
    },
    required: ['project']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = nextTaskSchema.parse(context.arguments);
      
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
        return this.error(`Project "${params.project}" not found. Create it first with chonky-task-manager-create-project.`);
      }

      const project: ProjectData = JSON.parse(projectResult.result);
      
      // Get next task recommendation
      const nextTask = getNextTask(project);
      const readyTasks = getReadyTasks(project);
      
      // Add project completion status at the top
      const allTasks = project.tasks || [];
      const pendingTasks = allTasks.filter(t => !['done', 'cancelled'].includes(t.status));
      const completedTasks = allTasks.filter(t => t.status === 'done').length;
      const pct = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;
      
      let output = `📊 **${project.name}** - Progress: ${pct}% (${completedTasks}/${allTasks.length})\n`;
      
      if (pendingTasks.length > 1) {
        output += `⚠️ ${pendingTasks.length} TASKS PENDING - CONTINUE UNTIL 100%\n`;
        if (readyTasks.length > 0) {
          output += `📋 Ready now: ${readyTasks.slice(0, 2).map(t => `#${t.id}`).join(', ')}`;
          if (readyTasks.length > 2) output += ` (+${readyTasks.length - 2} more)`;
          output += `\n`;
        }
        output += `\n`;
      } else if (pendingTasks.length === 1) {
        output += `🏁 FINAL TASK - ALMOST DONE!\n\n`;
      } else if (allTasks.length > 0) {
        output += `🎉 PROJECT COMPLETE!\n\n`;
      }
      
      output += `## 🎯 Next Task Recommendation\n\n`;

      if (!nextTask) {
        output += this.renderNoTasksAvailable(project, readyTasks, params.includeBlocked);
        return this.success(output, {
          project: params.project,
          nextTask: null,
          readyTasks: readyTasks.length,
          hasRecommendation: false
        });
      }

      // Render the recommended task
      output += this.renderRecommendedTask(nextTask, project);

      // Show alternatives if requested and available
      if (params.showAlternatives && readyTasks.length > 1) {
        const alternatives = readyTasks
          .filter(task => task.id !== nextTask.id && task.status === 'pending')
          .slice(0, 5); // Limit to top 5 alternatives
        
        if (alternatives.length > 0) {
          output += this.renderAlternatives(alternatives, project);
        }
      }

      // Always show blocked tasks in compact format
      output += this.renderBlockedTasksCompact(project);

      return this.success(output, {
        project: params.project,
        nextTask: {
          id: nextTask.id,
          title: nextTask.title,
          priority: nextTask.priority,
          status: nextTask.status,
          dependencies: nextTask.dependencies,
          subtasks: nextTask.subtasks.length
        },
        readyTasks: readyTasks.length,
        hasRecommendation: true
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private renderNoTasksAvailable(project: ProjectData, readyTasks: Task[], includeBlocked: boolean): string {
    let output = `### 🚫 No Tasks Available\n\n`;

    // Analyze why no tasks are available
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = project.tasks.filter(t => t.status === 'in-progress').length;
    const blockedTasks = project.tasks.filter(t => t.status === 'blocked').length;
    const pendingTasks = project.tasks.filter(t => t.status === 'pending').length;

    if (totalTasks === 0) {
      output += `No tasks exist in this project. Use \`chonky-task-manager-add-task\` to create your first task.\n\n`;
    } else if (completedTasks === totalTasks) {
      output += `🎉 **Congratulations!** All ${totalTasks} tasks are completed!\n\n`;
    } else {
      output += `**Current Status:**\n`;
      output += `- Total tasks: ${totalTasks}\n`;
      output += `- ✅ Completed: ${completedTasks}\n`;
      output += `- 🔵 In Progress: ${inProgressTasks}\n`;
      output += `- 🟡 Pending: ${pendingTasks}\n`;
      output += `- 🔴 Blocked: ${blockedTasks}\n\n`;

      if (inProgressTasks > 0) {
        output += `Focus on completing your ${inProgressTasks} in-progress task${inProgressTasks > 1 ? 's' : ''} first.\n\n`;
      } else if (blockedTasks > 0 && pendingTasks === 0) {
        output += `All pending tasks are blocked by dependencies. Review blocked tasks to resolve issues.\n\n`;
      }
    }

    return output;
  }

  private renderRecommendedTask(task: Task, project: ProjectData): string {
    const priorityEmoji = this.getPriorityEmoji(task.priority);
    const statusEmoji = this.getStatusEmoji(task.status);
    
    let output = `## 🎯 Next Task - Full Details\n\n`;
    output += `# ${task.id} - [${task.priority}] ${task.title}\n`;
    output += `**ID:** ${task.id}\n`;
    output += `**Status:** ${statusEmoji} ${task.status}\n`;
    output += `**Priority:** ${priorityEmoji} ${task.priority}\n`;
    
    if (task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter(st => st.status === 'done').length;
      output += `**Subtasks:** ${completedSubtasks}/${task.subtasks.length} completed\n`;
    }
    
    output += `\n## Description\n`;
    output += `${task.description}\n\n`;
    
    if (task.details) {
      output += `## Details\n`;
      output += `${task.details}\n\n`;
    }
    
    if (task.successCriteria) {
      output += `## Success Criteria\n`;
      output += `${task.successCriteria}\n\n`;
    }
    
    // Show subtasks
    if (task.subtasks.length > 0) {
      output += `## Subtasks\n`;
      task.subtasks.forEach(subtask => {
        const subtaskStatusEmoji = this.getStatusEmoji(subtask.status);
        output += `- **${task.id}.${subtask.id}** ${subtaskStatusEmoji} ${subtask.title}\n`;
      });
      output += `\n`;
    }
    
    output += `### � **Next Action**\n`;
    output += `Start working on this task using \`chonky-task-manager-update-task\` to mark it as "in-progress" with progress notes.\n\n`;

    return output;
  }

  private renderAlternatives(alternatives: Task[], project: ProjectData): string {
    let output = `### 🔄 **Alternative Tasks** (Top ${alternatives.length})\n\n`;
    
    alternatives.forEach((task, index) => {
      const priorityEmoji = this.getPriorityEmoji(task.priority);
      const depsText = formatDependencies(project, task.dependencies);
      
      output += `${index + 2}. **#${task.id} - ${task.title}**\n`;
      output += `   ${priorityEmoji} ${task.priority} priority • Dependencies: ${depsText}\n\n`;
    });

    return output;
  }

  private renderBlockedTasksInfo(project: ProjectData): string {
    const blockedTasks = project.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'cancelled' &&
      t.dependencies.some(depId => {
        const depTask = project.tasks.find(dt => dt.id === depId);
        return depTask?.status !== 'done';
      })
    );

    if (blockedTasks.length === 0) {
      return `### ✅ **No Blocked Tasks**\n\nAll tasks with unmet dependencies are progressing well!\n\n`;
    }

    let output = `### 🚧 **Blocked Tasks** (${blockedTasks.length})\n\n`;
    
    blockedTasks.slice(0, 5).forEach(task => {
      const incompleteDeps = task.dependencies.filter(depId => {
        const depTask = project.tasks.find(dt => dt.id === depId);
        return depTask?.status !== 'done';
      });

      output += `- **#${task.id} - ${task.title}**\n`;
      output += `  Waiting for: ${incompleteDeps.join(', ')}\n\n`;
    });

    return output;
  }

  private renderBlockedTasksCompact(project: ProjectData): string {
    const blockedTasks = project.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'cancelled' &&
      t.dependencies.some(depId => {
        const depTask = project.tasks.find(dt => dt.id === depId);
        return depTask?.status !== 'done';
      })
    );

    if (blockedTasks.length === 0) {
      return ``;
    }

    let output = `\n### 🚧 **Blocked Tasks** (${blockedTasks.length})\n`;
    
    blockedTasks.forEach(task => {
      const incompleteDeps = task.dependencies.filter(depId => {
        const depTask = project.tasks.find(dt => dt.id === depId);
        return depTask?.status !== 'done';
      });

      output += `${task.id} - ${task.title} (waiting for ${incompleteDeps.join(', ')})\n`;
    });

    return output + '\n';
  }

  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      'high': '🔴',
      'medium': '🟡',
      'low': '⚪'
    };
    return emojis[priority] || '⚪';
  }

  private getStatusEmoji(status: string): string {
    const statusEmojis: Record<string, string> = {
      'pending': '⏳',
      'in-progress': '🔄',
      'done': '✅',
      'blocked': '🚫',
      'deferred': '⏸️',
      'cancelled': '❌',
      'review': '👀'
    };
    return statusEmojis[status] || '❓';
  }
}
