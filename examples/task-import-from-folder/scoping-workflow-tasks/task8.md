---
title: "Actor and Flow Analysis"
description: "Systematic actor enumeration and user/data flow mapping"
priority: "high"
dependencies: [7]
details: |
  **Step 3.3: Actor and Flow Analysis**
  1. **Load chonky-task-master task** "Actor and Flow Analysis"
  2. **Create subtasks for systematic actor and flow mapping** (all tracking via tasks):

     **Create subtask** "System Actor Enumeration":
     - Identify fully trusted actors (administrators, system contracts)
     - Identify semi-trusted actors (authenticated users, verified contracts)
     - Identify untrusted actors (anonymous users, external contracts)
     - Update subtask with complete actor enumeration

     **Create subtask** "Actor Capability Analysis":
     - Document capabilities and permissions for each actor type
     - Map actor access levels and restrictions
     - Identify actor-specific security requirements
     - Update subtask with actor capability mapping

     **Create subtask** "User Flow Mapping":
     - Map primary user interaction flows through the system
     - Document step-by-step user journey processes
     - Identify critical user flow decision points
     - Update subtask with comprehensive user flow analysis

     **Create subtask** "Data Flow Analysis":
     - Map how data moves through the system components
     - Document data transformation and validation points
     - Identify data storage and persistence patterns
     - Update subtask with data flow mapping results

  3. **Update main task** "Actor and Flow Analysis" with complete actor and flow understanding for audit scope definition

successCriteria: |
  - System actor enumeration completed with trust level classification
  - Actor capability analysis completed with permissions mapping
  - User flow mapping completed with step-by-step documentation
  - Data flow analysis completed with transformation points identified
  - Complete actor and flow understanding achieved for scope definition
---

# Actor and Flow Analysis

Execute systematic actor enumeration with capability analysis and comprehensive user/data flow mapping.
