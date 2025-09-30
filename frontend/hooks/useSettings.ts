
import { useLocalStorage } from './useLocalStorage';
import React, { useMemo, useCallback } from 'react';

export type StorageLocation = 'localStorage' | 'fileSystem' | 'server';

// Represents a parsed, client-friendly provider configuration
export interface ProviderDetail {
    id: string;
    name: string;
    models: string[];
}

export interface AISettings {
  // Config fetched and parsed from server
  providers: ProviderDetail[];
  
  // User's selections (to be saved back to server)
  selectedProvider: string; // id of the provider, e.g., 'ollama'
  selectedModel: string; // the model for the selected provider

  // Other UI settings
  toolbarActions: string[];
  appName: string;
  appSubtitle: string;
  accentColor: string;
  appLogoUrl: string | null;

  // Connection settings
  storageLocation: StorageLocation;
  serverProvider: {
    username: string;
    password?: string;
    token?: string;
  };
}

export const defaultSettings: AISettings = {
  providers: [], // This will be populated from the server on load
  selectedProvider: '',
  selectedModel: '',
  toolbarActions: ['enrich', 'format-selection', 'undo', 'redo'],
  storageLocation: 'localStorage',
  appLogoUrl: null,
  appName: 'SNote',
  appSubtitle: 'Your intelligent journal.',
  accentColor: '#06b6d4',
  serverProvider: {
    username: '',
    password: '',
    token: '',
  },
};

export const useSettings = () => {
  const [storedSettings, setStoredSettings] = useLocalStorage<Partial<AISettings>>('ai-settings', defaultSettings);
  
  const settings = useMemo<AISettings>(() => {
    return {
      ...defaultSettings,
      ...storedSettings,
      serverProvider: {
        ...defaultSettings.serverProvider,
        ...(storedSettings.serverProvider || {}),
      },
    };
  }, [storedSettings]);

  const setSettings = useCallback((value: React.SetStateAction<AISettings>) => {
    if (typeof value === 'function') {
      setStoredSettings(prevStored => {
        const prevFull: AISettings = {
          ...defaultSettings,
          ...prevStored,
           serverProvider: { ...defaultSettings.serverProvider, ...(prevStored.serverProvider || {}) },
        };
        return value(prevFull);
      });
    } else {
      setStoredSettings(value);
    }
  }, [setStoredSettings]);


  return { settings, setSettings };
};