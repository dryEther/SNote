/// <reference types="vite/client" />
import type { Note, Folder, FileSystemItem } from '../types';
import { parseFrontMatter, ParsedMarkdown } from '../utils/frontmatter';
import type { PromptComponents } from './promptBuilder';

//const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 9);

// --- API Helper ---

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

export type ServerProviderDetails = {
    model: string[];
    default?: boolean;
    name?: string;
};
export type ServerProviderConfig = string | { [key: string]: ServerProviderDetails };

export interface ServerConfig {
  provider: ServerProviderConfig[];
  toolbarActions: string[];
  appLogoUrl: string | null;
  appName: string;
  appSubtitle?: string;
  accentColor: string;
 // User's last selections from the server
  selectedProvider?: string;
  selectedModel?: string;
}

const getServerUrl = (): string => {
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    if (!serverUrl) {
        // This is a critical configuration error.
        throw new Error("SERVER_URL is not defined in the environment. Please configure it in .env file.");
    }
    return serverUrl.replace(/\/$/, '');
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const serverUrl = getServerUrl();
    const url = `${serverUrl}${endpoint}`;

    // Conditionally add Content-Type header only if there's a body.
    // This makes GET requests cleaner and avoids potential CORS preflight issues.
    const headers: HeadersInit = { ...options.headers };
    if (options.body) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...options,
        mode: 'cors',
        credentials: 'include',
        headers: headers,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => `HTTP error! status: ${response.status}`);
        let errorMessage = errorBody;
        try {
            const parsedError = JSON.parse(errorBody);
            errorMessage = parsedError.message || errorBody;
        } catch (e) {
            // Not a JSON error, use the raw text.
        }
        throw new ApiError(errorMessage, response.status);
    }

    // Handle empty JSON response (e.g., 204 No Content)
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return null;
    }
    
    const contentType = response.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
        return response.json();
    }
    // Handle file downloads that might return plain text
    return response.text();
};

// --- Authentication ---

export const register = ( username: string, password: string): Promise<{ message: string }> => {
    return apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
};

export const login = (username: string, password: string): Promise<{ message: string }> => {
    return apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
};

export const logout = (): Promise<{ message: string }> => {
    return apiFetch('/logout', {
        method: 'POST',
    });
};

// --- AI Proxy ---
export const serverEnrich = (payload: { prompts: PromptComponents, isSelection: boolean }): Promise<{ text: string }> => {
    return apiFetch('/AI', {
        method: 'POST',
        body: JSON.stringify({
            action: 'enrich',
            payload,
        }),
    });
};

export const serverFormatSelection = (payload: { selection: string }): Promise<{ text: string }> => {
     return apiFetch('/AI', {
        method: 'POST',
        body: JSON.stringify({
            action: 'format',
            payload,
        }),
    });
};

// --- File & Folder Operations ---

const getTree = (): Promise<any> => {
    return apiFetch('/tree', {
        method: 'GET',
    });
};

export const getFileContent = async (path: string): Promise<string> => {
         const serverUrl = getServerUrl();
     const url = `${serverUrl.replace(/\/$/, '')}/download/file?path=${encodeURIComponent(path)}`;
     const response = await fetch(url, {
         mode: 'cors',
         credentials: 'include',
     });
     if (!response.ok) {
         throw new ApiError(`Failed to download file: ${path}`, response.status);
     }
     return response.text();
};

export const fetchNoteContent = async (path: string): Promise<ParsedMarkdown> => {
    const contentWithFrontMatter = await getFileContent(path);
    return parseFrontMatter(contentWithFrontMatter);
}

const sortFileSystemItems = (a: FileSystemItem, b: FileSystemItem): number => {
    if (a.type === 'folder' && b.type === 'note') return -1;
    if (a.type === 'note' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
};


// Recursively parses the node structure from the API and fetches file content in parallel.
const parseApiNode = async (
    apiNode: any,
    currentPath: string
): Promise<FileSystemItem | null> => {
    if (!apiNode || typeof apiNode !== 'object' || !apiNode.type || !apiNode.name) {
        return null;
    }
    
    const itemPath = currentPath ? `${currentPath}/${apiNode.name}` : apiNode.name;

    if (apiNode.type === 'folder') {
        let children: FileSystemItem[] = [];
        if (apiNode.children && Array.isArray(apiNode.children)) {
            const childPromises = apiNode.children.map(childNode => 
                parseApiNode(childNode, itemPath)
            );
            const resolvedChildren = await Promise.all(childPromises);
            children = resolvedChildren.filter((item): item is FileSystemItem => item !== null);
        }

        const folder: Folder = {
            id: `folder:${itemPath}`,
            name: apiNode.name,
            type: 'folder',
            children: children.sort(sortFileSystemItems),
            isOpen: currentPath === '',
            path: itemPath,
        };
        return folder;
    } else if (apiNode.type === 'file' && apiNode.name.endsWith('.md')) {
        const note: Note = {
            id: `note:${itemPath}`, // Use path as a temporary, unique ID
            name: apiNode.name.replace(/\.md$/, ''),
            content: '', // Content will be lazy-loaded
            type: 'note',
            tags: [], // Tags will be loaded with content
            path: itemPath,
        };
        return note;
    }
    
    return null; // Ignore non-markdown files or other types.
};


export const fetchFileSystem = async (): Promise<FileSystemItem[]> => {
    const rootNode = await getTree();
    if (!rootNode) return [];
    // The server returns a root folder object, we want its children
    const rootItem = await parseApiNode(rootNode, ''); 
    if (rootItem && rootItem.type === 'folder') {
        return rootItem.children;
    }
    return [];
};

export const createFile = (filePath: string, fileName: string, content: string): Promise<{ message: string }> => {
    return apiFetch('/files/create', {
        method: 'POST',
        body: JSON.stringify({ filePath, fileName, content }),
    });
};

export const updateFile = (fileName: string, content: string): Promise<{ message: string }> => {
    return apiFetch('/files/update', {
        method: 'POST',
        body: JSON.stringify({ fileName, content }),
    });
};

export const createFolder = (folderPath: string, folderName: string): Promise<{ message: string }> => {
    return apiFetch('/folders/create', {
        method: 'POST',
        body: JSON.stringify({ folderPath, folderName }),
    });
};

export const renameItem = (oldPath: string, newPath: string): Promise<{ message: string }> => {
    return apiFetch('/rename', {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath }),
    });
};

export const deleteItem = (target: string): Promise<{ message: string }> => {
    return apiFetch('/delete', {
        method: 'POST',
        body: JSON.stringify({ target }),
    });
};

export const moveItem = (source: string, destination: string): Promise<{ message: string }> => {
    return apiFetch('/move', {
        method: 'POST',
        body: JSON.stringify({ source, destination }),
    });
};

export const downloadFile = async (path: string): Promise<Blob> => {
        const serverUrl = getServerUrl();
    const endpoint = `/download/file?path=${encodeURIComponent(path)}`;
    const url = `${serverUrl.replace(/\/$/, '')}${endpoint}`;

    const response = await fetch(url, {
        mode: 'cors',
        credentials: 'include',
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => `HTTP error ${response.status}`);
        throw new ApiError(errorText || `Server responded with status ${response.status}`, response.status);
    }

    return response.blob();
};

export const downloadFolder = async (path: string): Promise<Blob> => {
        const serverUrl = getServerUrl();
    const endpoint = `/download/folder?path=${encodeURIComponent(path)}`;
    const url = `${serverUrl.replace(/\/$/, '')}${endpoint}`;

    const response = await fetch(url, {
        mode: 'cors',
        credentials: 'include',
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => `HTTP error ${response.status}`);
        throw new ApiError(errorText || `Server responded with status ${response.status}`, response.status);
    }

    return response.blob();
};

export const uploadZip = async (file: File, targetFolder: string): Promise<{ message: string }> => {
        const serverUrl = getServerUrl();
    const endpoint = '/upload';
    const url = `${serverUrl.replace(/\/$/, '')}${endpoint}`;
    
    const formData = new FormData();
    formData.append('archive', file);
    formData.append('targetFolder', targetFolder);

    const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => `HTTP error! status: ${response.status}`);
        let errorMessage = errorBody;
        try {
            const parsedError = JSON.parse(errorBody);
            errorMessage = parsedError.message || errorBody;
        } catch (e) {
            // Not a JSON error, use the raw text.
        }
        throw new ApiError(errorMessage, response.status);
    }

    return response.json();
};

export const exportItem = async (target: string, exportType: 'pdf' | 'zip'): Promise<Blob> => {
        const serverUrl = getServerUrl();
    const type = exportType === 'pdf' ? 'pdf' : 'zip';
    const endpoint = `/export?target=${encodeURIComponent(target)}&type=${type}`;
    const url = `${serverUrl.replace(/\/$/, '')}${endpoint}`;

    const response = await fetch(url, {
        mode: 'cors',
        credentials: 'include',
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => `HTTP error ${response.status}`);
        throw new ApiError(errorText || `Server responded with status ${response.status}`, response.status);
    }

    return response.blob();
};

// --- Configuration ---

export const loadConfig = (): Promise<ServerConfig> => {
    return apiFetch('/loadConfig', { method: 'GET' });
};

export const updateConfig = (config: Partial<ServerConfig>): Promise<{ message: string }> => {
    return apiFetch('/updateConfig', {
        method: 'POST',
        body: JSON.stringify(config),
    });
};