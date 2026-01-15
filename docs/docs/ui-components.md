# UI Components

DataGEMS Front-end uses a comprehensive design system built with reusable React components. This documentation describes the component library that powers the user interface.

<!-- ## What is Storybook?

[Storybook](https://storybook.js.org/) is an open-source tool for developing UI components in isolation. It provides a dedicated environment where developers can build, test, and document components outside of the main application context.

### Key Concepts

**Stories**: Individual component states and variations that can be viewed and tested independently.

**Controls**: Interactive controls that allow you to dynamically change component props and see results in real-time.

**Documentation**: Auto-generated documentation from component code, including props, types, and usage examples.

**Addons**: Extensions that enhance functionality with features like accessibility testing, responsive design testing, and more.

## Why Storybook?

### Benefits for Large Projects

**1. Component Isolation**

Develop and test components independently without needing to navigate through the entire application. This speeds up development and makes debugging easier.

**2. Visual Testing**

See all component variations side-by-side, making it easy to:
- Catch visual regressions
- Test edge cases
- Ensure consistency across the design system
- Review UI changes before deployment

**3. Documentation**

Storybook serves as living documentation that:
- Always stays up-to-date with the code
- Shows real examples with actual components
- Provides interactive playground for designers and developers
- Helps onboard new team members faster

**4. Collaboration**

Facilitates collaboration between:
- **Designers** can review components without running the full application
- **Developers** can build components matching design specs exactly
- **QA Team** can test components in all states
- **Stakeholders** can preview UI changes early

**5. Quality Assurance**

Built-in testing capabilities:
- Visual regression testing
- Accessibility testing with a11y addon
- Interaction testing
- Cross-browser compatibility testing

### Advantages in Development Workflow

- **Faster Development**: Build components without running the entire app
- **Better Testing**: Test all component states easily
- **Improved Quality**: Catch UI bugs before they reach production
- **Shared Understanding**: Common reference point for entire team
- **Reusability**: Encourage component reuse across the application -->

## Component Library

DataGEMS Front-end includes a comprehensive set of UI components organized into categories. Below is a detailed overview of the available components.

<!-- ### Foundation Components

These are the building blocks used throughout the application.

## Form Controls

#### Button

Versatile button component with multiple variants and sizes.

#### Variants:
- `primary`: (Blue) - Main actions like "Save" or "Create"
- `outline`: (White with border) - Secondary actions like "Cancel"  
- `secondary`: (gray background) Alternative primary actions 
- `ghost`: (Transparent) - Subtle actions in toolbars
- `tertiary`: (Light gray) - Minor actions

#### Sizes:
- `icon`: 32px square for icon-only buttons
- `sm`: Small 32px height
- `md`: Medium 40px height (default)
- `lg`: Large 48px height

#### Features:
- Click the button to perform an action
- Primary buttons show the most important action on a page
- Outline buttons are for less important actions

**Usage Example:**
```typescript
<Button variant="primary" size="md">
  Save Changes
</Button>

<Button variant="outline" size="sm">
  Cancel
</Button>
```

#### Text Input

Text inputs let you type information like names, descriptions, or search terms.

#### Sizes:
- `medium`: Standard height (default)
- `large`: Increased height for emphasis

#### Features:
- **Label** - Shows what information to enter
- **Placeholder** - Light gray text showing example input
- **Error message** - Red text if something is wrong
- **Required indicator** (red asterisk *) - Must be filled out
- **Icons** - Small images on the left or right side

#### Props:
- `label`: Optional label text
- `error`: Error message to display
- `icon`: Left-side icon component
- `rightIcon`: Right-side icon component
- `required`: Shows asterisk in label
- `disabled`: Disables input with visual feedback

#### States:
- Normal - Ready to type
- Focused - Blue ring when you click inside
- Error - Red border when there's a problem
- Disabled - Grayed out, cannot edit

#### How to use:
1. Click inside the input box
2. Type your text
3. Press Tab or click outside to move to the next field

**Usage Example:**
```typescript
<Input
  label="Email Address"
  type="email"
  placeholder="Enter your email"
  required
  error={errors.email}
/>
```

#### Chip

Small, compact elements displaying tags, filters, or status information.

#### Variants:
- `regular`: Solid background (default)
- `outline`: Border with transparent background

#### Colors:
- `default`: Blue theme
- `warning`: Orange/amber theme
- `info`: Blue theme for information
- `success`: Green theme
- `error`: Red theme
- `grey`: Neutral gray theme
- `smart-search`: Special theme for AI-powered features

#### Sizes:
- `xs`: Extra small for compact spaces
- `sm`: Small size
- `md`: Medium size (default)

#### Features:
- Optional remove button (X icon)
- Customizable colors and variants
- Compact design for data display
- Letter spacing for readability

**Usage Example:**
```typescript
<Chip color="success" size="sm">
  Active
</Chip>

<Chip color="grey" onRemove={() => removeFilter()}>
  Filter: Category
</Chip>
```

### Form Components

Components for building forms and collecting user input.

#### Textarea

Multi-line text input with auto-resize capability.

#### Features:
- Label with optional required indicator
- Error message display
- Character counter (when `maxLength` provided)
- Auto-resize based on content
- Disabled state support
- Placeholder text

#### Props:
- `label`: Field label
- `error`: Error message
- `required`: Shows asterisk
- `maxLength`: Maximum characters allowed
- `rows`: Minimum number of rows

#### Checkbox

Standard checkbox input with label support.

#### Features:
- Custom styled checkbox
- Label text with proper spacing
- Checked/unchecked states
- Disabled state
- Focus visible indicators
- Accessible keyboard navigation

#### Radio

Radio button input for mutually exclusive options.

#### Features:
- Custom styled radio button
- Label text support
- Selected/unselected states
- Disabled state handling
- Focus indicators
- Group support for multiple options

#### Select

Dropdown selection component for choosing from options.

#### Features:
- Label with optional required indicator
- Error message display
- Placeholder text
- Disabled state
- Custom styling matching design system
- Native select functionality

#### MultiSelect

Multi-option selection component with checkbox support.

#### Features:
- Select multiple options
- Search/filter capability
- Select all/deselect all
- Visual indication of selected items
- Dropdown interface
- Keyboard navigation -->

<!-- ### Navigation Components

Components for application navigation and layout.

#### Logo

Application logo component with consistent styling.

#### Features:
- SVG-based logo
- Responsive sizing
- Link to home page
- Accessible alt text

#### MenuItem

Sidebar navigation item with active state.

#### Features:
- Icon support
- Active state highlighting
- Hover effects
- Badge/counter support
- Nested menu support

#### MainHeader

Top navigation header component.

#### Features:
- Logo placement
- User profile dropdown
- Navigation items
- Search integration
- Responsive layout

#### SidebarHeader

Sidebar header with branding and controls.

#### Features:
- Logo display
- Collapse/expand controls
- Responsive behavior
- Consistent styling

#### SidebarContent

Main sidebar navigation content.

#### Features:
- Collection list
- Quick actions
- Chat history
- Settings access
- Scrollable content area -->
<!-- 
### Display Components

Components for displaying information and data.

#### Avatar

User avatar with fallback to initials.

#### Features:
- Image support
- Initials fallback
- Customizable size
- Border and styling options
- Accessibility attributes

#### Toast

Notification messages that appear temporarily.

#### Types:
- `success`: Green theme for positive feedback
- `error`: Red theme for errors
- `warning`: Orange theme for warnings
- `info`: Blue theme for information

#### Features:
- Auto-dismiss timer
- Manual close button
- Icon based on type
- Animation on show/hide
- Stacking multiple toasts

#### Tooltip

Contextual information on hover.

#### Features:
- Multiple positions (top, right, bottom, left)
- Automatic positioning
- Hover trigger
- Customizable content
- Arrow indicator
- Accessible implementation

#### NoData

Empty state component when no data is available.

#### Features:
- Custom icon support
- Title and description
- Action button option
- Centered layout
- Consistent empty state design -->

<!-- ### Interactive Components

Advanced interactive components for rich user experiences.

#### Switch

Toggle component for binary choices (e.g., view modes).

#### Features:
- Left and right icon support
- Optional labels
- Active state highlighting
- Smooth transitions
- Data attributes for testing (`data-cy`)
- Accessible button implementation

**Usage Example:**
```typescript
<Switch
  leftIcon={ListIcon}
  rightIcon={GridIcon}
  value={viewMode}
  onChange={(value) => setViewMode(value)}
  leftLabel="List View"
  rightLabel="Grid View"
/>
```

#### Dropdown

Generic dropdown menu component.

#### Features:
- Trigger button customization
- Menu items with icons
- Dividers between sections
- Click outside to close
- Keyboard navigation
- Portal rendering for proper z-index

#### CollectionsDropdown

Specialized dropdown for managing collections.

#### Features:
- Collection list
- Create new collection
- Add to collection
- Visual feedback
- Search collections

#### UserProfileDropdown

User account menu dropdown.

#### Features:
- User info display
- Settings link
- Logout option
- Profile picture
- Keyboard accessible -->
<!-- 
### Specialized Components

Domain-specific components for DataGEMS features.

#### Search

Advanced search input with clear functionality.

#### Features:
- Search icon
- Clear button
- Submit on Enter
- Loading state
- Placeholder text
- Debouncing support

#### SmartSearch

AI-powered search interface.

#### Features:
- Toggle for smart search mode
- Visual indicators
- Example queries
- Integration with AI backend
- Match highlighting

#### SmartSearchRecommendation

Pre-defined search examples for smart search.

#### Features:
- Clickable example queries
- Categorized examples
- Quick start for users
- Visual cards

#### SmartSearchMatchItem

Display component for search results with AI matching.

#### Features:
- Match percentage display
- Highlighted matches
- Result metadata
- Click to view details -->
<!-- 
### Dataset Components

Components specific to dataset management and display.

#### DatasetCard

Card component for displaying dataset information.

#### Features:
- Two view modes: grid and list
- Favorite/star functionality
- Selection checkbox
- Collection badges
- Metadata display
- Smart search match indicator
- Click to view details
- Expandable sections

#### DatasetCardSkeleton

Loading placeholder for dataset cards.

#### Features:
- Matches DatasetCard layout
- Animated loading effect
- Grid and list variants
- Smooth transitions

#### FileUploadCard

File upload interface for datasets.

#### Features:
- Drag and drop support
- File type validation
- Progress indicator
- File preview
- Multiple file support
- Error handling

#### LicenseCard

License selection for datasets.

#### Features:
- License dropdown
- Description display
- Custom license option
- Validation support

#### VisibilityCard

Dataset visibility settings.

#### Features:
- Public/private toggle
- Access control options
- Visual indicators
- Permission settings -->
<!-- 
### Chat Components

Components for the AI chat interface.

#### ChatInput

Text input for chat messages.

#### Features:
- Multi-line support
- Auto-resize
- Submit button
- File attachment option
- Character limit indicator
- Disabled state during processing

#### ChatMessages

Container for displaying chat conversation.

#### Features:
- Auto-scroll to bottom
- Loading states
- Empty state handling
- Message grouping
- Date separators

#### AIMessage

AI-generated message component.

#### Features:
- Markdown rendering
- Code syntax highlighting
- Source citations
- Copy to clipboard
- Expandable sections

#### UserMessage

User-sent message component.

#### Features:
- User avatar
- Timestamp
- Edit capability
- Delete option
- Consistent styling

#### DataTable

Table component for displaying data in AI responses.

#### Features:
- Sortable columns
- Responsive design
- Cell formatting
- Striped rows
- Loading states

#### TemperatureMap

Visualization component for temperature data.

#### Features:
- Color-coded heatmap
- Interactive tooltips
- Legend
- Responsive sizing
- Data point highlighting -->

### Modal Components

Overlay components for focused interactions.

#### ConfirmationModal

Generic confirmation dialog.

#### Features:
- Title and message
- Confirm and cancel buttons
- Customizable actions
- Focus trap
- Escape key to close
- Backdrop click to close

#### FilterModal

Advanced filtering interface.

#### Features:
- Multiple filter types
- Date range pickers
- Hierarchical categories
- Apply and reset buttons
- Preview of active filters

#### CollectionSettingsModal

Manage collection visibility and order.

#### Features:
- Drag and drop reordering
- Visibility toggle
- Persist preferences
- Reset to default option

### Layout Components

Components for structuring page layouts.

#### FormSectionLayout

Consistent layout for form sections.

#### Features:
- Section header
- Description text
- Content area
- Divider lines
- Responsive spacing

#### FormattedText

Text component with formatting support.

#### Features:
- Markdown rendering
- Link handling
- Heading styles
- List formatting
- Code blocks

<!-- ## Component Guidelines

### Accessibility

All components follow accessibility best practices:

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper ARIA attributes for screen readers
- **Focus Indicators**: Clear visual focus states
- **Color Contrast**: WCAG AA compliant color contrast ratios
- **Semantic HTML**: Use of proper HTML elements

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

### Performance

Components are optimized for performance:

- **Code Splitting**: Components lazy-loaded when needed
- **Memoization**: Prevent unnecessary re-renders
- **Optimized Re-renders**: React.memo for pure components
- **Efficient Event Handlers**: Debounced and throttled where appropriate

## Testing

Components are thoroughly tested:

- **Unit Tests**: Individual component behavior
- **Integration Tests**: Component interactions
- **E2E Tests**: Full user workflows with Cypress
- **Visual Regression**: Automated screenshot comparison
- **Accessibility Tests**: Automated a11y checks

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
5. **Controlled components**: Let parent control component state when needed -->

## Related Documentation

- [Component Guidelines](component-guidelines.md) - Design principles and patterns
- [Theming](theming.md) - Color schemes and customization
- [Testing Methods](qa.md) - Testing strategies and practices

## External Resources

- [Storybook Documentation](https://storybook.js.org/docs) - Official Storybook docs
- [React Documentation](https://react.dev/) - React framework documentation
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript language guide
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Web accessibility standards

