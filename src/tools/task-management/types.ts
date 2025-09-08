/**
 * Type definitions for ChonkyTasks task management system
 * Based on TaskMaster-AI data model
 */

export type TaskStatus = 
  | 'pending' 
  | 'in-progress' 
  | 'done' 
  | 'blocked' 
  | 'deferred' 
  | 'cancelled' 
  | 'review';

export type Priority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: number;                   // Unique within parent task
  title: string;
  description: string;
  details?: string;
  status: TaskStatus;
  dependencies: number[];       // Can reference other subtask IDs or main task IDs
  notes?: string;              // Accumulated notes from task updates
}

export interface Task {
  id: number;                   // Unique numeric ID (1, 2, 3...)
  title: string;                // Brief descriptive title
  description: string;          // Concise task summary
  details?: string;             // Detailed implementation instructions
  successCriteria?: string;     // Testing approach and verification strategy
  status: TaskStatus;           // Current task state
  priority: Priority;           // Task importance level
  dependencies: number[];       // Array of task IDs this depends on
  subtasks: Subtask[];         // Nested subtasks
  notes?: string;              // Accumulated notes from task updates
  created: string;             // ISO timestamp
  updated: string;             // ISO timestamp
}

export interface ProjectData {
  name: string;
  tasks: Task[];               // Array of tasks (matches TaskMaster format)
  nextId: number;              // For ID generation
  created: string;
  updated: string;
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: Priority;
  withSubtasks?: boolean;
}

export interface DependencyValidationResult {
  isValid: boolean;
  errors: string[];
  circularDependencies?: number[][];
}

export interface NextTaskResult {
  task: Task | null;
  reason: string;
  readyTasks: Task[];
  blockedTasks: Task[];
}

export const VALID_STATUSES = [
  'pending', 'in-progress', 'done', 'blocked', 'deferred', 'cancelled', 'review'
] as const;

export const FINAL_STATUSES = ['done', 'cancelled'] as const;

export const VALID_PRIORITIES: Priority[] = ['low', 'medium', 'high'];

// TaskMaster-AI compatible status colors
export const STATUS_COLORS = {
  'pending': 'yellow',
  'in-progress': 'blue', 
  'done': 'green',
  'blocked': 'red',
  'deferred': 'gray',
  'cancelled': 'gray',
  'review': 'cyan'
} as const;

export const PRIORITY_COLORS = {
  'high': 'red',
  'medium': 'yellow',
  'low': 'gray'
} as const;
