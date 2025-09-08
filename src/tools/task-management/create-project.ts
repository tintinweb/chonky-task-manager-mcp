/**
 * ChonkyTasks - Create Project Tool
 * Creates a new task management project
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { ProjectData } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { normalizeProjectKey } from './utils.js';
import { validateProjectName } from './project-validation.js';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional()
});

export class TaskManagerCreateProjectTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-create-project';
  readonly description = 'Create a new task management project';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")',
        minLength: 1
      },
      description: {
        type: 'string',
        description: 'Optional project description'
      }
    },
    required: ['name']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = createProjectSchema.parse(context.arguments);
      
      // Validate project name format
      const nameValidation = validateProjectName(params.name);
      if (!nameValidation.isValid) {
        return this.error(nameValidation.error!);
      }
      
      const projectKey = normalizeProjectKey(params.name);
      
      // Check if project already exists
      const existingResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'get',
          key: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager'
        }
      });
      
      if (existingResult.success && existingResult.result && existingResult.result !== 'undefined') {
        return this.error(`Project "${params.name}" already exists`);
      }

      // Create new project data
      const now = new Date().toISOString();
      const projectData: ProjectData = {
        name: params.name,
        tasks: [],
        nextId: 1,
        created: now,
        updated: now
      };

            // Store project data
      const storeResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'set',
          key: `tasks.projects.${projectKey}`,
          value: projectData,
          namespace: 'chonky-task-manager'
        }
      });

      if (!storeResult.success) {
        return this.error(`Failed to create project: ${storeResult.result}`);
      }

      // Store active project reference
      await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'set',
          key: 'tasks.activeproject',
          value: params.name,
          namespace: 'chonky-task-manager'
        }
      });

      return this.success(
        `✅ **Project Created Successfully**\n\n` +
        `**Name:** ${params.name}\n` +
        `**Created:** ${now}\n` +
        `**Status:** Active project\n\n` +
        `You can now start adding tasks using \`chonky-task-manager-add-task\`.`,
        {
          project: projectData,
          isActiveProject: true
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
