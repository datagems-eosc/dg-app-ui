### Display Components

Components for displaying information and data.

#### Avatar

Circular image representing a user with fallback to initials.

**Features:**
- User photo (if available)
- Initials (first letter of first and last name)
- Placeholder icon
- Customizable size
- Border and styling options
- Accessibility attributes

**Sizes:**
- Small (sm) - 32px
- Medium (md) - 40px  
- Large (lg) - 48px

**Where you see it:**
- User profile menu
- Collection owner
- Chat messages


#### Toast

Pop-up messages that appear in the bottom-right corner for 3 seconds.

**Types:**
- `success`: Green theme for positive feedback
- `error`: Red theme for errors
- `warning`: Orange theme for warnings
- `info`: Blue theme for information

**Features:**
- Auto-dismiss timer
- Appears automatically after an action
- Shows a checkmark (✓) or warning icon
- Displays a brief message
- Click X to close it early
- Disappears automatically after 3 seconds
- Animation on show/hide
- Stacking multiple toasts

**Example messages:**
- "Dataset added successfully"
- "Failed to update collection"

#### Tooltip

Small text that appears when you hover over an element.

**Features:**
- Multiple positions (top, right, bottom, left)
- Automatic positioning
- Hover trigger
- Customizable content
- Arrow indicator
- Accessible implementation

**How to use:**
- Move your mouse over an icon or button
- Wait 0.5 seconds
- Tooltip appears with helpful text
- Move mouse away to hide it

**Example uses:**
- Explaining icon buttons
- Showing full text of truncated names
- Providing hints


#### NoData

Empty state component when no data is available.

**Features:**
- Custom icon support
- Title and description
- Action button option
- Centered layout
- Consistent empty state design