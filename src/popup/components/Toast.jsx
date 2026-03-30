import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Info } from 'lucide-react';

export default function Toast({ message, type = 'info', duration = 4000, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) setTimeout(onClose, 300); // Wait for fade out
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [message, duration, onClose]);

  if (!message && !visible) return null;

  const bgColors = {
    error: 'bg-red-500',
    info: 'bg-primary',
    loading: 'bg-gold'
  };

  const Icon = type === 'error' ? AlertCircle : (type === 'loading' ? Loader2 : Info);

  return (
    <div 
      className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full shadow-lg text-white flex items-center space-x-2 space-x-reverse transition-all duration-300 transform ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${bgColors[type] || bgColors.info}`}
    >
      <Icon className={`w-4 h-4 ${type === 'loading' ? 'animate-spin' : ''}`} />
      <span className="text-xs font-medium whitespace-nowrap">{message}</span>
    </div>
  );
}
