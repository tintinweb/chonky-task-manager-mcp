/**
 * Tool Registry for managing all Chonky MCP tools
 */

import { ChonkyTool, ToolCategory } from './types.js';

/**
 * Registry for managing and discovering Chonky tools
 */
export class ToolRegistry {
  private tools: Map<string, ChonkyTool> = new Map();

  /**
   * Register a tool with the registry
   */
  register(tool: ChonkyTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ChonkyTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ChonkyTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool names
   */
  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ChonkyTool[] {
    return this.getAll().filter(tool => tool.category === category);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool from registry
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Get tool statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<ToolCategory, number>;
  } {
    const tools = this.getAll();
    const byCategory = {} as Record<ToolCategory, number>;

    // Initialize counters
    const categories: ToolCategory[] = [
      'Utilities',
    ];

    categories.forEach(cat => byCategory[cat] = 0);

    // Count tools
    tools.forEach(tool => {
      byCategory[tool.category]++;
    });

    return {
      total: tools.length,
      byCategory
    };
  }

  /**
   * Search tools by name or description
   */
  search(query: string): ChonkyTool[] {
    const searchTerm = query.toLowerCase();
    return this.getAll().filter(tool => 
      tool.name.toLowerCase().includes(searchTerm) ||
      tool.description.toLowerCase().includes(searchTerm)
    );
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();

// Task Management Tools
import { TaskManagerCreateProjectTool } from './task-management/create-project.js';
import { TaskManagerAddTaskTool } from './task-management/add-task.js';
import { TaskManagerBatchAddTasksTool } from './task-management/batch-add-tasks.js';
import { TaskManagerListTasksTool } from './task-management/list-tasks.js';
import { TaskManagerUpdateTaskTool } from './task-management/update-task.js';
import { TaskManagerNextTaskTool } from './task-management/next-task.js';
import { TaskManagerDependenciesTool } from './task-management/manage-dependencies.js';
import { TaskManagerGetTaskTool } from './task-management/get-task.js';
import { TaskManagerImportExportTool } from './task-management/import-export.js';
import { TaskManagerImportFolderTool } from './task-management/import-folder.js';

// Register all tools
// Register Task Management Tools
toolRegistry.register(new TaskManagerCreateProjectTool());
toolRegistry.register(new TaskManagerAddTaskTool());
toolRegistry.register(new TaskManagerBatchAddTasksTool());
toolRegistry.register(new TaskManagerListTasksTool());
toolRegistry.register(new TaskManagerUpdateTaskTool());
toolRegistry.register(new TaskManagerNextTaskTool());
toolRegistry.register(new TaskManagerDependenciesTool());
toolRegistry.register(new TaskManagerGetTaskTool());
toolRegistry.register(new TaskManagerImportExportTool());
toolRegistry.register(new TaskManagerImportFolderTool());

