# Cortex Icons

This directory should contain the extension icons in PNG format. The provided `icon.svg` is the master design.

## Required Icons

| File | Size | Usage |
|------|------|-------|
| `icon16.png` | 16×16 px | Extension toolbar icon (small) |
| `icon48.png` | 48×48 px | Extension management page |
| `icon128.png` | 128×128 px | Chrome Web Store, install dialog |

## How to Generate PNGs from the SVG

Use any of these methods:

### Option 1: Using Inkscape (free)
```bash
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png
```

### Option 2: Using ImageMagick
```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Option 3: Using an online tool
Upload `icon.svg` to any SVG-to-PNG converter and export at 16px, 48px, and 128px.

### Option 4: Using rsvg-convert (librsvg)
```bash
rsvg-convert -w 16 -h 16 icon.svg -o icon16.png
rsvg-convert -w 48 -h 48 icon.svg -o icon48.png
rsvg-convert -w 128 -h 128 icon.svg -o icon128.png
```

## Design

The icon features:
- **Gradient background**: Emerald green (#10b981) to Cyan (#06b6d4)
- **Rounded rectangle**: 28px border radius
- **Center letter "C"**: Bold white, representing "Cortex"
- **Neural network dots and lines**: Representing AI memory and connections
- **Subtle shadow**: For depth

The design conveys intelligence, memory, and modern AI aesthetics.
