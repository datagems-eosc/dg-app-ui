## Component Guidelines

### General Guidelines

1. **Required Fields**: Look for the red asterisk (*) next to labels
2. **Error Messages**: Red text appears below fields when something is wrong
3. **Disabled Elements**: Grayed-out elements cannot be used right now
4. **Hover Effects**: Elements that can be clicked change appearance when you hover


### Accessibility

All components follow accessibility best practices:

- **Focus Ring**: Blue outline shows which element is selected
- **Labels**: Every input has a descriptive label
- **Alt Text**: Images have descriptions for screen readers
- **Keyboard Support**: All actions can be done without a mouse

### Keyboard Navigation

- **Tab** - Move to next field
- **Shift + Tab** - Move to previous field
- **Enter** - Submit form or click focused button
- **Escape** - Close modal or cancel action
- **Space** - Toggle checkbox or select option

### Responsive Design

Components adapt to different screen sizes:

- **Mobile First**: Optimized for mobile devices
- **Tablet Support**: Adjusted layouts for tablet screens
- **Desktop Enhancement**: Full feature set on desktop
- **Touch Friendly**: Adequate touch target sizes

### Theming

Components use design tokens for consistent theming:

- **Colors**: Defined in Tailwind config
- **Typography**: Consistent font scales
- **Spacing**: Standard spacing units
- **Shadows**: Elevation system
- **Border Radius**: Consistent corner rounding


### Color Meanings

Throughout the app, colors have consistent meanings:

- **Blue** - Primary actions, info, links
- **Green** - Success, Open Access, available
- **Orange** - Warnings, important notices
- **Red** - Errors, delete actions, restricted
- **Gray** - Disabled, secondary text, borders
- **Emerald Green** - Smart Search active


### Performance

Components are optimized for performance:

- **Code Splitting**: Components lazy-loaded when needed
- **Memoization**: Prevent unnecessary re-renders
- **Optimized Re-renders**: React.memo for pure components
- **Efficient Event Handlers**: Debounced and throttled where appropriate

---

## Common Patterns

### Creating Something New

1. Click the "Create" or "Add" button (usually blue)
2. A modal appears with a form
3. Fill in the required fields (marked with *)
4. Click "Create" or "Save"
5. A success toast appears
6. The modal closes
7. The new item appears in the list

### Editing Existing Items

1. Find the item
2. Click the edit icon or open the 3-dot menu
3. Select "Edit"
4. A modal appears with current values filled in
5. Change what you want
6. Click "Save" or "Update"
7. Changes appear immediately

### Deleting Items

1. Find the item
2. Click delete icon or open 3-dot menu
3. Select "Delete"
4. A confirmation modal appears
5. Read the warning
6. Click "Delete" to confirm (red button)
7. Item is removed from the list

### Searching and Filtering

1. **Quick Search**: Type in the search bar at the top
2. **Advanced Filters**: Click "Filters" button
3. Select your filter criteria (license, date, size, etc.)
4. Click "Apply"
5. Results update to match your filters
6. Click "Clear All" to remove filters

### Adding to Collections

1. Find a dataset
2. Click the "ADD" button
3. Choose tab: "Add to existing" or "Create new"
4. Select collection(s) or enter new collection name
5. Click "Add" or "Create"
6. Toast confirms success
7. Dataset appears in the collection

---

## Testing

Components are thoroughly tested:

- **Unit Tests**: Individual component behavior
- **Integration Tests**: Component interactions
- **E2E Tests**: Full user workflows with Cypress
- **Visual Regression**: Automated screenshot comparison
- **Accessibility Tests**: Automated a11y checks

---

## Best Practices

### Using Components

1. **Import from UI folder**: `import { Button } from '@/components/ui/Button'`
2. **Use TypeScript types**: Leverage type safety for props
3. **Follow naming conventions**: Use descriptive prop names
4. **Compose components**: Build complex UIs from simple components
5. **Handle edge cases**: Test with empty states, errors, loading

### Styling

1. **Use Tailwind classes**: Leverage utility classes for consistency
2. **Follow design system**: Use defined colors, spacing, typography
3. **Avoid inline styles**: Prefer className composition
4. **Responsive utilities**: Use Tailwind responsive prefixes (sm:, md:, lg:)
5. **Custom styles sparingly**: Only when design system doesn't cover use case

### State Management

1. **Local state first**: Use useState for component-specific state
2. **Lift state up**: Share state between components via props
3. **Context for shared state**: Use React Context for wider scope
4. **Props over context**: Prefer explicit props for clarity
5. **Controlled components**: Let parent control component state when needed


---

## Need Help?

If you encounter any issues or need assistance:

1. Check this guide for component information
2. Look for tooltips (hover over icons)
3. Read error messages carefully (they tell you how to fix problems)
4. Contact the DataGEMS Help Desk