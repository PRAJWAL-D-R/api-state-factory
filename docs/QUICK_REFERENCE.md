# 📋 API State Factory: Quick Reference & Cheatsheet

This guide serves as a quick reference for configuration layouts, API comparison matrices, and troubleshooting tips.

---

## ⚡ 15-Line Quick Start

### 1. Define API
```typescript
import { defineApi, endpoint } from 'api-state-factory';

export const userApi = defineApi({
  name: 'users',
  baseUrl: 'https://api.example.com/v1',
  endpoints: {
    getUsers: 'GET /users',
    deleteUser: endpoint.delete('/users/:id', { invalidates: ['getUsers'] })
  }
});
```

### 2. Configure Store & Use Hook
```tsx
import { createApiStore } from 'api-state-factory';
export const store = createApiStore({ apis: [userApi] });

function UserList() {
  const { data: users, loading } = userApi.useGetUsers();
  if (loading) return <div>Loading...</div>;
  return <div>{users?.map(u => <p key={u.id}>{u.name}</p>)}</div>;
}
```

---

## 🔧 Global Configurations Reference

Use `setGlobalConfig` to apply global overrides to your HTTP requests:

```typescript
import { setGlobalConfig } from 'api-state-factory';

setGlobalConfig({
  // Dynamic headers evaluation for each call (useful for changing tokens)
  headers: () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }),
  
  // Timeout in milliseconds
  timeout: 5000,
  
  // Intercept response errors
  onError: (error, context) => {
    console.error(`Error in endpoint ${context.endpointName}:`, error);
  }
});
```

---

## 📊 Feature Comparison Matrix

| Feature | Traditional Redux Setup | RTK Query | **API State Factory** |
| :--- | :--- | :--- | :--- |
| **Gzipped Bundle Size** | N/A | ~15KB | **~5KB** (Zero dependencies) |
| **Setup Boilerplate** | High (slices, thunks, selectors) | Medium (API slice configuration) | **Minimal** (1-line definition) |
| **Type Inference** | Manual type definitions | Automatic | **Automatic Path Parameter Extraction** |
| **Caching Model** | Manual reducer manipulation | Tag-based invalidation | **Multi-Slot Parameterized Caching** |
| **Loading UX** | Single loading boolean | Dual boolean | **Dual states (`loading` + `isRefreshing`)** |
| **Best For** | Legacy custom stores | Complex GraphQL/REST integrations | **REST APIs, Admin panels, CRMs, HRMS** |

---

## ❓ Frequently Asked Questions & Troubleshooting

### Why are React-Redux and Redux Toolkit marked as peer dependencies?
To keep the bundle size of `api-state-factory` under **5KB**, we do not bundle Redux or React. This prevents duplicate instances of Redux from being compiled into your final application bundle.

### How are different parameter orders handled in cache keys?
Caches are organized by serializing parameters. To prevent `{ id: 1, filter: 'a' }` and `{ filter: 'a', id: 1 }` from creating separate cache entries, the library runs a deterministic key sort on the parameter object before serialization.

### Can I cancel pending API requests manually?
Yes. Every query hook returns an `abort` controller method that cancels the active network call when invoked (e.g., inside an unmount cleanup hook).

### How do I handle file uploads or Multi-part Form Data?
Pass a `FormData` object as the request body. The library automatically intercepts `FormData` payloads and updates request headers to remove the JSON-specific `Content-Type` so the browser can set boundary tokens correctly.

---

## 🗺️ Project Roadmap

- [ ] **Optional GraphQL Adapter**: A separate plugin to parse GraphQL queries while reusing the factory cache.
- [ ] **State Factory DevTools Extension**: A browser extension to visualize state slots and invalidation dependency trees.
- [ ] **Time-to-Live (TTL) Eviction**: Automatic cache eviction algorithms based on custom timeouts.
- [ ] **Optimistic Update Helper Hooks**: Out-of-the-box templates to simplify state rollbacks on network exceptions.
