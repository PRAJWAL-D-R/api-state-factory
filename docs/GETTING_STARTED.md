# 🚀 Getting Started with API State Factory

Welcome to **API State Factory**! This guide will help you understand the core capabilities of the library and guide you through the available documentation to set up and customize your API state management layer.

---

## 📚 Documentation Structure

To help you get the most out of **API State Factory**, our documentation is divided into specialized guides:

1. **[Developer Guide](file:///d:/Mine/My_Packages/docs/DEVELOPER_GUIDE.md)**  
   Detailed, step-by-step instructions for installing, configuring, and utilizing the package. Covers basic CRUD endpoints, global settings, error handling, infinite scroll/merging, testing with MSW, and scaling configurations for large codebases.

2. **[Architecture & Data Flow](file:///d:/Mine/My_Packages/docs/ARCHITECTURE.md)**  
   Visual ASCII and flow diagrams explaining the architecture layers, GET and mutation data paths, parameterized cache structure, automatic invalidation dependency graph, and dual loading state machines.

3. **[Case Study: Production HRMS Integration](file:///d:/Mine/My_Packages/docs/CASE_STUDY_HRMS.md)**  
   A real-world case study detailing how the package resolved a critical Redux boilerplate bottleneck (reducing 7,500 lines to under 130 lines) and solved detail-view performance issues in a production HR Management System.

4. **[Quick Reference Cheatsheet](file:///d:/Mine/My_Packages/docs/QUICK_REFERENCE.md)**  
   A rapid-lookup cheat sheet with the core 15-line boilerplate, comparison tables with RTK Query and other packages, peer dependencies, and FAQs.

---

## ⚡ Core Features

- **Zero Redux Boilerplate**: Define endpoint routes like `'GET /users'` and get fully configured slices, thunks, selectors, and hooks automatically.
- **Parameterized Caching**: Separate cache slots are allocated for unique path parameters or query variables (e.g., `useGetUser({ id: 1 })` and `useGetUser({ id: 2 })` occupy different cache slots), ensuring instant back-and-forth navigation.
- **Declarative Cache Invalidation**: Mark endpoints to invalidate others on success (e.g., `deleteUser` automatically triggers a refetch of `getUsers`).
- **Dual loading states**: Exposes both `loading` (initial render shimmer) and `isRefreshing` (silent background update) booleans for seamless, spinner-free updates.
- **Extensive Type Safety**: Full TypeScript inference for parameters, query shapes, request bodies, and responses.

---

## 🛠️ Rapid Installation

To install the package and its required peer dependencies:

```bash
npm install api-state-factory
```

*Note: Ensure your project has React 18+, Redux Toolkit 2.0+, and React-Redux 9.0+ configured.*

---

## 📖 Quick Start Example

### 1. Define the API
```typescript
import { defineApi, endpoint } from 'api-state-factory';

export const userApi = defineApi({
  name: 'users',
  baseUrl: 'https://api.example.com',
  endpoints: {
    getUsers: 'GET /users',
    deleteUser: endpoint.delete('/users/:id', {
      invalidates: ['getUsers']
    })
  }
});
```

### 2. Configure the Redux Store
```typescript
import { createApiStore } from 'api-state-factory';
import { userApi } from './api/userApi';

export const store = createApiStore({
  apis: [userApi]
});
```

### 3. Use in React Components
```tsx
import React from 'react';
import { userApi } from './api/userApi';

function UserList() {
  const { data: users, loading } = userApi.useGetUsers();

  if (loading) return <div>Loading users...</div>;

  return (
    <ul>
      {users?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

## 🔍 Next Steps

- Jump into the **[Developer Guide](file:///d:/Mine/My_Packages/docs/DEVELOPER_GUIDE.md)** for a deep dive into endpoints configuration, headers interception, and testing.
- Review **[Architecture & Data Flow](file:///d:/Mine/My_Packages/docs/ARCHITECTURE.md)** to see diagrams of how the state tree is structured.
