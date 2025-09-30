

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useSettingsContext } from '../contexts/SettingsContext';
import type { FileSystemItem, Note, Folder } from '../types';
import { idbGet, idbSet } from '../utils/idb';
import { parseFrontMatter, stringifyFrontMatter, ParsedMarkdown } from '../utils/frontmatter';
import { useToast } from '../components/ToastProvider';
import JSZip from 'jszip';
import {
    fetchFileSystem as fetchServerFileSystem,
    fetchNoteContent,
    createFile,
    updateFile,
    createFolder,
    deleteItem as deleteServerItem,
    renameItem as renameServerItem,
    moveItem as moveServerItem,
    uploadZip,
    loadConfig,
    ApiError,
    ServerProviderConfig,
} from '../services/serverStorage';
import { defaultSettings, ProviderDetail } from './useSettings';
import {
    findItemAndParent,
    findAndRemoveItem,
    addItemToFolder,
    updateItemRecursive,
    deleteItemRecursive,
    sortFileSystemItems,
    findAndReplaceItem
} from '../utils/tree';
import { WELCOME_CONTENT } from '../constants';


// FIX: Add type definitions for the experimental File System Access API
// to resolve TypeScript errors about missing properties and types.
declare global {
    // This is a missing type from the spec.
    interface FileSystemHandlePermissionDescriptor {
        mode?: 'read' | 'readwrite';
    }

    // Augment the existing FileSystemHandle interface.
    interface FileSystemHandle {
        queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
        requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    }

    // Augment the existing FileSystemFileHandle interface.
    interface FileSystemFileHandle {
        getFile(): Promise<File>;
    }
    
    // Add showDirectoryPicker to the Window interface.
    interface Window {
        showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    }

    // Proprietary, non-standard API for renaming, but useful.
    interface FileSystemDirectoryHandle {
        move?(source: string, destination: string): Promise<void>;
    }
}

// Helper to detect if the app is running in a cross-origin iframe, where file system access is restricted.
const IS_CROSS_ORIGIN_IFRAME = (() => {
    if (window.self === window.top) {
        return false; // Not in an iframe
    }
    try {
        // Accessing this property will throw a security error if cross-origin
        const _ = window.top?.location.href;
        return false; // Same-origin iframe
    } catch (e) {
        return true; // Cross-origin iframe
    }
})();


const DIRECTORY_HANDLE_KEY = 'directory-handle';
const CUSTOM_LOGO_FILENAME = 'app-logo.txt';

const initialFileSystem: Folder[] = [
    {
        id: 'root',
        name: 'My Notes',
        type: 'folder',
        isOpen: true,
        path: '',
        children: [
            { id: '1', name: 'Welcome', type: 'note', content: WELCOME_CONTENT, tags: ['welcome', 'guide'], path: 'Welcome.md', isContentLoaded: true },
        ],
    }
];

const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 9);

// --- File System API Logic ---
async function verifyPermission(handle: FileSystemHandle, withWrite: boolean): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = withWrite ? { mode: 'readwrite' } : { mode: 'read' };
    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

async function readDirectory(dirHandle: FileSystemDirectoryHandle, path: string): Promise<FileSystemItem[]> {
    const items: FileSystemItem[] = [];
    for await (const entry of dirHandle.values()) {
        const entryPath = path ? `${path}/${entry.name}`: entry.name;
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            try {
                const file = await (entry as FileSystemFileHandle).getFile();
                const contentWithFrontMatter = await file.text();
                const { data, content } = parseFrontMatter(contentWithFrontMatter);
                const note: Note = {
                    id: data.id || `note:${entryPath}`,
                    name: entry.name.replace(/\.md$/, ''),
                    content,
                    type: 'note',
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    path: entryPath,
                    isContentLoaded: true,
                };
                items.push(note);
            } catch (e) {
                console.error(`Error reading file ${entry.name}:`, e);
            }
        } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
            const subdirHandle = entry as FileSystemDirectoryHandle;
            const children = await readDirectory(subdirHandle, entryPath);
            const folder: Folder = {
                id: `folder:${entryPath}`,
                name: entry.name,
                type: 'folder',
                children: children, 
                isOpen: false,
                path: entryPath,
            };
            items.push(folder);
        }
    }
    return items.sort(sortFileSystemItems);
}

async function copyItem(sourceHandle: FileSystemHandle, targetDirHandle: FileSystemDirectoryHandle): Promise<void> {
    if (sourceHandle.kind === 'file') {
        const file = await (sourceHandle as FileSystemFileHandle).getFile();
        const newFileHandle = await targetDirHandle.getFileHandle(sourceHandle.name, { create: true });
        const writer = await newFileHandle.createWritable();
        await writer.write(file);
        await writer.close();
    } else if (sourceHandle.kind === 'directory') {
        const newDirHandle = await targetDirHandle.getDirectoryHandle(sourceHandle.name, { create: true });
        for await (const entry of (sourceHandle as FileSystemDirectoryHandle).values()) {
            await copyItem(entry, newDirHandle);
        }
    }
}

const parseProviders = (providersFromServer: ServerProviderConfig[]): ProviderDetail[] => {
  const providerDetails: ProviderDetail[] = [];
  if (!providersFromServer) return [];

  for (const p of providersFromServer) {
    if (typeof p === 'string') {
      providerDetails.push({ id: p, name: p.charAt(0).toUpperCase() + p.slice(1), models: [] });
    } else if (typeof p === 'object' && p !== null) {
      const providerId = Object.keys(p)[0];
      const details = p[providerId];
      if (providerId && details) {
        providerDetails.push({
          id: providerId,
          name: details.name || providerId.charAt(0).toUpperCase() + providerId.slice(1),
          models: details.model || [],
        });
      }
    }
  }
  return providerDetails;
};


// --- The Hook ---
export const useNotes = () => {
    const { settings, setSettings } = useSettingsContext();
    const [localStorageNotes, setLocalStorageNotes] = useLocalStorage<FileSystemItem[]>('fileSystem', initialFileSystem);

    // Common state
    const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // File System specific state
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [needsPicker, setNeedsPicker] = useState(false);
    
    // Server specific state
    const [needsLogin, setNeedsLogin] = useState(false);
    const isServerLoadInitiated = useRef(false);


    const { showToast } = useToast();
    
    const { token } = settings.serverProvider;

    const refreshServerNotes = useCallback(async () => {
        if (!token) {
            setNeedsLogin(true);
            setIsLoading(false);
            setFileSystem([]);
            return;
        }
        setIsLoading(true);
        setNeedsLogin(false);
        try {
            const initialTree = await fetchServerFileSystem();

            // Load content for root-level notes immediately.
            const rootNotesToLoad = initialTree.filter(
                (item): item is Note => item.type === 'note' && !item.isContentLoaded
            );

            if (rootNotesToLoad.length > 0) {
                const contentPromises = rootNotesToLoad.map(note =>
                    fetchNoteContent(note.path)
                        .then((parsedNote: ParsedMarkdown) => ({
                            ...note,
                            content: parsedNote.content,
                            tags: Array.isArray(parsedNote.data.tags) ? parsedNote.data.tags : [],
                            isContentLoaded: true
                        }))
                        .catch(e => {
                            console.error(`Failed to load content for root note ${note.path}`, e);
                            showToast(`Could not load content for ${note.name}`, 'error');
                            return note; // Return original note on failure
                        })
                );
                
                const loadedRootNotes = await Promise.all(contentPromises);
                const loadedRootNotesMap = new Map(loadedRootNotes.map(n => [n.id, n]));

                const finalTree = initialTree.map(item => {
                    return loadedRootNotesMap.get(item.id) || item;
                });

                setFileSystem(finalTree);
            } else {
                setFileSystem(initialTree);
            }
        } catch (e: any) {
            console.error("Failed to refresh server notes:", e);
            setError(e.message || "Could not connect to the server.");
            showToast(e.message || "Connection to server failed.", 'error');
            if (e instanceof ApiError && e.status === 401) {
                setSettings(s => ({ ...s, serverProvider: { ...s.serverProvider, token: '' } }));
                setNeedsLogin(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, [token, showToast, setSettings, setError]);

    const getDataDirectoryHandle = useCallback(async (rootHandle: FileSystemDirectoryHandle | null): Promise<FileSystemDirectoryHandle | null> => {
        if (!rootHandle) return null;
        return rootHandle;
    }, []);

    // Load initial data based on storage type
    useEffect(() => {
        const init = async () => {
            setError(null);
            setNeedsPicker(false);
            setNeedsLogin(false);
            setDirectoryHandle(null);
            
            if (settings.storageLocation === 'fileSystem') {
                isServerLoadInitiated.current = false;
                setIsLoading(true);
                if (IS_CROSS_ORIGIN_IFRAME) {
                    setError("Local File System is not available in this sandboxed environment. Please use Browser Storage in Settings.");
                    setNeedsPicker(true);
                    setFileSystem([]);
                    setIsLoading(false);
                    return;
                }
                try {
                    const handle = await idbGet<FileSystemDirectoryHandle>(DIRECTORY_HANDLE_KEY);
                    if (handle && await verifyPermission(handle, false)) {
                        try {
                            const logoFileHandle = await handle.getFileHandle(CUSTOM_LOGO_FILENAME);
                            const file = await logoFileHandle.getFile();
                            const logoDataUrl = await file.text();
                            if (logoDataUrl && settings.appLogoUrl !== logoDataUrl) {
                                setSettings(s => ({ ...s, appLogoUrl: logoDataUrl }));
                            }
                        } catch (e) {
                             if (!(e instanceof DOMException && e.name === 'NotFoundError')) console.warn("Could not read custom logo file:", e);
                        }
                        setDirectoryHandle(handle);
                        const dataHandle = await getDataDirectoryHandle(handle);
                        if (dataHandle) setFileSystem(await readDirectory(dataHandle, ''));
                    } else {
                        setNeedsPicker(true);
                        setFileSystem([]);
                    }
                } catch (e) {
                    console.error("Error initializing file system:", e);
                    setError("Could not load directory. Please try picking it again.");
                    setNeedsPicker(true);
                }
                 setIsLoading(false);
            } else if (settings.storageLocation === 'server') {
                 if (settings.serverProvider.token) {
                    if (isServerLoadInitiated.current) {
                        return; // Breaker for re-render loop
                    }
                    isServerLoadInitiated.current = true;
                    setIsLoading(true);
                    try {
                        const savedConfig = await loadConfig();
                        const availableProviders = parseProviders(savedConfig.provider);
                        
                        let finalSelectedProvider = '';
                        let finalSelectedModel = '';
                        let toastMessage = '';

                        if (availableProviders.length > 0) {
                            const userSelectedProviderId = savedConfig.selectedProvider;
                            const userSelectedModel = savedConfig.selectedModel;

                            const providerMatch = userSelectedProviderId ? availableProviders.find(p => p.id === userSelectedProviderId) : null;

                            if (providerMatch) {
                                finalSelectedProvider = providerMatch.id;
                                const modelMatch = userSelectedModel ? providerMatch.models.find(m => m === userSelectedModel) : null;
                                if (modelMatch) {
                                    finalSelectedModel = modelMatch;
                                } else {
                                    if (userSelectedModel) {
                                        toastMessage = 'Your previously selected AI model is no longer available. Resetting to default for this provider.';
                                    }
                                    finalSelectedModel = providerMatch.models[0] || '';
                                }
                            } else {
                                if (userSelectedProviderId) {
                                    toastMessage = 'Your previously selected AI provider is no longer available. Resetting to default.';
                                }
                                const firstProvider = availableProviders[0];
                                finalSelectedProvider = firstProvider.id;
                                finalSelectedModel = firstProvider.models[0] || '';
                            }
                        }

                        if (toastMessage) {
                            showToast(toastMessage, 'info');
                        }

                        setSettings(prevSettings => ({
                            ...defaultSettings,
                            ...savedConfig,
                            providers: availableProviders,
                            selectedProvider: finalSelectedProvider,
                            selectedModel: finalSelectedModel,
                            storageLocation: prevSettings.storageLocation,
                            serverProvider: prevSettings.serverProvider,
                        }));
                        await refreshServerNotes();
                    } catch (e: any) {
                        console.error("Failed to load config on init:", e);
                        if (e instanceof ApiError && e.status === 401) {
                            setSettings(s => ({ ...s, serverProvider: { ...s.serverProvider, token: '' } }));
                            setNeedsLogin(true);
                        } else {
                            setError("Failed to load settings from server.");
                        }
                        setIsLoading(false);
                    }
                } else {
                    isServerLoadInitiated.current = false;
                    setNeedsLogin(true);
                    setFileSystem([]);
                    setIsLoading(false);
                }
            } else { // localStorage
                isServerLoadInitiated.current = false;
                setIsLoading(true);
                setFileSystem(localStorageNotes);
                setIsLoading(false);
            }
        };
        init();
    }, [settings.storageLocation, settings.serverProvider.token, localStorageNotes, getDataDirectoryHandle, setSettings, refreshServerNotes, showToast, settings.appLogoUrl]);

    // Effect to persist the custom logo to the file system when it changes
    useEffect(() => {
        const handleLogoWrite = async () => {
            if (settings.storageLocation !== 'fileSystem' || !directoryHandle) return;
            try {
                if (settings.appLogoUrl) {
                    const fileHandle = await directoryHandle.getFileHandle(CUSTOM_LOGO_FILENAME, { create: true });
                    const writer = await fileHandle.createWritable();
                    await writer.write(settings.appLogoUrl);
                    await writer.close();
                } else {
                    await directoryHandle.removeEntry(CUSTOM_LOGO_FILENAME);
                }
            } catch (e) {
                if (!(e instanceof DOMException && e.name === 'NotFoundError' && !settings.appLogoUrl)) {
                    console.error("Error updating logo file:", e);
                    showToast('Could not save custom logo.', 'error');
                }
            }
        };
        const readAndCompare = async () => {
            if (!directoryHandle) return;
            try {
                const logoFileHandle = await directoryHandle.getFileHandle(CUSTOM_LOGO_FILENAME);
                const file = await logoFileHandle.getFile();
                const onDiskLogo = await file.text();
                if (onDiskLogo !== settings.appLogoUrl) handleLogoWrite();
            } catch (e) {
                if (e instanceof DOMException && e.name === 'NotFoundError' && settings.appLogoUrl) handleLogoWrite();
            }
        };
        readAndCompare();
    }, [settings.appLogoUrl, directoryHandle, settings.storageLocation, showToast]);


    const pickDirectory = useCallback(async () => {
        setError(null);
        if (IS_CROSS_ORIGIN_IFRAME) {
            const errorMessage = "Local File System is not available in this sandboxed environment for security reasons.";
            setError(errorMessage);
            showToast(errorMessage, 'error');
            return;
        }

        if (typeof window.showDirectoryPicker !== 'function') {
            setError('Your browser does not support the File System Access API.');
            showToast('Feature not supported in this browser.', 'error');
            return;
        }
        try {
            const handle = await window.showDirectoryPicker();
            if (await verifyPermission(handle, true)) {
                
                try {
                    // Attempt to get the handle. If it fails with NotFoundError, we'll create the welcome file.
                    await handle.getFileHandle('Welcome.md');
                } catch (e) {
                    if (e instanceof DOMException && e.name === 'NotFoundError') {
                        // File doesn't exist, so create it.
                        try {
                            const fileHandle = await handle.getFileHandle('Welcome.md', { create: true });
                            const writer = await fileHandle.createWritable();
                            const noteContent = stringifyFrontMatter({ id: 'note:Welcome.md', tags: ['welcome', 'guide'] }, WELCOME_CONTENT);
                            await writer.write(noteContent);
                            await writer.close();
                        } catch (creationError) {
                            console.error("Failed to create welcome note:", creationError);
                            showToast("Could not create the initial welcome note.", "error");
                        }
                    } else {
                        // Rethrow other unexpected errors.
                        throw e;
                    }
                }

                await idbSet(DIRECTORY_HANDLE_KEY, handle);
                setDirectoryHandle(handle);
                setNeedsPicker(false);
                setIsLoading(true);
                const dataHandle = await getDataDirectoryHandle(handle);
                if (dataHandle) setFileSystem(await readDirectory(dataHandle, ''));
                setIsLoading(false);
                showToast('Directory selected successfully!', 'success');
            } else {
                setError('Permission to read and write to the directory was denied.');
                showToast('Permission denied.', 'error');
            }
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            console.error("Error picking directory:", e);
            setError("Could not access the selected directory.");
            showToast("Could not access directory.", 'error');
        }
    }, [showToast, getDataDirectoryHandle]);

    const renameItem = useCallback(async (id: string, newName: string): Promise<string | null> => {
        const { item, parent } = findItemAndParent(fileSystem, id);
        if (!item || item.name === newName) return null;
    
        const oldPath = item.path;
        const parentPath = parent?.path || '';
        const newBaseName = item.type === 'note' ? `${newName}.md` : newName;
        const newPath = parentPath ? `${parentPath}/${newBaseName}` : newBaseName;
        const newId = item.type === 'note' ? `note:${newPath}` : `folder:${newPath}`;
    
        if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) return null;
            try {
                await renameServerItem(oldPath, newPath);
    
                // Optimistic update
                const updateChildrenPaths = (children: FileSystemItem[], newParentPath: string): FileSystemItem[] => {
                    return children.map(child => {
                        const childBaseName = child.type === 'note' ? `${child.name}.md` : child.name;
                        const newChildPath = newParentPath ? `${newParentPath}/${childBaseName}` : childBaseName;
                        const newChildId = child.type === 'note' ? `note:${newChildPath}` : `folder:${newChildPath}`;
                        const updatedChild = { ...child, path: newChildPath, id: newChildId };
                        if (updatedChild.type === 'folder') {
                            updatedChild.children = updateChildrenPaths(updatedChild.children, newChildPath);
                        }
                        return updatedChild;
                    });
                };
                
                const updatedItem: FileSystemItem = {
                    ...item,
                    name: newName,
                    path: newPath,
                    id: newId,
                };
                if (updatedItem.type === 'folder' && item.type === 'folder') {
                    updatedItem.children = updateChildrenPaths(item.children, newPath);
                }
    
                setFileSystem(fs => findAndReplaceItem(fs, id, updatedItem));
                showToast('Item renamed successfully.', 'success');
                return newId;
            } catch (e: any) {
                showToast(`Rename failed: ${e.message}`, 'error');
                return null;
            }
        }
        if (settings.storageLocation === 'fileSystem' && directoryHandle) {
            const dataHandle = await getDataDirectoryHandle(directoryHandle);
            if (!dataHandle) return null;
    
            try {
                const oldPathParts = oldPath.split('/').filter(Boolean);
                const oldName = oldPathParts.pop();
                if (!oldName) throw new Error("Could not resolve item name from path.");

                let parentHandle = dataHandle;
                for (const part of oldPathParts) {
                    parentHandle = await parentHandle.getDirectoryHandle(part);
                }
                
                if (typeof parentHandle.move === 'function') {
                    await parentHandle.move(oldName, newBaseName);
                } else {
                    const sourceHandle = item.type === 'note'
                        ? await parentHandle.getFileHandle(oldName)
                        : await parentHandle.getDirectoryHandle(oldName);
                    
                    if (item.type === 'note') {
                        const newFileHandle = await parentHandle.getFileHandle(newBaseName, { create: true });
                        const file = await (sourceHandle as FileSystemFileHandle).getFile();
                        const writer = await newFileHandle.createWritable();
                        await writer.write(await file.text());
                        await writer.close();
                    } else { // folder
                        const newDirHandle = await parentHandle.getDirectoryHandle(newBaseName, { create: true });
                        for await (const entry of (sourceHandle as FileSystemDirectoryHandle).values()) {
                            await copyItem(entry, newDirHandle);
                        }
                    }
                    await parentHandle.removeEntry(oldName, { recursive: item.type === 'folder' });
                }

                const newFs = await readDirectory(dataHandle, '');
                setFileSystem(newFs);
                showToast('Item renamed successfully.', 'success');
                return newId;
            } catch (e) {
                console.error("Error renaming item:", e);
                showToast(`Failed to rename: ${e instanceof Error ? e.message : String(e)}`, 'error');
                return null;
            }
        } else { // Local Storage
             setLocalStorageNotes(fs => {
                const renameRecursive = (items: FileSystemItem[], parentPath: string): FileSystemItem[] => items.map(i => {
                    if (i.id === id) {
                        const newNameWithExt = i.type === 'note' ? `${newName}.md` : newName;
                        const newPath = parentPath ? `${parentPath}/${newNameWithExt}` : newNameWithExt;
                        const newId = i.type === 'note' ? `note:${newPath}` : `folder:${newPath}`;
                        const updatedItem = { ...i, name: newName, path: newPath, id: newId };
                        if (updatedItem.type === 'folder') {
                             updatedItem.children = renameRecursive(updatedItem.children, newPath);
                        }
                        return updatedItem;
                    }
                    if (i.type === 'folder') {
                        return { ...i, children: renameRecursive(i.children, i.path) };
                    }
                    return i;
                });
                return renameRecursive(fs, '');
             });
             return newId;
        }
    }, [settings.storageLocation, directoryHandle, fileSystem, setLocalStorageNotes, showToast, getDataDirectoryHandle, settings.serverProvider]);

    const addItem = useCallback(async (type: 'note' | 'folder', activeItemId: string | null): Promise<FileSystemItem | null> => {
        const newItemName = type === 'note' ? 'New Note' : 'New Folder';
        
        let targetParent: Folder | null = null;
        
        // Explicitly determine the parent folder for the new item.
        if (!activeItemId) {
            // Case 1: No item is selected, so the new item goes in the root.
            // targetParent remains null.
        } else {
            const { item: activeItem, parent: activeItemParent } = findItemAndParent(fileSystem, activeItemId);
            if (activeItem && activeItem.type === 'folder') {
                // Case 2: A folder is selected, so the new item goes inside it.
                targetParent = activeItem;
            } else {
                // Case 3: A note is selected (or the active item wasn't found).
                // The new item goes alongside the note in its parent folder.
                // If the note is at the root, activeItemParent will be null, correctly targeting the root.
                targetParent = activeItemParent;
            }
        }

        const parentPath = targetParent?.path || '';
        const newItemBaseName = type === 'note' ? `${newItemName}.md` : newItemName;
        const newItemPath = parentPath ? `${parentPath}/${newItemBaseName}` : newItemBaseName;

        if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) {
                showToast("You are not logged in.", 'error');
                return null;
            }
            try {
                const newItemId = type === 'note' ? `note:${newItemPath}` : `folder:${newItemPath}`;
                if (type === 'folder') {
                    await createFolder(newItemPath, newItemName);
                } else {
                    const content = stringifyFrontMatter({ id: newItemId, tags: [] }, '');
                    await createFile(newItemPath, `${newItemName}.md`, content);
                }
                
                // Optimistically update the local state instead of a full refresh
                const newItem: FileSystemItem = type === 'note'
                    ? { id: newItemId, name: newItemName, type: 'note', content: '', tags: [], path: newItemPath, isContentLoaded: true }
                    : { id: newItemId, name: newItemName, type: 'folder', children: [], isOpen: true, path: newItemPath };

                setFileSystem(fs => {
                    if (targetParent) {
                        return addItemToFolder(fs, targetParent.id, newItem);
                    } else {
                        return [...fs, newItem].sort(sortFileSystemItems);
                    }
                });

                return newItem;

            } catch (e: any) {
                showToast(`Failed to create item on server: ${e.message}`, 'error');
                return null;
            }
        }
        
        if (settings.storageLocation === 'fileSystem' && directoryHandle) {
            const dataHandle = await getDataDirectoryHandle(directoryHandle);
            if (!dataHandle) return null;

            let parentHandle = dataHandle;
            if (parentPath) {
                 const pathParts = parentPath.split('/').filter(Boolean);
                 for (const part of pathParts) {
                    parentHandle = await parentHandle.getDirectoryHandle(part);
                 }
            }
            
            try {
                if (type === 'folder') {
                    await parentHandle.getDirectoryHandle(newItemName, { create: true });
                } else {
                    const noteId = `note:${newItemPath}`;
                    const fileHandle = await parentHandle.getFileHandle(`${newItemName}.md`, { create: true });
                    const writer = await fileHandle.createWritable();
                    const noteContent = stringifyFrontMatter({ id: noteId, tags: [] }, '');
                    await writer.write(noteContent);
                    await writer.close();
                }

                const newFs = await readDirectory(dataHandle, '');
                setFileSystem(newFs);
                const { item: newItem } = findItemAndParent(newFs, type === 'note' ? `note:${newItemPath}` : `folder:${newItemPath}`);
                return newItem;

            } catch (e) {
                console.error("Error adding item to file system:", e);
                showToast("Failed to create item.", 'error');
                return null;
            }

        } else { // Local Storage
            const newItemId = type === 'note' ? `note:${newItemPath}` : `folder:${newItemPath}`;
            const newItem: FileSystemItem = type === 'note'
                ? { id: newItemId, name: newItemName, type: 'note', content: '', tags: [], path: newItemPath, isContentLoaded: true }
                : { id: newItemId, name: newItemName, type: 'folder', children: [], isOpen: true, path: newItemPath };

            setLocalStorageNotes(fs => {
                if (targetParent) {
                    return addItemToFolder(fs, targetParent.id, newItem);
                } else {
                    return [...fs, newItem].sort(sortFileSystemItems);
                }
            });
            return newItem;
        }
    }, [settings.storageLocation, directoryHandle, fileSystem, setLocalStorageNotes, showToast, getDataDirectoryHandle, settings.serverProvider]);
    
    const updateNote = useCallback(async (id: string, content: string, name: string, tags: string[]): Promise<string | null> => {
       const { item: noteInState } = findItemAndParent(fileSystem, id);
       if (!noteInState || noteInState.type !== 'note') return null;

       const nameChanged = noteInState.name !== name;
       const contentChanged = noteInState.content !== content || JSON.stringify(noteInState.tags || []) !== JSON.stringify(tags);

       if (!nameChanged && !contentChanged) {
           return null;
       }

       if (nameChanged) {
           const newId = await renameItem(id, name);
           // After renaming, the ID and path have changed. The calling component (App.tsx)
           // will update the activeItemId, causing the Editor to get a new `note` prop.
           // A subsequent save operation will be triggered by the Editor's useEffect
           // if the content is still dirty. This prevents data loss.
           return newId; 
       }
       
       if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) return null;
            const noteContentWithFrontMatter = stringifyFrontMatter({ id, tags }, content);
            try {
                await updateFile(noteInState.path, noteContentWithFrontMatter);
                setFileSystem(fs => updateItemRecursive(fs, { ...noteInState, content, tags, isContentLoaded: true }));
            } catch (e: any) {
                showToast(`Failed to save note: ${e.message}`, 'error');
            }
            return null;
       }
       
       const noteContentWithFrontMatter = stringifyFrontMatter({ id, tags }, content);

       if (settings.storageLocation === 'fileSystem' && directoryHandle) {
            const dataHandle = await getDataDirectoryHandle(directoryHandle);
            if (!dataHandle) return null;
            
            try {
                 const pathParts = noteInState.path.split('/').filter(Boolean);
                 const fileName = pathParts.pop();
                 if (!fileName) return null;

                 let currentHandle: FileSystemDirectoryHandle = dataHandle;
                 for (const part of pathParts) {
                     currentHandle = await currentHandle.getDirectoryHandle(part);
                 }
                 
                 const fileHandle = await currentHandle.getFileHandle(fileName);
                 const writer = await fileHandle.createWritable();
                 await writer.write(noteContentWithFrontMatter);
                 await writer.close();

                 setFileSystem(fs => updateItemRecursive(fs, { ...noteInState, content, name, tags, isContentLoaded: true }));
            } catch(e) {
                console.error("Error updating note on file system:", e);
                showToast("Failed to save note.", 'error');
            }
       } else { // Local Storage
           setLocalStorageNotes(fs => {
                const updatedNote = { ...noteInState, content, name, tags, isContentLoaded: true };
                return updateItemRecursive(fs, updatedNote);
           });
       }
       return null;
    }, [settings.storageLocation, directoryHandle, fileSystem, setLocalStorageNotes, showToast, getDataDirectoryHandle, settings.serverProvider, renameItem]);

    const deleteItem = useCallback(async (id: string) => {
        const { item } = findItemAndParent(fileSystem, id);
        if (!item) return;

        if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) return;
            try {
                await deleteServerItem(item.path);
                setFileSystem(fs => deleteItemRecursive(fs, id));
                showToast(`${item.type === 'note' ? 'Note' : 'Folder'} deleted.`, 'success');
            } catch (e: any) {
                showToast(`Failed to delete: ${e.message}`, 'error');
            }
            return;
        }

        if (settings.storageLocation === 'fileSystem' && directoryHandle) {
            const dataHandle = await getDataDirectoryHandle(directoryHandle);
            if (!dataHandle) return;

            try {
                const pathParts = item.path.split('/').filter(Boolean);
                const nameWithExt = pathParts.pop();
                if (!nameWithExt) return;

                let parentHandle = dataHandle;
                for (const part of pathParts) {
                    parentHandle = await parentHandle.getDirectoryHandle(part);
                }
                
                await parentHandle.removeEntry(nameWithExt, { recursive: item.type === 'folder' });
                
                const newFs = await readDirectory(dataHandle, '');
                setFileSystem(newFs);
                showToast(`${item.type === 'note' ? 'Note' : 'Folder'} deleted.`, 'success');
            } catch(e) {
                console.error("Error deleting item:", e);
                showToast("Failed to delete item.", 'error');
            }

        } else { // Local Storage
             setLocalStorageNotes(fs => deleteItemRecursive(fs, id));
        }
    }, [settings.storageLocation, directoryHandle, fileSystem, setLocalStorageNotes, showToast, getDataDirectoryHandle, settings.serverProvider]);
    
    const moveItem = useCallback(async (itemId: string, targetFolderId: string) => {
        if (itemId === targetFolderId) return;
        
        const { item: sourceItem } = findItemAndParent(fileSystem, itemId);
        const { item: targetFolder } = findItemAndParent(fileSystem, targetFolderId);
        if (!sourceItem || !targetFolder || targetFolder.type !== 'folder') return;
        
        if (sourceItem.type === 'folder' && (targetFolder.path.startsWith(sourceItem.path) || sourceItem.id === targetFolderId)) {
            showToast("Cannot move a folder into one of its own subfolders.", 'error');
            return;
        }
        
        const sourceName = sourceItem.path.split('/').pop();
        if(!sourceName) return;
        const destinationPath = targetFolder.path ? `${targetFolder.path}/${sourceName}` : sourceName;

        if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) return;
            try {
                await moveServerItem(sourceItem.path, destinationPath);
                await refreshServerNotes();
                showToast('Item moved successfully.', 'success');
            } catch(e: any) {
                showToast(`Move failed: ${e.message}`, 'error');
            }
            return;
        }
    
        if (settings.storageLocation === 'fileSystem' && directoryHandle) {
            const dataHandle = await getDataDirectoryHandle(directoryHandle);
            if (!dataHandle) return;

            try {
                const sourcePathParts = sourceItem.path.split('/').filter(Boolean);
                const sourceName = sourcePathParts.pop();
                if (!sourceName) throw new Error("Could not resolve source item name.");
                
                let sourceParentHandle = dataHandle;
                for (const part of sourcePathParts) {
                    sourceParentHandle = await sourceParentHandle.getDirectoryHandle(part);
                }
                const sourceHandle = sourceItem.type === 'note'
                    ? await sourceParentHandle.getFileHandle(sourceName)
                    : await sourceParentHandle.getDirectoryHandle(sourceName);

                const destPathParts = targetFolder.path.split('/').filter(Boolean);
                let destDirHandle = dataHandle;
                for (const part of destPathParts) {
                    destDirHandle = await destDirHandle.getDirectoryHandle(part);
                }

                await copyItem(sourceHandle, destDirHandle);
                await sourceParentHandle.removeEntry(sourceName, { recursive: sourceItem.type === 'folder' });

                const newFs = await readDirectory(dataHandle, '');
                setFileSystem(newFs);
                showToast("Item moved successfully.", 'success');
            } catch (e) {
                console.error("Error moving item:", e);
                showToast(`Move failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
            }
    
        } else { // Local Storage
            setLocalStorageNotes(currentFileSystem => {
                const { item: targetFolder } = findItemAndParent(currentFileSystem, targetFolderId);
                 if (!targetFolder || targetFolder.type !== 'folder') return currentFileSystem;

                const { newItems: fsWithoutSource, foundItem } = findAndRemoveItem(currentFileSystem, itemId);
                if (!foundItem) return currentFileSystem;

                const updatePathsAndIdsRecursive = (item: FileSystemItem, newParentPath: string): FileSystemItem => {
                    const baseName = item.name + (item.type === 'note' ? '.md' : '');
                    const newPath = newParentPath ? `${newParentPath}/${baseName}` : baseName;
                    const newId = item.type === 'note' ? `note:${newPath}` : `folder:${newPath}`;

                    if (item.type === 'folder') {
                        return { ...item, path: newPath, id: newId, children: item.children.map(child => updatePathsAndIdsRecursive(child, newPath)) };
                    }
                    return { ...item, path: newPath, id: newId };
                };
                
                const itemToAdd = updatePathsAndIdsRecursive(foundItem, targetFolder.path);
                
                const finalFileSystem = addItemToFolder(fsWithoutSource, targetFolderId, itemToAdd);
                showToast("Item moved successfully.", 'success');
                return finalFileSystem;
            });
        }
    }, [settings.storageLocation, directoryHandle, fileSystem, setLocalStorageNotes, showToast, getDataDirectoryHandle, refreshServerNotes, settings.serverProvider]);

    const importFiles = useCallback(async (files: File[], targetItemId: string | null) => {
        if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) {
                showToast('You must be logged in to import files.', 'error');
                return;
            }
            
            showToast(`Importing ${files.length} item(s)...`, 'info');
            
            let parentPath = '';
            if (targetItemId) {
                const { item: targetItem, parent } = findItemAndParent(fileSystem, targetItemId);
                const targetFolder = targetItem?.type === 'folder' ? targetItem : parent;
                parentPath = targetFolder?.path || '';
            }

            try {
                for (const file of files) {
                    if (file.name.endsWith('.md')) {
                        const path = parentPath ? `${parentPath}/${file.name}` : file.name;
                        const content = await file.text();
                        await createFile(path, file.name, content);
                    } else if (file.name.endsWith('.zip')) {
                        await uploadZip(file, parentPath);
                    }
                }
                await refreshServerNotes();
                showToast('Import successful!', 'success');
            } catch (e: any) {
                 showToast(`Import failed: ${e.message}`, 'error');
            }
            return;
        }

        if (settings.storageLocation === 'fileSystem') {
            if (!directoryHandle) {
                showToast("No directory selected.", 'error');
                return;
            }

            const dataHandle = await getDataDirectoryHandle(directoryHandle);
            if (!dataHandle) return;

            let targetDirHandle = dataHandle;
            if (targetItemId) {
                const { item } = findItemAndParent(fileSystem, targetItemId);
                const targetItem = item?.type === 'folder' ? item : findItemAndParent(fileSystem, targetItemId).parent;

                if (targetItem?.path) {
                    const pathParts = targetItem.path.split('/').filter(Boolean);
                    let currentHandle = dataHandle;
                    try {
                        for (const part of pathParts) {
                            currentHandle = await currentHandle.getDirectoryHandle(part);
                        }
                        targetDirHandle = currentHandle;
                    } catch (e) {
                        console.error("Could not find target import directory handle:", e);
                        showToast("Target import folder not found. Importing to root.", 'error');
                        targetDirHandle = dataHandle; // Fallback to root
                    }
                }
            }
            
            showToast(`Importing ${files.length} item(s)...`, 'info');

            try {
                for (const file of files) {
                    if (file.name.endsWith('.md')) {
                        const fileHandle = await targetDirHandle.getFileHandle(file.name, { create: true });
                        const writer = await fileHandle.createWritable();
                        await writer.write(await file.text());
                        await writer.close();
                    } else if (file.name.endsWith('.zip')) {
                        const zip = new JSZip();
                        const loadedZip = await zip.loadAsync(file);
                        
                        const processZipEntry = async (path: string, entry: JSZip.JSZipObject) => {
                            const pathParts = path.split('/').filter(p => p !== '.' && p !== '..');
                            if (pathParts.length === 0 || path.startsWith('__MACOSX')) return;
                            
                            let currentHandle = targetDirHandle;
                            for (let i = 0; i < pathParts.length - 1; i++) {
                                currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: true });
                            }

                            const fileName = pathParts[pathParts.length - 1];
                            if (!entry.dir) {
                                const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
                                const writer = await fileHandle.createWritable();
                                const content = await entry.async('string');
                                await writer.write(content);
                                await writer.close();
                            } else if (fileName) {
                                await currentHandle.getDirectoryHandle(fileName, { create: true });
                            }
                        };
                        
                        const promises: Promise<void>[] = [];
                        loadedZip.forEach((relativePath, zipEntry) => {
                            promises.push(processZipEntry(relativePath, zipEntry));
                        });
                        await Promise.all(promises);
                    }
                }
                const newFs = await readDirectory(dataHandle, '');
                setFileSystem(newFs);
                showToast('Import successful!', 'success');

            } catch (e) {
                console.error("Error during file system import:", e);
                showToast(`Import failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
            }
        } else { // Local Storage
            showToast(`Importing ${files.length} item(s)...`, 'info');
            const newItems: FileSystemItem[] = [];
            const { item: targetItem, parent } = findItemAndParent(fileSystem, targetItemId || '');
            const targetFolder = targetItem?.type === 'folder' ? targetItem : parent;
            const parentPath = targetFolder?.path || '';

            for (const file of files) {
                if (file.name.endsWith('.md')) {
                    const content = await file.text();
                    const { data, content: noteContent } = parseFrontMatter(content);
                    const notePath = parentPath ? `${parentPath}/${file.name}` : file.name;
                    const note: Note = {
                        id: data.id || `note:${notePath}`,
                        name: file.name.replace(/\.md$/, ''),
                        content: noteContent,
                        type: 'note',
                        tags: Array.isArray(data.tags) ? data.tags : [],
                        path: notePath,
                        isContentLoaded: true,
                    };
                    newItems.push(note);
                } else if (file.name.endsWith('.zip')) {
                    try {
                        const zip = new JSZip();
                        const loadedZip = await zip.loadAsync(file);
                        const rootFolderName = file.name.replace(/\.zip$/, '');
                        const rootFolderPath = parentPath ? `${parentPath}/${rootFolderName}` : rootFolderName;
                        const rootFolder: Folder = {
                            id: `folder:${rootFolderPath}`,
                            name: rootFolderName,
                            type: 'folder',
                            children: [],
                            isOpen: false,
                            path: rootFolderPath
                        };

                        const processZipEntry = async (path: string, entry: JSZip.JSZipObject) => {
                            if (entry.dir || !path.endsWith('.md') || path.startsWith('__MACOSX')) return;
                            
                            const pathParts = path.split('/').filter(Boolean);
                            const fileName = pathParts.pop();
                            if (!fileName) return;

                            let currentFolder = rootFolder;
                            for (const part of pathParts) {
                                let childFolder = currentFolder.children.find(c => c.name === part && c.type === 'folder') as Folder | undefined;
                                if (!childFolder) {
                                    const childFolderPath = `${currentFolder.path}/${part}`;
                                    childFolder = {
                                        id: `folder:${childFolderPath}`,
                                        name: part,
                                        type: 'folder',
                                        children: [],
                                        isOpen: false,
                                        path: childFolderPath
                                    };
                                    currentFolder.children.push(childFolder);
                                }
                                currentFolder = childFolder;
                            }

                            const contentWithFrontMatter = await entry.async('string');
                            const { data, content } = parseFrontMatter(contentWithFrontMatter);
                            const notePath = `${currentFolder.path}/${fileName}`;
                            const note: Note = {
                                id: data.id || `note:${notePath}`,
                                name: fileName.replace(/\.md$/, ''),
                                content,
                                type: 'note',
                                tags: Array.isArray(data.tags) ? data.tags : [],
                                path: notePath,
                                isContentLoaded: true,
                            };
                            currentFolder.children.push(note);
                            currentFolder.children.sort(sortFileSystemItems);
                        };

                        const promises: Promise<void>[] = [];
                        loadedZip.forEach((relativePath, zipEntry) => {
                            promises.push(processZipEntry(relativePath, zipEntry));
                        });
                        await Promise.all(promises);
                        if(rootFolder.children.length > 0) {
                            newItems.push(rootFolder);
                        }
                    } catch (e) {
                        console.error("Error processing zip file:", e);
                        showToast(`Failed to import ${file.name}.`, 'error');
                    }
                }
            }
            
            if (newItems.length === 0) {
                showToast(`No valid items found to import.`, 'info');
                return;
            }

            setLocalStorageNotes(currentFileSystem => {
                if (targetFolder) {
                    return addItemToFolder(currentFileSystem, targetFolder.id, ...newItems);
                } else {
                    return [...currentFileSystem, ...newItems].sort(sortFileSystemItems);
                }
            });
            showToast(`${newItems.length} item(s) imported successfully!`, 'success');
        }
    }, [
        settings.storageLocation, 
        directoryHandle, 
        fileSystem,
        showToast, 
        getDataDirectoryHandle, 
        setLocalStorageNotes,
        settings.serverProvider,
        refreshServerNotes
    ]);

    const toggleFolderOpen = useCallback(async (folderId: string) => {
        const { item: folder } = findItemAndParent(fileSystem, folderId);
        if (!folder || folder.type !== 'folder') return;
    
        const isOpening = !folder.isOpen;
    
        if (isOpening) {
            const notesToLoad = folder.children.filter(
                (child): child is Note => child.type === 'note' && !child.isContentLoaded
            );
    
            if (notesToLoad.length > 0) {
                // Instant feedback: open folder and show loading spinner
                setFileSystem(fs => updateItemRecursive(fs, { ...folder, isOpen: true, isLoadingContents: true }));
    
                const contentPromises = notesToLoad.map(note =>
                    fetchNoteContent(note.path)
                        .then((parsedNote: ParsedMarkdown) => ({ 
                            ...note, 
                            content: parsedNote.content, 
                            tags: Array.isArray(parsedNote.data.tags) ? parsedNote.data.tags : [],
                            isContentLoaded: true 
                        }))
                        .catch(e => {
                            console.error(`Failed to load content for ${note.path}`, e);
                            showToast(`Could not load content for ${note.name}`, 'error');
                            return note; // Return original note on failure
                        })
                );
    
                const updatedNotes = await Promise.all(contentPromises);
    
                // Create a map for quick lookups
                const updatedNotesMap = new Map(updatedNotes.map(n => [n.id, n]));
    
                const updatedChildren = folder.children.map(child => {
                    return updatedNotesMap.get(child.id) || child;
                });
    
                const finalFolderState: Folder = {
                    ...folder,
                    isOpen: true,
                    isLoadingContents: false,
                    children: updatedChildren.sort(sortFileSystemItems),
                };
    
                setFileSystem(fs => updateItemRecursive(fs, finalFolderState));
    
            } else {
                // No content to load, just toggle open
                setFileSystem(fs => updateItemRecursive(fs, { ...folder, isOpen: true }));
            }
        } else {
            // Closing the folder
            setFileSystem(fs => updateItemRecursive(fs, { ...folder, isOpen: false }));
        }
    }, [fileSystem, showToast]);

    const loadNoteContent = useCallback(async (noteId: string): Promise<void> => {
        const { item } = findItemAndParent(fileSystem, noteId);
        if (!item || item.type !== 'note' || item.isContentLoaded) {
            return;
        }

        if (settings.storageLocation === 'server') {
            try {
                const parsedNote = await fetchNoteContent(item.path);
                const updatedNote: Note = {
                    ...item,
                    content: parsedNote.content,
                    tags: Array.isArray(parsedNote.data.tags) ? parsedNote.data.tags : [],
                    isContentLoaded: true
                };
                setFileSystem(fs => updateItemRecursive(fs, updatedNote));
            } catch (e) {
                console.error(`Failed to load content for ${item.path}`, e);
                showToast(`Could not load content for ${item.name}`, 'error');
            }
        }
    }, [fileSystem, settings.storageLocation, showToast]);

    return {
        fileSystem,
        isLoading,
        error,
        needsPicker,
        needsLogin,
        pickDirectory,
        addItem,
        updateNote,
        deleteItem,
        renameItem,
        importFiles,
        moveItem,
        toggleFolderOpen,
        loadNoteContent,
    };
};
