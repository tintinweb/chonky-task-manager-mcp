import * as vscode from 'vscode';

// Import individual tools from moved locations
import { registerAllMCPTools } from './mcp-tools';

export function registerChatTools(context: vscode.ExtensionContext) {
  // register MCP tools
  registerAllMCPTools(context);
}
