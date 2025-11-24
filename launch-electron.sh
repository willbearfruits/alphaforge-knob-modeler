#!/bin/bash
# AlphaForge Electron Launcher

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════╗"
echo "║  AlphaForge - AI Knob Modeler         ║"
echo "║  Standalone Desktop Application       ║"
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

echo "🚀 Starting AlphaForge Desktop App..."
echo ""

npm run electron:dev
