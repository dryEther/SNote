import React from 'react';
import { FolderIcon } from './icons';

interface DirectoryPickerProps {
    onDirectoryPick: () => void;
    error?: string | null;
}

const DirectoryPicker: React.FC<DirectoryPickerProps> = ({ onDirectoryPick, error }) => {
    return (
        <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center p-8">
            <FolderIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Select a Notes Directory</h2>
            <p className="mt-2 max-w-lg text-gray-600 dark:text-gray-400">
                To use local file system storage, please select a folder on your computer where you'd like your notes to be saved.
                The app will remember this folder for future sessions.
            </p>
            <button
                onClick={onDirectoryPick}
                className="mt-6 px-6 py-3 rounded-md font-semibold bg-accent-600 text-accent-contrast hover:bg-accent-700 dark:hover:bg-accent-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-accent-500"
            >
                Choose Directory
            </button>
            {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
};

export default DirectoryPicker;