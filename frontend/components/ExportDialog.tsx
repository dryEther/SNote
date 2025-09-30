import React from 'react';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'md' | 'pdf') => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div
      className="not-printable fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4 border border-slate-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Choose Export Format</h2>
        <p className="text-slate-600 dark:text-gray-300 mb-6">How would you like to export the selected item?</p>
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => onSelect('md')}
            className="w-full px-4 py-3 rounded-md text-base font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
          >
            As Markdown (.md / .zip)
          </button>
          <button
            onClick={() => onSelect('pdf')}
            className="w-full px-4 py-3 rounded-md text-base font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
          >
            As PDF
          </button>
        </div>
        <div className="mt-6 flex justify-end">
             <button
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-gray-500"
            >
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
