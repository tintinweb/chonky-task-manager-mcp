/**
 * MCP Tools Registry Integration for VS Code Extension
 * 
 * This file creates a dynamic VS Code tool wrapper that integrates directly with
 * the chonky-mcp-server toolRegistry, eliminating the need for individual tool wrappers.
 */

import * as vscode from 'vscode';
import { toolRegistry } from 'chonky-tasks-mcp-server/build/tools/registry.js';
/**
 * Universal MCP Tool Wrapper
 * Dynamically wraps any MCP tool from the registry
 */
export class UniversalMCPToolWrapper implements vscode.LanguageModelTool<any> {
  private tool: any;
  private toolName: string;

  constructor(toolName: string, tool: any, private description: string) {
    this.toolName = toolName;
    this.tool = tool;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<any>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      // Create MCP execution context similar to the server
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      
      // Use persistent session ID based on workspace to maintain memory across invocations
      const sessionId = `vscode-session-${workspacePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      const context: any = {
        arguments: options.input || {},
        sessionId: sessionId,
        workspaceRoot: workspacePath,
        progressToken: Math.floor(Math.random() * 100000),
        sendProgress: async (params: { progress: number; message?: string }) => {
          // VS Code doesn't have direct progress reporting in language model tools yet
          console.log(`Progress: ${params.progress}% - ${params.message || 'Working...'}`);
        }
      };

      // Execute the tool directly using the registry
      const result = await this.tool.execute(context);
      
      // Convert result to VS Code format
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(result.result || JSON.stringify(result, null, 2))
      ]);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error executing ${this.toolName}: ${errorMessage}`)
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `📋 Chonky: ${this.toolName} - ${this.description}`,
    };
  }
}

/**
 * Register all MCP tools from the registry with VS Code
 */
export async function registerAllMCPTools(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Dynamic import of the registry
    const tools = toolRegistry.getAll();
    let registeredCount = 0;

    for (const tool of tools) {
      try {
        // Create a universal wrapper for this tool
        const wrapper = new UniversalMCPToolWrapper(tool.name, tool, tool.description);
        
        // Register with VS Code using the tool's name as the ID
        context.subscriptions.push(
          vscode.lm.registerTool(tool.name, wrapper)
        );
        
        registeredCount++;
      } catch (error) {
        console.error(`Failed to register MCP tool '${tool.name}':`, error);
      }
    }

    console.log(`✅ Registered ${registeredCount}/${tools.length} MCP tools with VS Code`);
  } catch (error) {
    console.error('Failed to load MCP tools:', error);
  }
}
