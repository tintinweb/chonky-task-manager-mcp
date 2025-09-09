# Chonky Task Manager MCP / VSCode Extension

**Task Management for AI Agents & Workflows** - A task management system with MCP server and VS Code extension for systematic workflow automation and agent-driven development.

> 🚀 Part of the [Super Chonky Tools](https://github.com/tintinweb/vscode-chonky) suite for AI agents

![Chonky Logo](https://github.com/tintinweb/chonky-task-manager-mcp/raw/master/vscode-extension/img/superchonky-tasks.png)


## Features

### Core Task Management
- **Project Organization** - Create and manage structured task projects
- **Task Dependencies** - Handle complex workflows with dependency tracking
- **Status Tracking** - Full lifecycle management (pending → in-progress → done → review)
- **Smart Recommendations** - AI-powered next task suggestions
- **Batch Operations** - Efficient bulk task creation and updates

### Workflow Automation
- **Agent Task Management** - Guide AI agents through systematic execution
- **Verification Enforcement** - Proof requirements prevent task skipping
- **Context Preservation** - Detailed progress tracking and notes
- **Dependency Management** - Ensure proper execution order
- **Import/Export** - Project backup, migration, and folder import

### Integration Options
- **MCP Server** - Direct integration with MCP-compatible clients
- **VS Code Extension** - Native Copilot integration with language model tools
- **JSON Export/Import** - Universal project portability

## Usage

### Workflow Automation
Chonky Tasks enables AI agents to autonomously manage and execute long-running projects by systematically working through tasks until all goals are achieved.

**Typical Workflow:**
1. **Agent creates project** from user's goals and requirements
2. **Agent breaks down work** into specific, actionable tasks with dependencies  
3. **Agent works autonomously** task-by-task, updating progress and status
4. **Agent tracks completion** with success criteria validation and detailed notes
5. **Agent continues iteratively** until all project goals are achieved

### Command Examples
- *"Create a chonky-tasks project and work through building my API with authentication step by step"*
- *"Set up a chonky-tasks workflow for this React dashboard and complete it autonomously"*
- *"Continue working on the chonky-tasks project until all tasks are done"*
- *"Take my project plan and execute it systematically using chonky-tasks management"*
- *"Import this project outline into chonky-tasks and work through each task until completion"*

**Granular Task Operations:**
- *"Add this as a task to the current chonky-tasks project"*
- *"Show me all pending tasks in the project"*
- *"Get the next task you should work on"*
- *"Mark task 3 as completed with proof of completion"*
- *"Update the current task status and add your progress notes"*

### Folder Import
Import structured task workflows from markdown files using `chonky-task-manager-import-folder`. Files should follow the naming pattern `task{id}.md` or `task{id}-{subtaskId}.md` with YAML frontmatter:

```yaml
---
title: "Task Title"
description: "Task description"
priority: "high|medium|low"
dependencies: [1, 2]  # Task IDs this depends on
---
Task details and success criteria...
```

**Example folder structure:**
```
project-tasks/
├── task1.md           # Main task 1
├── task1-1.md         # Subtask 1.1
├── task1-2.md         # Subtask 1.2
├── task2.md           # Main task 2
├── task3.md           # Main task 3
└── task3-1.md         # Subtask 3.1
```

See `examples/task-import-from-folder/` for a complete workflow example.

## Quick Start

### MCP Server
```bash
# Install and build locally
npm install && npm run build
npm start

# OR install globally via npm
npm install -g chonky-task-manager-mcp
chonky-task-manager-mcp stdio
```

### VS Code Extension
1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tintinweb.chonky-task-manager)
2. Or open the `vscode-extension` folder in VS Code and press F5 for development mode
3. Use Copilot chat with natural language task commands

## Integration

### MCP Client Configuration
```json
{
  "mcpServers": {
    "chonky-task-manager": {
      "command": "chonky-task-manager-mcp",
      "args": ["stdio"]
    }
  }
}
```

### VS Code Extension
The [extension](https://marketplace.visualstudio.com/items?itemName=tintinweb.chonky-task-manager) automatically integrates with GitHub Copilot, providing language model tools for natural task management through chat interactions.

https://github.com/user-attachments/assets/4eea8ad3-295f-4805-87f8-204474d8e559

## Available Tools

- `chonky-task-manager-create-project` - Initialize new task projects
- `chonky-task-manager-add-task` - Create individual tasks
- `chonky-task-manager-batch-add-tasks` - Bulk task creation
- `chonky-task-manager-list-tasks` - View project dashboard
- `chonky-task-manager-update-task` - Progress tracking
- `chonky-task-manager-next-task` - Smart task recommendations
- `chonky-task-manager-manage-dependencies` - Dependency management
- `chonky-task-manager-import-export` - Project backup/restore
- `chonky-task-manager-import-folder` - Bulk import from markdown

## Development

```bash
# MCP Server
npm run dev      # Development mode with rebuild
npm test         # Run test suite
npm run lint     # Code linting

# VS Code Extension  
cd vscode-extension
npm run compile  # Build extension
npm run watch    # Development mode
```

## Project Structure

- `/src` - MCP server source code
- `/vscode-extension` - VS Code extension with Copilot integration
- `/examples` - Task import examples and workflows
- `/build` - Compiled MCP server output

## License

Chonky Proprietary License
