import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings, AISettings } from '../hooks/useSettings';

interface SettingsContextType {
  settings: AISettings;
  setSettings: React.Dispatch<React.SetStateAction<AISettings>>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, setSettings } = useSettings();
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};
