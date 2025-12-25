import React from 'react';
import * as THREE from 'three';

// Shared Materials
const MAT_CHROME = new THREE.MeshStandardMaterial({ color: "#dddddd", roughness: 0.1, metalness: 0.9 });
const MAT_BRASS = new THREE.MeshStandardMaterial({ color: "#d4af37", roughness: 0.3, metalness: 0.8 });
const MAT_PLASTIC_BLACK = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.8 });
const MAT_PLASTIC_BLUE = new THREE.MeshStandardMaterial({ color: "#0044aa", roughness: 0.6 });
const MAT_PLASTIC_RED = new THREE.MeshStandardMaterial({ color: "#aa0000", roughness: 0.6 });
const MAT_PCB = new THREE.MeshStandardMaterial({ color: "#006600", roughness: 0.8 });

// Primitive Components
// All primitives are aligned with Y-axis as the central axis (Bolt Axis)

const HexNut = ({ radius = 6, height = 2, material = MAT_CHROME }: any) => (
  // CylinderGeometry is naturally Y-aligned. No rotation needed for a nut on a vertical bolt.
  <mesh material={material}>
    <cylinderGeometry args={[radius, radius, height, 6]} />
  </mesh>
);

const Washer = ({ radius = 7, hole = 4, material = MAT_CHROME }: any) => (
  // RingGeometry is created on XY plane (facing Z). 
  // We need it on XZ plane (facing Y). Rotate -90 X.
  <mesh rotation={[-Math.PI/2, 0, 0]} material={material}>
    <ringGeometry args={[hole, radius, 32]} />
  </mesh>
);

// --- COMPONENT MODELS ---
// Origin (0,0,0) is the mounting surface level (Top of enclosure)
// +Y is OUTSIDE/ABOVE case.
// -Y is INSIDE/BELOW case.

export const PotentiometerModel = () => {
  return (
    <group>
       {/* --- EXTERNAL PARTS (+Y) --- */}
       <group>
          {/* Washer (Flat on surface 0) */}
          <group position={[0, 0.1, 0]}>
             <Washer radius={6.5} hole={3.6} material={MAT_BRASS} />
          </group>

          {/* Nut (Sitting on washer, height 2mm, center at 1.1) */}
          <group position={[0, 1.2, 0]}>
             <HexNut radius={6} height={2} material={MAT_BRASS} />
          </group>

          {/* Threaded Shaft (Brass) */}
          <mesh position={[0, 3, 0]} material={MAT_BRASS}>
             <cylinderGeometry args={[3.5, 3.5, 6, 32]} />
          </mesh>

          {/* Turning Shaft (Aluminum, extends further) */}
          <mesh position={[0, 7.5, 0]} material={MAT_CHROME}>
            <cylinderGeometry args={[3, 3, 15, 32]} />
          </mesh>
       </group>

       {/* --- INTERNAL PARTS (-Y) --- */}
       <group position={[0, -6, 0]}>
          {/* Main Body (Cylinder) */}
          <mesh material={MAT_PLASTIC_BLUE}>
             <cylinderGeometry args={[8, 8, 8, 32]} />
          </mesh>
          
          {/* PCB/Wafer */}
          <mesh position={[0, -4.5, 0]} material={MAT_PCB}>
             <boxGeometry args={[10, 1, 5]} />
          </mesh>

          {/* Pins (Lugs) */}
          <group position={[0, -7, 2]}>
             {[ -3.5, 0, 3.5 ].map((x, i) => (
               <mesh key={i} position={[x, 0, 0]} material={MAT_CHROME}>
                  <boxGeometry args={[1, 5, 0.5]} />
               </mesh>
             ))}
          </group>
       </group>
    </group>
  );
};

export const AudioJackModel = () => {
  return (
    <group>
      {/* --- EXTERNAL (+Y) --- */}
      <group>
         {/* Washer */}
         <group position={[0, 0.1, 0]}>
            <Washer radius={7} hole={4.6} material={MAT_CHROME} />
         </group>
         {/* Nut */}
         <group position={[0, 1.2, 0]}>
            <HexNut radius={6} height={2} material={MAT_CHROME} />
         </group>
         {/* Sleeve/Bushing */}
         <mesh position={[0, -1, 0]} material={MAT_CHROME}>
            <cylinderGeometry args={[4.5, 4.5, 6, 32]} />
         </mesh>
      </group>

      {/* --- INTERNAL (-Y) --- */}
      <group position={[0, -12, 0]}>
        {/* Box Body */}
        <mesh material={MAT_PLASTIC_BLACK}>
           <boxGeometry args={[16, 25, 12]} />
        </mesh>
        {/* Solder Lugs (Coming out back/bottom) */}
        <mesh position={[0, -14, 4]} material={MAT_BRASS}>
           <boxGeometry args={[10, 4, 0.5]} />
        </mesh>
      </group>
    </group>
  );
};

export const DCJackModel = () => {
  return (
    <group>
      {/* --- EXTERNAL (+Y) --- */}
      <group>
         {/* Nut */}
         <group position={[0, 1.2, 0]}>
            <HexNut radius={7} height={2} material={MAT_CHROME} />
         </group>
         {/* Bushing */}
         <mesh position={[0, -1, 0]} material={MAT_CHROME}>
            <cylinderGeometry args={[6, 6, 6, 32]} />
         </mesh>
      </group>

      {/* --- INTERNAL (-Y) --- */}
      <group position={[0, -8, 0]}>
         <mesh material={MAT_PLASTIC_BLACK}>
            <boxGeometry args={[14, 18, 11]} />
         </mesh>
      </group>
    </group>
  );
};

export const FootSwitchModel = () => {
  return (
    <group>
      {/* --- EXTERNAL (+Y) --- */}
      <group>
         {/* Washer */}
         <group position={[0, 0.1, 0]}>
             <Washer radius={9} hole={6.1} material={MAT_CHROME} />
         </group>
         {/* Nut */}
         <group position={[0, 1.5, 0]}>
             <HexNut radius={8} height={2.5} material={MAT_CHROME} />
         </group>
         {/* Threaded Bushing */}
         <mesh position={[0, 2, 0]} material={MAT_CHROME}>
            <cylinderGeometry args={[6, 6, 8, 32]} />
         </mesh>
         
         {/* Plunger (Clicker) */}
         <group position={[0, 8, 0]}>
            <mesh material={MAT_CHROME}>
               <cylinderGeometry args={[4, 4, 6, 16]} />
            </mesh>
            <mesh position={[0, 3, 0]} material={MAT_CHROME}>
               <sphereGeometry args={[4]} />
            </mesh>
         </group>
      </group>

      {/* --- INTERNAL (-Y) --- */}
      <group position={[0, -10, 0]}>
         {/* Blue Body */}
         <mesh material={MAT_PLASTIC_BLUE}>
            <boxGeometry args={[18, 17, 18]} />
         </mesh>
         {/* Epoxy bottom */}
         <mesh position={[0, -9.5, 0]} material={MAT_PLASTIC_RED}>
            <boxGeometry args={[18, 2, 18]} />
         </mesh>
         {/* 9 Pins */}
         <group position={[0, -11.5, 0]}>
            {[ -5, 0, 5 ].map(x => (
              [ -5, 0, 5 ].map(z => (
                 <mesh key={`${x}-${z}`} position={[x, 0, z]} material={MAT_CHROME}>
                    <boxGeometry args={[1, 3, 1]} />
                 </mesh>
              ))
            ))}
         </group>
      </group>
    </group>
  );
};

export const LEDModel = ({ color = "#ff0000" }: { color?: string }) => {
   const matLED = new THREE.MeshStandardMaterial({ 
      color: color, 
      emissive: color, 
      emissiveIntensity: 2,
      roughness: 0.2
   });
   
   return (
      <group>
         {/* Chrome Bezel (+Y) */}
         <group>
            {/* Bezel Ring */}
            <mesh position={[0, 1, 0]} material={MAT_CHROME}>
               <cylinderGeometry args={[4, 4, 2, 32]} />
            </mesh>
            {/* Bezel Lip */}
            <mesh position={[0, 2, 0]} material={MAT_CHROME}>
               <torusGeometry args={[3.5, 0.8, 16, 32]} rotation={[Math.PI/2, 0, 0]} />
            </mesh>
            {/* The LED Bulb */}
            <mesh position={[0, 2, 0]} material={matLED}>
               <sphereGeometry args={[2.5, 32, 16]} />
            </mesh>
         </group>

         {/* Internal Body (-Y) */}
         <group position={[0, -6, 0]}>
            {/* Plastic Housing */}
            <mesh material={MAT_PLASTIC_BLACK}>
               <cylinderGeometry args={[3.5, 3.5, 12, 16]} />
            </mesh>
            {/* Pins */}
            <mesh position={[1, -7, 0]} material={MAT_CHROME}>
               <cylinderGeometry args={[0.3, 0.3, 4]} />
            </mesh>
            <mesh position={[-1, -7, 0]} material={MAT_CHROME}>
               <cylinderGeometry args={[0.3, 0.3, 4]} />
            </mesh>
         </group>
      </group>
   );
};