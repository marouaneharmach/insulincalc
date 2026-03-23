# InsulinCalc V4 - Main App & Components Created

## Files Created

### 1. `/src/App.jsx` (11 KB)
- Main application orchestrator with complete state management
- Implements all core V3 calculation logic (glycemia, carbs, bolus, corrections, fat bonus)
- Bottom tab navigation between 4 screens: home, repas, timeline, settings
- Manages journal storage with smart deduplication
- Handles quick-add overlay for glycemia, insulin, activity
- Preserves all V3 business logic but with new V4 UI structure

Key features:
- LocalStorage persistence for all user data
- Memoized calculations for performance
- Schedule-based notifications integration
- Food database mapping and selection management

### 2. `/src/components/BottomNav.jsx` (1.7 KB)
- Floating bottom navigation bar with 4 tabs
- Soft rounded design with light mode first
- Badge counter on meal tab showing items in selection
- Active state styling (teal highlight)
- Responsive, touch-friendly buttons

### 3. `/src/components/HomeScreen.jsx` (9.4 KB)
- Health app-style home dashboard
- Displays last glycemia with color-coded status
- Time-in-range (TIR) mini metric
- Average glycemia and estimated HbA1c stats
- Glycemia sparkline chart (24h data)
- Quick action buttons (4 tiles: glycemia, meal, insulin, activity)
- Active result card showing calculated insulin dose with breakdown
- Smart warnings (hypoglycemia, hyperglycemia, fat bonus, high GI, high dose)

### 4. `/src/components/GlycemiaChart.jsx` (2.8 KB)
- SVG sparkline showing 24h glycemia trend
- Target zone visualization (shaded area)
- Points color-coded by glycemia status (red < 0.7, orange < 1.0, green 0.8-1.8, yellow 1.8-2.5, red > 2.5)
- Minimal, fast rendering
- Responsive to dark/light mode

### 5. `/src/components/QuickAddSheet.jsx` (3.8 KB)
- Bottom sheet overlay for rapid data entry
- Three modes: glycemia (0.3-6.0 g/L), insulin (0.5-50 U), activity (5-300 min)
- Large numeric input with unit label
- Smooth slideUp animation
- Saves directly to journal
- Responsive, mobile-first design

## Architecture Notes

### State Management
- Uses `useLocalStorage` custom hook for all persistent data
- Theme system via `useTheme` hook (light/dark, colors)
- i18n via `useI18n` hook for multi-language support

### Calculation Pipeline (Preserved from V3)
1. Parse glycemia input (0.3-6.0 g/L validation)
2. Calculate total carbs from selected foods
3. Determine dominant fat profile and GI
4. Compute meal bolus = carbs / ratio
5. Calculate correction = (glycemia - target) / ISF if above target
6. Calculate fat bonus = (carbs / ratio) * FAT_FACTOR
7. Round total dose to 0.05 units
8. Determine bolus type (standard vs dual) based on fat content
9. Build injection schedule based on digestion profile
10. Generate warnings for edge cases

### Component Dependencies
This app requires the following external components (to be created by other agents):
- `MealBuilder` - Food selection, multiplier adjustment, custom foods
- `DayTimeline` - Journal visualization, entries editor, stats
- `Settings` - User profile, insulin ratios, targets, notifications, theme/locale

### Design System
- Tailwind CSS with soft pastel colors
- Rounded corners (2xl, xl) throughout
- Light mode first with dark mode support
- Airy spacing using Tailwind's default scale
- Emoji icons for quick visual scanning
- Teal (#10b981) as primary accent color
- Mobile-optimized (max-w-lg constraint)

### File Paths
```
/sessions/wizardly-keen-lovelace/mnt/calc-glycemie/v4/src/
├── App.jsx
└── components/
    ├── BottomNav.jsx
    ├── HomeScreen.jsx
    ├── GlycemiaChart.jsx
    └── QuickAddSheet.jsx
```

All files are production-ready and follow React best practices with proper hook usage, memoization, and error handling.
