/**
 * Chonky Tasks MCP Server - Modern implementation using SDK 1.17.1
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema, RootsListChangedNotificationSchema, InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { toolRegistry } from './tools/registry.js';
import { ToolExecutionContext } from './tools/types.js';


/**
 * Modern MCP server implementation
 */
export class ChonkyTasksMcpServer {
  private server: Server;
  private clientRoots: Array<{ uri: string; name?: string }> = [];
  private clientSupportsRoots: boolean = false;
  private currentSessionId: string = 'anonymous';

  constructor() {
    // Create server instance with modern SDK 1.17.1 API
    this.server = new Server({
      name: 'chonky-task-manager',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
        roots: {
          listChanged: true
        },
      },
    });

    this.setupHandlers();
  }

  /**
   * Set client roots capability support
   */
  public setClientSupportsRoots(supports: boolean) {
    this.clientSupportsRoots = supports;
    console.error(`📁 Client roots capability: ${supports ? 'supported' : 'not supported'}`);
  }

  /**
   * Handle workspace from environment variable
   */
  private handleWorkspaceFromEnvironment() {
    const workspaceDir = process.env.CHONKY_TARGET_WORKSPACE;
    if (workspaceDir) {
      try {
        process.chdir(workspaceDir);
        console.error(`🏠 Set workspace from CHONKY_TARGET_WORKSPACE: ${workspaceDir}`);
      } catch (error) {
        console.error(`❌ Failed to change to CHONKY_TARGET_WORKSPACE '${workspaceDir}':`, error);
        console.error('🛑 Cannot continue - refusing to run in MCP server directory');
        process.exit(1);
      }
    } else {
      console.error('⚠️  No CHONKY_TARGET_WORKSPACE set');
    }
  }

  /**
   * Request the list of roots from the client
   */
  public async requestRootsFromClient(): Promise<boolean> {
    if (!this.clientSupportsRoots) {
      console.error('⚠️  Client does not support roots capability');
      return false;
    }

    try {
      console.error('� Requesting roots from client...');
      
      // Send roots/list request to client using SDK method
      const response = await this.server.listRoots();
      console.log(response);
      if (response.roots && Array.isArray(response.roots) && response.roots.length > 0) {
        console.error(`📂 Received ${response.roots.length} root(s) from client:`);
        response.roots.forEach((root: any, index: number) => {
          console.error(`  ${index + 1}. ${root.name || 'unnamed'}: ${root.uri}`);
        });
        
        this.handleRootsChanged(response.roots);
        return true;
      } else {
        console.error('📂 No roots received from client');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting roots from client:', error);
      return false;
    }
  }

  /**
   * Handle roots list changed notification from client
   */
  private handleRootsChanged(roots: Array<{ uri: string; name?: string }>) {
    this.clientRoots = roots;
    console.error(`📁 Client provided ${roots.length} roots:`);
    roots.forEach(root => {
      console.error(`  - ${root.name || 'Unnamed'}: ${root.uri}`);
    });
    
    // Change working directory to the first root if available
    if (roots.length > 0) {
      const firstRoot = roots[0];
      if (firstRoot.uri && firstRoot.uri.startsWith('file://')) {
        let rootPath = firstRoot.uri.replace('file://', '');
        
        // Handle URL decoding for paths with spaces or special characters
        try {
          rootPath = decodeURIComponent(rootPath);
        } catch (e) {
          // If decoding fails, use the original path
        }
        
        try {
          process.chdir(rootPath);
          console.error(`🏠 Set workspace from client roots: ${rootPath}`);
        } catch (error) {
          console.error(`⚠️  Failed to change to workspace: ${rootPath}`, error);
        }
      } else {
        console.error(`⚠️  First root is not a file:// URI: ${firstRoot.uri}`);
      }
    }
  }

  /**
   * Get the current list of roots provided by the client
   */
  public getClientRoots(): Array<{ uri: string; name?: string }> {
    return this.clientRoots.slice(); // Return a copy
  }

  /**
   * Extract or generate a session ID for the client
   * Since MCP might not have built-in session identification,
   * we generate a consistent ID based on available request information
   */
  private extractSessionId(request: any): string {
    // Option 1: Check if request has any client identification
    const clientId = request.id || request.meta?.clientId || request.meta?.sessionId;
    
    if (clientId) {
      return `client_${clientId}`;
    }
    
    // Option 2: Generate based on connection characteristics
    // In a real implementation, you might use connection info, user agent, etc.
    // For now, we'll use a combination of timestamp and random for this session
    if (!this.currentSessionId) {
      this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    return this.currentSessionId;
  }

  private setupHandlers() {
    // Handle initialization to detect client capabilities
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      console.error('🔄 Processing initialize request...');
      
      const params = request.params as any;
      const { capabilities } = params;
      
      // Check if client supports roots
      this.clientSupportsRoots = !!(capabilities?.roots);
      console.error(`🔍 Client roots support: ${this.clientSupportsRoots ? 'YES' : 'NO'}`);
      
      if (this.clientSupportsRoots) {
        console.error('🔄 Will try to request roots from client after connection is established...');
        // Don't request roots immediately for SSE - wait for connection to be fully established
        // The roots request will be triggered when the SSE connection is established
      } else {
        console.error('📁 Client does not support roots, falling back to environment variable');
        this.handleWorkspaceFromEnvironment();
      }
      
      // Return server capabilities with protocol version
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          roots: {
            listChanged: true
          },
        },
        serverInfo: {
          name: 'chonky-task-manager',
          version: '1.0.0',
        },
      };
    });

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = toolRegistry.getAll();
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      console.error(`🚨 TOOL CALL RECEIVED: ${name}`);
      
      // Extract client session ID using our smart detection method
      const clientSessionId = this.extractSessionId(request);
      console.error(`📋 Using client session ID: ${clientSessionId}`);
      
      const tool = toolRegistry.get(name);
      if (!tool) {
        throw new Error(`Tool '${name}' not found`);
      }

      try {
        // Extract progress token if present
        const progressToken = (request.params as any)?._meta?.progressToken || 
                             Math.floor(Math.random() * 100000);
        
        console.error(`🔍 Progress token:`, progressToken);
        
        const context: ToolExecutionContext = {
          arguments: args || {},
          sessionId: clientSessionId, // Use client session ID for isolation
          workspaceRoot: process.cwd(), // Now points to the first client root
          progressToken,
          sendProgress: async (params: { progress: number; message?: string }) => {
            console.error(`📊 Progress: ${params.progress}% - ${params.message || 'Working...'}`);
            try {
              // Send progress notification using the modern MCP protocol
              await this.server.notification({
                method: 'notifications/progress',
                params: {
                  progressToken,
                  progress: params.progress,
                  total: 100,
                  ...(params.message && { message: params.message })
                }
              });
            } catch (progressError) {
              console.error(`⚠️ Progress notification failed:`, progressError);
              // Don't fail the entire tool execution if progress fails
            }
          }
        };

        // Send initial invocation message
        const toolEmoji = "📋";
        await context.sendProgress({
          progress: 0,
          message: `${toolEmoji} ${tool.name}...`
        });

        const result = await tool.execute(context);
        
        return {
          content: [
            {
              type: 'text' as const,
              text: result.result,
            },
          ],
          isError: !result.success,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error executing tool '${name}': ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Handle roots list changed notifications from client
    this.server.setNotificationHandler(RootsListChangedNotificationSchema, async (notification) => {
      // Client is telling us the roots have changed, request the new list
      console.error('📁 Client notified us that roots list changed, requesting updated list...');
      await this.requestRootsFromClient();
    });
    
    const tools = toolRegistry.getAll();
    console.error(`📝 Registered ${tools.length} tools`);
  }

  /**
   * Start stdio transport
   */
  async startStdio() {
    // For stdio, use a simple session ID since there's no transport session
    this.currentSessionId = 'stdio-session';
    console.error(`🔗 Using stdio session ID: ${this.currentSessionId}`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('📟 Chonky Tasks MCP Server running on stdio');
    
    // Use the same logic as SSE: wait for initialization to complete, then request roots
    // The initialize handler sets this.clientSupportsRoots based on client capabilities
    setTimeout(async () => {
      if (this.clientSupportsRoots) {
        console.error('🔄 stdio connection established, requesting roots...');
        const success = await this.requestRootsFromClient();
        if (!success) {
          console.error('⚠️  Failed to get roots from client, falling back to environment variable');
          this.handleWorkspaceFromEnvironment();
        }
      } else {
        console.error('📁 Client does not support roots, falling back to environment variable');
        this.handleWorkspaceFromEnvironment();
      }
    }, 500); // Use same timeout as SSE to ensure initialization is complete
  }

  /**
   * Start SSE transport
   */
  async startSSE(port: number = 3000, host: string = 'localhost') {
    console.error(`🌐 Starting SSE server on ${host}:${port}`);
    
    // Store active transports to handle POST messages
    const activeTransports = new Map<string, SSEServerTransport>();
    
    const httpServer = createServer(async (req, res) => {
      console.error(`📡 HTTP ${req.method} ${req.url}`);
      
      if (req.url === '/sse' && req.method === 'GET') {
        // Handle SSE connection
        try {
          const transport = new SSEServerTransport('/sse', res);
          await this.server.connect(transport); // This automatically calls transport.start()
          
          // Capture the session ID for this connection
          this.currentSessionId = transport.sessionId;
          console.error(`🔗 Captured client session ID: ${this.currentSessionId}`);
          
          // Store the transport for handling POST messages
          activeTransports.set(transport.sessionId, transport);
          
          console.error(`🔌 SSE client connected with session: ${transport.sessionId}`);
          
          // Request roots after connection is established if client supports it
          if (this.clientSupportsRoots) {
            setTimeout(async () => {
              console.error('🔄 SSE connection established, requesting roots...');
              const success = await this.requestRootsFromClient();
              if (!success) {
                console.error('⚠️  Failed to get roots from client, falling back to environment variable');
                this.handleWorkspaceFromEnvironment();
              }
            }, 500); // Give a bit more time for SSE to be fully ready
          }
          
          // Clean up when connection closes
          transport.onclose = () => {
            activeTransports.delete(transport.sessionId);
            console.error(`🔌 SSE client disconnected: ${transport.sessionId}`);
          };
          
        } catch (error) {
          console.error('❌ SSE setup error:', error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('SSE Setup Error');
          }
        }
      } else if ((req.url === '/sse' || req.url === '/message' || req.url?.startsWith('/message?') || req.url?.startsWith('/sse?')) && req.method === 'POST') {
        // Handle POST messages
        try {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const message = JSON.parse(body);
              
              // Extract session ID from URL query params or headers
              const url = new URL(req.url!, `http://${req.headers.host}`);
              const sessionId = url.searchParams.get('sessionId') || req.headers['x-session-id'] as string;
              const transport = sessionId ? activeTransports.get(sessionId) : activeTransports.values().next().value;
              
              if (transport) {
                await transport.handleMessage(message);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"success": true}');
              } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('No active SSE session found');
              }
            } catch (error) {
              console.error('❌ Error handling POST message:', error);
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Invalid JSON');
            }
          });
        } catch (error) {
          console.error('❌ Error handling POST request:', error);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      } else {
        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found. Use GET /sse for SSE connection, POST /sse or /message for messages.');
      }
    });
    
    return new Promise<void>((resolve, reject) => {
      httpServer.listen(port, host, () => {
        console.error(`🌐 Chonky Tasks MCP Server SSE at http://${host}:${port}/sse`);
        resolve();
      });
      
      httpServer.on('error', reject);
    });
  }

  /**
   * Start server with both transports
   */
  async startBoth(port: number = 3000, host: string = 'localhost') {
    // Start stdio in background
    setTimeout(() => this.startStdio(), 100);
    
    // Start SSE
    await this.startSSE(port, host);
    
    console.error(`🚀 Chonky Tasks MCP Server ready on stdio and http://${host}:${port}/sse`);
  }
}
