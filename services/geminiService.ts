import { KnobParameters } from "../types";

// Declare the Electron API that's exposed via preload
declare global {
  interface Window {
    electronAPI?: {
      generateKnobParams: (description: string) => Promise<Partial<KnobParameters>>;
    };
  }
}

export const generateKnobParams = async (description: string): Promise<Partial<KnobParameters>> => {
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
    // Fallback for browser environment (development only)
    console.warn("Electron API not available - running in browser mode");
    throw new Error("AI generation only available in desktop app. Please set GEMINI_API_KEY in .env.local and use the Electron app.");
  }
};
