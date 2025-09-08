---
title: "Generate Scoping Report"
description: "Compile comprehensive scoping report with analysis data integration"
priority: "high"
dependencies: [9]
details: |
  **Step 4.1: Compile Comprehensive Scoping Report**
  1. **Load chonky-task-master task** "Generate Scoping Report"
  2. **Create subtasks for systematic report compilation** (task-driven report generation):

     **Create subtask** "Analysis Completeness Verification":
     - Verify all analysis tasks are complete in task manager
     - Confirm all architectural mapping finished in tasks
     - Check all complexity assessments completed in tasks
     - Update subtask with completeness verification results

     **Create subtask** "Analysis Data Gathering":
     - Load project classification from planning task notes
     - Extract metrics and architecture from analysis task notes
     - Collect actor and flow analysis from task notes
     - Compile complexity and risk assessments from task notes
     - Update subtask with gathered analysis data summary

     **Create subtask** "SCOPING_REPORT.md Generation":
     - Create SCOPING_REPORT.md file based on gathered task data
     - Populate all required sections with task-derived content
     - Ensure executive summary, technical overview, and recommendations are complete
     - Update subtask with report generation completion

     **Create subtask** "Task Persistence":
     - Add SCOPING_REPORT.md content as comprehensive task notes for persistence
     - Store all key findings and recommendations in task manager
     - Ensure task notes contain full scoping analysis for future reference
     - Update subtask with task persistence completion

  3. **SCOPING_REPORT.md structure** (populated from task analysis):

  ```markdown
  # Project Scoping Report

  ## Executive Summary
  - **Project Type**: [From project assessment task]
  - **Total Files**: [From file discovery tasks]
  - **Primary Language**: [From file discovery tasks]
  - **Complexity Assessment**: [From complexity analysis tasks]
  - **Estimated Audit Effort**: [From effort estimation tasks]

  ## Scope
  [Files in scope with NSLOC from metrics analysis tasks]

  ### Deployable Contracts
  [From deployable contracts analysis task]

  ## Technical Overview
  ### Architecture
  [From architecture analysis tasks]

  ### Key Components
  [From component mapping tasks]

  ### Dependencies
  [From integration analysis tasks]

  ## Security Scope
  ### Attack Surface
  [From attack surface identification tasks]

  ### Trust Relationships
  [From trust boundary analysis tasks]

  ### Typical Actors
  [From actor enumeration and capability tasks]
  - **Actor 1**: [From actor analysis tasks]
  - **Actor 2**: [From actor analysis tasks]
  - **Actor 3**: [From actor analysis tasks]

  ### User and Data Flows
  #### Key User Flows
  [From user flow mapping tasks]
  1. **Flow 1**: [From user flow analysis tasks]
  2. **Flow 2**: [From user flow analysis tasks]

  #### Data Flows
  [From data flow analysis tasks]
  1. **Flow 1**: [From data flow mapping tasks]
  2. **Flow 2**: [From data flow mapping tasks]

  ### Critical Security Areas
  [From risk area identification tasks]

  ## Audit Recommendations
  ### Methodology
  [From complexity and security analysis tasks]

  ### Focus Areas
  [From risk assessment tasks]

  ### Tool Recommendations
  [From technology analysis tasks]

  ## Complexity Assessment
  ### Factors Contributing to Complexity
  [From complexity analysis subtasks]

  ### Risk Areas
  [From risk identification tasks]

  ## Effort Estimation
  ### Baseline Metrics
  - **NSLOC**: [From metrics analysis tasks]
  - **Complexity Factor**: [From complexity assessment tasks]
  - **Estimated Audit Days**: [From effort estimation tasks]

  ### Resource Requirements
  [From complexity and effort estimation tasks]
  ```

  4. **Update main task** "Generate Scoping Report" with report compilation completion and task persistence confirmation

successCriteria: |
  - Analysis completeness verification completed with all tasks confirmed
  - Analysis data gathering completed with comprehensive data compilation
  - SCOPING_REPORT.md generated with all sections populated from task data
  - Task persistence completed with full analysis stored in task notes
---

# Generate Scoping Report

Compile comprehensive scoping report with systematic analysis data integration and complete task persistence.
