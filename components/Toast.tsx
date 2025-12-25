import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('alphaforge-theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  // Listen for theme changes
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('alphaforge-theme');
      setTheme((saved as 'dark' | 'light') || 'dark');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check periodically (since localStorage events don't fire in same tab)
    const interval = setInterval(handleStorageChange, 100);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} theme={theme} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void; theme: 'dark' | 'light' }> = ({ toast, onClose, theme }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const getIcon = () => {
    const iconClasses = theme === 'dark' ? '' : '';
    switch (toast.type) {
      case 'success': return <CheckCircle className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />;
      case 'error': return <AlertCircle className={`w-5 h-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />;
      case 'warning': return <AlertTriangle className={`w-5 h-5 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />;
      case 'info': return <Info className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />;
    }
  };

  const getBgColor = () => {
    if (theme === 'dark') {
      switch (toast.type) {
        case 'success': return 'bg-green-900/90 border-green-700';
        case 'error': return 'bg-red-900/90 border-red-700';
        case 'warning': return 'bg-yellow-900/90 border-yellow-700';
        case 'info': return 'bg-cyan-900/90 border-cyan-700';
      }
    } else {
      switch (toast.type) {
        case 'success': return 'bg-green-50 border-green-300';
        case 'error': return 'bg-red-50 border-red-300';
        case 'warning': return 'bg-yellow-50 border-yellow-300';
        case 'info': return 'bg-cyan-50 border-cyan-300';
      }
    }
  };

  return (
    <div
      className={`
        ${getBgColor()}
        border rounded-lg shadow-lg p-4 min-w-[300px] max-w-[400px]
        flex items-start gap-3 pointer-events-auto
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}
      `}
      style={{
        animation: isExiting ? undefined : 'slideIn 0.3s ease-out'
      }}
    >
      {getIcon()}
      <p className={`flex-1 text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{toast.message}</p>
      <button
        onClick={handleClose}
        className={`transition-colors ${
          theme === 'dark'
            ? 'text-gray-400 hover:text-white'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <X className="w-4 h-4" />
      </button>
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(2rem);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
