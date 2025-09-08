/**
 * ChonkyTasks - Manage Dependencies Tool
 * Add or remove dependencies between tasks
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { ProjectData } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { findTaskById, validateDependencies, touchTask, touchProject, normalizeProjectKey } from './utils.js';

const manageDependenciesSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  taskId: z.number().int().positive('Task ID must be a positive integer'),
  operation: z.enum(['add', 'remove']),
  dependencyId: z.number().int().positive('Dependency ID must be a positive integer')
});

export class TaskManagerDependenciesTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-manage-dependencies';
  readonly description = 'Add or remove dependencies between tasks with circular dependency checking';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")'
      },
      taskId: {
        type: 'number',
        description: 'ID of the task to modify dependencies for'
      },
      operation: {
        type: 'string',
        enum: ['add', 'remove'],
        description: 'Operation to perform (add or remove dependency)'
      },
      dependencyId: {
        type: 'number',
        description: 'ID of the task that this task depends on'
      }
    },
    required: ['project', 'taskId', 'operation', 'dependencyId']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = manageDependenciesSchema.parse(context.arguments);
      
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
      
      // Find the target task
      const task = findTaskById(project, params.taskId);
      if (!task) {
        return this.error(`Task #${params.taskId} not found in project "${params.project}".`);
      }

      // Find the dependency task
      const depTask = findTaskById(project, params.dependencyId);
      if (!depTask) {
        return this.error(`Dependency task #${params.dependencyId} not found in project "${params.project}".`);
      }

      // Prevent self-dependency
      if (params.taskId === params.dependencyId) {
        return this.error(`Task #${params.taskId} cannot depend on itself.`);
      }

      let message: string;
      const oldDependencies = [...task.dependencies];

      if (params.operation === 'add') {
        // Check if dependency already exists
        if (task.dependencies.includes(params.dependencyId)) {
          return this.error(`Task #${params.taskId} already depends on task #${params.dependencyId}.`);
        }

        // Add the dependency temporarily to test for circular dependencies
        task.dependencies.push(params.dependencyId);
        
        // Check for circular dependencies
        const validation = validateDependencies(project);
        if (!validation.isValid) {
          // Revert the change
          task.dependencies = oldDependencies;
          
          const circularErrors = validation.errors.filter(error => 
            error.includes('Circular dependency')
          );
          
          if (circularErrors.length > 0) {
            return this.error(
              `Cannot add dependency: This would create a circular dependency.\n` +
              `${circularErrors.join('\n')}`
            );
          } else {
            return this.error(`Invalid dependency: ${validation.errors.join(', ')}`);
          }
        }

        message = `✅ Added dependency: Task #${params.taskId} now depends on task #${params.dependencyId}`;
        
        // Check if this blocks the task
        if (depTask.status !== 'done' && task.status === 'pending') {
          message += `\n⏸️ Task #${params.taskId} is now blocked until task #${params.dependencyId} is completed.`;
        }

      } else { // remove
        // Check if dependency exists
        if (!task.dependencies.includes(params.dependencyId)) {
          return this.error(`Task #${params.taskId} does not depend on task #${params.dependencyId}.`);
        }

        // Remove the dependency
        task.dependencies = task.dependencies.filter(depId => depId !== params.dependencyId);
        
        message = `🗑️ Removed dependency: Task #${params.taskId} no longer depends on task #${params.dependencyId}`;
        
        // Check if this unblocks the task
        const remainingBlockedDeps = task.dependencies.filter(depId => {
          const remainingDepTask = findTaskById(project, depId);
          return remainingDepTask?.status !== 'done';
        });

        if (remainingBlockedDeps.length === 0 && task.status === 'pending') {
          message += `\n🚀 Task #${params.taskId} is now ready to work on!`;
        }
      }

      // Update timestamps
      touchTask(task);
      touchProject(project);

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

      return this.success(message, {
        project: params.project,
        taskId: params.taskId,
        dependencyId: params.dependencyId,
        operation: params.operation,
        currentDependencies: task.dependencies,
        taskTitle: task.title,
        dependencyTitle: depTask.title
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}
