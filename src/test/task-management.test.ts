import { describe, it } from 'mocha';
import * as assert from 'assert';

describe('Task Management Test Suite', () => {

	it('can import task management tools', async () => {
		// Test that tools can be imported without errors
		const { TaskManagerCreateProjectTool } = await import('../tools/task-management/create-project.js');
		const { TaskManagerAddTaskTool } = await import('../tools/task-management/add-task.js');
		
		assert.ok(TaskManagerCreateProjectTool);
		assert.ok(TaskManagerAddTaskTool);
	});

	it('task management tools have required properties', async () => {
		const { TaskManagerCreateProjectTool } = await import('../tools/task-management/create-project.js');
		const tool = new TaskManagerCreateProjectTool();
		
		assert.ok(tool.name);
		assert.ok(tool.description);
		assert.ok(typeof tool.execute === 'function');
		assert.ok(tool.inputSchema);
	});

	it('tools have consistent naming pattern', async () => {
		const { toolRegistry } = await import('../tools/registry.js');
		const tools = toolRegistry.getAll();
		
		const taskManagementTools = tools.filter(tool => 
			tool.name.startsWith('chonky-task-manager-')
		);
		
		assert.ok(taskManagementTools.length >= 8, 'Should have at least 8 task management tools');
		
		// All task management tools should follow naming convention
		for (const tool of taskManagementTools) {
			assert.ok(tool.name.startsWith('chonky-task-manager-'), 
				`Tool name should start with 'chonky-task-manager-': ${tool.name}`);
		}
	});

	it('createProject tool has correct schema structure', async () => {
		const { TaskManagerCreateProjectTool } = await import('../tools/task-management/create-project.js');
		const tool = new TaskManagerCreateProjectTool();
		
		assert.ok(tool.inputSchema.properties);
		assert.ok(tool.inputSchema.properties.name);
		assert.strictEqual(tool.inputSchema.required[0], 'name');
	});
});
