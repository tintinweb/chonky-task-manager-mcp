---
title: "Technology Metrics Analysis"
description: "Execute technology-specific metrics analysis with comprehensive tool usage"
priority: "high"
dependencies: [5]
details: |
  **Step 3.1: Technology-Specific Metrics Analysis**
  **Load chonky-task-master main task** "Technology Metrics Analysis" and create technology-specific subtasks based on project type.

  **For Solidity Projects:**
  1. **Create subtask** "Solidity Metrics Analysis":
     - Run chonky-solidity-metrics-analyze_solidity_files_get_overview
     - Extract NSLOC, complexity metrics, and contract counts
     - Update subtask with comprehensive Solidity metrics

  2. **Create subtask** "Deployable Contracts Analysis":
     - Run chonky-solidity-deployable-contracts
     - Identify main deployment targets and their purposes
     - Update subtask with deployable contract analysis

  3. **Create subtask** "Contract Interaction Analysis":
     - Generate call graph with chonky-solidity-metrics-get_contract_call_graph
     - Analyze contract interaction complexity
     - Update subtask with interaction analysis results

  4. **Create subtask** "Inheritance Analysis" (if multiple contracts found):
     - Generate inheritance graph with chonky-solidity-metrics-get_contract_inheritance_graph
     - Map inheritance hierarchies and dependencies
     - Update subtask with inheritance analysis

  **For MetaMask Snaps:**
  1. **Create subtask** "Snap Configuration Analysis":
     - Run chonky-metamask-snap-analysis on project directory
     - Extract manifest security configuration details
     - Update subtask with snap configuration findings

  2. **Create subtask** "Permissions and Endowments Analysis":
     - Analyze manifest permissions and endowments
     - Assess permission model security implications
     - Update subtask with permission analysis results

  **For Other Technologies:**
  1. **Create subtask** "General Architecture Analysis":
     - Run chonky-solidity-contract-structure for architecture overview (if applicable)
     - Map component relationships and dependencies
     - Update subtask with general architecture findings

  2. **Update main task** "Technology Metrics Analysis" with technology-specific analysis completion status

successCriteria: |
  - Technology-specific analysis subtasks created based on project type
  - All relevant metrics analysis tools executed successfully
  - Comprehensive metrics data extracted and documented
  - Technology analysis completion confirmed and documented
---

# Technology Metrics Analysis

Execute comprehensive technology-specific metrics analysis with systematic tool usage based on identified project type.
