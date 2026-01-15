# Storybook Images

This directory contains screenshots and images for the UI Components documentation.

## Required Images

To enhance the UI Components documentation, add the following screenshots from Storybook:

### Foundation Components
- `button-variants.png` - Button component showing all variants (primary, outline, secondary, ghost, tertiary)
- `button-sizes.png` - Button component showing all sizes (icon, sm, smPlus, md, lg)
- `input-states.png` - Input component showing normal, error, and disabled states
- `chip-variants.png` - Chip component showing different colors and variants

### Form Components
- `textarea-example.png` - Textarea component with label and character counter
- `checkbox-example.png` - Checkbox component examples
- `radio-example.png` - Radio button group example
- `select-example.png` - Select dropdown example
- `multiselect-example.png` - Multi-select component in action

### Interactive Components
- `switch-example.png` - Switch component showing both states
- `dropdown-example.png` - Dropdown menu opened
- `tooltip-example.png` - Tooltip component in different positions

### Display Components
- `avatar-example.png` - Avatar component with different sizes
- `toast-types.png` - Toast notifications showing all types (success, error, warning, info)
- `nodata-example.png` - Empty state component example

### Specialized Components
- `search-example.png` - Search component with clear button
- `smart-search-example.png` - Smart search interface
- `smart-search-examples.png` - Smart search example queries

### Dataset Components
- `dataset-card-grid.png` - Dataset card in grid view
- `dataset-card-list.png` - Dataset card in list view
- `file-upload-card.png` - File upload interface
- `license-card.png` - License selection component

### Chat Components
- `chat-input.png` - Chat input component
- `chat-messages.png` - Chat conversation view
- `ai-message.png` - AI-generated message with formatting
- `user-message.png` - User message display
- `data-table.png` - Data table in chat response

### Modal Components
- `confirmation-modal.png` - Confirmation dialog
- `filter-modal.png` - Filter modal interface
- `collection-settings-modal.png` - Collection settings modal

## Image Guidelines

When adding screenshots:

1. **Resolution**: Use 2x resolution for retina displays (e.g., 1600x900 for 800x450 display size)
2. **Format**: PNG format with transparency where appropriate
3. **Naming**: Use kebab-case naming (e.g., `button-variants.png`)
4. **Background**: Use clean, light background matching the application theme
5. **Content**: Show realistic data, avoid lorem ipsum or placeholder text
6. **Size**: Optimize images for web (compress without losing quality)
7. **Consistency**: Use the same zoom level and styling across all screenshots

## Capturing Screenshots from Storybook

1. Open Storybook: `npm run storybook`
2. Navigate to the component story
3. Adjust viewport size if needed
4. Use browser screenshot tool or screenshot extension
5. Crop to show just the relevant component
6. Optimize the image size
7. Save with appropriate filename in this directory

## Using Images in Documentation

Reference images in markdown files using relative paths:

```markdown
![Button Variants](images/storybook/button-variants.png)
```

Or with alt text and title:

```markdown
![Button component showing all available variants](images/storybook/button-variants.png "Button Variants")
```

## Tools for Image Optimization

- [TinyPNG](https://tinypng.com/) - PNG compression
- [Squoosh](https://squoosh.app/) - Image optimization
- [ImageOptim](https://imageoptim.com/) - Mac app for optimization
- [SVGOMG](https://jakearchibald.github.io/svgomg/) - SVG optimization

