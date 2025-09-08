/**
 * Project name validation and suggestion utilities
 */

/**
 * Validate project name - must be short and contain no spaces
 */
export function validateProjectName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Project name cannot be empty' };
  }
  
  if (name.length > 30) {
    return { isValid: false, error: 'Project name must be 30 characters or less' };
  }
  
  if (name.includes(' ')) {
    return { isValid: false, error: 'Project name cannot contain spaces. Use dashes or underscores instead' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { isValid: false, error: 'Project name can only contain letters, numbers, dashes, and underscores' };
  }
  
  return { isValid: true };
}

/**
 * Get active project suggestion when project not found
 */
export async function getActiveProjectSuggestion(memoryStore: any, context: any): Promise<string | null> {
  try {
    const activeResult = await memoryStore.execute({
      ...context,
      arguments: {
        operation: 'get',
        key: 'tasks.activeproject',
        namespace: 'chonky-task-manager'
      }
    });
    
    if (activeResult.success && activeResult.result && activeResult.result !== 'undefined') {
      return activeResult.result;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Create project not found error with active project suggestion
 */
export async function createProjectNotFoundError(projectName: string, memoryStore: any, context: any): Promise<string> {
  const activeProject = await getActiveProjectSuggestion(memoryStore, context);
  
  if (activeProject) {
    return `Project "${projectName}" not found. Did you mean the active project "${activeProject}"? ` +
           `Use "${activeProject}" instead, or create a new project with a valid name (no spaces, max 30 chars, alphanumeric with dashes/underscores only).`;
  }
  
  return `Project "${projectName}" not found. Create it first with chonky-task-manager-create-project, ` +
         `using a valid name (no spaces, max 30 chars, alphanumeric with dashes/underscores only).`;
}
