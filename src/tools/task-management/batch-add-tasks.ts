/**
 * ChonkyTasks - Batch Add Tasks Tool
 * Creates multiple tasks at once for efficient project setup
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { ProjectData, Task, TaskStatus, Priority } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { normalizeProjectKey, findTaskById, validateTaskDependencies } from './utils.js';

const batchTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().min(1, 'Task description is required'),
  details: z.string().optional(),
  successCriteria: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dependencies: z.array(z.number()).default([]),
  parentTaskId: z.number().optional()
});

const batchAddTasksSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  tasks: z.array(batchTaskSchema).min(1, 'At least one task is required')
});

export class TaskManagerBatchAddTasksTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-batch-add-tasks';
  readonly description = 'Add multiple tasks to a project at once for efficient project setup';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")',
        minLength: 1
      },
      tasks: {
        type: 'array',
        description: 'Array of tasks to create',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
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
              default: [],
              description: 'Array of task IDs this task depends on'
            },
            parentTaskId: {
              type: 'number',
              description: 'Parent task ID for subtasks'
            }
          },
          required: ['title', 'description']
        }
      }
    },
    required: ['project', 'tasks']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = batchAddTasksSchema.parse(context.arguments);
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
      const createdTasks: Task[] = [];
      const now = new Date().toISOString();
      
      // First pass: Create all tasks without validating dependencies
      // This allows forward references in the batch
      for (let i = 0; i < params.tasks.length; i++) {
        const taskParams = params.tasks[i];
        const taskId = project.nextId + i;
        
        // Check if parent task exists (if specified)
        if (taskParams.parentTaskId) {
          const parentTask = findTaskById(project, taskParams.parentTaskId);
          if (!parentTask) {
            return this.error(`Parent task ${taskParams.parentTaskId} does not exist`);
          }
        }
        
        const task: Task = {
          id: taskId,
          title: taskParams.title,
          description: taskParams.description,
          details: taskParams.details || '',
          successCriteria: taskParams.successCriteria || '',
          status: 'pending' as TaskStatus,
          priority: taskParams.priority as Priority,
          dependencies: [], // Will be set in second pass
          subtasks: [],
          notes: undefined,
          created: now,
          updated: now
        };
        
        createdTasks.push(task);
      }
      
      // Second pass: Validate and set dependencies
      for (let i = 0; i < params.tasks.length; i++) {
        const taskParams = params.tasks[i];
        const task = createdTasks[i];
        
        // Validate dependencies exist (in existing project or in current batch)
        for (const depId of taskParams.dependencies) {
          const depInProject = findTaskById(project, depId);
          const depInBatch = createdTasks.find(t => t.id === depId);
          
          if (!depInProject && !depInBatch) {
            return this.error(`Dependency task ${depId} does not exist in project or batch`);
          }
        }
        
        task.dependencies = taskParams.dependencies;
      }
      
      // Third pass: Validate for circular dependencies within the batch
      const allTasks = [...project.tasks, ...createdTasks];
      for (const task of createdTasks) {
        const validation = validateTaskDependencies(allTasks, task.id, task.dependencies);
        if (!validation.isValid) {
          return this.error(`Task "${task.title}" has dependency issues: ${validation.errors.join(', ')}`);
        }
      }
      
      // Add all tasks to project
      project.tasks.push(...createdTasks);
      project.nextId += createdTasks.length;
      project.updated = now;
      
      // Store updated project data
      const storeResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'set',
          key: `tasks.projects.${projectKey}`,
          value: project,
          namespace: 'chonky-task-manager'
        }
      });

      if (!storeResult.success) {
        return this.error(`Failed to store batch tasks: ${storeResult.result}`);
      }

      // Format success message
      const taskSummary = createdTasks.map(task => {
        const depString = task.dependencies.length > 0 
          ? ` (deps: ${task.dependencies.join(', ')})`
          : '';
        const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪';
        return `- **${task.id}**: ${task.title} ${priorityEmoji}${depString}`;
      }).join('\n');

      // Check if any tasks have successCriteria and add completion guidance
      const tasksWithCriteria = createdTasks.filter(task => task.successCriteria && task.successCriteria.trim().length > 0);
      let completionGuidance = '';
      if (tasksWithCriteria.length > 0) {
        completionGuidance = `\n\n📝 **Completion Note:** ${tasksWithCriteria.length} task${tasksWithCriteria.length > 1 ? 's' : ''} ha${tasksWithCriteria.length > 1 ? 've' : 's'} defined successCriteria. When marking these as "done", provide definitive proof explaining how the criteria were met.`;
      }

      return this.success(
        `✅ **Batch Created ${createdTasks.length} Tasks Successfully**\n\n` +
        `**Project:** ${params.project}\n` +
        `**Tasks Created:**\n${taskSummary}\n\n` +
        `All tasks added with proper dependency validation.${completionGuidance}`,
        {
          project: project.name,
          tasksCreated: createdTasks.length,
          taskIds: createdTasks.map(t => t.id),
          tasks: createdTasks
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
