/**
 * ChonkyTasks - Update Task Tool
 * Updates status and notes of tasks or subtasks with workflow enforcement
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { Task, Subtask, ProjectData, TaskStatus, FINAL_STATUSES } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { parseTaskId, validateDependencies, findTaskById, touchTask, touchProject, normalizeProjectKey } from './utils.js';
import { createProjectNotFoundError } from './project-validation.js';
import { getReadyTasks } from './utils.js';

const updateTaskSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  status: z.enum(['pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review']).optional(),
  notes: z.string().min(1, 'Notes are required for every task update')
});

export class TaskManagerUpdateTaskTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-update-task';
  readonly description = 'Update task status and notes with workflow enforcement for task completion';
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
      },
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review'],
        description: 'New status for the task/subtask (optional - if not provided, only notes are updated)'
      },
      notes: {
        type: 'string',
        description: 'Required notes about the update, progress, findings, or completion proof'
      }
    },
    required: ['project', 'taskId', 'notes']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = updateTaskSchema.parse(context.arguments);

      // Get project from memory
      const projectKey = normalizeProjectKey(params.project);
      const getResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'get',
          key: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager'
        }
      });

      if (!getResult.success || !getResult.result || getResult.result === 'undefined') {
        const errorMessage = await createProjectNotFoundError(params.project, this.memoryStore, context);
        return this.error(errorMessage);
      }

      const project: ProjectData = JSON.parse(getResult.result);
      const { parentId, subtaskId } = parseTaskId(params.taskId);
      const isSubtask = subtaskId !== undefined;

      // Find the task
      const task = findTaskById(project, parentId);
      if (!task) {
        return this.error(`Task #${parentId} not found.`);
      }

      let oldStatus: TaskStatus;
      let updatedEntity: Task | Subtask;
      let entityType: string;
      let entityId: string;

      if (isSubtask) {
        // Update subtask
        const subtask = task.subtasks.find(st => st.id === subtaskId);
        if (!subtask) {
          return this.error(`Subtask #${parentId}.${subtaskId} not found.`);
        }

        oldStatus = subtask.status;
        updatedEntity = subtask;
        entityType = 'Subtask';
        entityId = `${parentId}.${subtaskId}`;

        // Handle status change if provided
        if (params.status && params.status !== oldStatus) {
          // Check if marking as done
          if (params.status === 'done') {
            const completionCheck = this.validateCompletion(subtask, params.notes);
            if (!completionCheck.isValid) {
              return this.error(completionCheck.reason!);
            }

            // Check subtask dependencies
            const depCheck = this.checkSubtaskDependencies(task, subtask);
            if (!depCheck.canComplete) {
              return this.error(
                `Cannot mark subtask #${entityId} as done. ` +
                `Incomplete dependencies: ${depCheck.incompleteDeps.join(', ')}`
              );
            }
          }

          subtask.status = params.status;
        }

        // Always update notes
        this.appendNotes(subtask, params.notes, oldStatus, params.status);
        touchTask(task); // Update parent task timestamp

        // Auto-update parent task status based on subtask completion
        this.updateParentTaskStatus(task);

      } else {
        // Update main task
        oldStatus = task.status;
        updatedEntity = task;
        entityType = 'Task';
        entityId = `${parentId}`;

        // Handle status change if provided
        if (params.status && params.status !== oldStatus) {
          // Check if marking as done
          if (params.status === 'done') {
            const completionCheck = this.validateCompletion(task, params.notes);
            if (!completionCheck.isValid) {
              return this.error(completionCheck.reason!);
            }

            // Check task dependencies
            const incompleteDeps = task.dependencies.filter(depId => {
              const depTask = findTaskById(project, depId);
              return depTask && !FINAL_STATUSES.includes(depTask.status as any);
            });
            
            if (incompleteDeps.length > 0) {
              return this.error(
                `Cannot mark task #${parentId} as done. ` +
                `Incomplete dependencies: ${incompleteDeps.join(', ')}`
              );
            }

            // Check if all subtasks are in final states
            const incompleteSubtasks = task.subtasks.filter(st => !FINAL_STATUSES.includes(st.status as any));
            if (incompleteSubtasks.length > 0) {
              return this.error(
                `Cannot mark task #${parentId} as done. ` +
                `Subtasks not in final state: ${incompleteSubtasks.map(st => `${parentId}.${st.id}`).join(', ')}`
              );
            }
          }

          task.status = params.status;
        }

        // Always update notes
        this.appendNotes(task, params.notes, oldStatus, params.status);
        touchTask(task);
      }

      // Save updated project
      const saveResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'set',
          key: `tasks.projects.${projectKey}`,
          value: project,
          namespace: 'chonky-task-manager'
        }
      });

      if (!saveResult.success) {
        return this.error('Failed to save project updates.');
      }

      // Create success message
      let message = `${entityType} #${entityId} updated`;
      
      if (params.status && params.status !== oldStatus) {
        message += ` - Status: ${oldStatus} → ${params.status}`;
      }

      message += `\nNotes added: ${params.notes.substring(0, 100)}${params.notes.length > 100 ? '...' : ''}`;

      // Add any automatic status changes
      const autoUpdates = [];
      if (isSubtask) {
        const parentStatusChange = this.getParentStatusChange(task, oldStatus);
        if (parentStatusChange) {
          autoUpdates.push(`Parent task #${parentId} status updated to ${parentStatusChange}`);
        }
      }

      if (autoUpdates.length > 0) {
        message += `\n\nAutomatic updates:\n- ${autoUpdates.join('\n- ')}`;
      }

      // Add completion guidance for tasks with successCriteria that are not yet done
      const hasSuccessCriteria = 'successCriteria' in updatedEntity && updatedEntity.successCriteria && updatedEntity.successCriteria.trim().length > 0;
      if (hasSuccessCriteria && updatedEntity.status !== 'done') {
        const successCriteria = (updatedEntity as Task).successCriteria!;
        message += `\n\n📝 **Completion Reminder:** To mark this task as "done", provide definitive proof explaining how the successCriteria is met: "${successCriteria}"`;
      }

      // Add project completion status
      const allTasks = project.tasks || [];
      const pendingTasks = allTasks.filter(t => !['done', 'cancelled'].includes(t.status));
      const completedTasks = allTasks.filter(t => t.status === 'done').length;
      
      if (pendingTasks.length > 0) {
        const pct = Math.round((completedTasks / allTasks.length) * 100);
        message += `\n\n⚠️ PROJECT: ${pct}% complete, ${pendingTasks.length} tasks pending`;
        
        const readyTasks = getReadyTasks(project);
        if (readyTasks.length > 0) {
          message += `\n📋 Next ready tasks:`;
          readyTasks.slice(0, 2).forEach(t => message += `\n   • #${t.id}: ${t.title}`);
          if (readyTasks.length > 2) message += `\n   ... and ${readyTasks.length - 2} more ready`;
        }
      } else if (allTasks.length > 0) {
        message += `\n\n🎉 PROJECT COMPLETE: All ${allTasks.length} tasks finished!`;
      }

      return this.success(message, {
        project: params.project,
        taskId: params.taskId,
        oldStatus,
        newStatus: params.status || oldStatus,
        entityType: isSubtask ? 'subtask' : 'task',
        notesAdded: true,
        autoUpdates: autoUpdates.length
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private validateCompletion(entity: Task | Subtask, notes: string): { isValid: boolean; reason?: string } {
    // Check if entity has successCriteria defined
    const hasSuccessCriteria = 'successCriteria' in entity && entity.successCriteria && entity.successCriteria.trim().length > 0;
    
    // If no successCriteria defined, allow completion without proof
    if (!hasSuccessCriteria) {
      return { isValid: true };
    }

    // Check for completion-related keywords in the notes
    const completionKeywords = [
      'proof', 'complete', 'done', 'finished', 'verified', 'tested', 'validated', 
      'confirmed', 'successful', 'achieved', 'met', 'satisfied', 'implemented',
      'deployed', 'working', 'fixed', 'resolved', 'delivered'
    ];
    
    const hasCompletionEvidence = () => completionKeywords.some(keyword => 
      notes.toLowerCase().includes(keyword.toLowerCase())
    );

    // If successCriteria is defined, require a note to be provided
    if (!notes || notes.trim().length === 0 || !hasCompletionEvidence()) {
      const successCriteria = (entity as Task).successCriteria!;
      return {
        isValid: false,
        reason: `Task has defined successCriteria and requires completion proof. Please provide a note that includes completion keywords (like 'COMPLETION PROOF:', 'completed', 'verified', 'tested', 'implemented', 'delivered', etc.) and explains how the following criteria was met: "${successCriteria}"`
      };
    }

    // If successCriteria exists and notes are provided, trust the caller
    return { isValid: true };
  }

  private appendNotes(entity: Task | Subtask, newNotes: string, oldStatus?: TaskStatus, newStatus?: TaskStatus): void {
    const timestamp = new Date().toISOString();
    let noteEntry = `[${timestamp}] ${newNotes}`;
    
    if (newStatus && oldStatus && newStatus !== oldStatus) {
      noteEntry = `[${timestamp}] Status: ${oldStatus} → ${newStatus}\n${newNotes}`;
    }

    if (entity.notes) {
      entity.notes += '\n\n' + noteEntry;
    } else {
      entity.notes = noteEntry;
    }
  }

  private checkSubtaskDependencies(task: Task, subtask: Subtask): { canComplete: boolean; incompleteDeps: string[] } {
    const incompleteDeps: string[] = [];
    
    for (const depId of subtask.dependencies) {
      const depSubtask = task.subtasks.find(st => st.id === depId);
      if (depSubtask && !FINAL_STATUSES.includes(depSubtask.status as any)) {
        incompleteDeps.push(`${task.id}.${depId}`);
      }
    }

    return {
      canComplete: incompleteDeps.length === 0,
      incompleteDeps
    };
  }

  private updateParentTaskStatus(task: Task): void {
    if (task.subtasks.length === 0) return;

    const completedSubtasks = task.subtasks.filter(st => st.status === 'done').length;
    const totalSubtasks = task.subtasks.length;
    const inProgressSubtasks = task.subtasks.filter(st => st.status === 'in-progress').length;
    const blockedSubtasks = task.subtasks.filter(st => st.status === 'blocked').length;

    // Auto-update parent task status based on subtask states
    if (completedSubtasks === totalSubtasks) {
      // All subtasks done - but don't auto-complete, require explicit completion with notes
      if (task.status !== 'review' && task.status !== 'done') {
        task.status = 'review'; // Ready for completion review
        touchTask(task);
      }
    } else if (blockedSubtasks > 0 && task.status !== 'blocked') {
      // Some subtasks blocked
      task.status = 'blocked';
      touchTask(task);
    } else if (inProgressSubtasks > 0 && task.status === 'pending') {
      // Some subtasks in progress, parent still pending
      task.status = 'in-progress';
      touchTask(task);
    }
  }

  private getParentStatusChange(task: Task, oldTaskStatus: TaskStatus): TaskStatus | null {
    // Only return if the task status actually changed
    return task.status !== oldTaskStatus ? task.status : null;
  }
}
