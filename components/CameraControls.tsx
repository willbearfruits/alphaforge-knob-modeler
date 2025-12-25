import { useRef, useImperativeHandle, forwardRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface CameraControlsHandle {
  setView: (view: 'top' | 'front' | 'side' | 'iso') => void;
  reset: () => void;
}

interface CameraControlsProps {
  distance?: number;
}

export const CameraControls = forwardRef<CameraControlsHandle, CameraControlsProps>(
  ({ distance = 30 }, ref) => {
    const { camera, controls } = useThree();
    const targetPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const targetTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
    const isAnimating = useRef(false);
    const animationProgress = useRef(0);
    const startPosition = useRef<THREE.Vector3>(new THREE.Vector3());
    const startTarget = useRef<THREE.Vector3>(new THREE.Vector3());

    useImperativeHandle(ref, () => ({
      setView: (view: 'top' | 'front' | 'side' | 'iso') => {
        // Save start position for smooth transition
        startPosition.current.copy(camera.position);
        if (controls) {
          startTarget.current.copy((controls as any).target || new THREE.Vector3(0, 0, 0));
        }

        // Set target positions based on view
        switch (view) {
          case 'top':
            targetPosition.current.set(0, distance, 0);
            targetTarget.current.set(0, 0, 0);
            break;
          case 'front':
            targetPosition.current.set(0, 0, distance);
            targetTarget.current.set(0, 0, 0);
            break;
          case 'side':
            targetPosition.current.set(distance, 0, 0);
            targetTarget.current.set(0, 0, 0);
            break;
          case 'iso':
            targetPosition.current.set(distance * 0.7, distance * 0.7, distance * 0.7);
            targetTarget.current.set(0, 0, 0);
            break;
        }

        isAnimating.current = true;
        animationProgress.current = 0;
      },
      reset: () => {
        startPosition.current.copy(camera.position);
        if (controls) {
          startTarget.current.copy((controls as any).target || new THREE.Vector3(0, 0, 0));
        }
        targetPosition.current.set(distance * 0.7, distance * 0.7, distance * 0.7);
        targetTarget.current.set(0, 0, 0);

        isAnimating.current = true;
        animationProgress.current = 0;
      },
    }));

    useFrame((state, delta) => {
      if (isAnimating.current && controls) {
        animationProgress.current += delta * 2; // Animation speed

        if (animationProgress.current >= 1) {
          // Animation complete
          camera.position.copy(targetPosition.current);
          (controls as any).target.copy(targetTarget.current);
          (controls as any).update();
          isAnimating.current = false;
          animationProgress.current = 1;
        } else {
          // Smooth easing (ease-out-cubic)
          const t = 1 - Math.pow(1 - animationProgress.current, 3);

          // Interpolate camera position
          camera.position.lerpVectors(startPosition.current, targetPosition.current, t);

          // Interpolate controls target
          const newTarget = new THREE.Vector3();
          newTarget.lerpVectors(startTarget.current, targetTarget.current, t);
          (controls as any).target.copy(newTarget);
          (controls as any).update();
        }
      }
    });

    return null; // This component doesn't render anything
  }
);

CameraControls.displayName = 'CameraControls';
