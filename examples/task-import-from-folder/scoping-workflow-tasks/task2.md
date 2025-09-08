---
title: "Create Scoping Plan"
description: "Develop comprehensive scoping strategy with tool selection and phase planning"
priority: "high"
dependencies: [1]
details: |
  **Step 1.1: Create Scoping Plan and Execute as Tasks**
  1. **Create chonky-task-master task** "Create Scoping Plan"
  2. **Assess project type** from available context and update task notes
  3. **Create subtasks for each analysis component** (never rely on documents for tracking):

     **Create subtask** "Project Assessment":
     - Determine project type (Solidity/MetaMask Snap/Multi-language)
     - Assess expected complexity (Low/Medium/High)
     - Identify target technology (Blockchain/Web3/Application)
     - Update subtask with assessment results

     **Create subtask** "Tool Strategy Planning":
     - Plan chonky-workspace-find_files usage for file discovery
     - Plan chonky-solidity-metrics-analyze_solidity_files_get_overview (if Solidity)
     - Plan chonky-metamask-snap-analysis (if MetaMask Snap)
     - Plan chonky-solidity-deployable-contracts (if Solidity)
     - Plan chonky-solidity-metrics-get_contract_call_graph (if complex Solidity)
     - Plan chonky-solidity-metrics-get_contract_inheritance_graph (if inheritance)
     - Update subtask with tool selection strategy

     **Create subtask** "Deliverables Planning":
     - Plan SCOPING_REPORT.md structure (comprehensive scope analysis)
     - Plan architecture overview approach
     - Plan complexity assessment methodology
     - Plan audit effort estimation approach
     - Update subtask with deliverables framework

  4. **Create corresponding tasks for all major scoping phases** based on assessment:
     - "File Discovery and Classification" (Phase 2.1)
     - "Architecture Analysis" (Phase 2.2)
     - "Technology Metrics Analysis" (Phase 3.1)
     - "Security Architecture Analysis" (Phase 3.2)
     - "Actor and Flow Analysis" (Phase 3.3)
     - "Complexity Assessment" (Phase 3.4)
     - "Generate Scoping Report" (Phase 4.1)
     - "Final Validation" (Phase 4.2)

  5. **Update main task** "Create Scoping Plan" with completion status and next phase readiness

successCriteria: |
  - Project type assessment completed and documented
  - Tool strategy plan created with specific tool selections
  - Deliverables framework established with clear structures
  - All major scoping phase tasks created with dependencies
  - Complete planning phase documented in task notes
  - Next phase readiness confirmed and documented
---

# Create Scoping Plan

Develop comprehensive scoping strategy including project assessment, tool selection, and systematic phase planning for complete codebase analysis.
