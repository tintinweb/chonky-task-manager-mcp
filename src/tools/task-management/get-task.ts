/**
 * ChonkyTasks - Get Task Tool
 * Shows detailed information about a specific task including all states and notes
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { Task, Subtask, ProjectData, TaskStatus } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { parseTaskId, findTaskById, normalizeProjectKey } from './utils.js';

export class TaskManagerGetTaskTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-get-task';
  readonly description = 'Get detailed information about a specific task including all states and notes';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")'
      },
      taskId: {
        type: 'string',
        description: 'Task ID (e.g., "1" for task, "1.2" for subtask)'
      }
    },
    required: ['project', 'taskId']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const args = context.arguments as { project: string; taskId: string };
    
    // Validate input
    if (!args.project || !args.taskId) {
      return this.error('Project name and task ID are required');
    }

    const { project, taskId } = args;

    try {
      // Get project data from memory store
      const projectKey = normalizeProjectKey(project);
      const projectResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'get',
          key: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager'
        }
      });
      
      if (!projectResult.success || !projectResult.result || projectResult.result === 'undefined') {
        return this.error(`Project "${project}" not found. Use create-project to initialize it first.`);
      }

      const projectData: ProjectData = JSON.parse(projectResult.result);
      const { parentId, subtaskId } = parseTaskId(taskId);

      // Find the requested task
      const task = findTaskById(projectData, parentId);
      
      if (!task) {
        return this.error(`Task ${parentId} not found in project "${project}"`);
      }

      if (subtaskId !== undefined) {
        // Return subtask details
        const subtask = task.subtasks.find(st => st.id === subtaskId);
        if (!subtask) {
          return this.error(`Subtask ${taskId} not found in project "${project}"`);
        }
        
        const details = this.formatTaskDetails(subtask, task, true);
        
        return this.success(details, {
          project,
          taskId,
          taskType: 'subtask',
          parentTaskId: parentId,
          entity: subtask
        });
      } else {
        // Return main task details
        const details = this.formatTaskDetails(task, task, false);
        
        return this.success(details, {
          project,
          taskId,
          taskType: 'task',
          entity: task
        });
      }

    } catch (error) {
      return this.error(`Failed to retrieve task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format comprehensive task/subtask details
   */
  private formatTaskDetails(entity: Task | Subtask, parentTask: Task, isSubtask: boolean): string {
    const taskId = isSubtask ? `${parentTask.id}.${entity.id}` : entity.id;
    const priority = isSubtask ? '' : ` - [${(entity as Task).priority}]`;
    
    let response = `# ${taskId}${priority} ${entity.title}\n`;
    response += `**ID:** ${taskId}\n`;
    response += `**Status:** ${this.getStatusEmoji(entity.status)} ${entity.status}\n`;
    
    // Priority only for main tasks
    if (!isSubtask) {
      response += `**Priority:** ${this.getPriorityEmoji((entity as Task).priority)} ${(entity as Task).priority}\n`;
    }
    
    // Subtasks summary (only for main tasks)
    if (!isSubtask && (entity as Task).subtasks && (entity as Task).subtasks.length > 0) {
      const completedSubtasks = (entity as Task).subtasks.filter(st => st.status === 'done').length;
      response += `**Subtasks:** ${completedSubtasks}/${(entity as Task).subtasks.length} completed\n`;
    }
    
    if (isSubtask) {
      response += `**Parent Task:** #${parentTask.id} - ${parentTask.title}\n`;
    }

    response += `\n## Description\n${entity.description}\n`;

    // Implementation Details
    if (entity.details) {
      response += `\n## Details\n${entity.details}\n`;
    }

    // Success Criteria (only on main tasks)
    if (!isSubtask && (entity as Task).successCriteria) {
      response += `\n## Success Criteria\n${(entity as Task).successCriteria}\n`;
    }

    // Dependencies
    if (entity.dependencies && entity.dependencies.length > 0) {
      response += `\n## Dependencies\n`;
      entity.dependencies.forEach(depId => {
        if (isSubtask) {
          response += `- Depends on Subtask #${parentTask.id}.${depId} or Task #${depId}\n`;
        } else {
          response += `- Depends on Task #${depId}\n`;
        }
      });
    }

    // Subtasks list (only for main tasks)
    if (!isSubtask && (entity as Task).subtasks && (entity as Task).subtasks.length > 0) {
      response += `\n## Subtasks\n`;
      (entity as Task).subtasks.forEach(subtask => {
        response += `- **${parentTask.id}.${subtask.id}** ${this.getStatusEmoji(subtask.status)} ${subtask.title}\n`;
      });
    }

    // Notes History
    response += `\n## 📝 **Notes History**\n`;
    if (entity.notes && typeof entity.notes === 'string' && entity.notes.trim()) {
      response += `${entity.notes}\n`;
    } else {
      response += `No notes recorded yet.\n`;
    }

    // Timestamps
    response += `\n## ⏰ **Timestamps**\n`;
    const timestamp = isSubtask ? parentTask : (entity as Task);
    response += `**Created:** ${new Date(timestamp.created).toLocaleString()}\n`;
    response += `**Last Updated:** ${new Date(timestamp.updated).toLocaleString()}\n`;

    // Completion Guidance
    if (entity.status === 'pending' || entity.status === 'in-progress') {
      response += `\n### 💡 **Completion Guidance**\n`;
      response += `To mark as "done", provide completion notes with evidence:\n`;
      response += `- ✅ "COMPLETION PROOF: Successfully implemented..." \n`;
    }

    return response;
  }

  /**
   * Get status emoji for visual clarity
   */
  private getStatusEmoji(status: TaskStatus): string {
    const statusEmojis: { [key in TaskStatus]: string } = {
      'pending': '⏳',
      'in-progress': '🔄',
      'done': '✅',
      'blocked': '🚫',
      'deferred': '⏸️',
      'cancelled': '❌',
      'review': '👀'
    };
    return statusEmojis[status];
  }

  /**
   * Get priority emoji for visual clarity
   */
  private getPriorityEmoji(priority: string): string {
    const priorityEmojis: { [key: string]: string } = {
      'high': '🔴',
      'medium': '🟡', 
      'low': '🟢'
    };
    return priorityEmojis[priority] || '❓';
  }
}
