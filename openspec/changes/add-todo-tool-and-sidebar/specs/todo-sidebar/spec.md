# Spec Delta

## Purpose

Shows the viewed session's todo list in the TUI's right sidebar so the user can see the agent's plan and progress at a glance.

## ADDED Requirements

### Requirement: Sidebar shows the viewed session's todos
When the sidebar is visible for a session that has todos, the TUI SHALL show a "Todos" section in the sidebar content area listing that session's items in stored order.

#### Scenario: Session with todos
- **WHEN** the user views session S, which has items A, B, C
- **THEN** the sidebar shows a "Todos" section listing A, B, C in that order

#### Scenario: Switching sessions
- **WHEN** the user switches from session S to session T
- **THEN** the section shows T's todos, not S's

### Requirement: Sidebar shows only the viewed session
The section SHALL show only the viewed session's own list. It SHALL NOT merge in todos from child or parent sessions.

#### Scenario: Parent with active subagent
- **WHEN** the user views parent session P and a subagent in child session C has written todos
- **THEN** the section shows only P's todos

### Requirement: Status is visually distinct
Each item SHALL show a status marker that differs for `not_started`, `in_progress`, and `completed`, using theme colors. `in_progress` SHALL be emphasized and `completed` SHALL be de-emphasized. The section header SHALL show the completed count over the total.

#### Scenario: Mixed statuses
- **WHEN** S has A (`completed`), B (`in_progress`), C (`not_started`)
- **THEN** each item shows a different marker
- **AND** the header shows `1/3`

### Requirement: Live updates
The section SHALL update without user action when the viewed session's list changes.

#### Scenario: Agent updates a status
- **WHEN** the user is viewing S and the agent changes item B to `completed`
- **THEN** the sidebar shows B as completed without the user refreshing or switching sessions

### Requirement: Hidden when empty
The section SHALL NOT render when the viewed session has no todos.

#### Scenario: No todos
- **WHEN** the user views a session with no todos
- **THEN** no "Todos" section appears in the sidebar

#### Scenario: List cleared
- **WHEN** the agent clears S's list while the user is viewing S
- **THEN** the "Todos" section disappears

### Requirement: Current state on open
When the user opens a session or the TUI starts, the section SHALL show the session's stored list, including changes made while the TUI was not watching.

#### Scenario: Reopen after restart
- **WHEN** S has a list and the user starts the TUI and opens S
- **THEN** the section shows S's stored list

### Requirement: Long content does not break layout
Item text longer than the sidebar width SHALL wrap or truncate within the sidebar and SHALL NOT overflow into other UI areas.

#### Scenario: Long item
- **WHEN** an item's content is longer than the sidebar is wide
- **THEN** it stays inside the sidebar
