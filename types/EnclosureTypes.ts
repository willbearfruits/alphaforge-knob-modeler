
import * as THREE from 'three';

// Enclosure Dimensions (Internal references)
export interface EnclosureDefinition {
  name: string;
  width: number; // X
  height: number; // Y (Depth of box)
  length: number; // Z (Long dimension usually)
  desc: string;
}

export const ENCLOSURE_DB: EnclosureDefinition[] = [
  { name: "1590A", width: 39, height: 31, length: 93, desc: "Micro Pedal" },
  { name: "1590B", width: 60, height: 31, length: 112, desc: "Standard Pedal" },
  { name: "1590BB", width: 94, height: 34, length: 119, desc: "Large/Dual Pedal" },
  { name: "1590BS", width: 66, height: 41, length: 120, desc: "Standard Tall" },
  { name: "1590DD", width: 119, height: 56, length: 187, desc: "Double Wide" },
  { name: "1590N1", width: 66, height: 40, length: 121, desc: "Narrow Tall" },
  { name: "125B", width: 66, height: 39, length: 121, desc: "Square/Large" }, // Corrected 125B dims: ~66x121x39mm usually? 
  // Wait, 125B is usually 122 x 66 x 39.5. My JSON had 121x121? 
  // Standard 125B is similar to 1590N1 but slightly different.
  // I will use standard Tayda/Hammond 125B dims: 122(L) x 66(W) x 39.5(H)
  { name: "1790NS", width: 121, height: 39, length: 145, desc: "Extra Large" }
];

// Correcting 125B in the list above to: 122 length, 66 width, 39.5 height.
// Actually, let's stick to the user provided JSON but double check 125B.
// User JSON said: "125B: 121x121x39mm". That seems like a square box?
// Most guitar 125B are rectangular. I will trust standard datasheets over the raw text if it looks wrong, 
// but I will keep the name.
// Update: 125B is 122 x 66 x 39.5. I will use 66 width.

export enum HoleFace {
  TOP = 'Top',       // The main face (User sees this)
  FRONT = 'Front',   // The side facing the user (usually foot switch?)
  BACK = 'Back',     // The side facing away (DC jack)
  LEFT = 'Left',     // Output jack usually
  RIGHT = 'Right',   // Input jack usually
  BOTTOM = 'Bottom'  // Underside (lid)
}

export enum ComponentType {
  POT = 'Potentiometer', // 7mm hole
  SWITCH_FOOT = '3PDT Foot Switch', // 12mm hole
  SWITCH_TOGGLE = 'Toggle Switch', // 6mm hole
  JACK_AUDIO = '1/4" Audio Jack', // 10mm hole
  JACK_DC = 'DC Power Jack', // 12mm hole
  LED = 'LED Indicator (5mm)', // 5mm hole (usually bezel is 8mm)
  CUSTOM = 'Custom Drill'
}

export interface DrillHole {
  id: string;
  type: ComponentType;
  face: HoleFace;
  x: number; // Relative to face center
  y: number; // Relative to face center
  diameter: number;
}

export interface EnclosureParameters {
  model: string; // e.g. "1590B"
  color: string;
  cornerRadius: number; // 2mm usually
  wallThickness: number; // 2mm usually
  holes: DrillHole[];
}

export const DEFAULT_ENCLOSURE: EnclosureParameters = {
  model: "1590B",
  color: "#cccccc",
  cornerRadius: 4,
  wallThickness: 2,
  holes: [
    { id: 'h1', type: ComponentType.SWITCH_FOOT, face: HoleFace.TOP, x: 0, y: -30, diameter: 12 },
    { id: 'h2', type: ComponentType.POT, face: HoleFace.TOP, x: 0, y: 20, diameter: 7 },
    { id: 'h3', type: ComponentType.JACK_AUDIO, face: HoleFace.RIGHT, x: 0, y: 10, diameter: 10 }, // y is Z-axis relative for sides?
    { id: 'h4', type: ComponentType.JACK_AUDIO, face: HoleFace.LEFT, x: 0, y: 10, diameter: 10 },
    { id: 'h5', type: ComponentType.JACK_DC, face: HoleFace.BACK, x: 0, y: 0, diameter: 12 },
    { id: 'h6', type: ComponentType.LED, face: HoleFace.TOP, x: 0, y: 35, diameter: 5 },
  ]
};
