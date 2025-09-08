import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate } from '../extension';
import { UniversalMCPToolWrapper, registerAllMCPTools } from '../features/copilot/tools/mcp-tools';

suite('Extension Test Suite', () => {

	test('Extension activates successfully', () => {
		const mockContext = {
			subscriptions: [],
			globalState: {},
			workspaceState: {}
		} as unknown as vscode.ExtensionContext;

		// Should not throw
		assert.doesNotThrow(() => {
			activate(mockContext);
		});
	});

	test('registerAllMCPTools completes without errors', async () => {
		const mockContext = {
			subscriptions: [],
			globalState: {},
			workspaceState: {}
		} as unknown as vscode.ExtensionContext;

		// Should not throw
		await assert.doesNotReject(async () => {
			await registerAllMCPTools(mockContext);
		});
	});

	test('UniversalMCPToolWrapper creates successfully', () => {
		const mockTool = {
			execute: () => Promise.resolve({ result: 'test result' })
		};

		const wrapper = new UniversalMCPToolWrapper('test-tool', mockTool, 'Test tool');
		
		assert.ok(wrapper);
		assert.ok(typeof wrapper.invoke === 'function');
		assert.ok(typeof wrapper.prepareInvocation === 'function');
	});

	test('UniversalMCPToolWrapper executes tool correctly', async () => {
		const mockTool = {
			execute: async () => ({ result: 'test result' })
		};

		const wrapper = new UniversalMCPToolWrapper('test-tool', mockTool, 'Test tool');
		
		const options = {
			input: { param: 'value' }
		} as vscode.LanguageModelToolInvocationOptions<any>;

		const token = { isCancellationRequested: false } as vscode.CancellationToken;
		const result = await wrapper.invoke(options, token);
		
		assert.ok(result instanceof vscode.LanguageModelToolResult);
		assert.ok(result.content.length > 0);
	});

	test('UniversalMCPToolWrapper handles errors gracefully', async () => {
		const mockTool = {
			execute: async () => { throw new Error('Tool error'); }
		};

		const wrapper = new UniversalMCPToolWrapper('test-tool', mockTool, 'Test tool');
		
		const options = {
			input: {}
		} as vscode.LanguageModelToolInvocationOptions<any>;

		const token = { isCancellationRequested: false } as vscode.CancellationToken;
		const result = await wrapper.invoke(options, token);
		
		assert.ok(result instanceof vscode.LanguageModelToolResult);
		// Should contain error message
		const content = result.content[0] as vscode.LanguageModelTextPart;
		assert.ok(content.value.includes('Error executing test-tool'));
	});

	test('prepareInvocation returns correct message', async () => {
		const mockTool = { execute: () => Promise.resolve({}) };
		const wrapper = new UniversalMCPToolWrapper('test-tool', mockTool, 'Test description');
		
		const options = {} as vscode.LanguageModelToolInvocationPrepareOptions<any>;
		const token = { isCancellationRequested: false } as vscode.CancellationToken;
		const result = await wrapper.prepareInvocation(options, token);
		
		assert.strictEqual(result.invocationMessage, '📋 Chonky: test-tool - Test description');
	});
});
