import { ChonkyTool, ToolExecutionContext, ToolExecutionResult } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// EXACT SAME interfaces from VSCode
interface StoreEntry {
    value: any;
    type: string;
    created: Date;
    lastModified: Date;
    ttl?: number; // Time-to-live in milliseconds
}

interface MemoryStore {
    data: Map<string, StoreEntry>;
    metadata: {
        created: Date;
        lastAccess: Date;
        totalOperations: number;
    };
}

interface StoreInfo {
    namespace: string;
    totalKeys: number;
    totalSize: number;
    created: Date;
    lastAccess: Date;
    operations: number;
    expiredKeys?: number;
}

interface SetOptions {
    overwrite?: boolean;
    createPath?: boolean;
    ttl?: number;
}

interface QueryOptions {
    format?: 'json' | 'table' | 'tree' | 'flat';
    includeMetadata?: boolean;
}

// EXACT SAME MemoryStoreManager class from VSCode (moved before tool class)
class MemoryStoreManager {
    private stores = new Map<string, MemoryStore>();
    private readonly MAX_STORE_SIZE = 100 * 1024 * 1024; // 100MB per namespace
    private readonly MAX_VALUE_SIZE = 10 * 1024 * 1024;  // 10MB per value
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Cleanup expired entries every 5 minutes (only if not in test environment)
        if (process.env.NODE_ENV !== 'test') {
            this.cleanupInterval = setInterval(() => {
                this.cleanupExpiredEntries();
            }, 5 * 60 * 1000);
        }
    }

    // Method to cleanup interval for testing
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    private getOrCreateStore(namespace: string): MemoryStore {
        if (!this.stores.has(namespace)) {
            this.stores.set(namespace, {
                data: new Map(),
                metadata: {
                    created: new Date(),
                    lastAccess: new Date(),
                    totalOperations: 0
                }
            });
        }
        
        const store = this.stores.get(namespace)!;
        store.metadata.lastAccess = new Date();
        store.metadata.totalOperations++;
        
        return store;
    }

    private normalizeKey(key: string): string {
        return key
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '') // Remove invalid chars
            .replace(/\.+/g, '.')         // Collapse multiple dots
            .replace(/^\.|\.$/, '');      // Remove leading/trailing dots
    }

    private matchPattern(key: string, pattern: string): boolean {
        // Handle simple wildcard cases first
        if (pattern === '*' || pattern === '**') {
            return true; // Match everything
        }
        
        // For exact match
        if (pattern === key) {
            return true;
        }
        
        // Convert pattern to regex
        let regexPattern = pattern
            .replace(/\./g, '\\.')  // Escape dots
            .replace(/\*\*/g, '.*') // ** matches anything including dots
            .replace(/(?<!\*)\*/g, '[^.]*'); // * matches anything except dots
        
        try {
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(key);
        } catch (error) {
            // If regex fails, fallback to simple string matching
            return key === pattern;
        }
    }

    private isExpired(entry: StoreEntry): boolean {
        if (!entry.ttl) {
            return false;
        }
        return Date.now() > (entry.created.getTime() + entry.ttl);
    }

    private cleanupExpiredEntries(): void {
        const storeEntries = Array.from(this.stores.entries());
        for (const [namespace, store] of storeEntries) {
            const expiredKeys: string[] = [];
            
            const dataEntries = Array.from(store.data.entries());
            for (const [key, entry] of dataEntries) {
                if (this.isExpired(entry)) {
                    expiredKeys.push(key);
                }
            }
            
            expiredKeys.forEach(key => store.data.delete(key));
        }
    }

    private validateValue(value: any): void {
        const serialized = JSON.stringify(value);
        if (serialized.length > this.MAX_VALUE_SIZE) {
            throw new Error(`Value size (${serialized.length} bytes) exceeds maximum allowed size (${this.MAX_VALUE_SIZE} bytes)`);
        }
    }

    private getValueType(value: any): string {
        if (value === null) {
            return 'null';
        }
        if (Array.isArray(value)) {
            return 'array';
        }
        return typeof value;
    }

    set(namespace: string, key: string, value: any, options: SetOptions = {}): void {
        const store = this.getOrCreateStore(namespace);
        const normalizedKey = this.normalizeKey(key);
        
        if (!normalizedKey) {
            throw new Error('Invalid key format');
        }

        // Validate value size
        this.validateValue(value);

        // Check if key exists and overwrite is disabled
        if (!options.overwrite && store.data.has(normalizedKey)) {
            throw new Error(`Key '${normalizedKey}' already exists and overwrite is disabled`);
        }

        // Create entry
        const entry: StoreEntry = {
            value: value,
            type: this.getValueType(value),
            created: new Date(),
            lastModified: new Date(),
            ttl: options.ttl
        };

        store.data.set(normalizedKey, entry);
    }

    get(namespace: string, key: string): any {
        const store = this.stores.get(namespace);
        if (!store) {
            return undefined;
        }

        const normalizedKey = this.normalizeKey(key);
        const entry = store.data.get(normalizedKey);
        
        if (!entry) {
            return undefined;
        }

        if (this.isExpired(entry)) {
            store.data.delete(normalizedKey);
            return undefined;
        }

        return entry.value;
    }

    delete(namespace: string, key: string): boolean {
        const store = this.stores.get(namespace);
        if (!store) {
            return false;
        }

        const normalizedKey = this.normalizeKey(key);
        return store.data.delete(normalizedKey);
    }

    query(namespace: string, pattern: string, options: QueryOptions = {}): any {
        const store = this.stores.get(namespace);
        if (!store) {
            return { results: {}, count: 0 };
        }

        const results: any = {};
        let count = 0;

        const dataEntries = Array.from(store.data.entries());
        for (const [key, entry] of dataEntries) {
            if (this.isExpired(entry)) {
                store.data.delete(key);
                continue;
            }

            if (this.matchPattern(key, pattern)) {
                if (options.includeMetadata) {
                    results[key] = {
                        value: entry.value,
                        type: entry.type,
                        created: entry.created,
                        lastModified: entry.lastModified,
                        ttl: entry.ttl
                    };
                } else {
                    results[key] = entry.value;
                }
                count++;
            }
        }

        return {
            results,
            count,
            pattern,
            namespace
        };
    }

    list(namespace: string, options: QueryOptions = {}): any {
        return this.query(namespace, '*', options);
    }

    clear(namespace: string): void {
        const store = this.stores.get(namespace);
        if (store) {
            store.data.clear();
        }
    }

    info(namespace: string): StoreInfo {
        const store = this.stores.get(namespace);
        if (!store) {
            return {
                namespace,
                totalKeys: 0,
                totalSize: 0,
                created: new Date(),
                lastAccess: new Date(),
                operations: 0
            };
        }

        let totalSize = 0;
        let expiredKeys = 0;

        const dataEntries = Array.from(store.data.entries());
        for (const [key, entry] of dataEntries) {
            if (this.isExpired(entry)) {
                expiredKeys++;
            } else {
                totalSize += JSON.stringify(entry.value).length;
            }
        }

        return {
            namespace,
            totalKeys: store.data.size,
            totalSize,
            created: store.metadata.created,
            lastAccess: store.metadata.lastAccess,
            operations: store.metadata.totalOperations,
            expiredKeys
        };
    }

    exportData(namespace: string): any {
        const store = this.stores.get(namespace);
        if (!store) {
            return { data: {}, metadata: null };
        }

        const data: any = {};
        const dataEntries = Array.from(store.data.entries());
        for (const [key, entry] of dataEntries) {
            if (!this.isExpired(entry)) {
                data[key] = {
                    value: entry.value,
                    type: entry.type,
                    created: entry.created,
                    lastModified: entry.lastModified,
                    ttl: entry.ttl
                };
            }
        }

        return {
            data,
            metadata: store.metadata,
            exportTime: new Date()
        };
    }

    importData(namespace: string, importData: any): void {
        const store = this.getOrCreateStore(namespace);
        
        if (importData.data) {
            for (const [key, entryData] of Object.entries(importData.data)) {
                const entry: StoreEntry = {
                    value: (entryData as any).value,
                    type: (entryData as any).type || this.getValueType((entryData as any).value),
                    created: new Date((entryData as any).created),
                    lastModified: new Date((entryData as any).lastModified),
                    ttl: (entryData as any).ttl
                };
                
                store.data.set(key, entry);
            }
        }
    }
}

/**
 * MIGRATED from VSCode extension: /src/features/copilot/tools/utilities/memory-store.ts
 * Uses EXACT SAME business logic from VSCode tool, only interface changed for MCP compatibility
 * 
 * In-memory key-value store with dotted notation and wildcard queries for audit data persistence
 */
export class MemoryStoreTool extends ChonkyTool {
  readonly name = 'chonky-memory-store';
  readonly description = 'In-memory key-value store with dotted notation and wildcard queries for audit data persistence. Features automatic session isolation to prevent cross-session data access.';
  readonly category = 'Utilities' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['set', 'get', 'delete', 'query', 'list', 'clear', 'info', 'export', 'import', 'dump'],
        description: 'Operation to perform'
      },
      namespace: {
        type: 'string',
        default: 'default',
        description: 'Storage namespace for isolation (default: "default")'
      },
      key: {
        type: 'string',
        description: 'Key in dotted notation (e.g., "audit.findings.high", "contracts.main")'
      },
      value: {
        description: 'Value to store (any JSON-serializable data)'
      },
      pattern: {
        type: 'string',
        description: 'Pattern for query operation (e.g., "audit.findings.*", "contracts.*.address")'
      },
      filePath: {
        type: 'string',
        description: 'File path for dump operation (absolute path, e.g., "/tmp/memory-dump.json")'
      },
      ttl: {
        type: 'number',
        description: 'Time-to-live in seconds for the entry'
      },
      options: {
        type: 'object',
        properties: {
          overwrite: {
            type: 'boolean',
            default: true,
            description: 'Whether to overwrite existing keys'
          },
          createPath: {
            type: 'boolean',
            default: true,
            description: 'Create intermediate path keys if they do not exist'
          },
          format: {
            type: 'string',
            enum: ['json', 'table', 'tree', 'flat'],
            default: 'json',
            description: 'Output format for results'
          },
          includeMetadata: {
            type: 'boolean',
            default: false,
            description: 'Include metadata in query results'
          }
        }
      }
    },
    required: ['operation']
  };

  // EXACT SAME manager instance from VSCode
  private static manager = new MemoryStoreManager();

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { 
        operation, 
        namespace = 'default', 
        key, 
        value, 
        pattern, 
        ttl, 
        options = {} 
      } = context.arguments;

      const manager = MemoryStoreTool.manager;
      
      // SESSION ISOLATION: Prefix namespace with sessionId to prevent cross-session data access
      const sessionId = context.sessionId || 'anonymous';
      const isolatedNamespace = `${sessionId}.${namespace}`;
      
      let result: any;

      // EXACT SAME operation dispatch from VSCode
      switch (operation) {
        case 'set':
          if (!key) {
            return this.error('Key is required for set operation');
          }
          const setOptions: SetOptions = {
            overwrite: options.overwrite !== false,
            createPath: options.createPath !== false,
            ttl: ttl ? ttl * 1000 : undefined // Convert seconds to milliseconds
          };
          manager.set(isolatedNamespace, key, value, setOptions);
          result = { success: true, key, namespace };
          break;

        case 'get':
          if (!key) {
            return this.error('Key is required for get operation');
          }
          result = manager.get(isolatedNamespace, key);
          break;

        case 'delete':
          if (!key) {
            return this.error('Key is required for delete operation');
          }
          const deleted = manager.delete(isolatedNamespace, key);
          result = { success: deleted, key, namespace };
          break;

        case 'query':
          if (!pattern) {
            return this.error('Pattern is required for query operation');
          }
          const queryOptions: QueryOptions = {
            format: options.format || 'json',
            includeMetadata: options.includeMetadata || false
          };
          result = manager.query(isolatedNamespace, pattern, queryOptions);
          break;

        case 'list':
          const listOptions: QueryOptions = {
            format: options.format || 'json',
            includeMetadata: options.includeMetadata || false
          };
          result = manager.list(isolatedNamespace, listOptions);
          break;

        case 'clear':
          manager.clear(isolatedNamespace);
          result = { success: true, namespace, cleared: true };
          break;

        case 'info':
          result = manager.info(isolatedNamespace);
          break;

        case 'export':
          result = manager.exportData(isolatedNamespace);
          break;

        case 'import':
          if (!value) {
            return this.error('Data is required for import operation');
          }
          manager.importData(isolatedNamespace, value);
          result = { success: true, namespace, imported: true };
          break;

        case 'dump':
          if (!context.arguments.filePath) {
            return this.error('filePath is required for dump operation');
          }
          const dumpData = manager.exportData(isolatedNamespace);
          const dumpFilePath = context.arguments.filePath;
          
          try {
            // Ensure directory exists
            const dir = path.dirname(dumpFilePath);
            await fs.mkdir(dir, { recursive: true });
            
            // Write formatted JSON to file
            await fs.writeFile(dumpFilePath, JSON.stringify(dumpData, null, 2), 'utf8');
            
            // Get file stats
            const stats = await fs.stat(dumpFilePath);
            const sizeKB = Math.round(stats.size / 1024 * 100) / 100;
            
            result = {
              success: true,
              filePath: dumpFilePath,
              fileSize: stats.size,
              fileSizeKB: sizeKB,
              entriesExported: Object.keys(dumpData.data || {}).length,
              namespace: namespace,
              dumpTime: new Date().toISOString()
            };
          } catch (error) {
            return this.error(`Failed to write dump file: ${error instanceof Error ? error.message : String(error)}`);
          }
          break;

        default:
          return this.error(`Unknown operation: ${operation}`);
      }

      // Format result as string for MCP protocol compatibility
      const formattedResult = typeof result === 'object' 
        ? JSON.stringify(result, null, 2)
        : String(result);

      return this.success(formattedResult, {
        operation,
        namespace: namespace, // User-provided namespace
        sessionId: sessionId, // Session ID for transparency
        internalNamespace: isolatedNamespace, // Actual internal namespace used
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = `Memory store error: ${error instanceof Error ? error.message : String(error)}`;
      return this.error(errorMessage);
    }
  }
}
