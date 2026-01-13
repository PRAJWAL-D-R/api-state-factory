# 🚀 api-state-factory

[![npm version](https://img.shields.io/npm/v/api-state-factory.svg?style=flat-square)](https://www.npmjs.com/package/api-state-factory)
[![install size](https://img.shields.io/bundlephobia/min/api-state-factory?style=flat-square)](https://bundlephobia.com/result?p=api-state-factory)
[![mit license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**api-state-factory** is a lightweight, type-safe integration library that transforms your REST endpoint declarations into Redux-ready async APIs. It handles the boilerplate of thunks, slices, and loading states, giving you both powerful React hooks and direct JavaScript call methods.

---

## ✨ Features

- **⚡ Zero Boilerplate**: Define APIs with simple strings or full configs.
- **🛡️ Type-Safe**: Full TypeScript support with generics.
- **🔄 Auto-Sync**: Queries auto-fetch on mount, with support for polling and caching.
- **🚀 Advanced Features**: Optimistic updates, infinite scroll merging, and interceptors.
- **🔗 Flexible Calls**: Use generated React hooks or call APIs directly.

---

## ⚖️ Why api-state-factory?

Bridging the gap between manual Redux thunks and full-blown query libraries.

| Feature | RTK Query | api-state-factory |
| :--- | :---: | :---: |
| **State Sync** | Complex Caching | Predictable Redux State |
| **Auto-Fetching** | Yes | **Yes** (New!) |
| **Optimistic UI** | Yes | **Yes** (New!) |
| **Outside React** | Middleware | Works Everywhere |
| **Bundle Size** | Larger | **Tiny** |

---

## 📦 Installation

```bash
npm install api-state-factory
```

*Peer dependencies required: `@reduxjs/toolkit`, `react`, and `react-redux`.*

---

## 🚀 Quick Start

### 1. Define your API
Declare your endpoints. Use `:ids` for dynamic paths.

```typescript
import { defineApi, endpoint } from 'api-state-factory';

export const userApi = defineApi({
  name: 'users',
  baseUrl: 'https://api.example.com',
  endpoints: {
    getUsers: '/users', // Simple Shorthand!
    getUser: endpoint.get<User>('/users/:id'),
    createUser: endpoint.post<User, { name: string }>('/users', {
      invalidatesTags: ['Users'] // Auto-refetch list after creation
    }),
  },
});
```

### 2. Register with Redux
### 2. Register with Redux
Add the generated slice to your store and register the store instance.

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { registerStore } from 'api-state-factory';
import { userApi } from './api';

const store = configureStore({
  reducer: {
    [userApi.name]: userApi.slice.reducer,
  },
});

registerStore(store);
```

### 3. Use in Components
Hooks auto-fetch by default for GET requests!

```tsx
function Profile({ id }) {
  // Auto-fetches when component mounts!
  const { data, loading } = userApi.useGetUser({ 
    params: { id },
    // Options
    pollingInterval: 5000, // Poll every 5s
    skip: !id, // Skip if no ID
  });

  if (loading) return <Spinner />;
  return <div>{data?.name}</div>;
}
```

---

## 🛠️ Advanced Usage

### 1. Magic Types & Smart Arguments (New in v0.4.0)
Define an interface for your API to get full TypeScript inference and cleaner usage.

```typescript
// Define the shape of your API
interface UserApiMap {
    getUser: { response: User, params: { id: number } };
    createUser: { body: NewUser, response: User };
}

// Pass it to defineApi
const userApi = defineApi<UserApiMap>({
    name: 'users',
    baseUrl: 'https://api.example.com',
    endpoints: {
        getUser: 'GET /users/:id',   // Auto-inferred
        createUser: 'POST /users'    // Auto-inferred
    }
});

// usage
const { data } = userApi.useGetUser(123); // Smart Arg: Pass ID directly!
await userApi.createUser({ body: { name: 'Alice' } });
```

### 2. Global Interceptors & Config
Inject headers or handle global errors directly in the API definition.

```typescript
const api = defineApi({
    // ...
    config: {
        prepareHeaders: (headers, { getState }) => {
            const token = getState().auth.token;
            if (token) headers.set('Authorization', `Bearer ${token}`);
            return headers;
        },
        onError: (error, { dispatch }) => {
            if (error.status === 401) {
                dispatch(logout());
            }
        }
    }
});
```

### 3. Hybrid Definitions
Mix simple strings with full objects for complex endpoints.

```typescript
endpoints: {
    // Simple
    getUsers: 'GET /users',
    // Complex
    getProfile: {
        url: 'GET /profile',
        cacheTime: 30000,
        providesTags: ['User']
    }
}
```

### 4. Optimistic Updates
Update the UI immediately while the request is pending.

```typescript
updateUser: endpoint.put('/users/:id', {
  onQueryStarted: (arg, { dispatch, queryFulfilled }) => {
    // Optimistic update
    dispatch(userApi.actions.updateData({ 
      endpointName: 'getUser', 
      data: { ...arg.body } 
    }));
  }
})
```

### 5. Infinite Scroll / Pagination
Merge new data with existing cache instead of overwriting it.

```typescript
getPosts: endpoint.get('/posts', {
  merge: (currentCache, newResponse) => {
    return {
      ...newResponse,
      items: [...currentCache.items, ...newResponse.items]
    };
  }
})
```

---

## 📖 API Reference

### `defineApi(config)`
Returns an object containing:
- `slice`: The generated Redux slice.
- `actions`: Reset & manual update actions.
- `use{EndpointName}`: React hooks.
- `{EndpointName}`: Direct call methods.

### `endpoint`
- `endpoint.get<TResponse>(path, options?)`
- `endpoint.post<TResponse, TBody>(path, options?)`
- `endpoint.put<TResponse, TBody>(path, options?)`
- `endpoint.delete<TResponse>(path, options?)`

---

##  Author

**Prajwal D R**  
*Full Stack Developer*

## 📜 License

MIT © 2026 [Prajwal D R](https://github.com/PRAJWAL-D-R)
