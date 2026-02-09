# API State Factory - Interview Preparation Guide 🎯

## Table of Contents
1. [Package Overview & Elevator Pitch](#elevator-pitch)
2. [Step-by-Step Usage Guide](#usage-guide)
3. [Why This Package is Helpful](#why-helpful)
4. [Interview Questions & Answers](#qa)
5. [Technical Deep Dive](#technical-deep-dive)
6. [Best Practices & Tips](#best-practices)

---

## 🎤 Elevator Pitch (30 seconds)

**"API State Factory is a lightweight TypeScript library that eliminates Redux boilerplate for REST API integration. Instead of writing hundreds of lines of slices, thunks, and reducers for each endpoint, developers define their API in a single configuration object and get fully-typed hooks, automatic caching, and state management for free. It's like RTK Query but lighter, more flexible, and designed specifically for REST APIs with advanced features like parameterized caching and automatic invalidation."**

---

## 📖 Step-by-Step Usage Guide

### Step 1: Installation
```bash
npm install api-state-factory
```

**Prerequisites:**
- React 18+
- Redux Toolkit 2.0+
- React-Redux 9.0+

### Step 2: Define Your API
Create a centralized API definition file (e.g., `src/api/userApi.ts`):

```typescript
import { defineApi, endpoint } from 'api-state-factory';

export const userApi = defineApi({
  name: 'users',
  baseUrl: 'https://api.example.com/v1',
  endpoints: {
    // Simple GET request
    getUsers: 'GET /users',
    
    // GET with path parameters
    getUser: 'GET /users/:id',
    
    // POST with body
    createUser: endpoint.post('/users', {
      invalidates: ['getUsers'], // Auto-refresh user list after creation
    }),
    
    // DELETE with retry logic
    deleteUser: endpoint.delete('/users/:id', {
      invalidates: ['getUsers'],
      retry: 2, // Retry twice on failure
    }),
    
    // PUT for updates
    updateUser: endpoint.put('/users/:id', {
      invalidates: ['getUsers', 'getUser'],
    }),
  },
});
```

### Step 3: Configure Redux Store
```typescript
import { createApiStore } from 'api-state-factory';
import { userApi } from './api/userApi';

export const store = createApiStore({
  apis: [userApi], // Register all your APIs here
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Step 4: Setup Global Configuration (Optional)
```typescript
import { setGlobalConfig } from 'api-state-factory';

setGlobalConfig({
  headers: () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  }),
  onError: (error) => {
    if (error.status === 401) {
      // Handle unauthorized
      window.location.href = '/login';
    }
  },
});
```

### Step 5: Use in React Components
```tsx
import { userApi } from './api/userApi';

function UserList() {
  // Automatically fetches on mount
  const { data, loading, error, isRefreshing, refetch } = userApi.useGetUsers();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {isRefreshing && <span>Updating...</span>}
      <button onClick={refetch}>Refresh</button>
      {data?.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

function UserDetail({ userId }: { userId: string }) {
  // Parameterized caching - each userId gets its own cache slot
  const { data: user } = userApi.useGetUser({ id: userId });
  
  return <div>{user?.name}</div>;
}

function CreateUserForm() {
  const [createUser, { loading }] = userApi.useCreateUser();

  const handleSubmit = async (formData) => {
    const result = await createUser({ body: formData });
    if (result.success) {
      alert('User created!');
      // getUsers will auto-refresh due to invalidation
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Step 6: Direct Thunk Access (Advanced)
```typescript
// Use outside React components
import { store } from './store';
import { userApi } from './api/userApi';

async function fetchUserData() {
  const result = await store.dispatch(userApi.thunks.getUsers());
  return result.payload;
}
```

---

## 💡 Why This Package is Helpful

### 1. **Massive Time Savings**
- **Traditional Redux**: 100-200 lines per endpoint (slice, thunk, reducer, types)
- **API State Factory**: 1 line per endpoint
- **Result**: 95% less boilerplate code

### 2. **Enterprise-Grade Caching**
- **Parameterized Caching**: Each unique parameter combination gets its own cache slot
- **Example**: `useGetUser(1)` and `useGetUser(2)` maintain separate caches
- **Benefit**: Instant navigation between different items (no re-fetching)

### 3. **Better User Experience**
- **Dual Loading States**: 
  - `loading`: Initial fetch (show skeleton)
  - `isRefreshing`: Background update (show subtle indicator)
- **Result**: No jarring full-screen spinners on refresh

### 4. **Type Safety**
- Full TypeScript inference for:
  - Path parameters
  - Request bodies
  - Response types
  - Error types
- Catch bugs at compile-time, not runtime

### 5. **Automatic Invalidation**
- Define relationships once: `invalidates: ['getUsers']`
- Automatic re-fetching when related data changes
- No manual cache management

### 6. **Production-Ready Features**
- Automatic retry logic
- Global error handling
- Request interceptors
- Infinite scroll support (list merging)
- Optimistic updates

---

## ❓ Interview Questions & Answers

### Basic Questions

**Q1: What is API State Factory?**
**A:** API State Factory is a lightweight TypeScript library that simplifies REST API integration with Redux. It eliminates boilerplate by auto-generating Redux slices, thunks, and React hooks from a simple API definition. Instead of writing hundreds of lines of Redux code for each endpoint, developers define their API in a configuration object and get fully-typed hooks and state management automatically.

---

**Q2: Why did you create this package?**
**A:** I created this package while working on large-scale enterprise applications (HRMS, ERP systems) where I noticed teams spending 60-70% of their time writing repetitive Redux boilerplate for API calls. Each endpoint required:
- Creating a slice
- Writing async thunks
- Defining reducers
- Creating custom hooks
- Managing loading/error states

This was inefficient and error-prone. API State Factory reduces this to a single line per endpoint while adding advanced features like parameterized caching and automatic invalidation.

---

**Q3: How is this different from RTK Query?**
**A:** 
| Feature | RTK Query | API State Factory |
|---------|-----------|-------------------|
| **Size** | Heavier (part of RTK) | Ultra-lightweight |
| **Focus** | GraphQL + REST | REST-optimized |
| **Caching** | Tag-based | Parameterized (multi-slot) |
| **Setup** | More configuration | Minimal setup |
| **Flexibility** | Opinionated | More flexible |
| **Learning Curve** | Steeper | Gentler |

API State Factory is ideal when you want Redux integration without the complexity of RTK Query's tag system, and when you need fine-grained control over parameterized caching.

---

**Q4: What are the peer dependencies and why?**
**A:** 
- **React 18+**: For hooks and modern React features
- **Redux Toolkit 2.0+**: For createSlice and createAsyncThunk
- **React-Redux 9.0+**: For connecting React to Redux

These are peer dependencies (not bundled) to avoid version conflicts and keep the package lightweight. Users likely already have these in their projects.

---

### Technical Questions

**Q5: Explain how parameterized caching works.**
**A:** 
Traditional caching stores one result per endpoint:
```
cache = { getUser: { id: 1, name: "John" } }
// Fetching user 2 overwrites user 1's data
```

Parameterized caching creates separate slots for each parameter combination:
```
cache = {
  getUser: {
    '{"id":"1"}': { id: 1, name: "John" },
    '{"id":"2"}': { id: 2, name: "Jane" }
  }
}
```

**Implementation:**
1. Serialize parameters to a cache key: `JSON.stringify({ id: userId })`
2. Store data in a nested structure: `state[endpoint][cacheKey]`
3. Retrieve data using the same key

**Benefits:**
- Instant navigation between items (no re-fetching)
- Reduced API calls
- Better UX for detail pages

---

**Q6: How does automatic invalidation work?**
**A:** 
When you define an endpoint with `invalidates`:
```typescript
deleteUser: endpoint.delete('/users/:id', {
  invalidates: ['getUsers']
})
```

**Flow:**
1. User calls `deleteUser({ id: 1 })`
2. API request completes successfully
3. Library checks the `invalidates` array
4. Marks `getUsers` cache as stale
5. Any component using `useGetUsers()` automatically re-fetches

**Implementation:**
- Maintain a dependency graph: `{ deleteUser: ['getUsers'] }`
- On success, dispatch invalidation actions
- Hooks listen for invalidation and trigger refetch

---

**Q7: How do you handle TypeScript type inference?**
**A:** 
The library uses advanced TypeScript features:

1. **Template Literal Types** for path parsing:
```typescript
type ExtractParams<T> = T extends `${string}/:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string }
  : T extends `${string}/:${infer Param}`
  ? { [K in Param]: string }
  : {};
```

2. **Generic Constraints** for endpoint definitions:
```typescript
function endpoint.get<TResponse, TParams>(
  path: string,
  config?: EndpointConfig
): EndpointDefinition<TResponse, TParams>
```

3. **Conditional Types** for hook return types:
```typescript
type UseEndpointReturn<T> = T extends 'GET'
  ? { data: TResponse; loading: boolean; error: Error | null }
  : [mutate: (params) => Promise<TResponse>, state: MutationState];
```

---

**Q8: How do you ensure the package is lightweight?**
**A:** 
1. **Tree-shakeable exports**: Use ES modules
2. **Zero dependencies**: Only peer dependencies
3. **Minimal bundle**: ~5KB gzipped
4. **Code splitting**: Separate core, React, and Redux modules
5. **Build optimization**: Use `tsup` with minification

---

**Q9: Explain the dual loading states (loading vs isRefreshing).**
**A:** 
**Problem:** Traditional loading states cause jarring UX:
- User sees data → clicks refresh → entire screen shows spinner → data reappears

**Solution:** Two separate states:
```typescript
{
  loading: boolean,      // true only on initial fetch
  isRefreshing: boolean  // true on background updates
}
```

**Usage:**
```tsx
if (loading) return <Skeleton />;  // First load
return (
  <div>
    {isRefreshing && <TopBarSpinner />}  // Subtle indicator
    {data.map(...)}
  </div>
);
```

**Implementation:**
- Track `hasLoadedOnce` flag in state
- Set `loading = true` only when `!hasLoadedOnce`
- Set `isRefreshing = true` when `hasLoadedOnce && isFetching`

---

**Q10: How do you handle errors globally?**
**A:** 
```typescript
setGlobalConfig({
  onError: (error, context) => {
    // context contains endpoint name, params, etc.
    
    if (error.status === 401) {
      // Redirect to login
      logout();
    } else if (error.status === 403) {
      // Show permission error
      toast.error('Access denied');
    } else if (error.status >= 500) {
      // Log to error tracking service
      Sentry.captureException(error);
    }
  }
});
```

**Flow:**
1. API call fails
2. Error caught in thunk
3. Global `onError` handler invoked
4. Error stored in endpoint state
5. Component can access via `error` property

---

### Advanced Questions

**Q11: How would you implement optimistic updates?**
**A:** 
```typescript
const [updateUser] = userApi.useUpdateUser({
  optimistic: true,
  onOptimisticUpdate: (params) => {
    // Immediately update cache
    return { ...currentUser, ...params.body };
  },
  onError: (error, rollback) => {
    // Revert on failure
    rollback();
  }
});
```

**Implementation:**
1. Store original state before mutation
2. Apply optimistic update to cache
3. Make API call
4. On success: keep optimistic update
5. On failure: restore original state

---

**Q12: How do you test components using this library?**
**A:** 
```typescript
import { renderWithProviders } from './test-utils';

test('UserList renders users', async () => {
  const mockUsers = [{ id: 1, name: 'John' }];
  
  // Mock the API response
  server.use(
    rest.get('/users', (req, res, ctx) => {
      return res(ctx.json(mockUsers));
    })
  );

  const { findByText } = renderWithProviders(<UserList />);
  
  expect(await findByText('John')).toBeInTheDocument();
});
```

**Test utilities:**
```typescript
export function renderWithProviders(ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  );
}
```

---

**Q13: How do you handle request cancellation?**
**A:** 
```typescript
function UserSearch() {
  const { data, abort } = userApi.useSearchUsers({ query: searchTerm });
  
  useEffect(() => {
    return () => abort(); // Cancel on unmount
  }, [abort]);
}
```

**Implementation:**
- Use `AbortController` in fetch requests
- Store abort function in hook return
- Call on unmount or parameter change

---

**Q14: What's your strategy for versioning and breaking changes?**
**A:** 
- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **Breaking changes**: Only in major versions
- **Deprecation warnings**: Add in minor versions before removal
- **Migration guides**: Provide for major updates
- **Changelog**: Detailed for every release

---

**Q15: How would you scale this for a large application with 100+ endpoints?**
**A:** 
```typescript
// Split by domain
export const userApi = defineApi({ name: 'users', ... });
export const productApi = defineApi({ name: 'products', ... });
export const orderApi = defineApi({ name: 'orders', ... });

// Combine in store
export const store = createApiStore({
  apis: [userApi, productApi, orderApi]
});

// Code splitting
const LazyUserModule = lazy(() => import('./modules/users'));
```

**Best practices:**
- Organize by feature/domain
- Use code splitting for large modules
- Implement lazy loading for routes
- Monitor bundle size

---

## 🔧 Technical Deep Dive

### Architecture Overview

```
api-state-factory/
├── core/
│   ├── endpoint.ts        # Endpoint builder functions
│   ├── define-api.ts      # API definition factory
│   ├── config.ts          # Global configuration
│   └── types.ts           # TypeScript definitions
├── redux/
│   ├── slice-factory.ts   # Auto-generates Redux slices
│   ├── store-factory.ts   # Creates configured store
│   └── store-registry.ts  # Manages multiple APIs
└── react/
    └── hooks-factory.ts   # Generates React hooks
```

### Key Design Patterns

1. **Factory Pattern**: `defineApi()`, `createApiStore()`
2. **Builder Pattern**: `endpoint.get()`, `endpoint.post()`
3. **Registry Pattern**: Store registry for multiple APIs
4. **Proxy Pattern**: Auto-generated hooks and thunks

### Data Flow

```
Component → Hook → Thunk → API → Response
    ↑                              ↓
    └──────── Redux State ←────────┘
```

---

## 🎯 Best Practices & Tips

### For the Interview

1. **Start with the problem**: Explain the pain point before the solution
2. **Use real examples**: Reference your HRMS/ERP projects
3. **Show metrics**: "Reduced API code by 95%", "Saved 40 hours per month"
4. **Demonstrate trade-offs**: Acknowledge when NOT to use it
5. **Be honest**: If asked about a feature you haven't implemented, explain how you would

### Demo Preparation

**Prepare a live demo:**
1. Simple todo app with CRUD operations
2. Show before/after code comparison
3. Demonstrate parameterized caching
4. Show automatic invalidation in action

### Key Talking Points

✅ **Emphasize:**
- Developer productivity
- Type safety
- Production-ready features
- Real-world usage in enterprise apps

❌ **Avoid:**
- Claiming it's better than everything
- Ignoring limitations
- Over-technical jargon without context

---

## 🚀 Closing Statement

**"API State Factory represents my commitment to solving real developer problems. It's not just a library—it's a productivity multiplier that I've battle-tested in production environments managing millions of API calls. I'm excited to continue evolving it based on community feedback and real-world use cases."**

---

## 📚 Additional Resources

- **GitHub**: https://github.com/PRAJWAL-D-R/api-state-factory
- **NPM**: https://www.npmjs.com/package/api-state-factory
- **Documentation**: See README.md
- **Examples**: See tests/ directory

---

## 🎓 Quick Reference Card

**Print this and keep it handy:**

```
ELEVATOR PITCH: Redux boilerplate eliminator for REST APIs

KEY FEATURES:
✓ Zero boilerplate (1 line per endpoint)
✓ Parameterized caching (multi-slot storage)
✓ Automatic invalidation
✓ Full TypeScript inference
✓ Dual loading states (loading + isRefreshing)

BEST FOR:
✓ HRMS/ERP systems
✓ Admin dashboards
✓ CRUD-heavy apps
✓ Enterprise applications

NOT FOR:
✗ Real-time apps (use WebSockets)
✗ GraphQL (use Apollo)
✗ Non-Redux projects

TECH STACK:
- React 18+
- Redux Toolkit 2.0+
- TypeScript 5.0+

SIZE: ~5KB gzipped
LICENSE: MIT
```

---

Good luck with your interview! 🎉
