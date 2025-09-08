---
title: "File Discovery and Classification"
description: "Comprehensive file discovery with systematic classification and prioritization"
priority: "high"
dependencies: [3]
details: |
  **Step 2.1: Comprehensive File Discovery**
  1. **Load chonky-task-master task** "File Discovery and Classification"
  2. **Create subtasks for systematic discovery** (never use documents for tracking):

     **Create subtask** "Solidity File Discovery":
     - Use chonky-workspace-find_files with `**/*.sol` pattern
     - Exclude tests, scripts, interfaces from scope
     - Count and classify discovered Solidity files
     - Update subtask with Solidity file results

     **Create subtask** "JavaScript/TypeScript File Discovery":
     - Use chonky-workspace-find_files with `**/*.{js,ts,jsx,tsx}` pattern
     - Identify relevant application files vs dependencies
     - Count and classify discovered JS/TS files
     - Update subtask with JS/TS file results

     **Create subtask** "MetaMask Snap Detection":
     - Search for snap.manifest.json files
     - Identify snap configuration and structure
     - Update subtask with snap detection results

     **Create subtask** "Configuration File Discovery":
     - Identify package.json, hardhat.config, foundry.toml, etc.
     - Discover build and deployment configurations
     - Update subtask with configuration file analysis

  3. **Create subtask "File Classification and Prioritization"**:
     - Classify all discovered files by type and importance
     - Prioritize files for analysis based on security relevance
     - Generate file counts and category breakdown
     - Update subtask with comprehensive classification results

  4. **Update main task** "File Discovery and Classification" with discovery summary and next phase readiness

successCriteria: |
  - All file discovery subtasks completed with comprehensive results
  - File classification and prioritization completed systematically
  - File counts and category breakdown documented
  - Discovery summary compiled and next phase readiness confirmed
---

# File Discovery and Classification

Execute comprehensive file discovery across all file types with systematic classification and security-relevance prioritization.
