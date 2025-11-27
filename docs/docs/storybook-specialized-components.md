### Specialized Components

Domain-specific components for DataGEMS features.

#### Search

Advanced search input with clear functionality.

**Features:**
- Magnifying glass icon on the left
- Type to search
- Clear button (X) appears when you type
- Press Enter to search
- Loading state
- Placeholder text
- Debouncing support

**How to use:**
1. Click in the search bar
2. Type at least 3 characters
3. Press Enter or wait for auto-search
4. Click X to clear your search

#### SmartSearch

Enhanced search with AI that finds datasets based on meaning, not just keywords.

**Features:**
- Toggle for smart search mode
- Visual indicators
- Example queries
- Integration with AI backend
- Match highlighting

**How to use:**
1. Toggle Smart Search ON (green indicator)
2. Type your question naturally (e.g., "weather data in Greece")
3. Results show datasets matching the meaning
4. Each result shows similarity score and relevant text snippets

**Benefits:**
- Finds datasets even if they don't use your exact words
- Shows why each result matches
- Searches across dataset content, not just titles


#### SmartSearchRecommendation

Pre-defined search examples for smart search.

**Features:**
- Clickable example queries
- Categorized examples
- Quick start for users
- Visual cards

#### SmartSearchMatchItem

Display component for search results with AI matching.

**Features:**
- Match percentage display
- Highlighted matches
- Result metadata
- Click to view details
