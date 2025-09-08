/**
 * ChonkyTasks - Add Task Tool
 * Adds a new task to a project with manual specification
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { Task, ProjectData, VALID_STATUSES, VALID_PRIORITIES, Priority } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { getNextTaskId, findTaskById, validateDependencies, touchProject, normalizeProjectKey } from './utils.js';

const addTaskSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().min(1, 'Task description is required'),
  details: z.string().optional(),
  successCriteria: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dependencies: z.array(z.number()).default([]),
  parentTaskId: z.number().optional()
});

export class TaskManagerAddTaskTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-add-task';
  readonly description = 'Add a new task with manual specification of all details';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")'
      },
      title: {
        type: 'string',
        description: 'Task title',
        minLength: 1
      },
      description: {
        type: 'string',
        description: 'Task description',
        minLength: 1
      },
      details: {
        type: 'string',
        description: 'Detailed implementation notes and requirements'
      },
      successCriteria: {
        type: 'string',
        description: 'Testing approach and verification strategy'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        description: 'Task priority'
      },
      dependencies: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of task IDs this depends on',
        default: []
      },
      parentTaskId: {
        type: 'number',
        description: 'Parent task ID for subtasks'
      }
    },
    required: ['project', 'title', 'description']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = addTaskSchema.parse(context.arguments);
      const projectKey = normalizeProjectKey(params.project);
      
      // Get project data
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
      
      // Validate dependencies exist
      for (const depId of params.dependencies) {
        const depTask = findTaskById(project, depId);
        if (!depTask) {
          return this.error(`Dependency task ${depId} does not exist`);
        }
      }
      
      // If this is a subtask, validate parent exists
      if (params.parentTaskId) {
        const parentTask = findTaskById(project, params.parentTaskId);
        if (!parentTask) {
          return this.error(`Parent task ${params.parentTaskId} does not exist`);
        }
      }

      // Create new task
      const now = new Date().toISOString();
      const taskId = getNextTaskId(project);
      
      const newTask: Task = {
        id: taskId,
        title: params.title,
        description: params.description,
        details: params.details,
        successCriteria: params.successCriteria,
        status: 'pending',
        priority: params.priority as Priority,
        dependencies: params.dependencies,
        subtasks: [],
        notes: undefined,
        created: now,
        updated: now
      };

      let parentTask: Task | undefined;
      let subtaskId: number | undefined;

      // Add to project
      if (params.parentTaskId) {
        // Add as subtask
        parentTask = findTaskById(project, params.parentTaskId)!;
        
        // Convert to subtask format
        subtaskId = parentTask.subtasks.length > 0 
          ? Math.max(...parentTask.subtasks.map(st => st.id)) + 1 
          : 1;
        
        parentTask.subtasks.push({
          id: subtaskId,
          title: newTask.title,
          description: newTask.description,
          details: newTask.details,
          status: newTask.status,
          dependencies: newTask.dependencies
        });
        
        parentTask.updated = now;
      } else {
        // Add as main task
        project.tasks.push(newTask);
      }

      touchProject(project);

      // Validate dependencies after adding
      const validation = validateDependencies(project);
      if (!validation.isValid) {
        return this.error(`Dependency validation failed: ${validation.errors.join('; ')}`);
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
        return this.error(`Failed to save project: ${saveResult.result}`);
      }

      // Format response
      const taskDisplayId = params.parentTaskId && subtaskId
        ? `${params.parentTaskId}.${subtaskId}`
        : taskId.toString();
        
      const dependencyText = params.dependencies.length > 0 
        ? params.dependencies.map(id => `${id} ⏱️`).join(', ')
        : 'None';

      const addedTask = params.parentTaskId && parentTask 
        ? parentTask.subtasks[parentTask.subtasks.length - 1] 
        : newTask;

      // Build completion guidance message
      let completionGuidance = '';
      if (params.successCriteria && params.successCriteria.trim().length > 0) {
        completionGuidance = `\n\n📝 **Completion Note:** When marking this task as "done", you must provide definitive proof that explains how the successCriteria was met: "${params.successCriteria}"`;
      }

      return this.success(
        `✅ **Task Added Successfully**\n\n` +
        `**ID:** ${taskDisplayId}\n` +
        `**Title:** ${params.title}\n` +
        `**Description:** ${params.description}\n` +
        `**Priority:** ${params.priority}\n` +
        `**Dependencies:** ${dependencyText}\n` +
        `**Status:** pending\n\n` +
        `${params.parentTaskId ? `Added as subtask to task ${params.parentTaskId}.` : `Added as main task ${taskId}.`}${completionGuidance}`,
        {
          taskId: taskDisplayId,
          task: addedTask,
          isSubtask: !!params.parentTaskId,
          project: project
        }
      );

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}
