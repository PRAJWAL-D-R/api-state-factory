# API State Factory 🚀

**The fastest way to build type-safe, production-ready API layers for React & Redux.**

API State Factory is a lightweight, zero-boilerplate utility that transforms your API definitions into fully-managed Redux slices, high-performance React hooks, and type-safe direct-call methods.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 🔥 Why API State Factory?

Most state management libraries require you to write hundreds of lines of "glue code" for every endpoint. **API State Factory** reduces this to a single configuration.

- **Zero Boilerplate**: Define an endpoint with a string; get a slice, thunk, and hook instantly.
- **Enterprise Caching**: Built-in parameterized caching (multi-slot storage) so navigating between different items is instant.
- **Extreme Type Safety**: Full end-to-end IntelliSense for paths, parameters, bodies, and responses.
- **Ultra Lightweight**: A fraction of the size of traditional data-fetching libraries.
- **Modern UX Ready**: Dual-boolean states (`loading` vs `isRefreshing`) for shimmer-free updates.

---

## 📦 Installation

```bash
npm install api-state-factory
```

---

## 🚀 Quick Start

### 1. Define your API
Create a clean, centralized definition of your service.

```typescript
import { defineApi, endpoint } from 'api-state-factory';

export const expenseApi = defineApi({
  name: 'expenses',
  baseUrl: 'https://api.example.com/v1',
  endpoints: {
    // Shorthand for simple GET requests
    getExpenses: 'GET /expenses',
    
    // Advanced definition with full configuration
    deleteExpense: endpoint.delete('/expenses/:id', {
      invalidates: ['getExpenses'], // Automatically re-fetches the list on success
      retry: 2                      // Auto-retry twice on network glitch
    }),
    
    // Infinite list support
    getFeed: endpoint.get('/feed', { merge: true }) 
  }
});
```

### 2. Setup Store (The 1-Line Way)
No more complex `combineReducers` or middleware setup.

```typescript
import { createApiStore } from 'api-state-factory';
import { expenseApi } from './api';

export const store = createApiStore({
  apis: [expenseApi]
});
```

### 3. Use in Components
Hooks are reactive by default—they fetch on mount and re-fetch when params change.

```tsx
function ExpenseList() {
  const { data, loading, isRefreshing } = expenseApi.useGetExpenses();

  if (loading) return <Shimmer />;

  return (
    <div>
      {isRefreshing && <span>Updating...</span>}
      {data.map(exp => <Item key={exp.id} {...exp} />)}
    </div>
  );
}
```

---

## 🛠️ Advanced Features

### Parameterized Caching (Multi-Slot Storage)
Unlike basic libraries that store one result per endpoint, API State Factory partitions data by parameters. 
If you visit `useGetUser(1)` and then `useGetUser(2)`, the data for User 1 is preserved. Navigation back to User 1 is **instant**.

### List Merging (Infinite Scroll)
Stop writing `[...oldData, ...newData]` logic. Set `merge: true` and the library handles the array appending for you.

### Global Interceptors & Interceptors
Easily handle Auth tokens and global errors.

```typescript
import { setGlobalConfig } from 'api-state-factory';

setGlobalConfig({
  headers: () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }),
  onError: (error) => {
    if (error.status === 401) logout();
  }
});
```

### Direct Thunk Access
Need to trigger an API call from outside React (e.g., inside another thunk)?
```typescript
await store.dispatch(expenseApi.thunks.getExpenses());
```

---

## ⚡ Comparison

| Feature | Legacy Setup | **API State Factory** |
| :--- | :--- | :--- |
| **Setup Time** | Hours/Days | **Minutes** |
| **Boilerplate** | High (Slices, Thunks, Reducers) | **Zero** |
| **Type Safety** | Manual Interfaces | **Automatic Inference** |
| **UX** | Full-screen spinners | **Smooth Refreshing** |
| **Caching** | Manual Management | **Automatic Multi-Slot** |

---

## 📜 License

MIT © [Prajwal D R](https://github.com/PRAJWAL-D-R)
