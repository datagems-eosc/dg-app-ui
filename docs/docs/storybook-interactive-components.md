### Interactive Components

Advanced interactive components for rich user experiences.

#### Switch

A switch with two options (like left/right or on/off) with icons.

#### Features:
- Left and right icon support
- Optional labels
- Active state highlighting
- Smooth transitions
- Data attributes for testing (`data-cy`)
- Accessible button implementation


#### How to use:
- Click either side to switch between options
- Active side has a light gray background
- Icon shows which option is selected

#### Example uses:
- Switching between list and grid view
- Toggling Smart Search on/off

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
- Keyboard accessible