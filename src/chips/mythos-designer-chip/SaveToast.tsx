import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save } from 'lucide-react';

interface SaveToastProps {
  isVisible: boolean;
  onClose: () => void;
}

export const SaveToast: React.FC<SaveToastProps> = ({ isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="fixed bottom-4 right-4 z-50 pointer-events-none"
        >
          <div className="bg-[#0a0d12] border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded shadow-lg flex items-center gap-2 font-mono-data text-xs uppercase tracking-wider">
            <Save className="w-3 h-3" />
            <span>State Synchronized</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
