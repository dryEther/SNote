import React from 'react';
import { SettingsIcon } from './icons';

interface LoginPromptProps {
    onOpenSettings: () => void;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({ onOpenSettings }) => {
    return (
        <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center p-8">
            <SettingsIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Login Required</h2>
            <p className="mt-2 max-w-lg text-gray-600 dark:text-gray-400">
                To use server storage, please go to Settings to configure your server URL and log in with your username.
            </p>
            <button
                onClick={onOpenSettings}
                className="mt-6 px-6 py-3 rounded-md font-semibold bg-accent-600 text-accent-contrast hover:bg-accent-700 dark:hover:bg-accent-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-accent-500"
            >
                Go to Settings
            </button>
        </div>
    );
};

export default LoginPrompt;