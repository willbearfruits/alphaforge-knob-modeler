import React, { useState } from 'react';
import { Coffee, Heart, Github, X } from 'lucide-react';

export default function DonationButton() {
  const [visible, setVisible] = useState(true);

  const handleDonate = () => {
    // Direct PayPal payment link with email
    window.open('https://www.paypal.com/paypalme/dogme84', '_blank');
  };

  if (!visible) return null;

  return (
    <div className="space-y-3 bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-4 rounded-xl border border-amber-700/30 relative">
      {/* Close Button */}
      <button
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-800/50"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Beta Badge */}
      <div className="flex items-center gap-2 text-xs">
        <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
          BETA
        </span>
        <span className="text-gray-400">Free & Open Source</span>
      </div>

      {/* Donation Button */}
      <button
        onClick={handleDonate}
        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition-all transform hover:scale-105"
      >
        <Coffee className="w-4 h-4" />
        Buy Me a Coffee
      </button>

      {/* Support Text */}
      <div className="text-xs text-gray-400 space-y-1.5">
        <p className="flex items-center gap-1.5">
          <Heart className="w-3 h-3 text-red-400" />
          <span>PayPal: dogme84@gmail.com</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Github className="w-3 h-3 text-gray-500" />
          <span>Contributions & feedback welcome!</span>
        </p>
      </div>
    </div>
  );
}
