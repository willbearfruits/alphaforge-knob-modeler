
import { EnclosureParameters, ENCLOSURE_DB, HoleFace } from '../types/EnclosureTypes';

export const generateDrillTemplateSVG = (params: EnclosureParameters): string => {
  const specs = ENCLOSURE_DB.find(e => e.name === params.model) || ENCLOSURE_DB[1];
  const W = specs.width;
  const H = specs.height; // Depth
  const L = specs.length;
  
  // Padding and layout
  const pad = 20;
  
  // Canvas Size
  // We lay them out: Top in center.
  // Left/Right on sides.
  // Front/Back above/below.
  
  // Center X, Y
  const cx = 300;
  const cy = 300;
  
  // Face Origins (Top-Left of the face rect)
  // Top Face (W x L) - Wait, usually L is vertical on paper?
  // Pedal Top: Width is horizontal, Length is vertical.
  const topRect = { x: cx - W/2, y: cy - L/2, w: W, h: L };
  
  // Right Face (H x L) - to the right of Top
  const rightRect = { x: topRect.x + W + pad, y: topRect.y, w: H, h: L };
  
  // Left Face (H x L) - to the left
  const leftRect = { x: topRect.x - pad - H, y: topRect.y, w: H, h: L };
  
  // Back Face (W x H) - above Top (since Back is "North" usually)
  const backRect = { x: topRect.x, y: topRect.y - pad - H, w: W, h: H };
  
  // Front Face (W x H) - below Top
  const frontRect = { x: topRect.x, y: topRect.y + L + pad, w: W, h: H };
  
  let svg = `<?xml version="1.0" standalone="no"?>
  <svg width="600" height="800" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <style>
    .outline { fill: none; stroke: black; stroke-width: 1; }
    .drill { fill: none; stroke: red; stroke-width: 1; }
    .center { stroke: red; stroke-width: 0.5; stroke-dasharray: 2,2; }
    .label { font-family: sans-serif; font-size: 10px; fill: blue; }
  </style>
  <rect width="100%" height="100%" fill="white"/>
  
  <!-- Scale Check -->
  <line x1="50" y1="50" x2="150" y2="50" stroke="black" stroke-width="2"/>
  <text x="50" y="45" class="label">100mm Scale Check</text>
  <text x="50" y="70" class="label">Model: ${params.model}</text>
  `;

  // Helper to draw face
  const drawFace = (name: string, rect: {x:number,y:number,w:number,h:number}, faceEnum: HoleFace) => {
    // Draw Outline
    svg += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="outline" />`;
    svg += `<text x="${rect.x}" y="${rect.y - 5}" class="label">${name}</text>`;
    
    // Draw Center Lines
    const cx = rect.x + rect.w/2;
    const cy = rect.y + rect.h/2;
    svg += `<line x1="${cx}" y1="${rect.y}" x2="${cx}" y2="${rect.y+rect.h}" class="center"/>`;
    svg += `<line x1="${rect.x}" y1="${cy}" x2="${rect.x+rect.w}" y2="${cy}" class="center"/>`;

    // Draw Drills
    const faceHoles = params.holes.filter(h => h.face === faceEnum);
    faceHoles.forEach(h => {
       // Coords are relative to center
       // Need to map standard 3D coords to 2D SVG coords
       // Logic depends on face orientation in 'drawFace' call
       // For Top: x is X, y is Y (Length)
       
       let hx = cx;
       let hy = cy;
       
       if (faceEnum === HoleFace.TOP) {
          hx = cx + h.x; 
          hy = cy + h.y; 
       } else if (faceEnum === HoleFace.RIGHT) {
          // 3D: y (height) -> x (width on paper), x (length) -> y (height on paper)
          // Wait, 'Right' rect is H wide, L tall.
          // 3D Right Face: y is vertical height, x is horizontal Z-length.
          // On paper, Width is H (Height), Height is L (Length).
          // So 3D 'y' maps to paper 'x' (offset from center)
          // 3D 'x' maps to paper 'y' (offset from center)
          hx = cx + h.y;
          hy = cy + h.x;
       } else if (faceEnum === HoleFace.LEFT) {
          hx = cx - h.y; // Invert height for left?
          hy = cy + h.x;
       } else if (faceEnum === HoleFace.FRONT) {
          // Rect W x H
          // 3D: x is X, y is Height
          hx = cx + h.x;
          hy = cy + h.y;
       } else if (faceEnum === HoleFace.BACK) {
          hx = cx + h.x;
          hy = cy - h.y; // Invert?
       }

       const r = h.diameter / 2;
       svg += `<circle cx="${hx}" cy="${hy}" r="${r}" class="drill" />`;
       
       // Crosshair
       svg += `<line x1="${hx-r}" y1="${hy}" x2="${hx+r}" y2="${hy}" class="center"/>`;
       svg += `<line x1="${hx}" y1="${hy-r}" x2="${hx}" y2="${hy+r}" class="center"/>`;
    });
  };

  drawFace("TOP", topRect, HoleFace.TOP);
  drawFace("RIGHT (Input)", rightRect, HoleFace.RIGHT);
  drawFace("LEFT (Output)", leftRect, HoleFace.LEFT);
  drawFace("BACK (DC)", backRect, HoleFace.BACK);
  drawFace("FRONT", frontRect, HoleFace.FRONT);

  svg += `</svg>`;
  return svg;
};
