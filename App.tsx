import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Center, ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import {
  Download,
  Cpu,
  Layers,
  Settings2,
  Wand2,
  Loader2,
  Box,
  Circle,
  Hammer,
  ChevronDown,
  Key,
  Trash2,
  Sun,
  Moon,
  Plus
} from 'lucide-react';

import KnobMesh from './components/KnobMesh';
import EnclosureMesh from './components/EnclosureMesh';
import SplashScreen from './components/SplashScreen';
import DonationButton from './components/DonationButton';
import UpdateNotification from './components/UpdateNotification';
import { ToastProvider, useToast } from './components/Toast';
import { Tooltip, kbd, InfoTooltip } from './components/Tooltip';
import { CameraControls, CameraControlsHandle } from './components/CameraControls';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmModal } from './components/ConfirmModal';
import { DEFAULT_KNOB, KnobParameters, KnobShape, ShaftType } from './types';
import { DEFAULT_ENCLOSURE, EnclosureParameters, ENCLOSURE_DB, ComponentType, HoleFace } from './types/EnclosureTypes';
import { generateKnobParams } from './services/geminiService';
import { generateDrillTemplateSVG } from './services/exportService';
import { KNOB_PRESETS } from './presets/knobPresets';

function AppContent() {
  const { showToast } = useToast();
  const [showSplash, setShowSplash] = useState(true);

  // App Mode State
  const [appMode, setAppMode] = useState<'knob' | 'enclosure'>('knob');

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('alphaforge-theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('alphaforge-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    showToast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} mode`, 'info');
  };

  // Modal State
  const [showResetModal, setShowResetModal] = useState(false);

  // Knob State
  const [knobParams, setKnobParams] = useState<KnobParameters>(DEFAULT_KNOB);
  
  // Enclosure State
  const [enclosureParams, setEnclosureParams] = useState<EnclosureParameters>(DEFAULT_ENCLOSURE);
  const [showHelpers, setShowHelpers] = useState(true);
  const [showLid, setShowLid] = useState(true);

  const [activeTab, setActiveTab] = useState<'design' | 'slicer'>('design');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Mobile/Web API Key State
  const [isMobile, setIsMobile] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Reference to the main group
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraControlsRef = useRef<CameraControlsHandle>(null);

  // Undo/Redo History Management
  const [knobHistory, setKnobHistory] = useState<KnobParameters[]>([DEFAULT_KNOB]);
  const [knobHistoryIndex, setKnobHistoryIndex] = useState(0);
  const [enclosureHistory, setEnclosureHistory] = useState<EnclosureParameters[]>([DEFAULT_ENCLOSURE]);
  const [enclosureHistoryIndex, setEnclosureHistoryIndex] = useState(0);
  const historyTimeoutRef = useRef<NodeJS.Timeout>();

  // Add to history (debounced to avoid flooding on slider changes)
  const addToHistory = useCallback((params: KnobParameters | EnclosureParameters, mode: 'knob' | 'enclosure') => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = setTimeout(() => {
      if (mode === 'knob') {
        setKnobHistory(prev => {
          const newHistory = prev.slice(0, knobHistoryIndex + 1);
          newHistory.push(params as KnobParameters);
          // Limit history to 50 items
          if (newHistory.length > 50) newHistory.shift();
          return newHistory;
        });
        setKnobHistoryIndex(prev => Math.min(prev + 1, 49));
      } else {
        setEnclosureHistory(prev => {
          const newHistory = prev.slice(0, enclosureHistoryIndex + 1);
          newHistory.push(params as EnclosureParameters);
          if (newHistory.length > 50) newHistory.shift();
          return newHistory;
        });
        setEnclosureHistoryIndex(prev => Math.min(prev + 1, 49));
      }
    }, 500); // 500ms debounce
  }, [knobHistoryIndex, enclosureHistoryIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (appMode === 'knob' && knobHistoryIndex > 0) {
      const newIndex = knobHistoryIndex - 1;
      setKnobHistoryIndex(newIndex);
      setKnobParams(knobHistory[newIndex]);
      showToast("Undo", "info");
    } else if (appMode === 'enclosure' && enclosureHistoryIndex > 0) {
      const newIndex = enclosureHistoryIndex - 1;
      setEnclosureHistoryIndex(newIndex);
      setEnclosureParams(enclosureHistory[newIndex]);
      showToast("Undo", "info");
    }
  }, [appMode, knobHistory, knobHistoryIndex, enclosureHistory, enclosureHistoryIndex, showToast]);

  // Redo
  const handleRedo = useCallback(() => {
    if (appMode === 'knob' && knobHistoryIndex < knobHistory.length - 1) {
      const newIndex = knobHistoryIndex + 1;
      setKnobHistoryIndex(newIndex);
      setKnobParams(knobHistory[newIndex]);
      showToast("Redo", "info");
    } else if (appMode === 'enclosure' && enclosureHistoryIndex < enclosureHistory.length - 1) {
      const newIndex = enclosureHistoryIndex + 1;
      setEnclosureHistoryIndex(newIndex);
      setEnclosureParams(enclosureHistory[newIndex]);
      showToast("Redo", "info");
    }
  }, [appMode, knobHistory, knobHistoryIndex, enclosureHistory, enclosureHistoryIndex, showToast]);

  useEffect(() => {
    // Check if we are in Electron or Web/Mobile
    if (!window.electronAPI) {
      setIsMobile(true);
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) setApiKey(storedKey);
    }
  }, []);

  // Clamp dependent parameters
  useEffect(() => {
    if (knobParams.shaftDepth > knobParams.height) {
      handleUpdateKnobParam('shaftDepth', knobParams.height);
    }
    if (knobParams.hasCap && knobParams.capHeight > knobParams.height / 2) {
      handleUpdateKnobParam('capHeight', Math.max(1, knobParams.height / 2));
    }
  }, [knobParams.height, knobParams.shaftDepth, knobParams.capHeight, knobParams.hasCap]);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowApiKeyModal(false);
  };

  // Input validation helper
  const safeParseFloat = (value: string, fallback: number, min?: number, max?: number): number => {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return fallback;
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;
    return parsed;
  };

  // Validation warnings for knob parameters
  const validateKnobParams = (params: KnobParameters): string[] => {
    const warnings = [];

    // Check if shaft is too deep
    if (params.shaftDepth > params.height * 0.85) {
      warnings.push("⚠️ Shaft depth is very deep - knob may be fragile");
    }

    // Check if diameter is too small for shaft
    if (params.diameter < params.shaftDiameter * 3) {
      warnings.push("⚠️ Diameter too small for shaft - walls will be weak");
    }

    // Check if cap height is too large
    if (params.hasCap && params.capHeight > params.height * 0.6) {
      warnings.push("⚠️ Cap is very tall - may be top-heavy");
    }

    // Check tolerance for tight fit
    if (params.holeTolerance !== undefined && params.holeTolerance < 0.05) {
      warnings.push("⚠️ Very tight tolerance - may not fit without force");
    }

    // Check tolerance for loose fit
    if (params.holeTolerance !== undefined && params.holeTolerance > 0.3) {
      warnings.push("⚠️ Large tolerance - knob may be loose on shaft");
    }

    return warnings;
  };

  // Validation warnings for enclosure parameters
  const validateEnclosureParams = (params: EnclosureParameters): string[] => {
    const warnings = [];

    // Check wall thickness
    if (params.wallThickness && params.wallThickness < 1.2) {
      warnings.push("⚠️ Walls very thin - enclosure may be fragile");
    }

    // Check for overlapping holes
    const holes = params.holes;
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        const h1 = holes[i];
        const h2 = holes[j];
        if (h1.face === h2.face) {
          const dist = Math.sqrt(Math.pow(h1.x - h2.x, 2) + Math.pow(h1.y - h2.y, 2));
          const minDist = (h1.diameter + h2.diameter) / 2 + 2; // 2mm clearance
          if (dist < minDist) {
            warnings.push(`⚠️ Holes too close - may overlap or crack between them`);
            break;
          }
        }
      }
    }

    return warnings;
  };

  // Get current warnings (memoized for performance)
  const warnings = useMemo(() => {
    return appMode === 'knob' ? validateKnobParams(knobParams) : validateEnclosureParams(enclosureParams);
  }, [appMode, knobParams, enclosureParams]);

  const handleUpdateKnobParam = (key: keyof KnobParameters, value: any) => {
    const newParams = { ...knobParams, [key]: value };
    setKnobParams(newParams);
    addToHistory(newParams, 'knob');
  };

  const handleUpdateEnclosureParam = (key: keyof EnclosureParameters, value: any) => {
    const newParams = { ...enclosureParams, [key]: value };
    setEnclosureParams(newParams);
    addToHistory(newParams, 'enclosure');
  };

  const handleAddHole = (type: ComponentType) => {
     const newHole = {
       id: Math.random().toString(36).substr(2, 9),
       type,
       face: HoleFace.TOP,
       x: 0,
       y: 0,
       diameter: type === ComponentType.POT ? 7 : type === ComponentType.SWITCH_FOOT ? 12 : type === ComponentType.JACK_AUDIO ? 10 : 12
     };
     setEnclosureParams(prev => ({
       ...prev,
       holes: [...prev.holes, newHole]
     }));
  };

  const handleRemoveHole = (id: string) => {
    setEnclosureParams(prev => ({
      ...prev,
      holes: prev.holes.filter(h => h.id !== id)
    }));
  };

  const handleUpdateHole = (id: string, key: string, value: any) => {
    setEnclosureParams(prev => ({
      ...prev,
      holes: prev.holes.map(h => h.id === id ? { ...h, [key]: value } : h)
    }));
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    
    // In mobile mode, require API key
    if (isMobile && !apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      if (appMode === 'knob') {
        const newParams = await generateKnobParams(prompt, apiKey);
        setKnobParams(prev => ({ ...prev, ...newParams }));
      } else {
        // Placeholder for Enclosure AI
        showToast("Enclosure AI generation coming soon!", "info");
      }
    } catch (e) {
      showToast("Failed to generate parameters. " + (isMobile ? "Check your API Key." : "Ensure API Key is set."), "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportSTL = async (type: 'all' | 'body' | 'cap') => {
    if (!groupRef.current) {
      showToast("3D model not ready. Please wait and try again.", "warning");
      return;
    }

    setIsExporting(true);
    try {
      const exporter = new STLExporter();
      const group = groupRef.current;

      // Visibility Toggle Logic for Partial Exports
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

      // Restore visibility
      group.traverse((child) => {
        if (originalVis.has(child)) {
          child.visible = originalVis.get(child)!;
        }
      });

      const blob = new Blob([str], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${appMode}-${type}.stl`;
      link.download = filename;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 100);
      setExportMenuOpen(false);

      // Success feedback
      showToast(`${filename} exported successfully!`, "success");
    } catch (error) {
      console.error('Export failed:', error);
      showToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = () => {
    setIsExporting(true);
    try {
      const svgContent = generateDrillTemplateSVG(enclosureParams);
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `drill-template-${enclosureParams.model}.svg`;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      setExportMenuOpen(false);

      // Success feedback
      showToast(`${filename} exported successfully!`, "success");
    } catch (error) {
      console.error('SVG export failed:', error);
      showToast(`SVG export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Save project to JSON
  const handleSaveProject = () => {
    const project = {
      version: "1.0.4",
      mode: appMode,
      knob: knobParams,
      enclosure: enclosureParams,
      createdAt: new Date().toISOString(),
    };
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${appMode}-design-${Date.now()}.knob`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    showToast("Project saved successfully!", "success");
  };

  // Load project from JSON
  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.knob,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const project = JSON.parse(event.target?.result as string);
          if (project.mode) setAppMode(project.mode);
          if (project.knob) {
            setKnobParams(project.knob);
            setKnobHistory([project.knob]);
            setKnobHistoryIndex(0);
          }
          if (project.enclosure) {
            setEnclosureParams(project.enclosure);
            setEnclosureHistory([project.enclosure]);
            setEnclosureHistoryIndex(0);
          }
          showToast("Project loaded successfully!", "success");
        } catch (error) {
          showToast("Failed to load project. Invalid file format.", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Reset to defaults
  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    if (appMode === 'knob') {
      setKnobParams(DEFAULT_KNOB);
      setKnobHistory([DEFAULT_KNOB]);
      setKnobHistoryIndex(0);
    } else {
      setEnclosureParams(DEFAULT_ENCLOSURE);
      setEnclosureHistory([DEFAULT_ENCLOSURE]);
      setEnclosureHistoryIndex(0);
    }
    showToast("Reset to defaults", "success");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            handleSaveProject();
            break;
          case 'o':
            e.preventDefault();
            handleLoadProject();
            break;
          case 'e':
            e.preventDefault();
            handleExportSTL('all');
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 'n':
            e.preventDefault();
            handleReset();
            break;
        }
      } else {
        switch (e.key.toLowerCase()) {
          case 'g':
            // Toggle grid - handled by Three.js OrbitControls
            break;
          case 'h':
            setShowHelpers(!showHelpers);
            break;
          case 't':
            setAppMode(appMode === 'knob' ? 'enclosure' : 'knob');
            showToast(`Switched to ${appMode === 'knob' ? 'Enclosure' : 'Knob'} mode`, "info");
            break;
          case '1':
            cameraControlsRef.current?.setView('top');
            break;
          case '2':
            cameraControlsRef.current?.setView('front');
            break;
          case '3':
            cameraControlsRef.current?.setView('side');
            break;
          case '4':
            cameraControlsRef.current?.setView('iso');
            break;
          case 'r':
            cameraControlsRef.current?.reset();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, showHelpers, handleUndo, handleRedo]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className={`flex flex-col md:flex-row h-screen w-full overflow-hidden font-sans transition-colors duration-300 ${
      theme === 'dark'
        ? 'bg-gray-950 text-gray-200'
        : 'bg-gray-50 text-gray-800'
    }`}>
    
      {/* API Key Modal for Mobile/Web */}
      {showApiKeyModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          theme === 'dark' ? 'bg-black/80' : 'bg-black/60'
        }`}>
          <div className={`rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl ${
            theme === 'dark'
              ? 'bg-gray-900 border border-gray-700'
              : 'bg-white border border-gray-200'
          }`}>
            <h3 className={`text-xl font-bold flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <Key className="w-5 h-5 text-cyan-500" />
              Enter Gemini API Key
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              To use AI generation features on this device, you need to provide your own Google Gemini API Key.
              It will be stored locally on your device.
            </p>
            <label htmlFor="gemini-api-key" className="sr-only">Gemini API Key</label>
            <input
              id="gemini-api-key"
              name="gemini-api-key"
              type="password"
              placeholder="Paste your API Key here"
              className={`w-full rounded-lg px-4 py-2 focus:border-cyan-500 outline-none ${
                theme === 'dark'
                  ? 'bg-gray-950 border border-gray-700 text-white'
                  : 'bg-gray-50 border border-gray-300 text-gray-900'
              }`}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey(apiKey)}
              value={apiKey}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className={`px-4 py-2 ${
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => saveApiKey(apiKey)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
              >
                Save Key
              </button>
            </div>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
            }`}>
              Get a key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-cyan-500 hover:underline">aistudio.google.com</a>
            </p>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className={`order-1 md:order-2 flex-1 relative flex flex-col h-[40vh] md:h-auto ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-900 to-gray-950'
          : 'bg-gradient-to-br from-gray-100 to-gray-200'
      }`}>
        
        {/* Mode Switcher */}
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-10 backdrop-blur-xl rounded-xl border p-1.5 flex gap-1 shadow-2xl ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-gray-900/95 to-gray-950/95 border-gray-700/50 shadow-black/30'
            : 'bg-gradient-to-br from-white/95 to-gray-50/95 border-gray-200 shadow-gray-400/20'
        }`}>
           <Tooltip content={<>Design knobs for guitar pedals • Press {kbd('T')}</>}>
             <button
               onClick={() => setAppMode('knob')}
               className={`px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                 appMode === 'knob'
                   ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-500/25'
                   : theme === 'dark'
                     ? 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                     : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
               }`}
             >
               KNOB
             </button>
           </Tooltip>
           <Tooltip content={<>Design pedal enclosures • Press {kbd('T')}</>}>
             <button
               onClick={() => setAppMode('enclosure')}
               className={`px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                 appMode === 'enclosure'
                   ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-500/25'
                   : theme === 'dark'
                     ? 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                     : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
               }`}
             >
               PEDAL
             </button>
           </Tooltip>
        </div>

        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
           <div className={`backdrop-blur-xl rounded-xl p-1.5 border flex gap-1 shadow-lg ${
             theme === 'dark'
               ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-gray-700/50 shadow-black/20'
               : 'bg-gradient-to-br from-white/90 to-gray-50/90 border-gray-200 shadow-gray-400/20'
           }`}>
              <button
                onClick={() => setActiveTab('design')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all duration-200 ${
                  activeTab === 'design'
                    ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800/50 active:scale-95'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:scale-95'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Design</span>
              </button>
              <button
                onClick={() => setActiveTab('slicer')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all duration-200 ${
                  activeTab === 'slicer'
                    ? 'bg-gradient-to-br from-gray-700 to-gray-600 text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800/50 active:scale-95'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:scale-95'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Slicer</span>
              </button>
           </div>

           {/* Camera Presets */}
           <div className={`backdrop-blur-xl rounded-xl p-1.5 border flex gap-1 shadow-lg ${
             theme === 'dark'
               ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-gray-700/50 shadow-black/20'
               : 'bg-gradient-to-br from-white/90 to-gray-50/90 border-gray-200 shadow-gray-400/20'
           }`}>
              <Tooltip content={<>Top view • Press {kbd('1')}</>}>
                <button
                  onClick={() => cameraControlsRef.current?.setView('top')}
                  className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200'
                  }`}
                >
                  TOP
                </button>
              </Tooltip>
              <Tooltip content={<>Front view • Press {kbd('2')}</>}>
                <button
                  onClick={() => cameraControlsRef.current?.setView('front')}
                  className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200'
                  }`}
                >
                  FRONT
                </button>
              </Tooltip>
              <Tooltip content={<>Side view • Press {kbd('3')}</>}>
                <button
                  onClick={() => cameraControlsRef.current?.setView('side')}
                  className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200'
                  }`}
                >
                  SIDE
                </button>
              </Tooltip>
              <Tooltip content={<>Isometric view • Press {kbd('4')}</>}>
                <button
                  onClick={() => cameraControlsRef.current?.setView('iso')}
                  className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all duration-200 active:scale-95 ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200'
                  }`}
                >
                  ISO
                </button>
              </Tooltip>
           </div>
        </div>

        <div className="flex-1 relative">
           <Canvas shadows camera={{ position: [25, 25, 25], fov: 45 }}>
              <color attach="background" args={[theme === 'dark' ? '#111827' : '#e5e7eb']} />
              
              <Environment preset="city" />
              
              <Stage intensity={0.5} environment={null} adjustCamera={false}>
                <Center top>
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
                </Center>
              </Stage>
              
              <ContactShadows position={[0, -0.1, 0]} opacity={0.4} scale={40} blur={2} far={4.5} />

              {activeTab === 'slicer' && appMode === 'knob' && (
                 <SlicerVisuals params={knobParams} />
              )}

              <Grid
                renderOrder={-1}
                position={[0, 0, 0]}
                infiniteGrid
                cellSize={1}
                sectionSize={10}
                fadeDistance={50}
                sectionColor={theme === 'dark' ? "#334155" : "#94a3b8"}
                cellColor={theme === 'dark' ? "#1e293b" : "#cbd5e1"}
              />
              <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI} />
              <CameraControls ref={cameraControlsRef} distance={30} />
              <axesHelper args={[20]} />
           </Canvas>

           {/* Overlay Info */}
           <div className="absolute bottom-6 right-6 text-right pointer-events-none select-none">
             {appMode === 'knob' ? (
                <>
                  <div className={`text-4xl md:text-6xl font-black ${
                    theme === 'dark' ? 'text-gray-800/50' : 'text-gray-300/60'
                  }`}>{knobParams.diameter}mm</div>
                  <div className={`text-xs md:text-sm font-mono mt-1 ${
                    theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {knobParams.shape.toUpperCase()} // {knobParams.shaftType.toUpperCase()}
                  </div>
                </>
             ) : (
                <>
                  <div className={`text-4xl md:text-6xl font-black ${
                    theme === 'dark' ? 'text-gray-800/50' : 'text-gray-300/60'
                  }`}>{enclosureParams.model}</div>
                  <div className={`text-xs md:text-sm font-mono mt-1 ${
                    theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {enclosureParams.holes.length} DRILLS
                  </div>
                </>
             )}
           </div>
        </div>
      </main>

      {/* Sidebar Controls */}
      <aside className={`order-2 md:order-1 w-full md:w-96 flex flex-col border-t md:border-t-0 md:border-r backdrop-blur-xl h-[60vh] md:h-full overflow-hidden shadow-2xl ${
        theme === 'dark'
          ? 'border-gray-800/60 bg-gradient-to-b from-gray-900/95 to-gray-950/95'
          : 'border-gray-200 bg-gradient-to-b from-white to-gray-50'
      }`}>

        {/* Header */}
        <div className={`p-5 md:p-6 border-b flex justify-between items-center md:block ${
          theme === 'dark'
            ? 'border-gray-800/60 bg-gradient-to-br from-gray-900/50 to-gray-950/80'
            : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white'
        }`}>
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-500/30">
                <Cpu className="w-5 h-5 md:w-5 md:h-5 text-cyan-500" />
              </div>
              <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${
                theme === 'dark'
                  ? 'text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent'
                  : 'text-gray-900'
              }`}>AlphaForge</h1>
            </div>
            <p className={`text-[10px] md:text-xs font-mono tracking-wider ml-0.5 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>PARAMETRIC MODELER v1.0.4</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-200 active:scale-95 ${
                theme === 'dark'
                  ? 'bg-gray-800/60 hover:bg-gray-700/60 text-yellow-400'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="md:hidden bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white p-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/25 active:scale-95"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6 md:space-y-8 custom-scrollbar pb-20 md:pb-5">

          {/* Update Notification */}
          <div className="hidden md:block"><UpdateNotification /></div>

          {/* Donation Section */}
          <DonationButton />

          {/* AI Generator Section */}
          <div className={`space-y-3 p-5 rounded-xl border shadow-lg backdrop-blur-sm ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-gray-700/40 shadow-black/20'
              : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-gray-300/20'
          }`}>
            <div className="flex justify-between items-center">
              <label htmlFor="ai-prompt" className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
              }`}>
                <div className="p-1 rounded bg-cyan-500/10">
                  <Wand2 className="w-3.5 h-3.5" />
                </div>
                AI Assistant
              </label>
              {isMobile && (
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className={`text-xs flex items-center gap-1.5 transition-colors duration-200 px-2 py-1 rounded-md hover:bg-cyan-500/10 ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-cyan-400'
                      : 'text-gray-600 hover:text-cyan-600'
                  }`}
                >
                  <Key className="w-3 h-3" /> {apiKey ? 'Key Set' : 'Set Key'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                id="ai-prompt"
                name="ai-prompt"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleAiGenerate()}
                placeholder={appMode === 'knob' ? "e.g. 'Two-tone HiFi knob'" : "e.g. 'Standard Pedal with 3 knobs'"}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all duration-200 shadow-inner ${
                  theme === 'dark'
                    ? 'bg-gray-950/80 border border-gray-700/60 text-gray-100 placeholder-gray-500'
                    : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <button
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white p-2.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25 active:scale-95"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Validation Warnings */}
          {warnings.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-900/25 to-orange-900/20 border border-yellow-600/40 rounded-xl p-4 space-y-2.5 shadow-lg shadow-yellow-900/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs uppercase tracking-wider">
                <div className="p-1 rounded bg-yellow-500/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                Printability Warnings
              </div>
              <ul className="space-y-2 text-xs text-yellow-100/90">
                {warnings.map((warning, idx) => (
                  <li key={idx} className="pl-3 py-1 border-l-2 border-yellow-600/50 bg-yellow-900/10 rounded-r">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* DYNAMIC CONTROLS BASED ON MODE */}

          {appMode === 'knob' ? (
             /* ================= KNOB CONTROLS ================= */
             <>
                {/* Preset Library */}
                <section className="space-y-3">
                  <h2 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-wide ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    <div className="p-1 rounded bg-purple-500/10">
                      <svg className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    Quick Start Presets
                  </h2>
                  <select
                    onChange={(e) => {
                      const preset = KNOB_PRESETS.find(p => p.name === e.target.value);
                      if (preset) {
                        setKnobParams(preset.params);
                        setKnobHistory([preset.params]);
                        setKnobHistoryIndex(0);
                        showToast(`Loaded preset: ${preset.name}`, "success");
                      }
                    }}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all duration-200 shadow-inner cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-gray-950/80 border border-gray-700/60 text-gray-200 hover:border-gray-600'
                        : 'bg-gray-50 border border-gray-300 text-gray-900 hover:border-gray-400'
                    }`}
                    defaultValue=""
                  >
                    <option value="" disabled>Choose a preset to load...</option>
                    {KNOB_PRESETS.map(preset => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name} - {preset.description}
                      </option>
                    ))}
                  </select>
                </section>

                <hr className={theme === 'dark' ? 'border-gray-800/60' : 'border-gray-300'} />

                <section className="space-y-4">
                  <h2 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-wide ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    <div className="p-1 rounded bg-blue-500/10">
                      <Box className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                    </div>
                    Geometry
                  </h2>
                  <ControlGroup id="knob-diameter" label="Diameter (mm)" value={knobParams.diameter} min={10} max={60} step={0.5}
                    onChange={(v: number) => handleUpdateKnobParam('diameter', v)} theme={theme} />
                  <ControlGroup id="knob-height" label="Total Height (mm)" value={knobParams.height} min={5} max={50} step={0.5}
                    onChange={(v: number) => handleUpdateKnobParam('height', v)} theme={theme} />

                  <div className="space-y-2">
                    <label id="shape-profile-label" className={`text-xs font-semibold ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>Shape Profile</label>
                    <div className="flex flex-wrap gap-2" role="group" aria-labelledby="shape-profile-label">
                      {Object.values(KnobShape).map(shape => (
                        <button
                          key={shape}
                          onClick={() => handleUpdateKnobParam('shape', shape)}
                          aria-pressed={knobParams.shape === shape}
                          className={`text-xs py-2 px-3 rounded-lg border transition-all duration-200 flex-grow text-center font-semibold ${
                            knobParams.shape === shape
                            ? 'bg-gradient-to-br from-cyan-600/50 to-cyan-700/50 border-cyan-500/60 text-white shadow-lg shadow-cyan-500/20'
                            : theme === 'dark'
                              ? 'bg-gradient-to-br from-gray-800/40 to-gray-800/20 border-gray-700/40 text-gray-300 hover:border-cyan-500/40 hover:text-cyan-200 active:scale-95'
                              : 'bg-gradient-to-br from-white to-gray-50 border-gray-300 text-gray-700 hover:border-cyan-500/40 hover:text-gray-900 active:scale-95'
                          }`}
                        >
                          {shape}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <hr className={theme === 'dark' ? 'border-gray-800/60' : 'border-gray-300'} />

                {/* Construction Controls (Knob) */}
                <section className="space-y-4">
                   <h2 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-wide ${
                     theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                   }`}>
                    <div className="p-1 rounded bg-orange-500/10">
                      <Hammer className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                      }`} />
                    </div>
                    Construction
                   </h2>
                   {/* ... (Existing knob construction controls) ... */}
                   <div className={`flex items-center justify-between p-3.5 rounded-lg border shadow-sm transition-all duration-200 ${
                     theme === 'dark'
                       ? 'bg-gradient-to-br from-gray-800/40 to-gray-800/20 border-gray-700/40 hover:border-gray-600/60'
                       : 'bg-gradient-to-br from-white to-gray-50 border-gray-300 hover:border-gray-400'
                   }`}>
                      <label htmlFor="closed-top" className={`text-xs font-semibold ${
                        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                      }`}>Closed Top</label>
                      <input
                        id="closed-top"
                        name="closed-top"
                        type="checkbox"
                        checked={knobParams.closedTop}
                        onChange={(e) => handleUpdateKnobParam('closedTop', e.target.checked)}
                        className="w-4 h-4 accent-cyan-500 cursor-pointer transition-transform hover:scale-110"
                      />
                   </div>
                   <div className={`space-y-3 p-3.5 rounded-lg border shadow-sm ${
                     theme === 'dark'
                       ? 'bg-gradient-to-br from-gray-800/40 to-gray-800/20 border-gray-700/40'
                       : 'bg-gradient-to-br from-white to-gray-50 border-gray-300'
                   }`}>
                      <div className="flex items-center justify-between">
                        <label htmlFor="separate-cap" className={`text-xs font-semibold ${
                          theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                        }`}>Separate Cap / Hat</label>
                        <input
                          id="separate-cap"
                          name="separate-cap"
                          type="checkbox"
                          checked={knobParams.hasCap}
                          onChange={(e) => handleUpdateKnobParam('hasCap', e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 cursor-pointer transition-transform hover:scale-110"
                        />
                      </div>
                      {knobParams.hasCap && (
                        <div className={`pl-2 border-l-2 space-y-3 pt-2 ${
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                        }`}>
                          <ControlGroup id="cap-height" label="Cap Height (mm)" value={knobParams.capHeight} min={1} max={knobParams.height / 2} step={0.5}
                            onChange={(v: number) => handleUpdateKnobParam('capHeight', v)} theme={theme} />
                          <div className="space-y-1">
                             <label htmlFor="cap-color" className={`text-xs font-medium ${
                               theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                             }`}>Cap Color</label>
                             <input
                                id="cap-color"
                                name="cap-color"
                                type="color"
                                value={knobParams.capColor}
                                onChange={(e) => handleUpdateKnobParam('capColor', e.target.value)}
                                className="h-6 w-8 rounded cursor-pointer bg-transparent border-none"
                             />
                          </div>
                        </div>
                      )}
                   </div>
                </section>

                <hr className={theme === 'dark' ? 'border-gray-800/60' : 'border-gray-300'} />

                {/* Shaft Controls */}
                <section className="space-y-4">
                  <h2 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-wide ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    <div className="p-1 rounded bg-green-500/10">
                      <Circle className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      }`} />
                    </div>
                    Shaft Fit
                  </h2>
                  <label htmlFor="shaft-type" className="sr-only">Shaft Type</label>
                  <select
                      id="shaft-type"
                      name="shaft-type"
                      value={knobParams.shaftType}
                      onChange={(e) => handleUpdateKnobParam('shaftType', e.target.value)}
                      className="w-full bg-gray-950/80 border border-gray-700/60 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-green-500/60 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-200 shadow-inner cursor-pointer hover:border-gray-600"
                    >
                      {Object.values(ShaftType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <ControlGroup
                    id="shaft-diameter"
                    label="Shaft Diameter"
                    value={knobParams.shaftDiameter}
                    min={2} max={10} step={0.05}
                    onChange={(v: number) => handleUpdateKnobParam('shaftDiameter', v)}
                    tooltip="Diameter of the potentiometer shaft (typically 6mm or 6.35mm/1/4 inch)"
                    theme={theme}
                  />

                  <ControlGroup
                    id="hole-tolerance"
                    label="Hole Tolerance (Offset)"
                    value={knobParams.holeTolerance ?? 0.15}
                    min={0} max={0.5} step={0.01}
                    onChange={(v: number) => handleUpdateKnobParam('holeTolerance', v)}
                    tooltip="Extra clearance for 3D printing fit. Start at 0.15mm, increase if too tight, decrease if too loose"
                    theme={theme}
                  />

                  <ControlGroup
                    id="shaft-depth"
                    label="Shaft Depth"
                    value={knobParams.shaftDepth}
                    min={5} max={knobParams.height} step={0.5}
                    onChange={(v: number) => handleUpdateKnobParam('shaftDepth', v)}
                    tooltip="How deep the shaft hole goes into the knob. Deeper = more secure, but don't exceed 85% of height"
                    theme={theme}
                  />

                  {knobParams.shaftType === ShaftType.D_SHAFT && (
                     <ControlGroup
                       id="d-flat-distance"
                       label="Flat Distance (Opposite)"
                       value={knobParams.dFlatSize}
                       min={1} max={5} step={0.1}
                       onChange={(v: number) => handleUpdateKnobParam('dFlatSize', v)}
                       tooltip="Distance from the flat side to the opposite wall (typically 4.5mm for standard D-shafts)"
                       theme={theme}
                     />
                  )}
                </section>
             </>
          ) : (
             /* ================= ENCLOSURE CONTROLS ================= */
             <>
                <section className="space-y-4">
                   <h2 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-wide ${
                     theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                   }`}>
                    <div className="p-1 rounded bg-indigo-500/10">
                      <Box className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                      }`} />
                    </div>
                    Enclosure Model
                   </h2>
                   <label htmlFor="enclosure-model" className="sr-only">Enclosure Model</label>
                   <select
                      id="enclosure-model"
                      name="enclosure-model"
                      value={enclosureParams.model}
                      onChange={(e) => handleUpdateEnclosureParam('model', e.target.value)}
                      className="w-full bg-gray-950/80 border border-gray-700/60 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 shadow-inner cursor-pointer hover:border-gray-600"
                   >
                      {ENCLOSURE_DB.map(e => (
                        <option key={e.name} value={e.name}>{e.name} - {e.desc}</option>
                      ))}
                   </select>

                   <ControlGroup
                     id="wall-thickness"
                     label="Wall Thickness (mm)"
                     value={enclosureParams.wallThickness || 1.5}
                     min={1} max={4} step={0.1}
                     onChange={(v: number) => handleUpdateEnclosureParam('wallThickness', v)}
                     tooltip="Wall thickness for the enclosure. Minimum 1.2mm for strength, 1.5-2mm recommended"
                     theme={theme}
                   />

                   <div className="flex items-center justify-between">
                     <label htmlFor="case-color" className={`text-xs font-medium ${
                       theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                     }`}>Case Color</label>
                     <input
                        id="case-color"
                        name="case-color"
                        type="color"
                        value={enclosureParams.color}
                        onChange={(e) => handleUpdateEnclosureParam('color', e.target.value)}
                        className="h-6 w-8 rounded cursor-pointer bg-transparent border-none"
                     />
                   </div>

                   <div className={`flex items-center justify-between p-2 rounded ${
                     theme === 'dark' ? 'bg-gray-800/30' : 'bg-gray-100'
                   }`}>
                     <label htmlFor="show-helpers" className={`text-xs font-medium ${
                       theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                     }`}>Show Internal Parts</label>
                     <input
                        id="show-helpers"
                        name="show-helpers"
                        type="checkbox"
                        checked={showHelpers}
                        onChange={(e) => setShowHelpers(e.target.checked)}
                        className="w-4 h-4 accent-cyan-500"
                     />
                   </div>

                   <div className={`flex items-center justify-between p-2 rounded ${
                     theme === 'dark' ? 'bg-gray-800/30' : 'bg-gray-100'
                   }`}>
                     <label htmlFor="show-lid" className={`text-xs font-medium ${
                       theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                     }`}>Show Bottom Lid</label>
                     <input
                        id="show-lid"
                        name="show-lid"
                        type="checkbox"
                        checked={showLid}
                        onChange={(e) => setShowLid(e.target.checked)}
                        className="w-4 h-4 accent-cyan-500"
                     />
                   </div>
                </section>

                <hr className={theme === 'dark' ? 'border-gray-800/60' : 'border-gray-300'} />

                <section className="space-y-4">
                   <h2 className={`text-sm font-semibold flex items-center justify-between ${
                     theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                   }`}>
                      <span className="flex items-center gap-2"><Circle className="w-4 h-4" /> Drills</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleAddHole(ComponentType.POT)} className={`p-2.5 min-w-[44px] min-h-[44px] rounded transition-colors flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                        }`} title="Add Pot" aria-label="Add potentiometer hole"><Circle className="w-4 h-4" /></button>
                        <button onClick={() => handleAddHole(ComponentType.SWITCH_FOOT)} className={`p-2.5 min-w-[44px] min-h-[44px] rounded transition-colors flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                        }`} title="Add Footswitch" aria-label="Add footswitch hole"><Circle className="w-4 h-4 text-red-400" /></button>
                        <button onClick={() => handleAddHole(ComponentType.JACK_AUDIO)} className={`p-2.5 min-w-[44px] min-h-[44px] rounded transition-colors flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                        }`} title="Add Jack" aria-label="Add audio jack hole"><Circle className="w-4 h-4 text-blue-400" /></button>
                        <button onClick={() => handleAddHole(ComponentType.LED)} className={`p-2.5 min-w-[44px] min-h-[44px] rounded transition-colors flex items-center justify-center ${
                          theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                        }`} title="Add LED" aria-label="Add LED hole"><Circle className="w-4 h-4 text-yellow-400" /></button>
                      </div>
                   </h2>

                   <div className="space-y-2">
                      {enclosureParams.holes.map((hole, idx) => (
                        <div key={hole.id} className={`p-2 rounded border space-y-2 ${
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700'
                            : 'bg-gray-50 border-gray-300'
                        }`}>
                           <div className="flex justify-between items-center">
                              <span className={`text-xs font-bold ${
                                theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                              }`}>#{idx+1} {hole.type}</span>
                              <button onClick={() => handleRemoveHole(hole.id)} className="text-red-500 hover:text-red-400">
                                <Trash2 className="w-3 h-3" />
                              </button>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-2">
                             <div>
                               <label htmlFor={`hole-${hole.id}-face`} className={`text-[10px] block ${
                                 theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                               }`}>Face</label>
                               <select
                                  id={`hole-${hole.id}-face`}
                                  name={`hole-${hole.id}-face`}
                                  value={hole.face}
                                  onChange={(e) => handleUpdateHole(hole.id, 'face', e.target.value)}
                                  className={`w-full text-xs rounded px-1 py-1 ${
                                    theme === 'dark'
                                      ? 'bg-gray-900 border-gray-700 text-gray-200'
                                      : 'bg-gray-50 border-gray-300 text-gray-800'
                                  } border`}
                               >
                                  {Object.values(HoleFace).map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             </div>
                             <div>
                               <label htmlFor={`hole-${hole.id}-diameter`} className={`text-[10px] block ${
                                 theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                               }`}>Diameter</label>
                               <input
                                  id={`hole-${hole.id}-diameter`}
                                  name={`hole-${hole.id}-diameter`}
                                  type="number"
                                  value={hole.diameter}
                                  onChange={(e) => handleUpdateHole(hole.id, 'diameter', safeParseFloat(e.target.value, hole.diameter, 0.1, 50))}
                                  className={`w-full text-xs rounded px-1 py-1 ${
                                    theme === 'dark'
                                      ? 'bg-gray-900 border-gray-700 text-gray-200'
                                      : 'bg-gray-50 border-gray-300 text-gray-800'
                                  } border`}
                               />
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                             <div>
                               <label htmlFor={`hole-${hole.id}-x`} className={`text-[10px] block ${
                                 theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                               }`}>X Pos</label>
                               <input
                                  id={`hole-${hole.id}-x`}
                                  name={`hole-${hole.id}-x`}
                                  type="number"
                                  value={hole.x}
                                  onChange={(e) => handleUpdateHole(hole.id, 'x', safeParseFloat(e.target.value, hole.x, -200, 200))}
                                  className={`w-full text-xs rounded px-1 py-1 ${
                                    theme === 'dark'
                                      ? 'bg-gray-900 border-gray-700 text-gray-200'
                                      : 'bg-gray-50 border-gray-300 text-gray-800'
                                  } border`}
                               />
                             </div>
                             <div>
                               <label htmlFor={`hole-${hole.id}-y`} className={`text-[10px] block ${
                                 theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                               }`}>Y Pos</label>
                               <input
                                  id={`hole-${hole.id}-y`}
                                  name={`hole-${hole.id}-y`}
                                  type="number"
                                  value={hole.y}
                                  onChange={(e) => handleUpdateHole(hole.id, 'y', safeParseFloat(e.target.value, hole.y, -200, 200))}
                                  className={`w-full text-xs rounded px-1 py-1 ${
                                    theme === 'dark'
                                      ? 'bg-gray-900 border-gray-700 text-gray-200'
                                      : 'bg-gray-50 border-gray-300 text-gray-800'
                                  } border`}
                               />
                             </div>
                           </div>
                        </div>
                      ))}
                      {enclosureParams.holes.length === 0 && (
                        <div className="text-center text-xs text-gray-500 py-4 italic">
                          No drills added. Click buttons above.
                        </div>
                      )}
                   </div>
                </section>
             </>
          )}

        </div>

        {/* Footer Actions (Desktop Only) */}
        <div className="hidden md:block p-4 border-t border-gray-800 bg-gray-900">
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="w-4 h-4" /> Export STL <ChevronDown className="w-3 h-3 opacity-70" /></>
              )}
            </button>
            
            {exportMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-20">
                <button 
                  onClick={() => handleExportSTL('all')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-200"
                >
                  Export {appMode === 'knob' ? 'All (Assembly)' : 'Enclosure (STL)'}
                </button>
                {appMode === 'enclosure' && (
                   <button 
                      onClick={handleExportSVG}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-200 border-t border-gray-700"
                    >
                      Export Drill Template (SVG)
                    </button>
                )}
                {appMode === 'knob' && knobParams.hasCap && (
                  <>
                    <button 
                      onClick={() => handleExportSTL('body')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-200"
                    >
                      Export Body Only
                    </button>
                    <button 
                      onClick={() => handleExportSTL('cap')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-200"
                    >
                      Export Cap Only
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </aside>

      {/* Confirm Reset Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Reset to Defaults"
        message="Are you sure you want to reset all parameters to their default values? This action cannot be undone."
        confirmText="Reset"
        cancelText="Cancel"
        onConfirm={confirmReset}
        onCancel={() => setShowResetModal(false)}
        theme={theme}
        variant="danger"
      />
    </div>
  );
}

// Sub-component for individual slider controls with debouncing
interface ControlGroupProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  id: string;
  tooltip?: string | React.ReactNode;
  theme: 'dark' | 'light';
}

const ControlGroup = React.memo<ControlGroupProps>(({ label, value, min, max, step, onChange, id, tooltip, theme }) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update local value when prop value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);

    // Debounce the actual onChange call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 16); // ~1 frame delay
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <label htmlFor={id} className={`font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>{label}</label>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        <span className={`font-mono font-semibold px-2 py-0.5 rounded ${
          theme === 'dark'
            ? 'text-cyan-400 bg-cyan-500/5'
            : 'text-cyan-600 bg-cyan-500/10'
        }`}>{Number(localValue).toFixed(2)}</span>
      </div>
      <input
        id={id}
        name={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={handleChange}
        aria-label={label}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all duration-150 shadow-inner ${
          theme === 'dark' ? 'bg-gray-800/60' : 'bg-gray-200'
        }`}
      />
    </div>
  );
});

// Visual Slicer Component
const SlicerVisuals = ({ params }: { params: KnobParameters }) => {
  const sliceCount = 10;
  const slices = [];
  for(let i=0; i<sliceCount; i++) {
    const y = (params.height / sliceCount) * i + 0.1;
    slices.push(
      <mesh key={i} rotation={[-Math.PI/2, 0, 0]} position={[0, y, 0]}>
        <planeGeometry args={[params.diameter * 2, params.diameter * 2]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
        <lineSegments>
           <edgesGeometry args={[new THREE.PlaneGeometry(params.diameter*1.5, params.diameter*1.5)]} />
           <lineBasicMaterial color="#004433" transparent opacity={0.1} />
        </lineSegments>
      </mesh>
    );
  }
  return <group>{slices}</group>;
};

// Main App wrapper with ToastProvider and ErrorBoundary
export default function App() {
  const theme = (localStorage.getItem('alphaforge-theme') as 'dark' | 'light') || 'dark';

  return (
    <ErrorBoundary theme={theme}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}