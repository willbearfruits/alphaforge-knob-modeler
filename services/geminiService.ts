import { KnobParameters } from "../types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Declare the Electron API that's exposed via preload
declare global {
  interface Window {
    electronAPI?: {
      generateKnobParams: (description: string) => Promise<Partial<KnobParameters>>;
    };
  }
}

export const generateKnobParams = async (description: string, apiKey?: string): Promise<Partial<KnobParameters>> => {
  // Check if running in Electron environment
  if (window.electronAPI) {
    // Use secure IPC to main process (API key is safe in main process)
    try {
      const params = await window.electronAPI.generateKnobParams(description);
      return params;
    } catch (error) {
      console.error("Electron IPC Error:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to generate parameters");
    }
  } else {
    // Client-side execution (Web/Mobile)
    if (!apiKey) {
      throw new Error("API Key is required for mobile/web usage.");
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `
        You are a 3D modeling assistant. The user wants a knob described as: "${description}".
        
        Generate a JSON object with the following parameters based on the description. 
        Only return the JSON object, no other text.
        
        Parameters to generate:
        - diameter: number (in mm, usually between 10 and 50)
        - height: number (in mm, usually between 10 and 40)
        - shape: string (one of: "Cylinder", "Polygon", "Fluted", "Teardrop", "Pointer / Nub")
        - polygonSides: number (integer, only if shape is Polygon, between 3 and 12)
        - fluteCount: number (integer, only if shape is Fluted, between 3 and 24)
        - closedTop: boolean
        - hasCap: boolean (true if it should have a separate cap/hat)
        - capHeight: number (in mm, if hasCap is true)
        - capColor: string (hex color code, e.g., "#ff0000")
        - pointerIndent: boolean (true if it should have a pointer line/indent)
        - pointerColor: string (hex color code)
        - shaftType: string (one of: "D-Shaft", "Round (Set Screw)", "Splined (Knurled)")
        - shaftDiameter: number (in mm, usually 6 or 6.35)
        - shaftDepth: number (in mm)
        - dFlatSize: number (in mm, only if shaftType is D-Shaft, usually around 4.5)
        
        Example JSON:
        {
          "diameter": 25,
          "height": 20,
          "shape": "Cylinder",
          "closedTop": true,
          "hasCap": false,
          "shaftType": "Splined (Knurled)",
          "shaftDiameter": 6,
          "shaftDepth": 15
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }
      
      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      console.error("Client-side AI Error:", error);
      throw new Error("Failed to generate parameters on device. Check your API Key.");
    }
  }
};
