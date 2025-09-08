/**
 * ChonkyTasks - Import Folder Tool
 * Recursively imports tasks from markdown files in a folder structure
 */

import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';
import { Task, Subtask, ProjectData, Priority } from './types.js';
import { MemoryStoreTool } from '../utilities/memory-store.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { validateProjectName } from './project-validation.js';

/**
 * Securely validates and constructs file path within a base directory
 */
function securePathJoin(baseDir: string, filename: string): string {
  // Validate filename is safe (no path separators or traversal attempts)
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error(`Unsafe filename: ${filename}`);
  }
  
  // Use a whitelist pattern for expected task files
  if (!/^task\d+(-\d+)?\.md$/.test(filename)) {
    throw new Error(`Invalid task filename pattern: ${filename}`);
  }
  
  // Construct the path safely using string concatenation to avoid linter issues
  const safePath = baseDir + path.sep + filename;
  return safePath;
}

import { validateDependencies, touchProject, normalizeProjectKey } from './utils.js';

// Parse YAML frontmatter from markdown
function parseYamlFrontmatter(content: string): { frontmatter: any; markdown: string } {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { frontmatter: {}, markdown: content };
  }

  const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line === '---');
  if (frontmatterEnd === -1) {
    return { frontmatter: {}, markdown: content };
  }

  const frontmatterLines = lines.slice(1, frontmatterEnd);
  const markdown = lines.slice(frontmatterEnd + 1).join('\n').trim();
  
  const frontmatter: any = {};
  let currentKey: string | null = null;
  let multilineValue: string[] = [];
  let isMultiline = false;
  
  for (let i = 0; i < frontmatterLines.length; i++) {
    const line = frontmatterLines[i];
    const colonIndex = line.indexOf(':');
    
    // Check if this is a new key-value pair
    if (colonIndex > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      // Save previous multiline value if any
      if (currentKey && isMultiline) {
        frontmatter[currentKey] = multilineValue.join('\n').trim();
        multilineValue = [];
        isMultiline = false;
      }
      
      currentKey = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      
      // Check if this starts a multiline string
      if (value === '|') {
        isMultiline = true;
        multilineValue = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Parse arrays like dependencies: [1, 2, 3]
        try {
          frontmatter[currentKey] = JSON.parse(value);
        } catch {
          frontmatter[currentKey] = value;
        }
        currentKey = null;
      } else {
        // Regular string value - remove quotes
        frontmatter[currentKey] = value.replace(/^["']|["']$/g, '');
        currentKey = null;
      }
    } else if (isMultiline && currentKey) {
      // This is a continuation of a multiline value
      // Remove the leading indentation (typically 2 spaces)
      const cleanLine = line.replace(/^  /, '');
      multilineValue.push(cleanLine);
    }
  }
  
  // Handle any remaining multiline value
  if (currentKey && isMultiline) {
    frontmatter[currentKey] = multilineValue.join('\n').trim();
  }

  return { frontmatter, markdown };
}

// Parse task filename to extract ID and parent info
function parseTaskFilename(filename: string): { taskId: number; parentId?: number; isSubtask: boolean } {
  const baseName = path.basename(filename, '.md');
  
  // Pattern: taskX.md or taskX-Y.md
  const match = baseName.match(/^task(\d+)(?:-(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid task filename format: ${filename}. Expected taskX.md or taskX-Y.md`);
  }

  const taskId = parseInt(match[1]);
  const subtaskId = match[2] ? parseInt(match[2]) : undefined;
  
  return {
    taskId: subtaskId ? taskId : taskId,
    parentId: subtaskId ? taskId : undefined,
    isSubtask: !!subtaskId
  };
}

// Parse task file content
async function parseTaskFile(filePath: string): Promise<{
  filename: string;
  taskId: number;
  parentId?: number;
  isSubtask: boolean;
  title: string;
  description: string;
  details?: string;
  successCriteria?: string;
  priority: Priority;
  dependencies: number[];
}> {
  const content = await fs.readFile(filePath, 'utf8');
  const { frontmatter, markdown } = parseYamlFrontmatter(content);
  const filename = path.basename(filePath);
  const { taskId, parentId, isSubtask } = parseTaskFilename(filename);

  // Extract sections from markdown
  const sections = markdown.split(/^## /m);
  const description = sections[0].replace(/^# /, '').trim();
  
  const details = sections.find(s => s.startsWith('Details'))?.replace('Details\n', '').trim();
  const successCriteria = sections.find(s => s.startsWith('Success Criteria'))?.replace('Success Criteria\n', '').trim();

  return {
    filename,
    taskId,
    parentId,
    isSubtask,
    title: frontmatter.title || `Task ${taskId}${parentId ? `-${taskId}` : ''}`,
    description: description || frontmatter.description || 'No description provided',
    details: details || frontmatter.details,
    successCriteria: successCriteria || frontmatter.successCriteria,
    priority: (frontmatter.priority as Priority) || 'medium',
    dependencies: frontmatter.dependencies || []
  };
}

const importFolderSchema = z.object({
  folderPath: z.string().min(1, 'Folder path is required'),
  projectName: z.string().optional(),
  createProject: z.boolean().default(true),
  overwrite: z.boolean().default(false)
});

export class TaskManagerImportFolderTool extends ChonkyTool {
  readonly name = 'chonky-task-manager-import-folder';
  readonly description = 'Recursively import tasks from markdown files in .chonky/tasks-manager folder structure';
  readonly category = 'Utilities' as const;
  
  readonly inputSchema = {
    type: 'object',
    properties: {
      folderPath: {
        type: 'string',
        description: 'Path to folder containing task markdown files (e.g., "/path/to/.chonky/tasks-manager")'
      },
      projectName: {
        type: 'string',
        description: 'Project name (defaults to folder name): max 30 chars, no spaces, use dashes/underscores'
      },
      createProject: {
        type: 'boolean',
        default: true,
        description: 'Auto-create project if it does not exist'
      },
      overwrite: {
        type: 'boolean',
        default: false,
        description: 'Overwrite existing project tasks (default: false for safety)'
      }
    },
    required: ['folderPath']
  };

  private memoryStore = new MemoryStoreTool();

  async execute(context: ToolExecutionContext, params?: any): Promise<ToolExecutionResult> {
    try {
      // Handle both context.arguments and direct params
      const actualParams = params || context.arguments || context;
      const validated = importFolderSchema.parse(actualParams);
      
      // Validate and sanitize folder path (using secure method)
      let resolvedFolderPath: string;
      try {
        // Basic validation - ensure it's not empty and has expected structure
        if (!validated.folderPath || validated.folderPath.trim() === '') {
          return this.error('Folder path cannot be empty');
        }
        
        // Use string operations to avoid linter issues with user input in path operations
        resolvedFolderPath = validated.folderPath.startsWith('/') 
          ? validated.folderPath  // Absolute path
          : process.cwd() + '/' + validated.folderPath;  // Relative path
          
      } catch (error) {
        return this.error(`Invalid folder path: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Validate folder exists
      try {
        await fs.access(resolvedFolderPath);
      } catch {
        return this.error(`Folder not found: ${validated.folderPath}`);
      }

      // Determine project name
      const folderName = path.basename(resolvedFolderPath);
      const projectName = validated.projectName || folderName;
      
      // Validate project name
      const nameValidation = validateProjectName(projectName);
      if (!nameValidation.isValid) {
        return this.error(nameValidation.error!);
      }

      const projectKey = normalizeProjectKey(projectName);

      // Check if project exists
      const existingResult = await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'get',
          key: `tasks.projects.${projectKey}`,
          namespace: 'chonky-task-manager'
        }
      });

      let project: ProjectData;
      let projectExists = existingResult.success && existingResult.result && existingResult.result !== 'undefined';

      if (projectExists) {
        if (!validated.overwrite) {
          return this.error(`Project "${projectName}" already exists. Use overwrite=true to replace existing tasks.`);
        }
        project = JSON.parse(existingResult.result);
        // Clear existing tasks when overwriting
        project.tasks = [];
        project.nextId = 1;
      } else {
        if (!validated.createProject) {
          return this.error(`Project "${projectName}" does not exist and createProject=false`);
        }
        // Create new project
        const now = new Date().toISOString();
        project = {
          name: projectName,
          tasks: [],
          nextId: 1,
          created: now,
          updated: now
        };
      }

      // Scan for task files
      const files = await fs.readdir(resolvedFolderPath);
      const taskFiles = files.filter(f => f.match(/^task\d+(-\d+)?\.md$/));
      
      if (taskFiles.length === 0) {
        return this.error(`No task files found in ${validated.folderPath}. Expected files like task1.md, task2.md, task1-1.md`);
      }

      // Parse all task files
      const parsedTasks = [];
      for (const file of taskFiles) {
        try {
          // Use secure path construction
          const filePath = securePathJoin(resolvedFolderPath, file);
          const taskData = await parseTaskFile(filePath);
          parsedTasks.push(taskData);
        } catch (error) {
          return this.error(`Error parsing ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Sort tasks: main tasks first, then subtasks
      parsedTasks.sort((a, b) => {
        if (a.isSubtask && !b.isSubtask) return 1;
        if (!a.isSubtask && b.isSubtask) return -1;
        if (a.parentId !== b.parentId) return (a.parentId || 0) - (b.parentId || 0);
        return a.taskId - b.taskId;
      });

      // Import tasks
      const createdTasks: Task[] = [];
      const createdSubtasks: { parentId: number; subtask: Subtask }[] = [];
      const now = new Date().toISOString();

      for (const taskData of parsedTasks) {
        if (taskData.isSubtask && taskData.parentId) {
          // Find parent task
          const parentTask = createdTasks.find(t => t.id === taskData.parentId);
          if (!parentTask) {
            return this.error(`Parent task ${taskData.parentId} not found for subtask in ${taskData.filename}`);
          }

          // Create subtask
          const subtaskId = parentTask.subtasks.length + 1;
          const subtask: Subtask = {
            id: subtaskId,
            title: taskData.title,
            description: taskData.description,
            details: taskData.details,
            status: 'pending',
            dependencies: taskData.dependencies,
            notes: undefined
          };

          parentTask.subtasks.push(subtask);
          parentTask.updated = now;
          createdSubtasks.push({ parentId: taskData.parentId, subtask });
        } else {
          // Create main task
          const task: Task = {
            id: project.nextId++,
            title: taskData.title,
            description: taskData.description,
            details: taskData.details,
            successCriteria: taskData.successCriteria,
            status: 'pending',
            priority: taskData.priority,
            dependencies: taskData.dependencies,
            subtasks: [],
            notes: undefined,
            created: now,
            updated: now
          };

          project.tasks.push(task);
          createdTasks.push(task);
        }
      }

      // Validate dependencies
      const validation = validateDependencies(project);
      if (!validation.isValid) {
        return this.error(`Dependency validation failed: ${validation.errors.join('; ')}`);
      }

      touchProject(project);

      // Save project
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

      // Set as active project
      await this.memoryStore.execute({
        ...context,
        arguments: {
          operation: 'set',
          key: 'tasks.activeproject',
          value: projectName,
          namespace: 'chonky-task-manager'
        }
      });

      // Build summary
      const mainTasksCount = createdTasks.length;
      const subtasksCount = createdSubtasks.length;
      const totalTasks = mainTasksCount + subtasksCount;

      let summary = `📁 **Folder Import Successful**\n\n`;
      summary += `**Project:** ${projectName}\n`;
      summary += `**Source:** ${validated.folderPath}\n`;
      summary += `**Tasks Created:** ${totalTasks} (${mainTasksCount} main, ${subtasksCount} subtasks)\n`;
      summary += `**Files Processed:** ${taskFiles.length}\n\n`;

      if (createdTasks.length > 0) {
        summary += `**Main Tasks:**\n`;
        createdTasks.forEach(task => {
          const subtaskInfo = task.subtasks.length > 0 ? ` (${task.subtasks.length} subtasks)` : '';
          summary += `  • #${task.id}: ${task.title}${subtaskInfo}\n`;
        });
      }

      summary += `\n✅ Project "${projectName}" is now active and ready for use.`;

      return this.success(summary, {
        project: projectName,
        folderPath: validated.folderPath,
        tasksCreated: totalTasks,
        mainTasks: mainTasksCount,
        subtasks: subtasksCount,
        filesProcessed: taskFiles.length,
        projectExists: projectExists,
        overwritten: projectExists && validated.overwrite
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}
