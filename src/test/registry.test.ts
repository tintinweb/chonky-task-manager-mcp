import { describe, it } from 'mocha';
import * as assert from 'assert';

describe('MCP Server Test Suite', () => {

	it('toolRegistry loads successfully', async () => {
		const { toolRegistry } = await import('../tools/registry.js');
		
		assert.ok(toolRegistry);
		assert.ok(typeof toolRegistry.getAll === 'function');
		assert.ok(typeof toolRegistry.get === 'function');
	});

	it('toolRegistry contains expected tools', async () => {
		const { toolRegistry } = await import('../tools/registry.js');
		const tools = toolRegistry.getAll();
		
		assert.ok(Array.isArray(tools));
		assert.ok(tools.length > 0);
		
		// Check for some expected tool names
		const toolNames = tools.map(tool => tool.name);
		assert.ok(toolNames.includes('chonky-task-manager-create-project'));
		assert.ok(toolNames.includes('chonky-task-manager-add-task'));
		assert.ok(toolNames.includes('chonky-task-manager-list-tasks'));
	});

	it('tools have required properties', async () => {
		const { toolRegistry } = await import('../tools/registry.js');
		const tools = toolRegistry.getAll();
		
		for (const tool of tools) {
			assert.ok(tool.name, `Tool missing name: ${JSON.stringify(tool)}`);
			assert.ok(tool.description, `Tool missing description: ${tool.name}`);
			assert.ok(typeof tool.execute === 'function', `Tool missing execute function: ${tool.name}`);
			assert.ok(tool.inputSchema, `Tool missing inputSchema: ${tool.name}`);
		}
	});

	it('can get tool by name', async () => {
		const { toolRegistry } = await import('../tools/registry.js');
		const tool = toolRegistry.get('chonky-task-manager-create-project');
		
		assert.ok(tool);
		assert.strictEqual(tool.name, 'chonky-task-manager-create-project');
		assert.ok(typeof tool.execute === 'function');
	});

	it('returns undefined for non-existent tool', async () => {
		const { toolRegistry } = await import('../tools/registry.js');
		const tool = toolRegistry.get('non-existent-tool');
		assert.strictEqual(tool, undefined);
	});
});
