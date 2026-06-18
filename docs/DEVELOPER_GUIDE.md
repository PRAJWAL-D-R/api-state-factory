# 📘 Developer Guide: API State Factory

This comprehensive guide covers how to install, configure, and use **API State Factory** to manage API state in your React-Redux applications with zero boilerplate, full type safety, and optimized caching.

---

## 📋 Table of Contents
1. [Installation & Requirements](#1-installation--requirements)
2. [Defining APIs & Endpoints](#2-defining-apis--endpoints)
3. [Configuring the Redux Store](#3-configuring-the-redux-store)
4. [Global Configurations & Interceptors](#4-global-configurations--interceptors)
5. [Using React Hooks in Components](#5-using-react-hooks-in-components)
6. [Advanced Use Cases](#6-advanced-use-cases)
   - [Direct Thunk Access (Service Layer)](#direct-thunk-access-service-layer)
   - [Optimistic Updates](#optimistic-updates)
   - [List Merging / Infinite Scroll](#list-merging--infinite-scroll)
   - [Request Cancellation](#request-cancellation)
7. [Testing Strategy](#7-testing-strategy)
8. [Scaling Large Projects (100+ Endpoints)](#8-scaling-large-projects-100-endpoints)

---

## 1. Installation & Requirements

To add the package to your project:

```bash
npm install api-state-factory
```

### Peer Dependencies
To maintain a lightweight footprint and prevent version conflicts, the library expects the following peer dependencies in your project:
- **React**: `18.0.0` or higher
- **Redux Toolkit**: `2.0.0` or higher
- **React-Redux**: `9.0.0` or higher

---

## 2. Defining APIs & Endpoints

Centralize your API services using `defineApi` and the `endpoint` builder utilities.

```typescript
import { defineApi, endpoint } from 'api-state-factory';

export const userApi = defineApi({
  name: 'users',
  baseUrl: 'https://api.example.com/v1',
  endpoints: {
    // Simple GET shorthand
    getUsers: 'GET /users',
    
    // GET with dynamic path parameters
    getUser: 'GET /users/:id',
    
    // POST request with invalidation behavior
    createUser: endpoint.post('/users', {
      invalidates: ['getUsers'], // Auto-refetches getUsers when this succeeds
    }),
    
    // DELETE request with auto-retry on glitches
    deleteUser: endpoint.delete('/users/:id', {
      invalidates: ['getUsers'],
      retry: 2, // Retries failed calls up to two times
    }),
    
    // PUT request invalidating both detail and list
    updateUser: endpoint.put('/users/:id', {
      invalidates: ['getUsers', 'getUser'],
    }),
  },
});
```

### Path Parameter Parsing
Path parameters (like `:id` in `/users/:id`) are parsed dynamically. The library automatically generates type requirements for these parameters so that hooks and thunks require them when called.

---

## 3. Configuring the Redux Store

There are two primary ways to set up the Redux store with API State Factory, depending on whether you are creating a new store or integrating into an existing codebase.

### Option A: Creating a New Store (The 1-Line Way)
Use `createApiStore` to automatically bundle the slices and configure the middleware:

```typescript
import { createApiStore } from 'api-state-factory';
import { userApi } from './api/userApi';

export const store = createApiStore({
  apis: [userApi], // Registers all defined APIs
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Option B: Integrating with an Existing Store
If you already have a configured Redux store, register it with `registerStore` so that the library can hook into dispatch triggers:

```typescript
import { configureStore } from '@reduxjs/store';
import { registerStore } from 'api-state-factory';
import { userApi } from './api/userApi';
import yourExistingReducer from './reducers';

export const store = configureStore({
  reducer: {
    existing: yourExistingReducer,
    [userApi.name]: userApi.reducer, // Mount generated slice reducer
  },
});

// Call this once during application initialization
registerStore(store);
```

---

## 4. Global Configurations & Interceptors

Set up headers and centralize error catching globally (e.g., authorization token rotation, 401 redirect to login) using `setGlobalConfig`:

```typescript
import { setGlobalConfig } from 'api-state-factory';

setGlobalConfig({
  // Dynamically attach headers for every request
  headers: () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  }),
  
  // Intercept and handle response errors globally
  onError: (error, context) => {
    // context contains metadata like the endpoint name and parameters used
    if (error.status === 401) {
      // Handle unauthorized session expiration
      window.location.href = '/login';
    } else if (error.status === 403) {
      console.error(`Access denied to endpoint: ${context.endpointName}`);
    } else if (error.status >= 500) {
      // Send critical errors to monitoring services
      // Sentry.captureException(error);
    }
  },
});
```

---

## 5. Using React Hooks in Components

For every endpoint defined, API State Factory automatically generates custom hooks. 

### GET Requests (Queries)
Query hooks execute automatically on component mount and reactively update whenever parameters change:

```tsx
import React from 'react';
import { userApi } from './api/userApi';

function UserProfile({ userId }: { userId: string }) {
  // Parameterized caching ensures that switching userId is instant if already cached!
  const { data: user, loading, error, isRefreshing, refetch } = userApi.useGetUser({ id: userId });

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Failed to load profile: {error.message}</div>;

  return (
    <div>
      {isRefreshing && <div className="spinner">Updating cache...</div>}
      <h2>{user?.name}</h2>
      <p>Email: {user?.email}</p>
      <button onClick={refetch}>Force Refresh</button>
    </div>
  );
}
```

### POST/PUT/DELETE Requests (Mutations)
Mutation hooks return a tuple containing the mutate function and the current mutation state:

```tsx
import React, { useState } from 'react';
import { userApi } from './api/userApi';

function CreateUserButton() {
  const [name, setName] = useState('');
  const [createUser, { loading, error }] = userApi.useCreateUser();

  const handleCreate = async () => {
    const response = await createUser({
      body: { name },
    });
    
    if (response.success) {
      setName('');
      // getUsers will automatically refresh due to invalidation config
    }
  };

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

---

## 6. Advanced Use Cases

### Direct Thunk Access (Service Layer)
If you need to fetch data outside of React (e.g., inside other Redux thunks, routers, middleware, or background service tasks), use the direct thunk access:

```typescript
import { store } from './store';
import { userApi } from './api/userApi';

async function fetchUsersOnAppInit() {
  const result = await store.dispatch(userApi.thunks.getUsers());
  if (userApi.thunks.getUsers.fulfilled.match(result)) {
    console.log('Loaded users:', result.payload);
  } else {
    console.error('Failed to load initial users:', result.error);
  }
}
```

### Optimistic Updates
Optimistic updates make your UI feel instant by mutating local state caches before the server response returns, with automatic rollback if the request fails.

```typescript
const [updateUser] = userApi.useUpdateUser({
  onOptimisticUpdate: (params) => {
    // Mutate the local cache slice with mock data
    return { id: params.id, ...params.body };
  },
  onError: (error, rollback) => {
    // Rollback cached state to original values on failure
    rollback();
  }
});
```

### List Merging / Infinite Scroll
For lists that append data as the user scrolls, set `merge: true` in the endpoint configuration. The library automatically appends incoming arrays instead of replacing the cache:

```typescript
export const feedApi = defineApi({
  name: 'feed',
  baseUrl: 'https://api.example.com',
  endpoints: {
    // Merges new pages automatically into single array state
    getFeed: endpoint.get('/feed', { merge: true }),
  },
});
```

### Request Cancellation
Cancel pending HTTP requests when components unmount or parameters change to conserve client resources:

```typescript
import React, { useEffect } from 'react';
import { userApi } from './api/userApi';

function SearchResults({ query }: { query: string }) {
  const { data, abort } = userApi.useSearchUsers({ q: query });

  useEffect(() => {
    // Cancel any ongoing search requests when component unmounts
    return () => abort();
  }, [abort]);

  return <div>{/* Render results */}</div>;
}
```

---

## 7. Testing Strategy

Standard Redux testing practices apply. We recommend using **Mock Service Worker (MSW)** to mock network calls at the network boundaries.

### Helper: Test Store Wrap
Create a wrapper utility to render test components inside the correct Redux Provider:

```typescript
import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createApiStore } from 'api-state-factory';
import { userApi } from './api/userApi';

export function renderWithProviders(
  ui: React.ReactElement,
  { store = createApiStore({ apis: [userApi] }) } = {}
) {
  return render(<Provider store={store}>{ui}</Provider>);
}
```

### MSW Network Mocking
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('https://api.example.com/v1/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Alice' }]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Testing Components
```tsx
import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import UserList from './UserList';

test('renders users from API hook', async () => {
  renderWithProviders(<UserList />);
  
  // Wait for the mock user 'Alice' to render
  const userItem = await screen.findByText('Alice');
  expect(userItem).toBeInTheDocument();
});
```

---

## 8. Scaling Large Projects (100+ Endpoints)

As projects grow (e.g., massive ERP/HRMS panels), split definitions across domain folders rather than grouping them in a single massive config file:

```
src/api/
├── store.ts              # Combined store registration
├── domains/
│   ├── users.ts          # User-related endpoint declarations
│   ├── departments.ts    # Department-related endpoint declarations
│   └── billing.ts        # Billing-related endpoint declarations
```

### Domain Definition Splitting
```typescript
// src/api/domains/users.ts
export const userApi = defineApi({ name: 'users', ... });

// src/api/domains/departments.ts
export const departmentApi = defineApi({ name: 'departments', ... });
```

### Combined Registration
Register all modular API configurations into a single store instance:

```typescript
// src/api/store.ts
import { createApiStore } from 'api-state-factory';
import { userApi } from './domains/users';
import { departmentApi } from './domains/departments';
import { billingApi } from './domains/billing';

export const store = createApiStore({
  apis: [userApi, departmentApi, billingApi],
});
```

Using this decoupled modular approach ensures the initial bundle remains small, compiles fast, and helps teams organize logic logically.
