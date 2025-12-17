# Requirements Extraction Instructions

## Overview

Extract and structure business and technical requirements from JIRA story tickets and solution design subtasks. Write structured output to separate markdown files matching the existing documentation format.

## Output Files

1. **outputs/business_requirements.md** - Business requirements extracted from story ticket
2. **outputs/technical_requirements.md** - Technical requirements extracted from solution design subtasks

## Business Requirements Structure

Follow the structure of `docs/business-requirements.md`:

```markdown
# Business Requirements Specification

## 1. Executive Summary
[High-level overview of the project/product]

## 2. Target Audience
*   **Role 1:** Description of needs
*   **Role 2:** Description of needs

## 3. Key Business Goals
1.  **Goal 1:** Description
2.  **Goal 2:** Description

## 4. User Stories

### 4.1. [Category Name]
*   **US-1:** As a [role], I want [action] so that [benefit].
*   **US-2:** As a [role], I want [action] so that [benefit].

### 4.2. [Category Name]
[More user stories...]

## 5. Success Metrics
*   **Metric 1:** Description
*   **Metric 2:** Description
```

## Technical Requirements Structure

Follow the structure of `docs/technical-requirements.md`:

```markdown
# Technical Requirements Specification

## 1. System Overview
[High-level technical description]

## 2. Technology Stack
*   **Runtime:** [runtime]
*   **Language:** [language]
*   **Package Manager:** [package manager]
*   **Testing:** [testing framework]
*   **Linting/Formatting:** [tools]

## 3. Architecture Components

### 3.1. [Component Name]
*   **Sub-component 1:** Description
*   **Sub-component 2:** Description

### 3.2. [Component Name]
[More components...]

## 4. [Additional Sections]
[Implementation details, scenarios, etc.]

## 5. Security & Performance
*   **Security:** Requirements
*   **Performance:** Requirements

## 6. Key Architectural Decisions
*   **Decision 1:** Rationale
*   **Decision 2:** Rationale
```

## Extraction Guidelines

### From Story Ticket

Extract:
- User stories and acceptance criteria
- Business goals and objectives
- Target audience and stakeholders
- Success metrics and KPIs
- Business rules and constraints
- Executive summary

**DO NOT** extract:
- Technical implementation details
- Architecture decisions
- Technology choices
- Code-related information

### From Solution Design Subtasks

Extract:
- Technical architecture and components
- Technology stack and tools
- Implementation approach and patterns
- Technical constraints and dependencies
- Performance and security requirements
- Architectural decisions

**DO NOT** extract:
- Business goals
- User stories
- Business metrics
- Stakeholder information

## Separation Rules

- **Business Requirements** = What the system should do from a business perspective
- **Technical Requirements** = How the system should be built from a technical perspective

Keep them completely separate. Technical requirements should reference business requirements when needed, but not duplicate them.

## Formatting

- Use proper markdown formatting
- Use consistent heading levels
- Use bullet points for lists
- Use numbered lists for ordered items
- Preserve code blocks and technical diagrams if present
- Use JIRA markdown format when appropriate


