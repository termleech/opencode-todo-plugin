# Spec Delta

## Purpose

Lets an agent record an ordered plan for its current session as a todo list, update each item's status as work progresses, and lets clients read and observe that list.

## ADDED Requirements

### Requirement: Todo item shape
A todo item SHALL have a non-empty `content` string and a `status` that is exactly one of `not_started`, `in_progress`, or `completed`. A todo list SHALL be an ordered array of items, and its order SHALL be the order the agent supplied.

#### Scenario: Valid item
- **WHEN** an item is `{ "content": "Write tests", "status": "in_progress" }`
- **THEN** it is accepted as a todo item

#### Scenario: Unknown status
- **WHEN** an item has `status` set to `"done"`
- **THEN** it is rejected as invalid

#### Scenario: Blank content
- **WHEN** an item has `content` that is empty or only whitespace
- **THEN** it is rejected as invalid

### Requirement: Todo list size limits
A todo list SHALL contain at most 100 items, and each item's trimmed `content` SHALL be at most 500 characters.

#### Scenario: Too many items
- **WHEN** a write contains 101 items
- **THEN** it is rejected as invalid

#### Scenario: Content too long
- **WHEN** an item's trimmed content is 501 characters
- **THEN** it is rejected as invalid

### Requirement: Agent replaces the session todo list
The plugin SHALL provide a `todowrite` tool that takes `{ todos: TodoItem[] }` and replaces the calling session's entire list with `todos`, preserving their order. An empty array SHALL clear the list.

#### Scenario: First write
- **WHEN** an agent in session S calls `todowrite` with three items and S has no list
- **THEN** S's list becomes those three items in the given order

#### Scenario: Status update by rewrite
- **WHEN** S has items A (`in_progress`) and B (`not_started`) and the agent calls `todowrite` with A (`completed`) and B (`in_progress`)
- **THEN** S's list is A (`completed`), B (`in_progress`)

#### Scenario: Reorder
- **WHEN** the agent calls `todowrite` with the same items in a different order
- **THEN** S's list reflects the new order

#### Scenario: Clear
- **WHEN** the agent calls `todowrite` with `todos: []`
- **THEN** S has no todos

### Requirement: Invalid writes leave the list unchanged
If any item in a `todowrite` call is invalid, the tool SHALL return an error that names the invalid item's index and reason, and SHALL NOT change the stored list.

#### Scenario: One bad item
- **WHEN** S has a stored list and the agent calls `todowrite` where item 2 has `status: "blocked"`
- **THEN** the tool returns an error identifying item 2 and the allowed statuses
- **AND** S's stored list is unchanged

### Requirement: Write result reports the stored list
A successful `todowrite` SHALL return the stored list to the agent as text, one item per line in order with its status, followed by a count of items per status.

#### Scenario: Result content
- **WHEN** the agent writes A (`completed`), B (`in_progress`), C (`not_started`)
- **THEN** the result lists A, B, C in order with their statuses
- **AND** reports 1 completed, 1 in progress, 1 not started

### Requirement: Agent reads the session todo list
The plugin SHALL provide a `todoread` tool that takes no input and returns the calling session's current list in the same format as a successful `todowrite` result, or a message stating the list is empty.

#### Scenario: Read existing list
- **WHEN** S has two items and the agent calls `todoread`
- **THEN** the result lists both items in stored order with their statuses

#### Scenario: Read empty list
- **WHEN** S has no todos and the agent calls `todoread`
- **THEN** the result states that there are no todos

### Requirement: Lists are scoped to one session
Each session SHALL have its own list. A tool call SHALL read and write only the list of the session that made the call. A child (subagent) session SHALL have a list separate from its parent's.

#### Scenario: Two sessions
- **WHEN** session S writes a list and session T calls `todoread`
- **THEN** T sees no todos

#### Scenario: Subagent session
- **WHEN** a subagent running in child session C calls `todowrite`
- **THEN** C's list changes and the parent session's list does not

### Requirement: Lists persist across restarts
A session's stored list SHALL survive plugin reloads and OpenCode service restarts.

#### Scenario: Service restart
- **WHEN** S has a list and the OpenCode service restarts
- **THEN** `todoread` in S returns the same list

### Requirement: Clients can read a session's list
The plugin SHALL expose an RPC method that takes a session ID and returns that session's current list, returning an empty list for a session with no todos.

#### Scenario: Read via RPC
- **WHEN** a client calls the list method for session S, which has two items
- **THEN** it receives both items in stored order

#### Scenario: Unknown session
- **WHEN** a client calls the list method for a session with no stored list
- **THEN** it receives an empty list

### Requirement: Clients are notified of changes
After every successful `todowrite`, the plugin SHALL emit an RPC event containing the session ID and the full new list.

#### Scenario: Event on write
- **WHEN** the agent in S successfully calls `todowrite`
- **THEN** subscribers receive an event with S's ID and the new list

#### Scenario: No event on failed write
- **WHEN** a `todowrite` call is rejected as invalid
- **THEN** no event is emitted
