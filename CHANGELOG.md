# Changelog

All notable changes to AlphaForge Knob Modeler will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-25

### Added
- **Light/Dark Mode**: Full theme support with toggle button in sidebar
  - Theme preference persists across sessions via localStorage
  - All UI components (tooltips, toasts, modals, inputs) adapt to theme
  - 3D canvas background and grid colors change with theme
- **Error Boundary Component**: Catches and displays rendering errors gracefully
  - Theme-aware error display with "Try Again" and "Reload App" options
  - Detailed error information available in expandable section
- **Custom Confirm Modal**: Replaced native `confirm()` with accessible modal
  - Theme-aware styling
  - Better UX with customizable buttons and variants
  - Proper ARIA labels and keyboard navigation
- **ConfirmModal Component**: Reusable confirmation dialog with theme support
- **CHANGELOG.md**: Official changelog to track version changes

### Changed
- **Improved Security**:
  - Removed API key exposure from Vite build configuration
  - Added `.env.production` to `.gitignore`
  - API keys only handled in Electron main process and user localStorage
- **Better TypeScript Types**:
  - Created `ControlGroupProps` interface
  - Eliminated all `any` types in ControlGroup component
- **Performance Optimizations**:
  - Memoized validation functions with `useMemo`
  - Reduced unnecessary re-renders
- **Enhanced Accessibility**:
  - Increased touch targets to minimum 44x44px for mobile
  - Updated drill/hole add buttons with proper padding
  - Added ARIA labels to ControlGroup inputs
  - Theme-aware focus indicators
- **UI Improvements**:
  - Updated Tooltip component with theme support
  - Updated Toast component with theme support and localStorage sync
  - Improved InfoTooltip with theme-aware colors
  - Better contrast ratios in light mode
- **Version Updates**:
  - Splash screen now displays v1.1.0
  - Removed "BETA" designation (production-ready)

### Fixed
- **Memory Leaks**:
  - Added geometry and material disposal to EnclosureMesh component
  - Proper cleanup of Three.js resources on unmount
- **Theme Consistency**:
  - Fixed hardcoded dark mode colors throughout the app
  - Grid colors now respect theme setting
  - All hole parameter inputs properly themed
- **White-on-White Text**: Fixed readability issues in light mode
  - Updated text colors for proper contrast
  - Fixed icon colors to use darker shades in light mode

### Security
- Removed dangerous `define` block from vite.config.ts that embedded API keys
- Ensured electron-icon-builder remains in devDependencies only
- Verified no secrets are exposed in production builds

## [1.0.4] - 2024-XX-XX

### Added
- Initial public release
- AI-powered knob generation with Gemini API
- Real-time 3D preview with Three.js
- STL export functionality
- Cross-platform support (Windows, Linux, Android)
- Parametric controls for all knob dimensions
- Multiple knob shape presets
- Enclosure designer with drill templates
- Auto-update functionality

### Known Issues
- Shaft diameter tolerance needs calibration adjustment
- macOS builds not yet available

---

## Version History

- **v1.1.0** (2025-12-25) - Light/Dark Mode, Security & Performance Update
- **v1.0.4** (2024) - Initial Public Release
