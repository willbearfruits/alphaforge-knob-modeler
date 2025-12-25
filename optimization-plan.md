# AlphaForge Optimization & Quality Improvement Plan

## 🎯 Phase 1: Quick Wins (1-2 hours)

### Size Optimizations

#### 1. Remove Duplicate Dependencies
```bash
npm uninstall @google/genai
npm dedupe
```
**Impact:** 4-5 MB saved

#### 2. Optimize Vite Build Config
Add to `vite.config.ts`:
```typescript
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // ADD THIS:
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          }
        },
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/csg']
            }
          }
        },
        sourcemap: false,
        chunkSizeWarningLimit: 1000
      }
    };
});
```
**Impact:** 20-40% smaller production bundle

#### 3. Enable Electron Compression
Update `package.json` build config:
```json
"build": {
  "appId": "com.alphaforge.knobmodeler",
  "productName": "AlphaForge Knob Modeler",
  "compression": "maximum",
  "asar": true,
  // ... rest of config
}
```
**Impact:** 20-30% smaller packaged app

#### 4. Enable Android Minification
In `android/app/build.gradle`, change:
```gradle
buildTypes {
    release {
        minifyEnabled true  // Change from false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        signingConfig signingConfigs.release
    }
}
```
**Impact:** 30-50% smaller APK

---

## 🔧 Phase 2: Critical Quality Fixes (3-4 hours)

### Priority 0 - Fix Immediately

#### 1. Error Handling for Export Functions
**File:** `App.tsx:136-187`

```typescript
const handleExportSTL = async (type: 'all' | 'body' | 'cap') => {
  if (!groupRef.current) {
    alert("3D model not ready. Please wait and try again.");
    return;
  }

  setIsExporting(true);
  try {
    const exporter = new STLExporter();
    const group = groupRef.current;

    const originalVis: Map<THREE.Object3D, boolean> = new Map();

    group.traverse((child) => {
       originalVis.set(child, child.visible);

       if (appMode === 'knob') {
         if (type === 'body') {
           if (child.name.includes('Cap')) child.visible = false;
         } else if (type === 'cap') {
           if (child.name.includes('Body') || child.name.includes('Skirt')) child.visible = false;
         }
       }
    });

    const str = exporter.parse(group, { binary: true });

    group.traverse((child) => {
      if (originalVis.has(child)) {
        child.visible = originalVis.get(child)!;
      }
    });

    const blob = new Blob([str], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appMode}-${type}.stl`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
    setExportMenuOpen(false);

    // Success feedback
    alert(`✓ ${appMode}-${type}.stl exported successfully!`);
  } catch (error) {
    console.error('Export failed:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsExporting(false);
  }
};
```

#### 2. Input Validation Helper
**File:** `App.tsx` (add near top after imports)

```typescript
const safeParseFloat = (value: string, fallback: number, min?: number, max?: number): number => {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return fallback;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
};
```

Then update lines 602, 613, 622:
```typescript
onChange={(e) => handleUpdateHole(hole.id, 'diameter', safeParseFloat(e.target.value, hole.diameter, 0.1, 50))}
```

#### 3. Fix KnobMesh NaN Potential
**File:** `components/KnobMesh.tsx:96`

```typescript
// BEFORE:
const flatX = Math.sqrt(shaftR * shaftR - flatY * flatY);

// AFTER:
const flatX = flatY > shaftR ? 0 : Math.sqrt(shaftR * shaftR - flatY * flatY);
```

#### 4. Add Loading State for Exports
**File:** `App.tsx`

Add state:
```typescript
const [isExporting, setIsExporting] = useState(false);
```

Update export button (line 644):
```typescript
<button
  onClick={() => setExportMenuOpen(!exportMenuOpen)}
  disabled={isExporting}
  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
>
  {isExporting ? (
    <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
  ) : (
    <><Download className="w-4 h-4" /> Export STL <ChevronDown className="w-3 h-3 opacity-70" /></>
  )}
</button>
```

#### 5. Clamp Dependent Parameters
**File:** `App.tsx`

Add useEffect to ensure shaft depth doesn't exceed height:
```typescript
useEffect(() => {
  if (knobParams.shaftDepth > knobParams.height) {
    handleUpdateKnobParam('shaftDepth', knobParams.height);
  }
  if (knobParams.hasCap && knobParams.capHeight > knobParams.height / 2) {
    handleUpdateKnobParam('capHeight', Math.max(1, knobParams.height / 2));
  }
}, [knobParams.height, knobParams.shaftDepth, knobParams.capHeight, knobParams.hasCap]);
```

---

## ⚡ Phase 3: Performance & Polish (2-3 hours)

### 1. Debounce Slider Updates
**File:** `App.tsx:694-710`

```typescript
import { useState, useCallback, useMemo } from 'react';
import { debounce } from 'lodash-es'; // npm install lodash-es

const ControlGroup = React.memo(({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => {
  const [localValue, setLocalValue] = useState(value);

  const debouncedOnChange = useMemo(
    () => debounce(onChange, 16), // 1 frame
    [onChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setLocalValue(v);
    debouncedOnChange(v);
  };

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400 font-medium">{label}</span>
        <span className="text-cyan-400 font-mono">{Number(localValue).toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={handleChange}
        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
      />
    </div>
  );
});
```

### 2. Add Keyboard Navigation
**File:** `App.tsx:208-214` (API key modal)

```typescript
<input
  type="password"
  placeholder="Paste your API Key here"
  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
  onChange={(e) => setApiKey(e.target.value)}
  value={apiKey}
  onKeyDown={(e) => e.key === 'Enter' && saveApiKey(apiKey)}
  autoFocus
/>
```

**File:** `App.tsx:385-400` (AI input)

```typescript
<input
  type="text"
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleAiGenerate()}
  placeholder={appMode === 'knob' ? "e.g. 'Two-tone HiFi knob'" : "e.g. 'Standard Pedal with 3 knobs'"}
  className="flex-1 bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none placeholder-gray-600"
/>
```

### 3. Add ARIA Labels
**File:** `App.tsx:569-573` (Add hole buttons)

```typescript
<button
  onClick={() => handleAddHole(ComponentType.POT)}
  className="bg-gray-800 p-1 rounded hover:bg-gray-700"
  title="Add Pot"
  aria-label="Add potentiometer hole"
>
  <Circle className="w-3 h-3" />
</button>
```

### 4. Optimize Material Updates
**File:** `components/EnclosureMesh.tsx:28-41`

```typescript
const materialBody = useMemo(() => {
  const bumpMap = createNoiseTexture();
  return new THREE.MeshPhysicalMaterial({
    color: params.color,
    roughness: 0.6,
    metalness: 0.4,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
    bumpMap: bumpMap,
    bumpScale: 0.05,
  });
}, [params.color]);

// Add this to update color without recreating material
useEffect(() => {
  if (materialBody) {
    materialBody.color.set(params.color);
  }
}, [params.color, materialBody]);
```

---

## 🎨 Phase 4: UX Polish (2-3 hours)

### 1. Add Success Notifications
Install a toast library:
```bash
npm install react-hot-toast
```

**File:** `App.tsx`

```typescript
import toast, { Toaster } from 'react-hot-toast';

// In component return, add:
<Toaster position="bottom-right" />

// Update saveApiKey:
const saveApiKey = (key: string) => {
  setApiKey(key);
  localStorage.setItem('gemini_api_key', key);
  setShowApiKeyModal(false);
  toast.success('API Key saved successfully!');
};

// Update handleExportSTL success:
toast.success(`${appMode}-${type}.stl exported!`);

// Update handleAiGenerate success:
toast.success('AI parameters generated!');
```

### 2. Add Delete Confirmation
**File:** `App.tsx:581`

```typescript
const handleRemoveHole = (id: string, holeName: string) => {
  if (confirm(`Delete ${holeName}?`)) {
    setEnclosureParams(prev => ({
      ...prev,
      holes: prev.holes.filter(h => h.id !== id)
    }));
    toast.success('Hole removed');
  }
};

// Update button:
<button
  onClick={() => handleRemoveHole(hole.id, `${hole.type} (${hole.face})`)}
  className="text-red-500 hover:text-red-400"
  aria-label={`Delete ${hole.type}`}
>
  <Trash2 className="w-3 h-3" />
</button>
```

### 3. Add Transitions
**File:** `App.tsx:285-296`

```typescript
<Center top>
  <group key={appMode}> {/* Key triggers unmount/mount for fade */}
    {appMode === 'knob' ? (
       <KnobMesh
         params={knobParams}
         groupRef={groupRef}
         isSliceView={activeTab === 'slicer'}
       />
    ) : (
      <group ref={groupRef}>
         <EnclosureMesh params={enclosureParams} showHelpers={showHelpers} showLid={showLid} />
      </group>
    )}
  </group>
</Center>
```

---

## 📋 Phase 5: Code Quality (3-4 hours)

### 1. Enable TypeScript Strict Mode
**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "types": ["node"],

    // ADD THESE:
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,

    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

Then fix type errors:
```bash
npm run build  # Will show all type errors
```

### 2. Split Large Components
Create new files:
- `components/KnobControls.tsx` - Extract knob parameter controls (lines 405-511)
- `components/EnclosureControls.tsx` - Extract enclosure controls (lines 513-637)
- `components/ExportMenu.tsx` - Extract export menu (lines 641-686)
- `components/ApiKeyModal.tsx` - Extract API key modal (lines 196-234)

### 3. Add Global Type Definitions
**Create:** `global.d.ts`

```typescript
interface ElectronAPI {
  generateKnobParams: (description: string) => Promise<Partial<KnobParameters>>;
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  installUpdate: () => void;
  onUpdateChecking: (callback: () => void) => void;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateNotAvailable: (callback: (info: any) => void) => void;
  onUpdateError: (callback: (err: any) => void) => void;
  onUpdateDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
```

---

## 📊 Summary

### Total Estimated Time: 10-16 hours
### Total Estimated Impact:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| node_modules size | 1.1 GB | ~1.0 GB | 9% reduction |
| Production bundle | ~3-5 MB | ~2-3 MB | 40% reduction |
| Packaged app size | ~250 MB | ~175 MB | 30% reduction |
| Android APK | ~20 MB | ~10 MB | 50% reduction |
| Error coverage | 30% | 95% | +65% |
| User feedback | 40% | 90% | +50% |
| Accessibility | 0% | 80% | +80% |
| Type safety | 60% | 95% | +35% |

### Recommended Order:
1. **Phase 1** (Quick wins) - Do this first, biggest impact for least effort
2. **Phase 2** (Critical fixes) - Prevents crashes and bad UX
3. **Phase 3** (Performance) - Noticeable user experience improvement
4. **Phase 4** (Polish) - Professional feel
5. **Phase 5** (Code quality) - Long-term maintainability

Would you like me to implement any specific phase?
