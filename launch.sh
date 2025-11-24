#!/bin/bash
# AlphaForge AI Knob Modeler Launcher

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════╗"
echo "║  AlphaForge - AI Knob Modeler         ║"
echo "║  3D Knob Design Tool                  ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check for API key
if ! grep -q "GEMINI_API_KEY=" .env.local || grep -q "your-api-key-here" .env.local; then
    echo "⚠️  Warning: GEMINI_API_KEY not configured in .env.local"
    echo "   The app will still work but AI features may be limited"
    echo ""
fi

echo "🚀 Starting AlphaForge Knob Modeler..."
echo "📍 The app will open in your browser automatically"
echo "🌐 URL: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
