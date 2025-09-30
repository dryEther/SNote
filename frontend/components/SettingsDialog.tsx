
import React, { useState, useEffect } from 'react';
import type { AISettings, ProviderDetail } from '../hooks/useSettings';
import { ALL_TOOLBAR_ACTIONS, WELCOME_CONTENT } from '../constants';
import { XIcon } from './icons';
import Logo from './Logo';
import { 
    login, 
    register, 
    logout, 
    ApiError, 
    updateConfig, 
    ServerConfig,
    createFile
} from '../services/serverStorage';
import { useToast } from './ToastProvider';
import { defaultSettings } from '../hooks/useSettings';
import { stringifyFrontMatter } from '../utils/frontmatter';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AISettings) => void;
  currentSettings: AISettings;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
  const [settings, setSettings] = useState<AISettings>(currentSettings);
  const [activeTab, setActiveTab] = useState<'provider' | 'toolbar' | 'environment' | 'appearance'>('provider');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loginError, setLoginError] = useState('');
  const { showToast } = useToast();


  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      setActiveTab('provider');
      setLoginStatus('idle');
      setLoginError('');
    }
  }, [currentSettings, isOpen]);
  
  const handleSave = async () => {
    if (settings.storageLocation === 'server' && settings.serverProvider.token) {
        try {
            // The provider list is managed by the server. We only send back
            // user-configurable settings.
            const configToSave: Partial<ServerConfig> = {
              selectedProvider: settings.selectedProvider,
              selectedModel: settings.selectedModel,
              toolbarActions: settings.toolbarActions,
              appName: settings.appName,
              appSubtitle: settings.appSubtitle,
              accentColor: settings.accentColor,
              appLogoUrl: settings.appLogoUrl,
            };
            await updateConfig(configToSave);
        } catch (e: any) {
            showToast(`Error saving settings to server: ${e.message}`, 'error');
        }
    }
    
    // Save locally for immediate UI updates
    const settingsToSave = { ...settings };
    delete settingsToSave.serverProvider.password;
    onSave(settingsToSave);
    onClose();
  };
  
  const handleAddToolbarAction = (actionId: string) => {
    if (actionId && !settings.toolbarActions.includes(actionId)) {
        setSettings(s => ({ ...s, toolbarActions: [...s.toolbarActions, actionId]}));
    }
  };

  const handleRemoveToolbarAction = (actionId: string) => {
     setSettings(s => ({ ...s, toolbarActions: s.toolbarActions.filter(id => id !== actionId)}));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSettings(s => ({ ...s, appLogoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogin = async () => {
      setLoginStatus('loading');
      setLoginError('');
      const { username, password } = settings.serverProvider;
      if (!password) {
          setLoginStatus('error');
          setLoginError('Password is required.');
          return;
      }

      try {
          await login(username, password);
          onSave({
              ...settings,
              serverProvider: { ...settings.serverProvider, token: 'cookie_auth', password: '' },
          });
          setLoginStatus('idle');
          showToast('Login successful! Loading your workspace...', 'success');
          onClose();
      } catch (error: any) {
          setLoginStatus('error');
          if (error instanceof ApiError) {
              setLoginError(`Login failed: ${error.message}`);
          } else {
              setLoginError(`An unexpected error occurred: ${error.message}`);
          }
      }
  };

  const handleLoginKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Mirror the disabled logic of the button for consistency
      if (!settings.serverProvider.username || !settings.serverProvider.password || loginStatus === 'loading') {
        return;
      }
      handleLogin();
    }
  };

  const handleRegister = async () => {
      setLoginStatus('loading');
      setLoginError('');
      const { username, password } = settings.serverProvider;
      if (!password) {
          setLoginStatus('error');
          setLoginError('Password is required.');
          return;
      }

      try {
          await register(username, password);
          showToast('Registration successful! Logging in...', 'info');
          await login(username, password);
          
          // Create the welcome note for the new user.
          try {
            const welcomeNotePath = 'Welcome.md';
            const welcomeNoteId = `note:${welcomeNotePath}`;
            const content = stringifyFrontMatter({ id: welcomeNoteId, tags: ['welcome', 'guide'] }, WELCOME_CONTENT);
            await createFile(welcomeNotePath, 'Welcome.md', content);
          } catch (e) {
            console.error("Failed to create welcome note for new user:", e);
            // Don't block the login flow, just log the error and inform the user.
            showToast("Could not create welcome note, but registration was successful.", "info");
          }

          onSave({
              ...settings,
              serverProvider: { ...settings.serverProvider, token: 'cookie_auth', password: '' },
          });
          setLoginStatus('idle');
          showToast('Login successful! Loading your workspace...', 'success');
          onClose();
      } catch (error: any) {
          setLoginStatus('error');
          if (error instanceof ApiError) {
              setLoginError(`Registration failed: ${error.message}`);
          } else {
              setLoginError(`An unexpected error occurred: ${error.message}`);
          }
      }
  };

  const handleLogout = async () => {
      const { token } = currentSettings.serverProvider;
      if(token) {
         try {
            await logout();
         } catch(e) {
            console.error("Logout failed, clearing token locally anyway.", e);
         }
      }
      onSave({
          ...defaultSettings,
          storageLocation: currentSettings.storageLocation,
          serverProvider: {
              ...defaultSettings.serverProvider,
              username: currentSettings.serverProvider.username,
          }
      });
      showToast('Logged out successfully.', 'info');
      onClose();
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderId = e.target.value;
    const providerDetails = settings.providers.find(p => p.id === newProviderId);
    setSettings(s => ({
        ...s,
        selectedProvider: newProviderId,
        selectedModel: providerDetails?.models[0] || '',
    }));
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSettings(s => ({ ...s, selectedModel: e.target.value }));
  };

  if (!isOpen) return null;

  const commonInputClasses = "w-full bg-slate-100 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-slate-800 dark:text-gray-300 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500";
  const availableActions = ALL_TOOLBAR_ACTIONS.filter(action => !settings.toolbarActions.includes(action.id));
  const currentProviderDetails = settings.providers.find(p => p.id === settings.selectedProvider);

  const TabButton = ({ tabId, label }: { tabId: 'provider' | 'toolbar' | 'environment' | 'appearance', label: string }) => (
    <button
        onClick={() => setActiveTab(tabId)}
        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tabId ? 'bg-accent-100 text-accent-800 dark:bg-accent-500/20 dark:text-accent-300' : 'hover:bg-slate-100 dark:hover:bg-gray-700'}`}
    >
        {label}
    </button>
  );

  return (
    <div
      className="not-printable fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4 border border-slate-200 dark:border-gray-700">
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
        </div>
        
        <div className="flex flex-grow overflow-hidden">
          <nav className="w-48 flex-shrink-0 p-4 border-r border-slate-200 dark:border-gray-700">
            <ul className="space-y-1">
              <li><TabButton tabId="provider" label="AI Provider" /></li>
              <li><TabButton tabId="toolbar" label="Toolbar" /></li>
              <li><TabButton tabId="appearance" label="Appearance" /></li>
              <li><TabButton tabId="environment" label="Storage" /></li>
            </ul>
          </nav>
          
          <div className="flex-1 p-6 overflow-y-auto hide-scrollbar">
            {activeTab === 'provider' && (
              <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">AI Provider</h3>
                     <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                        AI provider is configured on the server. Select your preferred provider and model for AI actions.
                     </p>
                    <div className="space-y-4 mt-2 p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600">
                        {settings.storageLocation !== 'server' ? (
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">AI provider settings are only available when using Server storage.</p>
                        ) : settings.providers.length === 0 ? (
                             <p className="text-sm text-slate-600 dark:text-gray-400">No AI providers configured on the server.</p>
                        ) : (
                            <>
                                <div>
                                    <label htmlFor="provider-select" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Provider</label>
                                    <select
                                        id="provider-select"
                                        value={settings.selectedProvider}
                                        onChange={handleProviderChange}
                                        className={commonInputClasses}
                                    >
                                        <option value="" disabled>Select a provider</option>
                                        {settings.providers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {currentProviderDetails && currentProviderDetails.models.length > 0 && (
                                    <div>
                                    <label htmlFor="model-select" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Model</label>
                                    <select
                                        id="model-select"
                                        value={settings.selectedModel}
                                        onChange={handleModelChange}
                                        className={commonInputClasses}
                                    >
                                        {currentProviderDetails.models.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
              </div>
            )}
            {activeTab === 'toolbar' && (
              <div>
                  <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">Quick Access Toolbar</h3>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">Customize the buttons available in the editor's toolbar.</p>
                  <div className="p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600">
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Toolbar Actions</label>
                      <div className="flex flex-wrap gap-2 items-center mb-3 min-h-[40px]">
                          {settings.toolbarActions.map(actionId => {
                              const action = ALL_TOOLBAR_ACTIONS.find(a => a.id === actionId);
                              return action ? (
                                  <span key={action.id} className="flex items-center bg-accent-100 dark:bg-accent-500/20 text-accent-800 dark:text-accent-300 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                                      <action.icon className="w-4 h-4 mr-1.5" />
                                      {action.label}
                                      <button onClick={() => handleRemoveToolbarAction(action.id)} className="ml-2 p-0.5 rounded-full hover:bg-accent-200 dark:hover:bg-accent-500/40" aria-label={`Remove ${action.label}`}>
                                          <XIcon className="w-3.5 h-3.5"/>
                                      </button>
                                  </span>
                              ) : null;
                          })}
                      </div>
                       <label htmlFor="addAction" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Add Action</label>
                       <select 
                          id="addAction"
                          value=""
                          onChange={(e) => handleAddToolbarAction(e.target.value)}
                          className={`${commonInputClasses} ${availableActions.length === 0 ? 'cursor-not-allowed' : ''}`}
                          disabled={availableActions.length === 0}
                      >
                          <option value="" disabled>{availableActions.length > 0 ? "Select an action to add..." : "All actions added"}</option>
                          {availableActions.map(action => (
                               <option key={action.id} value={action.id}>{action.label}</option>
                          ))}
                      </select>

                  </div>
              </div>
            )}
             {activeTab === 'appearance' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">Application Name</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                            Set a custom name for the application (max 10 characters).
                        </p>
                        <div className="p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600">
                             <input
                                type="text"
                                id="app-name"
                                value={settings.appName}
                                onChange={(e) => setSettings(s => ({ ...s, appName: e.target.value }))}
                                maxLength={10}
                                className={commonInputClasses}
                                placeholder="Your App Name"
                            />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">Application Subtitle</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                            Set a custom subtitle shown below the application name.
                        </p>
                        <div className="p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600">
                             <input
                                type="text"
                                id="app-subtitle"
                                value={settings.appSubtitle}
                                onChange={(e) => setSettings(s => ({ ...s, appSubtitle: e.target.value }))}
                                maxLength={50}
                                className={commonInputClasses}
                                placeholder="Your intelligent journal."
                            />
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">Accent Color</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                            Choose an accent color for the application UI.
                        </p>
                        <div className="flex items-center gap-4 p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600">
                            <input
                                type="color"
                                value={settings.accentColor}
                                onChange={(e) => setSettings(s => ({ ...s, accentColor: e.target.value }))}
                                className="w-10 h-10 p-1 bg-white dark:bg-gray-600 border border-slate-300 dark:border-gray-500 rounded-md cursor-pointer"
                                aria-label="Accent color picker"
                            />
                            <div className="flex flex-wrap gap-2">
                                {['#06b6d4', '#ef4444', '#22c55e', '#f97316', '#8b5cf6', '#ec4899'].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                                        className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 ring-accent-500 ${settings.accentColor === color ? 'ring-2' : ''}`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Set accent color to ${color}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">Application Logo</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                            Upload a custom logo. It will be displayed in the sidebar. When using file system storage, the logo will be saved in your notes folder.
                        </p>
                        <div className="flex items-center gap-4 p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600">
                            <div className="w-16 h-16 bg-slate-200 dark:bg-gray-700 rounded-md flex items-center justify-center flex-shrink-0">
                                {settings.appLogoUrl ? (
                                    <img src={settings.appLogoUrl} alt="Logo Preview" className="w-full h-full object-cover rounded-md" />
                                ) : (
                                    <Logo className="w-12 h-12 text-slate-500 dark:text-gray-400" />
                                )}
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="file"
                                    id="logo-upload"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                                <label htmlFor="logo-upload" className="cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition-colors">
                                    Upload Logo
                                </label>
                                <button
                                  onClick={() => setSettings(s => ({ ...s, appLogoUrl: null }))}
                                  disabled={!settings.appLogoUrl}
                                  className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Reset to Default
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'environment' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-medium text-slate-800 dark:text-gray-200 mb-2">Persistent Storage</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 mb-3">
                            Choose where to save your notes. Changes will take effect after saving and reloading the app.
                        </p>
                        <select
                            id="storageLocation"
                            value={settings.storageLocation}
                            onChange={(e) => setSettings(s => ({ ...s, storageLocation: e.target.value as any }))}
                            className={commonInputClasses}
                        >
                            <option value="localStorage">Browser Storage</option>
                            <option value="fileSystem">Local File System</option>
                            <option value="server">Server</option>
                        </select>
                        <p className="mt-2 text-xs text-slate-500 dark:text-gray-500">
                            {settings.storageLocation === 'localStorage' && "Notes are stored in your browser's local storage. This is convenient but can be cleared by browser settings."}
                            {settings.storageLocation === 'fileSystem' && "Saves notes as Markdown files in a folder on your computer. Requires one-time permission."}
                            {settings.storageLocation === 'server' && "Saves notes to a remote server. Requires server URL and login."}
                        </p>
                        {settings.storageLocation === 'server' && (
                            <div className="mt-4 p-3 bg-slate-100 dark:bg-gray-700/50 rounded-md border border-slate-200 dark:border-gray-600 space-y-4">
                                {settings.serverProvider.token ? (
                                    <div>
                                        <p className="text-sm text-slate-700 dark:text-gray-300">
                                            Logged in as: <span className="font-semibold">{settings.serverProvider.username}</span>
                                        </p>
                                        <button
                                            onClick={handleLogout}
                                            className="mt-2 px-3 py-1.5 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition-colors"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Username</label>
                                            <input
                                                type="text"
                                                id="username"
                                                placeholder="Enter your username"
                                                value={settings.serverProvider.username}
                                                onChange={(e) => setSettings(s => ({ ...s, serverProvider: { ...s.serverProvider, username: e.target.value } }))}
                                                className={commonInputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="password"
                                                  className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Password</label>
                                            <input
                                                type="password"
                                                id="password"
                                                placeholder="Enter your password"
                                                value={settings.serverProvider.password}
                                                onChange={(e) => setSettings(s => ({ ...s, serverProvider: { ...s.serverProvider, password: e.target.value } }))}
                                                onKeyDown={handleLoginKeyDown}
                                                className={commonInputClasses}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 pt-1">
                                            <button
                                                onClick={handleLogin}
                                                disabled={!settings.serverProvider.username || !settings.serverProvider.password || loginStatus === 'loading'}
                                                className="px-4 py-2 rounded-md text-sm font-medium bg-accent-600 text-accent-contrast hover:bg-accent-700 dark:hover:bg-accent-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loginStatus === 'loading' ? 'Connecting...' : 'Login'}
                                            </button>
                                            <button
                                                onClick={handleRegister}
                                                disabled={!settings.serverProvider.username || !settings.serverProvider.password || loginStatus === 'loading'}
                                                className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loginStatus === 'loading' ? 'Connecting...' : 'Register'}
                                            </button>
                                        </div>
                                        {loginStatus === 'error' && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{loginError}</p>}
                                    </div>
                                )}
                            </div>
                        )}
                         <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-md border border-yellow-200 dark:border-yellow-500/20">
                             <p className="text-xs text-yellow-800 dark:text-yellow-300">
                                <strong>Note:</strong> Switching storage locations does not automatically migrate your existing notes.
                             </p>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t border-slate-200 dark:border-gray-700 flex-shrink-0 bg-slate-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-600 text-accent-contrast hover:bg-accent-700 dark:hover:bg-accent-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;