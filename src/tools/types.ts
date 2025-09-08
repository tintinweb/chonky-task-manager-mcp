/**
 * Shared types and interfaces for Chonky MCP Server tools
 */

import { z } from 'zod';

/**
 * Context passed to tool execution
 */
export interface ToolExecutionContext {
  arguments: Record<string, any>;
  sessionId: string;
  workspaceRoot: string;
  progressToken?: string | number;
  sendProgress: (params: { progress: number; message?: string }) => Promise<void>;
}

/**
 * Result returned from tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  result: string;
  metadata?: {
    filesProcessed?: number;
    processingTime?: number;
    [key: string]: any;
  };
}

/**
 * Tool category for organization
 */
export type ToolCategory = 
  | 'Utilities';

/**
 * Base abstract class for all Chonky MCP tools
 */
export abstract class ChonkyTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: ToolCategory;
  abstract readonly inputSchema: any;

  /**
   * Execute the tool with given context
   */
  abstract execute(context: ToolExecutionContext): Promise<ToolExecutionResult>;

  /**
   * Validate input parameters using the tool's schema
   */
  protected validateInput(input: any): any {
    if (this.inputSchema && typeof this.inputSchema === 'object') {
      // Basic validation - can be enhanced with proper JSON schema validation
      return input;
    }
    return input;
  }

  /**
   * Create a success result
   */
  protected success(result: string, metadata?: any): ToolExecutionResult {
    return {
      success: true,
      result,
      metadata
    };
  }

  /**
   * Create an error result
   */
  protected error(message: string): ToolExecutionResult {
    return {
      success: false,
      result: `Error: ${message}`
    };
  }
}
