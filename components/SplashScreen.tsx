import React, { useEffect, useState } from 'react';
import { Cpu, Loader2 } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black z-50 flex items-center justify-center">
      <div className="text-center space-y-8 px-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 animate-pulse">
          <Cpu className="w-16 h-16 text-cyan-400" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-white">
            AlphaForge
          </h1>
          <p className="text-sm text-gray-400 font-mono tracking-wider">
            AI-POWERED KNOB MODELER
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-80 mx-auto space-y-3">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>

        {/* Version & Status */}
        <div className="text-xs text-gray-600 space-y-1">
          <p className="font-mono">v1.1.0</p>
          <p className="text-gray-700">Free & Open Source</p>
        </div>
      </div>
    </div>
  );
}
