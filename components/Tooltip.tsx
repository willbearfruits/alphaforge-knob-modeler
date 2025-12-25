import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  theme?: 'dark' | 'light';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, delay = 500, theme = 'dark' }) => {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    timeoutRef.current = setTimeout(() => {
      const element = e.currentTarget as HTMLElement;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
      setShow(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      {show && (
        <div
          className={`fixed z-50 px-2 py-1 text-xs rounded shadow-lg pointer-events-none whitespace-nowrap ${
            theme === 'dark'
              ? 'text-white bg-gray-900 border border-gray-700'
              : 'text-gray-800 bg-white border border-gray-300'
          }`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {content}
          <div
            className={`absolute w-2 h-2 transform rotate-45 ${
              theme === 'dark'
                ? 'bg-gray-900 border-r border-b border-gray-700'
                : 'bg-white border-r border-b border-gray-300'
            }`}
            style={{
              bottom: '-5px',
              left: '50%',
              marginLeft: '-4px',
            }}
          />
        </div>
      )}
    </>
  );
};

// Keyboard hint helper
export const kbd = (key: string, theme: 'dark' | 'light' = 'dark') => (
  <kbd className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
    theme === 'dark'
      ? 'text-gray-400 bg-gray-800 border border-gray-700'
      : 'text-gray-600 bg-gray-100 border border-gray-300'
  }`}>
    {key}
  </kbd>
);

// Info icon with tooltip
export const InfoTooltip: React.FC<{ content: string | React.ReactNode; theme?: 'dark' | 'light' }> = ({ content, theme = 'dark' }) => (
  <Tooltip content={content} theme={theme}>
    <span className={`inline-flex items-center justify-center w-3.5 h-3.5 text-[10px] cursor-help border rounded-full transition-colors ${
      theme === 'dark'
        ? 'text-gray-500 hover:text-cyan-400 border-gray-600'
        : 'text-gray-600 hover:text-cyan-600 border-gray-400'
    }`}>
      ?
    </span>
  </Tooltip>
);
