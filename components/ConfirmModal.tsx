import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme?: 'dark' | 'light';
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  theme = 'dark',
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onCancel(); // Close modal after confirm
  };

  const getVariantColors = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: theme === 'dark' ? 'text-red-400' : 'text-red-600',
          button: theme === 'dark'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-red-500 hover:bg-red-600 text-white',
        };
      case 'warning':
        return {
          icon: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600',
          button: theme === 'dark'
            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
            : 'bg-yellow-500 hover:bg-yellow-600 text-white',
        };
      case 'info':
        return {
          icon: theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600',
          button: theme === 'dark'
            ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
            : 'bg-cyan-500 hover:bg-cyan-600 text-white',
        };
    }
  };

  const colors = getVariantColors();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      <div
        className={`max-w-md w-full p-6 rounded-lg border shadow-2xl ${
          theme === 'dark'
            ? 'bg-gray-900 border-gray-800'
            : 'bg-white border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
            <h2
              id="confirm-modal-title"
              className={`text-lg font-bold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className={`p-1 rounded transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <p
          id="confirm-modal-description"
          className={`mb-6 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 px-4 py-2 rounded font-semibold border transition-colors ${
              theme === 'dark'
                ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'
                : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'
            }`}
            autoFocus
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2 rounded font-semibold transition-colors ${colors.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
