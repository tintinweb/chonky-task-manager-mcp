/**
 * Error utilities for Chonky MCP Server
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ToolExecutionError extends Error {
  constructor(message: string, public toolName?: string) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}
