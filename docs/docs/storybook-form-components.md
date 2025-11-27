### Foundation Components

These are the building blocks used throughout the application.

## Form Controls

#### Button

Versatile button component with multiple variants and sizes.

**Variants:**
- `primary`: (Blue) - Main actions like "Save" or "Create"
- `outline`: (White with border) - Secondary actions like "Cancel"  
- `secondary`: (gray background) Alternative primary actions 
- `ghost`: (Transparent) - Subtle actions in toolbars
- `tertiary`: (Light gray) - Minor actions

**Sizes:**
- `icon`: 32px square for icon-only buttons
- `sm`: Small 32px height
- `md`: Medium 40px height (default)
- `lg`: Large 48px height

**Features:**
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

**Sizes:**
- `medium`: Standard height (default)
- `large`: Increased height for emphasis

**Features:**
- **Label** - Shows what information to enter
- **Placeholder** - Light gray text showing example input
- **Error message** - Red text if something is wrong
- **Required indicator** (red asterisk *) - Must be filled out
- **Icons** - Small images on the left or right side

**Props:**
- `label`: Optional label text
- `error`: Error message to display
- `icon`: Left-side icon component
- `rightIcon`: Right-side icon component
- `required`: Shows asterisk in label
- `disabled`: Disables input with visual feedback

**States:**
- Normal - Ready to type
- Focused - Blue ring when you click inside
- Error - Red border when there's a problem
- Disabled - Grayed out, cannot edit

**How to use:**
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

#### Chip / Tag

Small, compact elements displaying tags, filters, or status information.

**Variants:**
- `regular`: Solid background (default)
- `outline`: Border with transparent background

**Colors:**
- `warning`**Orange** - Warnings
- `info` **Blue** - Categories
- `success` **Green** - Open Access
- `error`**Red** - Errors
- `grey`**Gray** (Default) - General labels
- `smart-search`: Special theme for AI-powered features

**Sizes:**
- `xs`: Extra small for compact spaces
- `sm`: Small size
- `md`: Medium size (default)

**Features:**
- Optional remove button (X icon)
- Customizable colors and variants
- Compact design for data display
- Outline chips have a border and white background
- Letter spacing for readability

**Example uses:**
- Dataset category labels
- Access type badges
- Removable keyword tags


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

**Features:**
- Type multiple lines of text
- Label with optional required indicator
- Error message display
- Character counter e.g., "45/3000" (when `maxLength` provided)
- Auto-resize based on content
- Disabled state support
- Placeholder text

**Props:**
- `label`: Field label
- `error`: Error message
- `required`: Shows asterisk
- `maxLength`: Maximum characters allowed
- `rows`: Minimum number of rows

**How to use:**
1. Click inside
2. Type your text (press Enter for new lines)
3. Watch the character counter if shown

**Example uses:**
- Writing dataset descriptions
- Adding notes or comments

#### Checkbox

Checkboxes let you turn options on (checked) or off (unchecked).

**Features:**
- Custom styled checkbox
- Label text with proper spacing
- Checked/unchecked states
- Disabled state
- Focus visible indicators
- Accessible keyboard navigation

**How to use:**
- Click the box or label to check/uncheck
- Checked = Blue box with white checkmark
- Unchecked = Empty white box
- You can check multiple boxes in a group

**Example uses:**
- Selecting multiple datasets
- Agreeing to terms
- Enabling features

#### Radio

Radio buttons let you choose ONE option from a group.

**Features:**
- Custom styled radio button
- Label text support
- Selected/unselected states
- Disabled state handling
- Focus indicators
- Group support for multiple options

**How to use:**
- Click a circle to select that option
- Only one can be selected at a time
- Selected option has a blue filled circle
- Unselected options have empty circles

**Example uses:**
- Choosing dataset visibility (Public/Private)
- Selecting a single license type

#### Select

Dropdowns let you choose one option from a list.

**Features:**
- Label with optional required indicator
- Click to open the list of options
- Click an option to select it
- Selected option stays visible when closed
- Error message display
- Placeholder text
- Disabled state
- Custom styling matching design system
- Native select functionality

**How to use:**
1. Click the dropdown
2. Scroll through options if needed
3. Click your choice
4. The dropdown closes automatically

**Example uses:**
- Choosing a license type
- Selecting a category
- Picking a file type

#### MultiSelect

Multi-option selection component with checkbox support.

**Features:**
- Select multiple options
- Search/filter capability
- Select all/deselect all
- Visual indication of selected items
- Dropdown interface
- Keyboard navigation
