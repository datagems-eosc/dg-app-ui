# Frontend Engineering Guidelines

These guidelines define how we build, test, and maintain frontend code in this codebase. Follow the existing project patterns and context first; use these rules to keep changes consistent, minimal, and easy to review.

---

## 1) Language & Standards

- **ES6+ syntax only** (arrow functions, `const`/`let`, template literals, destructuring, etc.).
- **TypeScript is the default** for all new code.
- Keep code **simple and readable**. Prefer the clearest solution over “clever” abstractions.
- **No unnecessary changes**: avoid formatting-only PRs, drive-by refactors, or unrelated edits.
- **No new libraries unless truly required** and justified in the PR.

---

## 2) Project Consistency First

- Align with **how the project already works** (naming, folder structure, patterns, dependencies).
- Reuse existing utilities/hooks/components before adding new ones.
- Prefer incremental improvements over “rewrite” approaches.

---

## 3) Component Architecture

### Atomic Components
- Components must be **atomic**: small, focused, and reusable.
- Build from **Atoms → Molecules → Organisms → Pages** where it makes sense.
- Design component APIs for extensibility and reuse.

### UI vs Business Logic
- Separate UI from business logic using **container vs presentational** pattern when it helps:
  - **Presentational**: renders UI, receives data/handlers via props.
  - **Container**: owns state, data fetching, business rules, transforms.

**Example (container + presentational):**
```tsx
// UserList.container.tsx
export function UserListContainer() {
  const { users, isLoading } = useUsersQuery();
  return <UserListView users={users} loading={isLoading} />;
}

// UserList.view.tsx
export function UserListView({ users, loading }: Props) {
  if (loading) return <Spinner />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Functional Components & Hooks
- Use **function components** and **hooks** (no class components).
- If logic repeats, extract it into:
  - a **utility function** (pure logic)
  - a **custom hook** (React-related state/effects)

**Example (custom hook for reuse):**
```ts
export function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
```

---

## 4) Folder Structure: Co-locate Component Code

Each component keeps **code + styles + tests in a single folder** to simplify refactors and reuse.

**Recommended layout:**
```text
components/
  Chip/
    Chip.tsx
    Chip.styles.ts
    Chip.test.tsx
    index.ts
```

Shared modules live centrally and clearly:
```text
src/
  utils/
  hooks/
  constants/
  types/
```

---

## 5) State Management Rules

- Prefer **local state** (`useState`, `useReducer`) when possible.
- Use **global state only when necessary**.
- Choose state tools based on the problem:
  - Server/cache state: **TanStack Query** (or project equivalent)
  - App-level shared state: **Redux / Zustand / Jotai** (choose what fits the feature)
- Avoid deeply nested prop drilling. Use context/hooks/global state **sensibly**.
- Keep state logic separate from UI where possible.

---

## 6) Performance & Rendering

Optimize only where it provides real value:
- Use `React.memo`, `useMemo`, `useCallback` **only when they prevent measurable re-renders**.
- Prefer readable code; don’t pre-optimize.

**Example (memoization only for expensive derived data):**
```ts
const visibleItems = useMemo(() => heavyFilter(items, query), [items, query]);
```

---

## 7) Error Handling & Enums

- Errors must have **typed enums** (no magic strings).
- Prefer predictable, typed error flow.

**Example:**
```ts
export enum ApiErrorCode {
  Unauthorized = "UNAUTHORIZED",
  NotFound = "NOT_FOUND",
  Unknown = "UNKNOWN",
}

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};
```

---

## 8) Logging Policy

- **Do not use `console.log` / `console.error` in app code.**
- Use **pino** (or the project’s wrapper) for structured logs.

**Example:**
```ts
import { logger } from "@/utils/logger"; // preferred wrapper

logger.info({ feature: "search", query }, "Search executed");
logger.error({ err, feature: "search" }, "Search failed");
```

---

## 9) Testing Requirements

- **Every feature must have tests** (unit/integration as appropriate).
- Follow the project’s existing test stack (e.g., Jest/Vitest + React Testing Library).
- Test behavior, not implementation details.

**Example (React Testing Library):**
```tsx
it("removes a filter when clicking the chip remove button", async () => {
  render(<ActiveFilters filters={filters} onRemoveFilter={onRemove} ... />);
  await user.click(screen.getByRole("button", { name: /remove access/i }));
  expect(onRemove).toHaveBeenCalledWith("access");
});
```

---

## 10) Accessibility (A11y)

Accessibility is a standard, not an add-on:
- Use **semantic HTML** first (`button`, `label`, `nav`, etc.).
- Add **ARIA** only where needed.
- Include **automated and manual accessibility checks** for key flows.
- Ensure components work with keyboard navigation and screen readers.

**Example (ARIA + semantics):**
```tsx
<button type="button" aria-label="Remove Access filter" onClick={...}>
  ✕
</button>
```

---

## 11) Responsive Design

- Design for multiple screen sizes and devices.
- Avoid hard-coded dimensions that break layouts.
- Validate key views on mobile and desktop.

---

## 12) Comments & Documentation

- **Avoid comments unless truly required.**
- Prefer self-explanatory naming and small functions.
- If something needs explanation, first try to make the code clearer; comment only when the “why” can’t be expressed in code.

---

## 13) PR Hygiene (Non-Negotiables)

- Keep PRs focused: one feature/fix per PR where possible.
- No unrelated refactors or library additions.
- Write in PR description what has been changed
- Ensure tests pass and new functionality is covered.
- Match project conventions (linting, formatting, naming).
- Prefer small, composable changes over large rewrites.
