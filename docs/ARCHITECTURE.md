# 🏗️ Architecture & Data Flow: API State Factory

This document details the architectural layers, data synchronization paths, caching mechanisms, invalidation models, and type systems behind **API State Factory**.

---

## 1. Traditional Redux vs. API State Factory

```
TRADITIONAL REDUX API FLOW
(Repeated for EACH endpoint: ~150 lines)

┌─────────────────────────────────────────────┐
│  1. Types & Interfaces (Request/Response)   │
├─────────────────────────────────────────────┤
│  2. Async Thunk (Fetch logic & error catch) │
├─────────────────────────────────────────────┤
│  3. Redux Slice (Reducers & State slices)   │
├─────────────────────────────────────────────┤
│  4. Selectors (Select data/loading/errors)  │
├─────────────────────────────────────────────┤
│  5. Custom Hooks (Dispatchers & Selectors)   │
└─────────────────────────────────────────────┘

Result: Heavy boilerplate, high maintenance, easy to copy-paste bugs.
```

```
API STATE FACTORY FLOW
(Configured once in a single object: 1 line)

┌─────────────────────────────────────────────┐
│  Single Endpoint Route String               │
│  e.g., getUsers: 'GET /users'               │
└──────────────────────┬──────────────────────┘
                       │
                       ▼  (Auto-Generates)
┌─────────────────────────────────────────────┐
│  ✓ Redux Slice       ✓ Selectors            │
│  ✓ Async Thunk       ✓ React Hook           │
│  ✓ TS Type Safety    ✓ Multi-Slot Cache     │
└─────────────────────────────────────────────┘

Result: Zero boilerplate, centralized maintenance, clean developer experience.
```

---

## 2. Structural Layer Architecture

API State Factory is decoupled into modular layers to ensure clean tree-shaking and separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Component A │  │  Component B │  │  Component C │      │
│  │              │  │              │  │              │      │
│  │ useGetUsers()│  │ useGetUser() │  │ useCreateUser│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    REACT HOOKS LAYER                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Generated hooks (hooks-factory.ts)                │     │
│  │  - Component mounting lifecycle subscription       │     │
│  │  - Auto-fetch triggers on change                   │     │
│  │  - Exposes states (loading, error, refreshing)      │     │
│  └────────────────┬───────────────────────────────────┘     │
└───────────────────┼─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    REDUX LAYER                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Generated slices (slice-factory.ts)               │     │
│  │  - Redux reducers / actions                        │     │
│  │  - Async Thunk executions                          │     │
│  └────────────────┬───────────────────────────────────┘     │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐     │
│  │  Redux Store                                       │     │
│  │  ┌──────────────────────────────────────────┐     │     │
│  │  │  State Tree Structure                    │     │     │
│  │  │  {                                       │     │     │
│  │  │    users: {                              │     │     │
│  │  │      getUsers: { data, loading, error }  │     │     │
│  │  │      getUser: {                          │     │     │
│  │  │        '{"id":"1"}': { data, ... }       │     │     │
│  │  │        '{"id":"2"}': { data, ... }       │     │     │
│  │  │      }                                   │     │     │
│  │  │    }                                     │     │     │
│  │  │  }                                       │     │     │
│  │  └──────────────────────────────────────────┘     │     │
│  └────────────────┬───────────────────────────────────┘     │
└───────────────────┼─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    NETWORK LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  HTTP Client (axios / fetch wrapper)               │     │
│  │  - Request interceptors (Headers)                  │     │
│  │  - Response interceptors                           │     │
│  │  - Retry / Backoff loops                           │     │
│  └────────────────┬───────────────────────────────────┘     │
└───────────────────┼─────────────────────────────────────────┘
                    │
                    ▼
              ┌──────────┐
              │ REST API │
              └──────────┘
```

---

## 3. Data Flow Cycle

### Query (GET) Request Lifecycle
Queries check caches before requesting resources. If cached content exists, it is returned instantly while a background refresh can run silently:

```
Component Mount
      │
      ▼
┌─────────────────┐
│ useGetUser({id})│ ← Hook is called with params
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Check Local Cache       │
│ Is data already loaded? │
└────┬────────────────┬───┘
     │ YES            │ NO
     │                │
     ▼                ▼
┌─────────┐    ┌──────────────┐
│ Return  │    │ Dispatch     │
│ Cached  │    │ Thunk        │
│ Data    │    └──────┬───────┘
└─────────┘           │
                      ▼
               ┌──────────────────┐
               │ Set loading=true │
               └──────┬───────────┘
                      │
                      ▼
               ┌──────────────────┐
               │ Make HTTP Call   │
               └──────┬───────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
     ┌─────────┐             ┌──────────┐
     │ SUCCESS │             │  ERROR   │
     └────┬────┘             └────┬─────┘
          │                       │
          ▼                       ▼
 ┌──────────────────┐    ┌──────────────────┐
 │ Update Cache     │    │ Save Error       │
 │ Set loading=false│    │ Set loading=false│
 └────┬─────────────┘    └────┬─────────────┘
      │                       │
      └──────────┬────────────┘
                 ▼
         ┌──────────────┐
         │ Component    │
         │ Re-renders   │
         └──────────────┘
```

### Mutation (POST/PUT/DELETE) Lifecycle & Invalidation
Mutations modify server data, then use a declarative invalidation graph to flag dependent cache queries as stale, prompting components to auto-update:

```
User Action Trigger
      │
      ▼
┌────────────────────┐
│ Call mutation hook │
│ deleteUser({id:1}) │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Dispatch Thunk     │
│ Set loading=true   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Make HTTP Call     │
│ DELETE /users/1    │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ API Call SUCCESS   │
└────────┬───────────┘
         │
         ▼
┌───────────────────────────────┐
│ Read 'invalidates' definition │
│ eg. ['getUsers', 'getUser']   │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ Dispatch Invalidation Actions │
│ Mark caches as stale          │
└────────┬──────────────────────┘
         │
         ├───────────────────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ Component using  │    │ Component using  │
│ useGetUsers()    │    │ useGetUser(1)    │
│ auto-refetches   │    │ auto-refetches   │
└──────────────────┘    └──────────────────┘
```

---

## 4. Parameterized Caching (Multi-Slot Storage)

Standard Redux slice implementations typically store only a single data object per endpoint, causing data to overwrite when users toggle between items.

### Single-Slot (Overwriting) Cache
```
State:
{
  getUser: {
    data: { id: 1, name: "Alice" },
    loading: false
  }
}

Problem: Loading user 2 overwrites Alice. Switching back to Alice triggers another fetch.
```

### Parameterized Multi-Slot Cache
API State Factory partition caches based on parameter signatures, maintaining history slots across page toggles:

```
State:
{
  getUser: {
    '{"id":"1"}': {
      data: { id: 1, name: "Alice" },
      loading: false
    },
    '{"id":"2"}': {
      data: { id: 2, name: "Bob" },
      loading: false
    }
  }
}

Benefit: Switching between user 1 and user 2 is instant since both slots remain in state.
```

### Deterministic Serialization
To prevent query order disparities from generating duplicate cache entries (e.g. `{ id: 1, type: 'admin' }` vs `{ type: 'admin', id: 1 }`), cache keys are generated using deterministic sorting:

```
Parameters: { type: "admin", id: "123" }
      │
      ▼
Sort keys alphabetically: { id: "123", type: "admin" }
      │
      ▼
Serialize with JSON: '{"id":"123","type":"admin"}'
      │
      ▼
Used as unique key index in Redux state tree
```

---

## 5. Dual Loading State Machine

The library implements a dual-boolean loading model (`loading` vs `isRefreshing`) to ensure background sync updates don't wipe active screen structures, preventing visual layout shifts.

- **`loading`**: Evaluates to `true` **only** during the initial mount query, allowing components to safely render skeleton shimmer views.
- **`isRefreshing`**: Evaluates to `true` during background updates (e.g., refetch/invalidation) while the screen continues to show the existing cached database records.

```
                  ┌───────────────────┐
                  │   Initial State   │
                  │   loading: false  │
                  │ refreshing: false │
                  └─────────┬─────────┘
                            │
                            │ First query fires
                            ▼
                  ┌───────────────────┐
                  │    First Load     │
                  │   loading: true   │
                  │ refreshing: false │
                  └─────────┬─────────┘
                            │
                            │ Response received
                            ▼
                  ┌───────────────────┐
                  │   Cache Loaded    │
                  │   loading: false  │
                  │ refreshing: false │
                  └─────────┬─────────┘
                            │
                            │ Invalidation / Refetch triggered
                            ▼
                  ┌───────────────────┐
                  │    Refreshing     │
                  │   loading: false  │
                  │ refreshing: true  │
                  └───────────────────┘
```

---

## 6. Compile-Time Type Inference Flow

Using template literal types, endpoint route path strings are processed to generate compile-time constraints:

```
Endpoint Definition:
getGroupUser: 'GET /groups/:groupId/users/:userId'
      │
      ▼ (Template Literal Type Analysis)
Parsing parameters from path string structure
      │
      ▼
Generated Interface:
{ groupId: string; userId: string }
      │
      ▼ (Generic Constraints mapping)
Generated Hook Signature:
useGetGroupUser(params: { groupId: string; userId: string })
```
If developers call `useGetGroupUser` with incorrect key variables or missing properties, compiler warnings occur at build time.
