# Chonky Tasks - VSCode Extension

A simple task management extension for VSCode that integrates with GitHub Copilot through built-in language model tools.

> 🚀 Part of the [Super Chonky Tools](https://github.com/tintinweb/vscode-chonky) suite for AI agents

![Chonky Logo](https://github.com/tintinweb/chonky-task-manager-mcp/raw/master/vscode-extension/img/superchonky-tasks.png)

## Features

- **Simple Task Management**: Create, update, and track tasks directly through Copilot chat
- **Project Organization**: Organize tasks by projects with dependencies and priorities
- **Copilot Integration**: Native language model tools for seamless interaction
- **Task Dependencies**: Manage complex workflows with task dependencies
- **Status Tracking**: Track task progress with multiple status states
- **Batch Operations**: Create multiple tasks efficiently
- **Import/Export**: Backup and restore projects as JSON files
- **Folder Import**: Import tasks from markdown files

## Installation

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tintinweb.chonky-task-manager)
2. The extension will automatically activate when you start using Copilot

## Usage

### Workflow Automation & Agent Task Management

Chonky Tasks enables AI agents to autonomously manage and execute long-running projects by systematically working through tasks until all goals are achieved.

**Typical Workflow:**
1. **Agent creates project** from user's goals and requirements
2. **Agent breaks down work** into specific, actionable tasks with dependencies  
3. **Agent works autonomously** task-by-task, updating progress and status
4. **Agent tracks completion** with success criteria validation and detailed notes
5. **Agent continues iteratively** until all project goals are achieved

### Basic Commands

Use GitHub Copilot chat with natural language commands:

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

### Advanced Workflow Management

**Creating Structured Workflows:**
```
"Create a project for API development. Break it into tasks:
1. Design API schema (no dependencies)
2. Implement authentication (depends on schema)
3. Create endpoints (depends on auth)
4. Write tests (depends on endpoints)
5. Deploy to staging (depends on tests)
Each task should have clear success criteria and proof requirements."
```

**Agent-Driven Development:**
- Tasks include **success criteria** that must be met before completion
- **Proof requirements** force agents to demonstrate actual completion
- **Dependencies** ensure proper execution order
- **Context preservation** through task updates keeps agents aligned
- **Progress tracking** prevents work from being lost or repeated

### Bulk Import from Folders
Import structured workflows from markdown files with *"Import tasks from folder /path/to/tasks"*. Files should follow naming pattern `task{id}.md` or `task{id}-{subtaskId}.md`:

```
project-tasks/
├── task1.md           # Main task 1
├── task1-1.md         # Subtask 1.1
├── task2.md           # Main task 2
└── task3.md           # Main task 3
```

Each file needs YAML frontmatter with `title`, `description`, `priority`, and `dependencies`.

## Available Tools

This extension provides simple task management tools that work with VSCode's language model interface:

- **Create Project**: Initialize new task projects
- **Add Task**: Create individual tasks with details
- **Batch Add Tasks**: Create multiple tasks at once
- **List Tasks**: View and filter tasks by status
- **Update Task**: Modify task status and add notes
- **Get Task**: View detailed task information
- **Next Task**: Get recommendations for next steps
- **Manage Dependencies**: Set task dependencies
- **Import/Export**: Backup and restore data

## Development

```bash
# Build the extension
npm run compile

# Build for production
npm run compile:prod

# Watch mode for development
npm run watch

# Run tests
npm run test
```

## License

Chonky Proprietary License

## Support

For issues and feature requests, please visit our [GitHub repository](https://github.com/tintinweb/vscode-chonky-tasks).
