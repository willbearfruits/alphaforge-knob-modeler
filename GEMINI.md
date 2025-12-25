# AlphaForge Knob Modeler

**AI-Powered 3D Knob Designer for 3D Printing**

AlphaForge Knob Modeler is a production-ready, cross-platform Electron application that allows users to design custom 3D-printable knobs using natural language. It leverages the Google Gemini API to translate text descriptions into parametric 3D models.

## Project Overview

- **Type:** Desktop Application (Electron)
- **Frontend:** React 19, TypeScript, Vite
- **3D Engine:** Three.js, React Three Fiber
- **AI Integration:** Google Gemini API (via secure Main Process IPC)
- **Status:** Production Ready (v1.0.0)

## Architecture

The application follows a secure Electron architecture where sensitive operations (like API calls) are handled in the Node.js Main Process, separated from the Renderer Process.

### Directory Structure

- **`electron.cjs`**: The Electron Main Process. Handles app lifecycle, window creation, and secure IPC handlers for the Gemini API.
- **`preload.cjs`**: The context bridge. Exposes a safe, limited API (`window.electronAPI`) to the renderer.
- **`App.tsx`**: The main React entry point.
- **`services/geminiService.ts`**: Frontend service that calls the Electron IPC bridge to request knob parameters.
- **`components/KnobMesh.tsx`**: The core 3D component that renders the knob based on parametric data. Includes logic for D-Shaft, Round, and Splined fits with adjustable tolerance.
- **`dist/`**: The web build output (Vite).
- **`dist-electron/`**: The packaged desktop application installers.

### Key Data Flow

1.  User enters a description (e.g., "vintage hi-fi volume knob").
2.  `App.tsx` calls `geminiService.ts`.
3.  `geminiService.ts` invokes `window.electronAPI.generateKnobParams()` via IPC.
4.  `electron.cjs` receives the event, reads the secure `GEMINI_API_KEY`, calls Google Gemini, and returns JSON parameters.
5.  `App.tsx` updates the state, and `KnobMesh.tsx` re-renders the 3D model.

## Development

### Prerequisites

- Node.js v16+
- Valid `GEMINI_API_KEY` in `.env.local`

### Commands

| Command | Description |
| :--- | :--- |
| `npm run electron:dev` | **Start Dev Server.** Runs React (HMR) + Electron Main process. |
| `npm run electron:build:linux` | Build Linux packages (AppImage, .deb). |
| `npm run electron:build:win` | Build Windows installers (NSIS). |
| `npm run electron:build:mac` | Build macOS packages (.dmg, .zip). |
| `npm run build:clean` | Clean `dist` and `dist-electron` directories. |

### Configuration

- **Environment Variables:**
    - `.env.local`: Store `GEMINI_API_KEY=...` here. This file is ignored by git.
- **Electron Builder:** Configured in `package.json` under the `build` key.

## Coding Conventions

- **Security:** NEVER expose API keys in the frontend (`.tsx` files). Always use `ipcMain` in `electron.cjs` for sensitive tasks.
- **3D Modeling & Fit:**
    - **Hole Tolerance:** All shaft holes include a `holeTolerance` offset (default 0.15mm) to account for 3D printing shrinkage.
    - **Spline Ratio:** Knurled/Splined shafts use a 0.90 ratio for the inner root diameter to ensure compatibility with standard T18 potentiometers.
- **Memory Management:**
    - Explicitly dispose of Three.js geometries and materials in `useEffect` cleanup functions.
    - Revoke object URLs (e.g., for STL exports) to prevent leaks.
- **Logging:** Use `electron-log` instead of `console.log` for persistent logs in production.

## Production Notes

- **Assets:** Application icons are located in `build/`.
- **Logs:** Production logs are stored in the OS-specific user data folder (e.g., `~/.config/alphaforge-ai-knob-modeler/logs/` on Linux).
- **Code Signing:** Currently pending for Windows/macOS.
