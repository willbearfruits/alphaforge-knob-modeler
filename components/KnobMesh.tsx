
import React, { useMemo, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { KnobParameters, KnobShape, ShaftType } from '../types';

interface KnobMeshProps {
  params: KnobParameters;
  groupRef?: React.MutableRefObject<THREE.Group | null>;
  isSliceView?: boolean;
}

const KnobMesh: React.FC<KnobMeshProps> = ({ params, groupRef, isSliceView }) => {
  const localGroupRef = React.useRef<THREE.Group>(null);

  // 1. Generate the 2D Shapes (Outer Profile and Hole Profile)
  const { shapeSolid, shapeHollow } = useMemo(() => {
    const shape = new THREE.Shape();
    const radius = params.diameter / 2;
    const steps = 128;

    // --- Outer Profile Generation ---
    switch (params.shape) {
      case KnobShape.POLYGON: {
        const sides = Math.max(3, Math.floor(params.polygonSides));
        for (let i = 0; i < sides; i++) {
          const theta = (i / sides) * Math.PI * 2;
          const x = Math.cos(theta) * radius;
          const y = Math.sin(theta) * radius;
          if (i === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        }
        shape.closePath();
        break;
      }
      case KnobShape.FLUTED: {
        const flutes = Math.max(3, Math.floor(params.fluteCount));
        const depth = radius * 0.15;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const r = radius - (Math.cos(theta * flutes) * depth);
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;
          if (i === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        }
        break;
      }
      case KnobShape.DROP: {
        const tipDist = radius * 2.2; 
        const alpha = Math.acos(radius / tipDist);
        const startAngle = Math.PI / 2 + alpha;
        const endAngle = Math.PI / 2 - alpha; 
        shape.absarc(0, 0, radius, startAngle, endAngle + Math.PI * 2, false);
        shape.lineTo(0, tipDist);
        shape.closePath(); 
        break;
      }
      case KnobShape.POINTER: {
        const nubWidth = radius * 0.4;
        const nubHeight = radius * 1.3;
        const angleWidth = Math.asin((nubWidth / 2) / radius);
        const startAngle = Math.PI / 2 + angleWidth;
        const endAngle = Math.PI / 2 - angleWidth;
        shape.absarc(0, 0, radius, startAngle, endAngle + Math.PI * 2, false);
        shape.lineTo(nubWidth / 2, nubHeight);
        shape.lineTo(-nubWidth / 2, nubHeight);
        shape.closePath();
        break;
      }
      case KnobShape.CYLINDER:
      default: {
        shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
        break;
      }
    }

    // --- Shaft Hole Generation ---
    const holePath = new THREE.Path();
    const shaftR = params.shaftDiameter / 2;

    if (params.shaftType === ShaftType.D_SHAFT) {
      // Calculate flat position. params.dFlatSize is "Distance from Flat to Opposite Wall"
      // Center to Flat = dFlatSize - Radius
      // e.g. 4.5mm - 3mm = 1.5mm from center.
      const centerToFlat = params.dFlatSize - shaftR;
      
      // We place flat at BOTTOM (-Y) so it's opposite the Pointer (+Y)
      // Flat line is at Y = -centerToFlat
      const flatY = -centerToFlat;
      
      // Intersection X = sqrt(R^2 - y^2)
      const xOff = Math.sqrt(shaftR * shaftR - flatY * flatY);
      
      // Angles
      // We need to draw the D shape CW.
      // Start at Right intersection, go around Top to Left intersection, then straight line back.
      const startAngle = Math.asin(flatY / shaftR); // Approx -30deg
      const endAngle = Math.PI - startAngle; // Approx 210deg
      
      // absarc(x, y, r, start, end, clockwise)
      // To go from Right to Left via Top, we go Counter-Clockwise in standard math?
      // But Hole must be CW for ThreeJS shape subtraction? 
      // Actually ThreeJS Shapes: Outer CCW, Holes CW.
      // So we want to trace the hole border Clockwise.
      // Left Point -> Top -> Right Point -> Bottom Flat -> Left Point
      
      holePath.absarc(0, 0, shaftR, endAngle, startAngle, true); // CW arc
      holePath.lineTo(xOff, flatY); // Just in case
      holePath.lineTo(-xOff, flatY); // Close the flat
      holePath.closePath();

    } else if (params.shaftType === ShaftType.SPLINED) {
       const teeth = 18;
       const outerR = shaftR;
       const innerR = shaftR * 0.85;
       for(let i=0; i<teeth * 2; i++) {
         const theta = -(i / (teeth * 2)) * Math.PI * 2; // CW
         const r = (i % 2 === 0) ? outerR : innerR;
         const x = Math.cos(theta) * r;
         const y = Math.sin(theta) * r;
         if (i===0) holePath.moveTo(x, y);
         else holePath.lineTo(x, y);
       }
       holePath.closePath();
    } else {
      // Round
      holePath.absarc(0, 0, shaftR, 0, Math.PI * 2, true); // CW
    }

    // Shape Solid: Just the outer
    const shapeSolid = shape.clone();
    
    // Shape Hollow: Outer + Hole
    const shapeHollow = shape.clone();
    shapeHollow.holes.push(holePath);

    return { shapeSolid, shapeHollow };
  }, [params]);

  // 2. Generate Geometry Slices
  const slices = useMemo(() => {
    const totalHeight = params.height;
    const capHeight = params.hasCap ? Math.min(params.capHeight, totalHeight - 1) : 0;
    const bodyHeight = totalHeight - capHeight;
    const shaftDepth = Math.min(params.shaftDepth, totalHeight);
    
    // Helper for extrusion
    const createExtrusion = (shape: THREE.Shape, depth: number) => {
       const settings = {
         depth: depth,
         bevelEnabled: true, 
         bevelThickness: 0, // Disable bevel for stacking
         bevelSize: 0,
         steps: 1,
       };
       const geo = new THREE.ExtrudeGeometry(shape, settings);
       geo.rotateX(-Math.PI / 2); // Upright
       return geo;
    };

    const regions = [];

    // -- BODY REGIONS --
    
    // 1. Body Shaft Zone (Always Hollow)
    // Goes from 0 to min(bodyHeight, shaftDepth)
    const bodyShaftH = Math.min(bodyHeight, shaftDepth);
    if (bodyShaftH > 0.1) {
      regions.push({
        geo: createExtrusion(shapeHollow, bodyShaftH),
        y: 0,
        color: "#222",
        name: "Body_Hollow"
      });
    }

    // 2. Body Solid Zone (Above shaft hole, but below cap)
    // Goes from bodyShaftH to bodyHeight
    // If closedTop is FALSE, this remains Hollow.
    if (bodyHeight > bodyShaftH + 0.1) {
      const h = bodyHeight - bodyShaftH;
      regions.push({
        geo: createExtrusion(params.closedTop ? shapeSolid : shapeHollow, h),
        y: bodyShaftH,
        color: "#222",
        name: "Body_Solid"
      });
    }

    // -- CAP REGIONS --
    if (params.hasCap && capHeight > 0.1) {
      // 3. Cap Shaft Zone (If shaft extends into cap)
      // From bodyHeight to min(totalHeight, shaftDepth)
      const capShaftEnd = Math.min(totalHeight, shaftDepth);
      const capShaftH = Math.max(0, capShaftEnd - bodyHeight);
      
      if (capShaftH > 0.01) {
        regions.push({
          geo: createExtrusion(shapeHollow, capShaftH),
          y: bodyHeight,
          color: params.capColor,
          name: "Cap_Hollow"
        });
      }

      // 4. Cap Top Zone (Above shaft)
      // From (bodyHeight + capShaftH) to totalHeight
      const capTopStart = bodyHeight + capShaftH;
      const capTopH = totalHeight - capTopStart;
      
      if (capTopH > 0.01) {
        regions.push({
          geo: createExtrusion(params.closedTop ? shapeSolid : shapeHollow, capTopH),
          y: capTopStart,
          color: params.capColor,
          name: "Cap_Solid"
        });
      }
    }

    return regions;
  }, [params, shapeSolid, shapeHollow]);

  useLayoutEffect(() => {
    if (groupRef && localGroupRef.current) {
      groupRef.current = localGroupRef.current;
    }
  });

  // Cleanup geometries on unmount or when params change
  useEffect(() => {
    return () => {
      slices.forEach(slice => {
        if (slice.geo) {
          slice.geo.dispose();
        }
      });
    };
  }, [slices]);

  return (
    <group ref={localGroupRef}>
      {/* Generated Slices (Body & Cap) */}
      {slices.map((slice, idx) => (
        <mesh 
          key={idx} 
          geometry={slice.geo} 
          position={[0, slice.y, 0]} 
          castShadow 
          receiveShadow
          name={slice.name}
        >
           {isSliceView ? (
             <meshBasicMaterial color={slice.color} wireframe />
           ) : (
             <meshStandardMaterial 
              color={slice.color}
              roughness={0.4} 
              metalness={0.2} 
              flatShading={params.shape === KnobShape.POLYGON}
            />
           )}
        </mesh>
      ))}

      {/* Pointer Indicator (Only show if not using a shape that implies direction like Drop/Pointer, or if requested) */}
      {/* If hasCap, the indicator usually sits on the cap. */}
      {params.pointerIndent && params.shape !== KnobShape.DROP && params.shape !== KnobShape.POINTER && (
        <mesh 
          position={[0, params.height, params.diameter/2 - 2]} 
          rotation={[-Math.PI/2, 0, 0]}
          name="Indicator"
        >
           <capsuleGeometry args={[1, 4, 4, 8]} />
           <meshStandardMaterial 
             color={params.pointerColor} 
             emissive={params.pointerColor} 
             emissiveIntensity={0.5} 
           />
        </mesh>
      )}
      
      {/* Skirt (Optional) */}
      {params.skirtHeight > 0 && (
        <mesh position={[0, params.skirtHeight/2, 0]} name="Skirt">
           <cylinderGeometry args={[params.diameter/2, params.skirtDiameter/2, params.skirtHeight, 64]} />
           <meshStandardMaterial color="#222" />
        </mesh>
      )}
    </group>
  );
};

export default KnobMesh;
