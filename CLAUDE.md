# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlphaForge Knob Modeler is a cross-platform AI-powered 3D modeling application for creating custom 3D-printable knobs and guitar pedal enclosures. Built with Electron, React, Three.js, and Google Gemini AI.

**Key Technologies:**
- Frontend: React 19, TypeScript, Three.js, React Three Fiber
- Desktop: Electron 39 with IPC-based security
- Mobile: Capacitor for Android builds
- AI: Google Gemini API for natural language parameter generation
- 3D: Three.js with @react-three/fiber, @react-three/drei, and three-bvh-csg for CSG operations

## 🚨 Security & Critical Issues

### CRITICAL: Hardcoded Android Credentials
**Location:** `android/app/build.gradle:19-26`

The Android keystore password is **hardcoded as `"password123"`** in version control. This is a **major security vulnerability**.

**DO NOT use these credentials in production.** Before releasing:
1. Generate a new keystore with a strong password
2. Move credentials to `android/keystore.properties` (add to `.gitignore`)
3. Update `build.gradle` to read from properties file

### Build Script Cross-Platform Issue
The `build:clean` script uses Unix `rm -rf` which **fails on Windows**. Use `rimraf` for cross-platform compatibility or run builds on Unix-based systems.

## Development Commands

### Running the App

```bash
# Development mode (hot reload)
npm run electron:dev

# Web-only development (no Electron)
npm run dev

# Production Electron build
npm run electron
```

### Building for Distribution

```bash
# Clean build artifacts
npm run build:clean  # WARNING: Unix only, fails on Windows

# Platform-specific builds
npm run electron:build:win     # Windows (.exe installer + portable)
npm run electron:build:mac     # macOS (.dmg + .zip)
npm run electron:build:linux   # Linux (.AppImage + .deb)
npm run electron:build:all     # All platforms

# Build outputs go to: dist-electron/
# CRITICAL: Always upload latest.yml to GitHub Release for auto-update to work
```

### Android Build (Capacitor)

```bash
# Install Capacitor dependencies
npm install

# Build web assets first
npm run build

# Sync web build to Android (REQUIRED before building)
npx cap sync android

# Open in Android Studio
npx cap open android

# Build APK from Android Studio or:
cd android && ./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

**Requirements:**
- Java 17 (JDK)
- Android SDK (minSdk: 22, targetSdk: 35)
- Gradle 8.11.1 (auto-downloaded)

## Architecture

### Dual-Mode Application

The app operates in two modes, switchable via UI toggle:
1. **Knob Mode** - Design parametric knobs with AI assistance
2. **Enclosure Mode** - Design guitar pedal enclosures with drill templates

### Security Model (API Keys)

**Electron (Desktop):**
- API key stored in `.env.local` as `GEMINI_API_KEY`
- Key lives only in main process (`electron.cjs`)
- IPC handler `generate-knob-params` in main process makes AI calls
- Renderer never sees the API key (contextIsolation + preload.cjs)

**Web/Mobile:**
- Users provide their own API key via modal
- Key stored in `localStorage` (client-side only)
- AI calls made directly from `geminiService.ts` using client-provided key

### File Structure

```
App.tsx                     # Main React app, mode switcher, parameter controls
electron.cjs                # Electron main process (IPC, auto-updater, API key)
preload.cjs                 # Secure IPC bridge (contextBridge)
components/
  ├── KnobMesh.tsx          # Parametric 3D knob generator (CSG geometry)
  ├── EnclosureMesh.tsx     # Guitar pedal enclosure generator (CSG)
  ├── ElectronicParts.tsx   # 3D reference models for enclosure parts
  └── SplashScreen.tsx      # App startup splash
services/
  ├── geminiService.ts      # AI parameter generation (IPC or direct)
  └── exportService.ts      # STL/SVG export utilities
types/
  └── EnclosureTypes.ts     # Enclosure definitions (1590A, 1590B, etc.)
types.ts                    # Knob parameter types and enums
```

### Key Design Patterns

**Multi-Platform Execution Pattern:**
- Code detects environment via `window.electronAPI` presence
- Electron: API keys in main process, accessed via IPC
- Web/Mobile: API keys in localStorage, direct API calls
- Same React codebase runs in all environments
- See `services/geminiService.ts` for pattern implementation

**Parametric 3D Generation:**
- All 3D models are procedurally generated from parameters (no static assets)
- Uses CSG operations (union/subtract) via `@react-three/csg` library
- Geometry dynamically created in `useMemo` hooks based on parameter changes
- **CRITICAL:** Must dispose geometries in `useEffect` cleanup to prevent memory leaks

**Geometry Slicing Pattern (Multi-Material):**
- KnobMesh splits geometry into vertical "slices" at different heights
- Each slice can have different materials (body color vs cap color)
- Enables two-tone knobs and separable cap/body designs
- Pattern in `KnobMesh.tsx:139-220`
- Slices: Body Shaft Zone (hollow) → Body Solid Zone → Cap Shaft Zone → Cap Top Zone

**CSG Operation Pattern:**
```tsx
<mesh material={material}>
  <Geometry>
    <Base>
      <boxGeometry args={[width, height, depth]} />
    </Base>
    {/* Add features */}
    <Addition position={pos}>
      <cylinderGeometry args={[radius, radius, height]} />
    </Addition>
    {/* Subtract holes */}
    <Subtraction position={pos} rotation={rot}>
      <cylinderGeometry args={[radius, radius, depth]} />
    </Subtraction>
  </Geometry>
</mesh>
```
- **Order matters:** Base → Additions → Subtractions
- Use generous depths (40mm) for hole subtractions to ensure complete penetration
- See `EnclosureMesh.tsx:93-123` for advanced example

**State Management:**
- Single source of truth: `knobParams` or `enclosureParams`
- Parameters updated via `handleUpdateKnobParam` / `handleUpdateEnclosureParam`
- No external state library - React hooks only
- No state persistence (lost on refresh) - save/load not implemented yet

**Export Pipeline:**
- STL: Uses `STLExporter` from Three.js examples
- **Visibility toggling trick:** Hide unwanted parts → export → restore visibility
- Meshes filtered by `name` property (e.g., "Body_*", "Cap_*")
- SVG drill templates: 3D holes mapped to 2D face layouts
- See `App.tsx:136-175` for export pattern

### IPC Communication (Electron)

**Main Process → Renderer:**
- Auto-update events: `update-available`, `update-downloaded`, etc.

**Renderer → Main Process:**
- `generate-knob-params(description)` - AI parameter generation
- `check-for-updates()`, `download-update()`, `install-update()` - Auto-updater

**Exposed in preload.cjs:**
```javascript
window.electronAPI = {
  generateKnobParams: (desc) => ipcRenderer.invoke('generate-knob-params', desc),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // ... update handlers
}
```

### Memory Management

**Critical for Three.js:**
- Always dispose geometries/materials when components unmount
- Use `useLayoutEffect` for ref forwarding (synchronous before paint)
- Use `useEffect` with cleanup for geometry disposal
- URL.revokeObjectURL() after STL downloads
- See `KnobMesh.tsx:229-237` for disposal pattern

**Memory Leak Prevention:**
```typescript
// Create geometry in useMemo
const slices = useMemo(() => {
  const regions = [];
  const geo = new THREE.ExtrudeGeometry(shape, settings);
  regions.push({ geo, y, color, name });
  return regions;
}, [params, shapes]);

// Dispose in useEffect cleanup
useEffect(() => {
  return () => {
    slices.forEach(slice => {
      if (slice.geo) slice.geo.dispose();
    });
  };
}, [slices]);
```

### Type System

**Enums:**
- `ShaftType` - D-Shaft, Round, Splined
- `KnobShape` - Cylinder, Polygon, Fluted, Teardrop, Pointer
- `HoleFace` - Top, Front, Back, Left, Right, Bottom (for enclosures)
- `ComponentType` - Potentiometer, Foot Switch, Audio Jack, LED, etc.

**Interfaces:**
- `KnobParameters` - All knob geometry parameters
- `EnclosureParameters` - Enclosure model, holes, wall thickness
- `DrillHole` - Individual drill specification (type, face, position, diameter)

## AI Integration

**Prompt Engineering:**
- AI takes natural language descriptions (e.g., "Two-tone HiFi knob")
- Returns JSON with partial parameter updates
- See `electron.cjs:42-54` or `geminiService.ts:34-68` for prompt templates
- Model: `gemini-pro` (Google Generative AI)

**Response Parsing:**
- Extracts JSON from markdown code blocks using regex: `/\{[\s\S]*\}/`
- Merges partial updates into existing parameters (spread operator)

## Cross-Platform Notes

**Electron Builder Config:**
- NSIS installer for Windows (allows custom install location)
- Portable .exe for Windows (no install required)
- DMG + ZIP for macOS (both x64 and arm64)
- AppImage + .deb for Linux
- Icons: `build/icon.ico` (Windows), `build/icon.icns` (macOS), `build/icons/` (Linux)

**Capacitor (Android):**
- Uses Vite build output (`dist/`) as webDir
- App ID: `com.alphaforge.knobmodeler`
- Gradle build scripts in `android/`
- APK signed via Android Studio

**Auto-Updates:**
- electron-updater with GitHub releases provider
- Only checks in production builds (not dev mode)
- Events: checking, available, not-available, downloaded, error
- Component: `UpdateNotification.tsx` shows user prompts

## 🔥 Critical Gotchas & Non-Obvious Behaviors

### Shaft Tolerance is Additive, Not Symmetric
**Location:** `KnobMesh.tsx:80-93`

The `holeTolerance` parameter is **ADDED to the shaft diameter**, not applied symmetrically:
```typescript
const actualHoleRadius = (params.shaftDiameter / 2) + params.holeTolerance;
```

For D-shaft, the flat position also moves outward by tolerance. This is correct for 3D printing but confusing to contributors. The developer acknowledges this calculation needs refinement.

### STL Export Name-Based Filtering
**Location:** `App.tsx:143-164`

Partial exports (body-only, cap-only) work by **hiding meshes based on name matching**:
- Names must include "Cap", "Body", or "Skirt" for filtering to work
- Changing mesh names breaks partial export feature
- Pattern: `child.name.includes('Cap')` → `child.visible = false`

### Geometry Disposal Must Match Creation
Each geometry created in `useMemo` **must** be disposed in `useEffect` cleanup. If you add new geometry slices, you MUST add them to the cleanup array. Failure causes memory leaks that compound with parameter changes.

### ExtrudeGeometry Orientation
`ExtrudeGeometry` creates upside-down geometry by default. **MUST rotate -90° on X-axis** to make upright:
```tsx
<mesh rotation={[-Math.PI/2, 0, 0]}>
  <extrudeGeometry args={[shape, { depth: height }]} />
</mesh>
```
This applies to all extrusions in the codebase (KnobMesh.tsx:155).

### CSG Operation Order Matters
CSG operations are applied **in declaration order**:
1. `<Base>` - Starting solid
2. `<Addition>` - Boolean union
3. `<Subtraction>` - Boolean difference on the result of previous operations

Subtractions after additions work on the **union result**, not the original base.

### Capacitor Sync is Manual
Changes to web code **do not auto-sync** to Android. Must run `npx cap sync android` before building APK. Android build is completely separate from Electron build.

### AI Response Parsing is Brittle
AI responses are parsed using regex `/\{[\s\S]*\}/` to extract JSON (geminiService.ts:75). This pattern could break with model updates or unexpected response formatting.

### ElectronAPI Type Declaration Duplication
`window.electronAPI` is declared locally in each service file that uses it (e.g., geminiService.ts:4-11). Should be in a global `global.d.ts` file to avoid duplication.

### Update Notification Desktop-Only
`UpdateNotification` component only shows on desktop (checks for `window.electronAPI`). Auto-updater completely disabled in web/mobile builds with no degradation message.

### No React Error Boundaries
No error boundaries detected. Crashes in 3D rendering could break entire app. Recommended: Add error boundaries around `<Canvas>` components.

### Material Creation Performance
JSX inline materials like `<meshStandardMaterial color="..." />` create **new materials on every render**. For frequently updated components, use `useMemo` instead:
```typescript
const material = useMemo(() => new THREE.MeshStandardMaterial({ color }), [color]);
```

### Vite Base Path Required
`vite.config.ts` **MUST** have `base: './'` for Electron builds. Absolute paths break in packaged apps. This is already configured correctly but critical to maintain.

## Known Issues & Tolerances

**Shaft Hole Accuracy:**
- 3D printer tolerances vary (shaft holes may be tight/loose)
- `holeTolerance` parameter (default: 0.15mm) adds clearance to diameter
- Users may need to adjust +0.2mm to +0.4mm for their specific printer
- **Known Issue:** Developer acknowledges tolerance calculation needs adjustment (README:57)

**Enclosure Models:**
- Based on Hammond/Tayda enclosure dimensions (1590A, 1590B, etc.)
- See `types/EnclosureTypes.ts` for internal dimensions
- Wall thickness defaults to 2mm

**No State Persistence:**
- App state is lost on refresh/close
- No localStorage backup for parameters (unlike API key)
- Save/load project files planned but not implemented (Roadmap: README:211)

## 3D Component Development Guide

### Adding New Knob Shapes

1. Add enum value to `KnobShape` in `types.ts`
2. Add shape generation logic in `KnobMesh.tsx` (lines 22-75) within the switch statement
3. Update AI prompt in `geminiService.ts` to recognize new shape
4. Add UI button in `App.tsx` shape selector (lines 420-433)

Example shape generation:
```typescript
case KnobShape.NEW_SHAPE: {
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = radius * yourFormula(theta);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  break;
}
```

### Adding New Enclosure Models

1. Add to `ENCLOSURE_DB` array in `types/EnclosureTypes.ts`
2. Provide dimensions: `{ name, width, height, length, desc }`
3. No code changes needed - UI updates automatically

### Material Strategy

**Static materials** (shared across instances):
```typescript
// Module-level declaration
const MAT_CHROME = new THREE.MeshStandardMaterial({
  color: "#dddddd",
  roughness: 0.1,
  metalness: 0.9
});
// Reuse in multiple components
```

**Dynamic materials** (user-controlled properties):
```typescript
const material = useMemo(() => {
  return new THREE.MeshPhysicalMaterial({
    color: params.color, // Depends on user input
    roughness: 0.6,
    metalness: 0.4,
  });
}, [params.color]); // Recreates when color changes
```

### Ref Forwarding Pattern for Export

```typescript
const localGroupRef = React.useRef<THREE.Group>(null);

useLayoutEffect(() => {
  if (groupRef && localGroupRef.current) {
    groupRef.current = localGroupRef.current; // Forward to parent
  }
});

return <group ref={localGroupRef}>{children}</group>;
```

**Why useLayoutEffect?** Synchronous execution before browser paint ensures parent has ref access for immediate STL export.

### CSG Best Practices

- Use **generous depths** for subtractions (40mm for holes) to ensure complete penetration
- Memoize position calculations to avoid CSG recomputation
- Each operation needs unique `key` when in arrays
- CSG is expensive - minimize operation count
- Test with simple geometry first, then add complexity

### Slicer View Implementation

The "Slicer" view overlays transparent planes without affecting geometry:
```typescript
const SlicerVisuals = ({ params }) => {
  const sliceCount = 10;
  const slices = [];
  for(let i = 0; i < sliceCount; i++) {
    const y = (params.height / sliceCount) * i;
    slices.push(
      <mesh key={i} rotation={[-Math.PI/2, 0, 0]} position={[0, y, 0]}>
        <planeGeometry args={[params.diameter * 2, params.diameter * 2]} />
        <meshBasicMaterial
          transparent
          opacity={0.05}
          depthWrite={false}  // Prevents Z-fighting
        />
      </mesh>
    );
  }
  return <group>{slices}</group>;
};
```

## Testing & Code Quality

### Current Status
**NO testing infrastructure exists:**
- No Jest, Vitest, or any test framework
- No ESLint or Prettier configuration
- No CI/CD workflows
- No pre-commit hooks
- No type-checking in CI

**Quality Assurance Patterns Used:**
- React.StrictMode enabled
- TypeScript (but not strict mode)
- Memory cleanup with useEffect
- Geometry disposal patterns

**Contribution Opportunity:** Adding testing infrastructure would be a valuable contribution. The codebase is ready for unit tests on geometry generation functions and integration tests on parameter updates.

## Common Development Workflows

### Modifying Parameters
1. Update interface in `types.ts` or `types/EnclosureTypes.ts`
2. Update `DEFAULT_KNOB` or `DEFAULT_ENCLOSURE` with new field
3. Add UI control in `App.tsx` (use `ControlGroup` component for sliders)
4. Update 3D component (`KnobMesh.tsx` or `EnclosureMesh.tsx`) to use new parameter
5. Update AI prompt in `geminiService.ts` if AI should generate this parameter

### Debugging 3D Issues
- Use `activeTab: 'slicer'` to see cross-sections
- Enable `showHelpers` for enclosures to see internal parts
- Check browser console for Three.js warnings
- Use `axesHelper` (already in scene) for orientation reference
- Verify mesh `name` properties for export filtering

### Performance Profiling
- React DevTools Profiler for component render times
- Chrome DevTools Memory tab for heap snapshots
- Three.js Stats.js library (already installed: `stats.js` in dependencies)
- Check geometry disposal with memory snapshots before/after parameter changes

## Important Conventions

**3D Coordinate System:**
- Y-axis is vertical (height)
- Knobs face upward along +Y
- Enclosures: Width (X), Height (Y/Depth), Length (Z)
- Right-handed coordinate system

**Units:**
- All dimensions in millimeters (mm)
- Hex colors for materials (e.g., `#ff0000`)
- Angles in radians (use `Math.PI`)

**Naming Conventions:**
- Mesh names for export: "Body_*", "Cap_*", "Skirt"
- Hole IDs: Generated with `Math.random().toString(36).substr(2, 9)`
- Component types use enums (no magic strings)

**React Three Fiber:**
- Use declarative JSX for Three.js scene graph
- Prefer `useMemo` for expensive geometry computations
- Use `useLayoutEffect` for ref forwarding (synchronous)
- Use `useEffect` for cleanup (disposal)
- Always dispose of Three.js objects in cleanup

## Environment Variables

Create `.env.local` for Electron desktop builds:
```
GEMINI_API_KEY=your_actual_api_key_here
```

**Important:** Do not commit API keys. The `.env.local` file should be in `.gitignore`.

## Version & Build Info

Current version defined in `package.json` (v1.0.4 as of this writing). Update version before releases. Auto-updater compares against GitHub releases.

## Build Artifacts & Outputs

**Electron Builds** (`dist-electron/`):
- Windows: `AlphaForge Knob Modeler Setup X.X.X.exe` (NSIS installer)
- Windows: `AlphaForge Knob Modeler X.X.X.exe` (portable)
- Linux: `AlphaForge.Knob.Modeler-X.X.X.AppImage` (portable)
- Linux: `alphaforge-ai-knob-modeler_X.X.X_amd64.deb` (Debian package)
- **CRITICAL:** `latest.yml` - Auto-update manifest (MUST upload to GitHub Release)

**Android Builds:**
- Output: `android/app/build/outputs/apk/release/app-release.apk`
- Signed with keystore (see security warning about credentials)

**Web Builds** (`dist/`):
- Standard Vite output: `index.html`, `assets/*.js`, `assets/*.css`
- Can be deployed to any static hosting

## Common Build Issues

**Issue:** Electron shows blank screen in production
**Cause:** Incorrect Vite base path
**Fix:** Ensure `vite.config.ts` has `base: './'`

**Issue:** API key not working in Electron
**Cause:** Missing `.env.local`
**Fix:** Create `.env.local` with `GEMINI_API_KEY=your_key`

**Issue:** Android build fails with "SDK not found"
**Cause:** Missing Android SDK or incorrect path
**Fix:** Install Android Studio and set `ANDROID_HOME` environment variable

**Issue:** Gradle build fails with "Java version mismatch"
**Cause:** Wrong Java version
**Fix:** Use Java 17 (specified in `android/app/build.gradle`)

**Issue:** Auto-update not working
**Cause:** Missing `latest.yml` in GitHub Release
**Fix:** Always upload `latest.yml` from `dist-electron/` folder

**Issue:** `build:clean` fails on Windows
**Cause:** Script uses Unix `rm -rf` command
**Fix:** Run builds on Unix-based system or use `rimraf` package

## Architectural Decisions (Undocumented)

**Why No React Router?**
- Single-page app with mode switching instead of routes
- Appropriate for desktop app, keeps bundle small

**Why CommonJS for Electron Files?**
- `electron.cjs` and `preload.cjs` use CommonJS for Electron main process compatibility
- Mixed module systems: ESM for React, CJS for Electron

**Why Google Gemini over OpenAI?**
- Likely cost (Gemini has generous free tier)
- Not explicitly documented

**Why No Backend/Database?**
- Completely client-side/local-first architecture
- No user accounts, cloud storage, or analytics
- Privacy and simplicity prioritized

**Why Tailwind Utility Classes?**
- All styling is inline Tailwind classes
- Faster development but harder to maintain consistency
- No CSS modules or styled-components
