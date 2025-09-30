import React from 'react';

interface ChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (choice: 'zip' | 'pdf') => void;
  title: string;
  children: React.ReactNode;
  option1Text: string;
  option2Text: string;
}

const ChoiceDialog: React.FC<ChoiceDialogProps> = ({ isOpen, onClose, onConfirm, title, children, option1Text, option2Text }) => {
  if (!isOpen) return null;

  return (
    <div
      className="not-printable fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h2>
        <div className="text-slate-600 dark:text-gray-300 mb-6">{children}</div>
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm('zip')}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-600 text-accent-contrast hover:bg-accent-700 dark:hover:bg-accent-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
          >
            {option1Text}
          </button>
          <button
            onClick={() => onConfirm('pdf')}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-600 text-accent-contrast hover:bg-accent-700 dark:hover:bg-accent-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
          >
            {option2Text}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChoiceDialog;
