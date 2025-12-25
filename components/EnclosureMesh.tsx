import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Geometry, Base, Subtraction, Addition } from '@react-three/csg';
import { PivotControls } from '@react-three/drei';
import { EnclosureParameters, ENCLOSURE_DB, HoleFace } from '../types/EnclosureTypes';
import { PotentiometerModel, AudioJackModel, DCJackModel, FootSwitchModel, LEDModel } from './ElectronicParts';
import { createNoiseTexture } from '../utils/textureUtils';

interface EnclosureMeshProps {
  params: EnclosureParameters;
  showHelpers?: boolean;
  showLid?: boolean;
  onUpdateHole?: (id: string, updates: { x: number, y: number }) => void;
}

const EnclosureMesh: React.FC<EnclosureMeshProps> = ({ params, showHelpers = false, showLid = true, onUpdateHole }) => {
  const specs = useMemo(() => 
    ENCLOSURE_DB.find(e => e.name === params.model) || ENCLOSURE_DB[1], 
  [params.model]);

  // Dimensions
  const W = specs.width;
  const H = specs.height;
  const L = specs.length;
  const THICK = params.wallThickness || 1.5; 
  const LID_THICK = 2.0;

  // Powder Coat Material (Procedural)
  const materialBody = useMemo(() => {
     const bumpMap = createNoiseTexture();
     const m = new THREE.MeshPhysicalMaterial({
       color: params.color,
       roughness: 0.6,
       metalness: 0.4, // Increased metalness for Die Cast look
       clearcoat: 0.1,
       clearcoatRoughness: 0.4,
       bumpMap: bumpMap,
       bumpScale: 0.05, // Subtle bump
     });
     return m;
  }, []); // Only create once

  // Update color without recreating material
  useEffect(() => {
    if (materialBody) {
      materialBody.color.set(params.color);
    }
  }, [params.color, materialBody]);

  // Cleanup material and textures on unmount
  useEffect(() => {
    return () => {
      if (materialBody) {
        // Dispose bump map texture
        if (materialBody.bumpMap) {
          materialBody.bumpMap.dispose();
        }
        // Dispose material
        materialBody.dispose();
      }
    };
  }, [materialBody]);

  // Helper to place drills
  const getDrillTransform = (face: HoleFace, x: number, y: number) => {
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();
    
    switch (face) {
      case HoleFace.TOP:
        pos.set(x, H, y);
        rot.set(0, 0, 0); 
        break;
      case HoleFace.BOTTOM:
        pos.set(x, 0, y);
        rot.set(Math.PI, 0, 0);
        break;
      case HoleFace.RIGHT:
        pos.set(W/2, H/2 + y, x);
        rot.set(0, 0, -Math.PI/2);
        break;
      case HoleFace.LEFT:
        pos.set(-W/2, H/2 + y, x);
        rot.set(0, 0, Math.PI/2);
        break;
      case HoleFace.FRONT:
        pos.set(x, H/2 + y, L/2);
        rot.set(Math.PI/2, 0, 0);
        break;
      case HoleFace.BACK:
        pos.set(x, H/2 + y, -L/2);
        rot.set(-Math.PI/2, 0, 0);
        break;
    }
    return { pos, rot };
  };

  const cornerPosts = useMemo(() => {
    const inset = 4 + THICK; 
    const x = W/2 - inset;
    const z = L/2 - inset;
    return [
      { x: x, z: z },
      { x: -x, z: z },
      { x: x, z: -z },
      { x: -x, z: -z },
    ];
  }, [W, L, THICK]);

  return (
    <group>
      {/* ==================== MAIN BODY ==================== */}
      <mesh castShadow receiveShadow name="Enclosure_Body" material={materialBody}>
        <Geometry>
          <Base>
             <boxGeometry args={[W, H, L]} />
          </Base>

          <Subtraction position={[0, -THICK/2, 0]}>
             <boxGeometry args={[W - 2*THICK, H - THICK, L - 2*THICK]} />
          </Subtraction>

          {cornerPosts.map((pos, i) => (
             <Addition key={`post-${i}`} position={[pos.x, 0, pos.z]}>
                <cylinderGeometry args={[3, 3, H, 16]} />
             </Addition>
          ))}
          
           {cornerPosts.map((pos, i) => (
             <Subtraction key={`screw-${i}`} position={[pos.x, -THICK, pos.z]}>
                <cylinderGeometry args={[1.5, 1.5, H+5, 16]} />
             </Subtraction>
          ))}

          {params.holes.map((hole) => {
            let { pos, rot } = getDrillTransform(hole.face, hole.x, hole.y);
            pos.y -= H/2; 
            return (
              <Subtraction key={hole.id} position={pos} rotation={rot}>
                <cylinderGeometry args={[hole.diameter/2, hole.diameter/2, 40, 32]} />
              </Subtraction>
            );
          })}
        </Geometry>
      </mesh>

      {/* ==================== LID ==================== */}
      {showLid && (
        <mesh 
          position={[0, -H/2 - LID_THICK/2 - 0.5, 0]} 
          castShadow 
          receiveShadow 
          name="Enclosure_Lid"
        >
           <Geometry>
              <Base>
                 <boxGeometry args={[W, LID_THICK, L]} />
              </Base>
              {cornerPosts.map((pos, i) => (
                 <Subtraction key={`lid-screw-${i}`} position={[pos.x, 0, pos.z]}>
                    <cylinderGeometry args={[1.6, 1.6, 10, 16]} /> 
                 </Subtraction>
              ))}
           </Geometry>
           <meshStandardMaterial color="#333333" roughness={0.8} />
        </mesh>
      )}

      {/* ==================== COMPONENT VISUALIZERS ==================== */}
      {showHelpers && params.holes.map((hole) => {
          let { pos, rot } = getDrillTransform(hole.face, hole.x, hole.y);
          pos.y -= H/2; 
          
          return (
            <group key={`vis-${hole.id}`} position={pos} rotation={rot}>
               {/* 
                  TODO: Implement Drag Controls here using <PivotControls>
                  It's complex because we need to map World Delta back to Face Local Delta.
                  For now, we just render the model.
               */}
               <group position={[0, -2, 0]}>
                  {hole.type === 'Potentiometer' && <PotentiometerModel />}
                  {hole.type === '1/4" Audio Jack' && <AudioJackModel />}
                  {hole.type === 'DC Power Jack' && <DCJackModel />}
                  {hole.type === '3PDT Foot Switch' && <FootSwitchModel />}
                  {hole.type.includes('LED') && <LEDModel />}
                  
                  {hole.type === 'Toggle Switch' && (
                     <mesh>
                       <cylinderGeometry args={[3, 3, 10]} />
                       <meshBasicMaterial color="gray" wireframe />
                    </mesh>
                  )}
               </group>
            </group>
          );
      })}
    </group>
  );
};

export default EnclosureMesh;