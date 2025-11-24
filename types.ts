
export enum ShaftType {
  D_SHAFT = 'D-Shaft',
  ROUND = 'Round (Set Screw)',
  SPLINED = 'Splined (Knurled)',
}

export enum KnobShape {
  CYLINDER = 'Cylinder',
  POLYGON = 'Polygon',
  FLUTED = 'Fluted',
  DROP = 'Teardrop',
  POINTER = 'Pointer / Nub',
}

export interface KnobParameters {
  // Dimensions
  diameter: number;
  height: number;
  skirtHeight: number;
  skirtDiameter: number;
  
  // Shape
  shape: KnobShape;
  polygonSides: number; // For Polygon shape
  fluteCount: number;   // For Fluted shape
  taperPercentage: number; // 0 to 100%

  // Construction
  closedTop: boolean; // If true, shaft hole does not go all the way through
  hasCap: boolean;    // If true, creates a separate top part
  capHeight: number;  // Height of the cap
  capColor: string;   // Color of the cap filament

  // Pointer
  pointerIndent: boolean;
  pointerColor: string;
  
  // Shaft
  shaftType: ShaftType;
  shaftDiameter: number; // Usually 6mm or 6.35mm
  shaftDepth: number;
  dFlatSize: number; // Distance from Flat to Opposite side (e.g. 4.5mm for 6mm shaft)
}

export const DEFAULT_KNOB: KnobParameters = {
  diameter: 20,
  height: 18,
  skirtHeight: 0,
  skirtDiameter: 22,
  shape: KnobShape.CYLINDER,
  polygonSides: 6,
  fluteCount: 10,
  taperPercentage: 5,
  
  closedTop: true,
  hasCap: false,
  capHeight: 3,
  capColor: '#ff0000',

  pointerIndent: true,
  pointerColor: '#ffffff',
  shaftType: ShaftType.SPLINED,
  shaftDiameter: 6.0,
  shaftDepth: 14,
  dFlatSize: 4.5, // Standard Alpha D-Shaft
};
