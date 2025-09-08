#!/usr/bin/env node

/**
 * Chonky MCP Server - Modern Entry Point for SDK 1.17.1
 */

import { ChonkyTasksMcpServer } from './server.js';

// Import and register all tools
import './tools/registry.js';

/**
 * Main entry point
 */
async function main() {
  try {
    const server = new ChonkyTasksMcpServer();
    
    // Check command line arguments for transport type
    const args = process.argv.slice(2);
    const transportType = args[0] || 'stdio';
    
    console.error(`🚀 Starting Chonky MCP Server with ${transportType} transport...`);
    
    switch (transportType) {
      case 'stdio':
        await server.startStdio();
        break;
      case 'sse':
        const port = parseInt(args[1] || '3000');
        const host = args[2] || 'localhost';
        await server.startSSE(port, host);
        break;
      case 'both':
        const bothPort = parseInt(args[1] || '3000');
        const bothHost = args[2] || 'localhost';
        await server.startBoth(bothPort, bothHost);
        break;
      default:
        console.error(`❌ Unknown transport type: ${transportType}`);
        console.error('Usage: node index.js [stdio|sse|both] [port] [host]');
        process.exit(1);
    }
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.error('🛑 Shutting down...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
