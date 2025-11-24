
import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Center } from '@react-three/drei';
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
  ChevronDown
} from 'lucide-react';

import KnobMesh from './components/KnobMesh';
import { DEFAULT_KNOB, KnobParameters, KnobShape, ShaftType } from './types';
import { generateKnobParams } from './services/geminiService';

export default function App() {
  const [params, setParams] = useState<KnobParameters>(DEFAULT_KNOB);
  const [activeTab, setActiveTab] = useState<'design' | 'slicer'>('design');
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Reference to the entire knob group
  const groupRef = useRef<THREE.Group | null>(null);

  const handleUpdateParam = (key: keyof KnobParameters, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const newParams = await generateKnobParams(prompt);
      setParams(prev => ({ ...prev, ...newParams }));
    } catch (e) {
      alert("Failed to generate parameters. Ensure API Key is set.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportSTL = (type: 'all' | 'body' | 'cap') => {
    if (!groupRef.current) return;
    
    const exporter = new STLExporter();
    const group = groupRef.current;

    // Visibility Toggle Logic for Partial Exports
    const originalVis: Map<THREE.Object3D, boolean> = new Map();
    
    group.traverse((child) => {
       originalVis.set(child, child.visible);
       
       if (type === 'body') {
         // Hide Cap parts
         if (child.name.includes('Cap')) child.visible = false;
       } else if (type === 'cap') {
         // Hide Body parts and Skirt
         if (child.name.includes('Body') || child.name.includes('Skirt')) child.visible = false;
       }
       // 'all' leaves everything visible
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
    link.download = `knob-${type}.stl`;
    link.click();

    // Clean up the URL object to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 100);
    setExportMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-200 overflow-hidden font-sans">
      
      {/* Sidebar Controls */}
      <aside className="w-96 flex flex-col border-r border-gray-800 bg-gray-900/50 backdrop-blur-sm h-full overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">AlphaForge</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono">PARAMETRIC MODELER v1.2</p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
          
          {/* AI Generator Section */}
          <div className="space-y-3 bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
            <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-3 h-3" /> AI Assistant
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. 'Two-tone HiFi knob'"
                className="flex-1 bg-gray-950 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none placeholder-gray-600"
              />
              <button 
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-md transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Dimensions Controls */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Box className="w-4 h-4" /> Geometry
            </h2>
            
            <ControlGroup label="Diameter (mm)" value={params.diameter} min={10} max={60} step={0.5} 
              onChange={(v) => handleUpdateParam('diameter', v)} />
            
            <ControlGroup label="Total Height (mm)" value={params.height} min={5} max={50} step={0.5} 
              onChange={(v) => handleUpdateParam('height', v)} />

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Shape Profile</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(KnobShape).map(shape => (
                  <button
                    key={shape}
                    onClick={() => handleUpdateParam('shape', shape)}
                    className={`text-xs py-1.5 px-3 rounded border transition-all flex-grow text-center ${
                      params.shape === shape 
                      ? 'bg-cyan-900/50 border-cyan-500 text-cyan-200' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>
            
            {params.shape === KnobShape.POLYGON && (
               <ControlGroup label="Sides" value={params.polygonSides} min={3} max={12} step={1} 
               onChange={(v) => handleUpdateParam('polygonSides', v)} />
            )}
            {params.shape === KnobShape.FLUTED && (
               <ControlGroup label="Flutes" value={params.fluteCount} min={3} max={24} step={1} 
               onChange={(v) => handleUpdateParam('fluteCount', v)} />
            )}
          </section>

          <hr className="border-gray-800" />

          {/* Construction Controls */}
          <section className="space-y-4">
             <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Hammer className="w-4 h-4" /> Construction
             </h2>
             
             <div className="flex items-center justify-between bg-gray-800/30 p-3 rounded border border-gray-800">
                <span className="text-xs font-medium text-gray-300">Closed Top</span>
                <input 
                  type="checkbox" 
                  checked={params.closedTop} 
                  onChange={(e) => handleUpdateParam('closedTop', e.target.checked)}
                  className="w-4 h-4 accent-cyan-500"
                />
             </div>

             <div className="space-y-3 bg-gray-800/30 p-3 rounded border border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Separate Cap / Hat</span>
                  <input 
                    type="checkbox" 
                    checked={params.hasCap} 
                    onChange={(e) => handleUpdateParam('hasCap', e.target.checked)}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
                
                {params.hasCap && (
                  <div className="pl-2 border-l-2 border-gray-700 space-y-3 pt-2">
                    <ControlGroup label="Cap Height (mm)" value={params.capHeight} min={1} max={params.height / 2} step={0.5} 
                      onChange={(v) => handleUpdateParam('capHeight', v)} />
                    
                    <div className="space-y-1">
                       <label className="text-xs font-medium text-gray-400">Cap Color</label>
                       <div className="flex gap-2">
                         <input 
                            type="color" 
                            value={params.capColor}
                            onChange={(e) => handleUpdateParam('capColor', e.target.value)}
                            className="h-6 w-8 rounded cursor-pointer bg-transparent border-none"
                         />
                         <span className="text-xs text-gray-500 self-center font-mono">{params.capColor}</span>
                       </div>
                    </div>
                  </div>
                )}
             </div>
          </section>

          <hr className="border-gray-800" />

          {/* Shaft Controls */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Circle className="w-4 h-4" /> Shaft Fit
            </h2>
            <select 
                value={params.shaftType}
                onChange={(e) => handleUpdateParam('shaftType', e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-cyan-500 outline-none"
              >
                {Object.values(ShaftType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <ControlGroup label="Shaft Diameter" value={params.shaftDiameter} min={2} max={10} step={0.05} 
               onChange={(v) => handleUpdateParam('shaftDiameter', v)} />
            
            <ControlGroup label="Shaft Depth" value={params.shaftDepth} min={5} max={params.height} step={0.5} 
               onChange={(v) => handleUpdateParam('shaftDepth', v)} />

            {params.shaftType === ShaftType.D_SHAFT && (
               <ControlGroup label="Flat Distance (Opposite)" value={params.dFlatSize} min={1} max={5} step={0.1} 
               onChange={(v) => handleUpdateParam('dFlatSize', v)} />
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <div className="relative">
            <button 
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all"
            >
              <Download className="w-4 h-4" /> Export STL <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            
            {exportMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-20">
                <button 
                  onClick={() => handleExportSTL('all')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-200"
                >
                  Export All (Assembly)
                </button>
                {params.hasCap && (
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

      {/* Main Viewport */}
      <main className="flex-1 relative bg-gradient-to-br from-gray-900 to-gray-950 flex flex-col">
        
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
           <div className="bg-gray-800/80 backdrop-blur rounded-lg p-1 border border-gray-700 flex">
              <button 
                onClick={() => setActiveTab('design')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-2 transition-all ${
                  activeTab === 'design' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Design
              </button>
              <button 
                onClick={() => setActiveTab('slicer')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-2 transition-all ${
                  activeTab === 'slicer' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Slicer Preview
              </button>
           </div>
        </div>

        <div className="flex-1 relative">
           <Canvas shadows camera={{ position: [25, 25, 25], fov: 45 }}>
              <color attach="background" args={['#111827']} />
              
              <Stage intensity={0.5} environment="city" adjustCamera={false}>
                <Center top>
                  <KnobMesh 
                    params={params} 
                    groupRef={groupRef} 
                    isSliceView={activeTab === 'slicer'}
                  />
                </Center>
              </Stage>
              
              {activeTab === 'slicer' && (
                 <SlicerVisuals params={params} />
              )}

              <Grid 
                renderOrder={-1} 
                position={[0, 0, 0]} 
                infiniteGrid 
                cellSize={1} 
                sectionSize={10} 
                fadeDistance={50} 
                sectionColor="#334155" 
                cellColor="#1e293b" 
              />
              <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
              <axesHelper args={[20]} />
           </Canvas>

           {/* Overlay Info */}
           <div className="absolute bottom-6 right-6 text-right pointer-events-none select-none">
             <div className="text-6xl font-black text-gray-800/50">{params.diameter}mm</div>
             <div className="text-sm text-gray-600 font-mono mt-1">
               {params.shape.toUpperCase()} // {params.shaftType.toUpperCase()}
             </div>
           </div>
        </div>
      </main>
    </div>
  );
}

// Sub-component for individual slider controls
const ControlGroup = ({ label, value, min, max, step, onChange }: any) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="text-cyan-400 font-mono">{Number(value).toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
    />
  </div>
);

// Visual Slicer Component (renders planes to simulate layers)
const SlicerVisuals = ({ params }: { params: KnobParameters }) => {
  // Create visual slice planes
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
