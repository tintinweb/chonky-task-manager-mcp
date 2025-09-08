/**
 * ChonkyTasks - Import/Export Tool
 * Export complete project memory to JSON file or import project snapshot from JSON file
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { ProjectData } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import { normalizeProjectKey } from './utils.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const importExportSchema = z.object({
  operation: z.enum(['export', 'import']),
  project: z.string().min(1, 'Project name is required'),
  filePath: z.string().min(1, 'File path is required')
});

export class TaskManagerImportExportTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-import-export';
  readonly description = 'Export complete project memory to JSON file or import project snapshot from JSON file';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['export', 'import'],
        description: 'Operation to perform: export project to file or import project from file'
      },
      project: {
        type: 'string',
        description: 'Project name: max 30 chars, no spaces, use dashes/underscores (e.g. "my-audit-project")'
      },
      filePath: {
        type: 'string',
        description: 'Absolute file path for export/import (must end with .json)'
      }
    },
    required: ['operation', 'project', 'filePath']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const params = importExportSchema.parse(context.arguments);
      
      // Validate file path
      if (!params.filePath.endsWith('.json')) {
        return this.error('File path must end with .json extension');
      }

      if (params.operation === 'export') {
        return await this.exportProject(context, params.project, params.filePath);
      } else {
        return await this.importProject(context, params.project, params.filePath);
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private async exportProject(context: ToolExecutionContext, projectName: string, filePath: string): Promise<ToolExecutionResult> {
    try {
      const projectKey = normalizeProjectKey(projectName);
      
      // Get project data from memory with metadata
      const projectResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'query',
          pattern: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager',
          options: {
            format: 'json',
            includeMetadata: true
          }
        }
      });
      
      if (!projectResult.success || !projectResult.result) {
        return this.error(`Project "${projectName}" not found. Cannot export non-existent project.`);
      }

      // Parse the memory query result
      const memoryResult = JSON.parse(projectResult.result);
      if (!memoryResult.results || !memoryResult.results[`tasks.projects.${projectKey}`]) {
        return this.error(`Project "${projectName}" data not found in memory.`);
      }

      const projectMemoryEntry = memoryResult.results[`tasks.projects.${projectKey}`];
      const projectData: ProjectData = projectMemoryEntry.value;
      
      // Create export snapshot with complete metadata
      const exportSnapshot = {
        exportMetadata: {
          exportDate: new Date().toISOString(),
          exportVersion: '1.0.0',
          originalProjectName: projectName,
          normalizedProjectKey: projectKey,
          chonkyTasksVersion: '1.0.0',
          memoryNamespace: 'chonky-task-manager',
          memoryKey: `tasks.projects.${projectKey}`
        },
        projectData: projectData,
        memoryMetadata: {
          type: projectMemoryEntry.type,
          created: projectMemoryEntry.created,
          lastModified: projectMemoryEntry.lastModified
        }
      };

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write to file with formatted JSON
      await fs.writeFile(filePath, JSON.stringify(exportSnapshot, null, 2), 'utf8');

      // Verify file was written correctly
      const fileStats = await fs.stat(filePath);
      
      return this.success(
        `📁 **Project Export Successful**\n\n` +
        `**Project:** ${projectName}\n` +
        `**Tasks Exported:** ${projectData.tasks.length}\n` +
        `**File:** ${filePath}\n` +
        `**File Size:** ${Math.round(fileStats.size / 1024 * 100) / 100} KB\n` +
        `**Export Date:** ${exportSnapshot.exportMetadata.exportDate}\n\n` +
        `✅ Complete project memory snapshot saved successfully.\n` +
        `📋 Export includes: all tasks, subtasks, notes, dependencies, timestamps, and project metadata.`,
        {
          operation: 'export',
          project: projectName,
          filePath,
          fileSize: fileStats.size,
          tasksExported: projectData.tasks.length,
          exportMetadata: exportSnapshot.exportMetadata
        }
      );

    } catch (error) {
      return this.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async importProject(context: ToolExecutionContext, projectName: string, filePath: string): Promise<ToolExecutionResult> {
    try {
      const projectKey = normalizeProjectKey(projectName);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return this.error(`Import file not found: ${filePath}`);
      }

      // Read and parse the import file
      const fileContent = await fs.readFile(filePath, 'utf8');
      let importSnapshot: any;
      
      try {
        importSnapshot = JSON.parse(fileContent);
      } catch {
        return this.error('Invalid JSON format in import file');
      }

      // Validate import snapshot structure
      if (!importSnapshot.exportMetadata || !importSnapshot.projectData) {
        return this.error('Invalid export file format. Missing required metadata or project data.');
      }

      // Check if project already exists - never overwrite for safety
      const existingResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'get',
          key: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager'
        }
      });
      
      if (existingResult.success && existingResult.result) {
        return this.error(`Project "${projectName}" already exists. Choose a different project name for import to prevent data loss.`);
      }

      // Update project data with new name (preserve imported data structure)
      const projectData: ProjectData = {
        ...importSnapshot.projectData,
        name: projectName, // Use the specified project name
        updated: new Date().toISOString() // Update the import timestamp
      };

      // Import project data to memory
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
        return this.error(`Failed to import project: ${storeResult.result}`);
      }

      // Update active project reference
      await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'set',
          key: 'tasks.activeproject',
          value: projectName,
          namespace: 'chonky-task-manager'
        }
      });

      const originalProjectName = importSnapshot.exportMetadata.originalProjectName;
      const exportDate = importSnapshot.exportMetadata.exportDate;

      return this.success(
        `📥 **Project Import Successful**\n\n` +
        `**Project:** ${projectName}\n` +
        `**Tasks Imported:** ${projectData.tasks.length}\n` +
        `**Original Export:** ${originalProjectName} (${exportDate})\n` +
        `**Import Action:** Created new project\n` +
        `**Source File:** ${filePath}\n\n` +
        `✅ Complete project memory restored successfully.\n` +
        `📋 Import includes: all tasks, subtasks, notes, dependencies, timestamps, and project metadata.\n\n` +
        `Project "${projectName}" is now active and ready for use.`,
        {
          operation: 'import',
          project: projectName,
          filePath,
          tasksImported: projectData.tasks.length,
          originalProjectName,
          exportDate,
          importDate: new Date().toISOString()
        }
      );

    } catch (error) {
      return this.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
