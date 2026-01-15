## Dataset Components

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

#### What's included:
- Title
- Description (first few lines)
- Category chip (colored label)
- Access badge (Open Access / Restricted)
- Size
- Last updated date
- Keywords
- Actions (ADD button, favorite star)

#### How to interact:
- Click the card to see full details
- Click ADD to add it to a collection
- Click star to add to favorites
- Use the 3-dot menu for more actions


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
- Permission settings

## Status Indicators

### Loading States

**Spinner**
- Small rotating circle
- Appears while content is loading
- Located where the content will appear

**Skeleton**
- Gray placeholder shapes
- Shows while dataset cards are loading
- Gives a preview of the layout

### Empty States

**No Data Message**
- Shown when there are no results
- Example: "No datasets found"
- Includes friendly icon and message
