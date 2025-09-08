/**
 * Core utilities for ChonkyTasks task management system
 */

import { Task, Subtask, TaskStatus, DependencyValidationResult, ProjectData } from './types.js';

/**
 * Normalize project name to match MemoryStoreTool key normalization
 * This matches the exact normalization used by MemoryStoreTool
 */
export function normalizeProjectKey(projectName: string): string {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '') // Remove invalid chars
    .replace(/\.+/g, '.')         // Collapse multiple dots
    .replace(/^\.|\.$/, '');      // Remove leading/trailing dots
}

/**
 * Generate a hierarchical task ID for subtasks (e.g., "1.1", "2.3.1")
 */
export function generateSubtaskId(parentId: number, subtaskId: number): string {
  return `${parentId}.${subtaskId}`;
}

/**
 * Parse a hierarchical task ID into components
 */
export function parseTaskId(taskId: string): { parentId: number; subtaskId?: number } {
  if (!taskId.includes('.')) {
    return { parentId: parseInt(taskId, 10) };
  }
  
  const parts = taskId.split('.');
  return {
    parentId: parseInt(parts[0], 10),
    subtaskId: parseInt(parts[1], 10)
  };
}

/**
 * Find a task by ID in the project
 */
export function findTaskById(project: ProjectData, taskId: number): Task | null {
  return project.tasks.find(task => task.id === taskId) || null;
}

/**
 * Find a subtask by hierarchical ID
 */
export function findSubtaskById(project: ProjectData, taskId: string): { task: Task; subtask: Subtask } | null {
  const { parentId, subtaskId } = parseTaskId(taskId);
  
  if (subtaskId === undefined) {
    return null;
  }
  
  const parentTask = findTaskById(project, parentId);
  if (!parentTask) {
    return null;
  }
  
  const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
  if (!subtask) {
    return null;
  }
  
  return { task: parentTask, subtask };
}

/**
 * Get the next available task ID
 */
export function getNextTaskId(project: ProjectData): number {
  const nextId = project.nextId;
  project.nextId = nextId + 1;
  project.updated = new Date().toISOString();
  return nextId;
}

/**
 * Get the next available subtask ID for a parent task
 */
export function getNextSubtaskId(parentTask: Task): number {
  if (parentTask.subtasks.length === 0) {
    return 1;
  }
  return Math.max(...parentTask.subtasks.map(st => st.id)) + 1;
}

/**
 * Validate task dependencies to prevent circular references
 */
export function validateDependencies(project: ProjectData): DependencyValidationResult {
  const errors: string[] = [];
  const circularDependencies: number[][] = [];
  
  // Check each task's dependencies
  for (const task of project.tasks) {
    for (const depId of task.dependencies) {
      // Check if dependency exists
      const depTask = findTaskById(project, depId);
      if (!depTask) {
        errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
        continue;
      }
      
      // Check for circular dependencies using DFS
      const visited = new Set<number>();
      const recursionStack = new Set<number>();
      
      if (hasCircularDependency(project, task.id, visited, recursionStack)) {
        const cycle = Array.from(recursionStack);
        circularDependencies.push(cycle);
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    circularDependencies: circularDependencies.length > 0 ? circularDependencies : undefined
  };
}

/**
 * Check for circular dependencies using depth-first search
 */
function hasCircularDependency(
  project: ProjectData, 
  taskId: number, 
  visited: Set<number>, 
  recursionStack: Set<number>
): boolean {
  if (recursionStack.has(taskId)) {
    return true; // Found a cycle
  }
  
  if (visited.has(taskId)) {
    return false; // Already checked this path
  }
  
  visited.add(taskId);
  recursionStack.add(taskId);
  
  const task = findTaskById(project, taskId);
  if (task) {
    for (const depId of task.dependencies) {
      if (hasCircularDependency(project, depId, visited, recursionStack)) {
        return true;
      }
    }
  }
  
  recursionStack.delete(taskId);
  return false;
}

/**
 * Get tasks that are ready to work on (all dependencies completed)
 */
export function getReadyTasks(project: ProjectData): Task[] {
  const completedTaskIds = new Set(
    project.tasks
      .filter(task => task.status === 'done')
      .map(task => task.id)
  );
  
  return project.tasks.filter(task => {
    if (task.status === 'done' || task.status === 'cancelled') {
      return false;
    }
    
    // Check if all dependencies are completed
    return task.dependencies.every(depId => completedTaskIds.has(depId));
  });
}

/**
 * Get the next recommended task based on dependencies and priority
 */
export function getNextTask(project: ProjectData): Task | null {
  const readyTasks = getReadyTasks(project);
  
  if (readyTasks.length === 0) {
    return null;
  }
  
  // Filter out tasks that are already in progress
  const availableTasks = readyTasks.filter(task => task.status === 'pending');
  
  if (availableTasks.length === 0) {
    return null;
  }
  
  // Sort by priority (high > medium > low), then by ID (earlier tasks first)
  availableTasks.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.id - b.id;
  });
  
  return availableTasks[0];
}

/**
 * Format dependencies with status indicators (TaskMaster-AI style)
 */
export function formatDependencies(project: ProjectData, dependencies: number[]): string {
  if (dependencies.length === 0) {
    return 'None';
  }
  
  return dependencies
    .map(depId => {
      const depTask = findTaskById(project, depId);
      if (!depTask) {
        return `${depId} ❓`;
      }
      
      const indicator = depTask.status === 'done' ? '✅' : 
                       depTask.status === 'in-progress' ? '🔄' : '⏱️';
      return `${depId} ${indicator}`;
    })
    .join(', ');
}

/**
 * Calculate completion percentage for a task with subtasks
 */
export function calculateTaskProgress(task: Task): number {
  if (task.subtasks.length === 0) {
    return task.status === 'done' ? 100 : 0;
  }
  
  const completedSubtasks = task.subtasks.filter(st => st.status === 'done').length;
  return Math.round((completedSubtasks / task.subtasks.length) * 100);
}

/**
 * Update timestamp on task modification
 */
export function touchTask(task: Task): void {
  task.updated = new Date().toISOString();
}

/**
 * Update timestamp on project modification
 */
export function touchProject(project: ProjectData): void {
  project.updated = new Date().toISOString();
}

/**
 * Validate a single task's dependencies against a list of tasks
 */
export function validateTaskDependencies(allTasks: Task[], taskId: number, dependencies: number[]): DependencyValidationResult {
  const errors: string[] = [];
  const circularDependencies: number[][] = [];
  
  for (const depId of dependencies) {
    // Check if dependency exists
    const depTask = allTasks.find(t => t.id === depId);
    if (!depTask) {
      errors.push(`Task ${taskId} depends on non-existent task ${depId}`);
      continue;
    }
    
    // Check for circular dependencies by building a temporary project
    const tempProject: ProjectData = {
      name: 'temp',
      tasks: allTasks,
      nextId: Math.max(...allTasks.map(t => t.id)) + 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    // Check for circular dependencies
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    
    if (hasCircularDependency(tempProject, taskId, visited, recursionStack)) {
      const cycle = Array.from(recursionStack);
      circularDependencies.push(cycle);
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    circularDependencies: circularDependencies.length > 0 ? circularDependencies : undefined
  };
}
