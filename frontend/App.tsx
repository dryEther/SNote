import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ConfirmationDialog from './components/ConfirmationDialog';
import SettingsDialog from './components/SettingsDialog';
import DirectoryPicker from './components/DirectoryPicker';
import LoginPrompt from './components/LoginPrompt';
import type { FileSystemItem, Note, Folder } from './types';
import { ToastProvider, useToast } from './components/ToastProvider';
import { SettingsProvider, useSettingsContext } from './contexts/SettingsContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useNotes } from './hooks/useNotes';
import JSZip from 'jszip';
import PeekPreview from './components/PeekPreview';
import { downloadFile, downloadFolder, exportItem } from './services/serverStorage';
import type { AISettings } from './hooks/useSettings';
import { stringifyFrontMatter } from './utils/frontmatter';
import { hexToRgb, hexToHsl } from './utils/color';
import { findItemAndParent } from './utils/tree';


// Helper to trigger file download in the browser
const triggerDownload = (blob: Blob, filename: string) => {
    // Sanitize filename for download to prevent issues
    const sanitizedFilename = filename.replace(/[\\/:*?"<>|]/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const AppBody: React.FC = () => {
    const { 
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
    } = useNotes();
    
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [activeItemType, setActiveItemType] = useState<'note' | 'folder' | null>(null);
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; itemId: string | null; itemType: 'note' | 'folder' | null }>({ isOpen: false, itemId: null, itemType: null });
    const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const { settings, setSettings } = useSettingsContext();
    const { theme } = useTheme();
    const { showToast } = useToast();
    const [peekedNote, setPeekedNote] = useState<Note | null>(null);
    const [peekPosition, setPeekPosition] = useState<{ x: number; y: number } | null>(null);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Sidebar swipe gesture logic ---
    const sidebarRef = useRef<HTMLDivElement>(null);
    const swipeState = useRef({
        isSwiping: false,
        startX: 0,
        initialWidth: 0,
    });
    const sidebarMaxWidth = 320; // Tailwind's max-w-xs corresponds to 20rem = 320px

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!('ontouchstart' in window)) return;

        const touchX = e.touches[0].clientX;
        const sidebarWidth = sidebarRef.current?.offsetWidth || 0;

        // Only start swipe if touching near the left edge (when closed) or within the sidebar area (when open).
        // The target area is increased slightly for better usability.
        if ((!isSidebarOpen && touchX < 40) || (isSidebarOpen && touchX < sidebarWidth + 20)) {
            swipeState.current = {
                isSwiping: true,
                startX: touchX,
                initialWidth: sidebarWidth,
            };
            if (sidebarRef.current) {
                // Remove transition so the width changes instantly with finger movement
                sidebarRef.current.classList.remove('transition-all', 'duration-300', 'ease-in-out');
            }
        }
    }, [isSidebarOpen]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!swipeState.current.isSwiping) return;

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault();

        const currentX = e.touches[0].clientX;
        const deltaX = currentX - swipeState.current.startX;
        const newWidth = swipeState.current.initialWidth + deltaX;
        const clampedWidth = Math.max(0, Math.min(sidebarMaxWidth, newWidth));

        if (sidebarRef.current) {
            sidebarRef.current.style.width = `${clampedWidth}px`;
            // When manually setting width, we need to ensure it can't be shrunk by flexbox
            sidebarRef.current.style.flexShrink = '0';
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!swipeState.current.isSwiping) return;

        if (sidebarRef.current) {
            const finalWidth = sidebarRef.current.offsetWidth;
            
            // Restore transitions for the final snap animation
            sidebarRef.current.classList.add('transition-all', 'duration-300', 'ease-in-out');
            // Clear inline styles so CSS classes can take over
            sidebarRef.current.style.width = '';
            sidebarRef.current.style.flexShrink = '';

            // Decide whether to open or close based on a threshold (e.g., half the sidebar width)
            if (finalWidth > sidebarMaxWidth / 2) {
                setIsSidebarOpen(true);
            } else {
                setIsSidebarOpen(false);
            }
        }
        
        swipeState.current = { isSwiping: false, startX: 0, initialWidth: 0 };
    }, [setIsSidebarOpen]);


    useEffect(() => {
        const linkId = 'syntax-highlight-theme';
        const lightThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
        const darkThemeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
        
        let linkElement = document.getElementById(linkId) as HTMLLinkElement | null;

        if (!linkElement) {
            linkElement = document.createElement('link');
            linkElement.id = linkId;
            linkElement.rel = 'stylesheet';
            document.head.appendChild(linkElement);
        }

        linkElement.href = theme === 'dark' ? darkThemeUrl : lightThemeUrl;
    }, [theme]);

    useEffect(() => {
        document.title = settings.appName;
        const descriptionMeta = document.querySelector('meta[name="description"]');
        if (descriptionMeta) {
            descriptionMeta.setAttribute('content', `${settings.appName} - Your intelligent journal.`);
        }
    }, [settings.appName]);

    // Effect to update CSS variables for accent color
    useEffect(() => {
        const root = document.documentElement;
        
        // Update HSL variables for color palette
        const hsl = hexToHsl(settings.accentColor);
        if (hsl) {
            const [h, s, l] = hsl;
            root.style.setProperty('--accent-h', `${h}`);
            root.style.setProperty('--accent-s', `${s}%`);
            root.style.setProperty('--accent-l', `${l}%`);
        }
        
        // Update RGB variables for text contrast
        const rgb = hexToRgb(settings.accentColor);
        if (rgb) {
            const [r, g, b] = rgb;
            // Determine if text should be black or white based on luminance
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const accentTextRgb = luminance > 0.5 ? '0 0 0' : '255 255 255';
            root.style.setProperty('--color-accent-text-rgb', accentTextRgb);
        }
    }, [settings.accentColor]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                e.preventDefault();
                setIsAltPressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setIsAltPressed(false);
                setPeekedNote(null);
                setPeekPosition(null);
            }
        };
        const handleBlur = () => {
            setIsAltPressed(false);
            setPeekedNote(null);
            setPeekPosition(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    const handlePeekStart = useCallback((note: Note, rect: DOMRect) => {
        if (isAltPressed) {
            setPeekedNote(note);
            setPeekPosition({ x: rect.right + 10, y: rect.top });
        }
    }, [isAltPressed]);
    
    const handlePeekEnd = useCallback(() => {
        setPeekedNote(null);
        setPeekPosition(null);
    }, []);

    const handleSelectItem = async (id: string, type: 'note' | 'folder') => {
        setActiveItemId(id);
        setActiveItemType(type);

        if (type === 'note') {
            const { item } = findItemAndParent(fileSystem, id);
            if (item?.type === 'note' && !item.isContentLoaded) {
                await loadNoteContent(id);
            }
        }

        if (window.innerWidth < 768) {
             setIsSidebarOpen(false);
        }
    };
    
    const handleAddItem = async (type: 'note' | 'folder') => {
        const newItem = await addItem(type, activeItemId);
        if (newItem) {
            handleSelectItem(newItem.id, type);
            if (type === 'folder') {
                setRenamingItemId(newItem.id);
            }
        }
    };

    const handleUpdateNote = useCallback(async (id: string, content: string, name: string, tags: string[]) => {
        const newId = await updateNote(id, content, name, tags);
        if (newId && activeItemId === id) {
            setActiveItemId(newId);
        }
    }, [updateNote, activeItemId]);

    const handleRenameItem = async (id: string, newName: string) => {
        // This function is also used to exit renaming mode without changes.
        // If the name is blank or unchanged, renameItem will return null, and we just exit.
        const newId = await renameItem(id, newName);
        setRenamingItemId(null);
        
        // If the renamed item was the active one, update the activeItemId to the new ID.
        if (newId && activeItemId === id) {
            setActiveItemId(newId);
        }
    };

    const handleDeleteRequest = (id: string) => {
        const { item } = findItemAndParent(fileSystem, id);
        if (item) {
          setDeleteConfirmation({ isOpen: true, itemId: id, itemType: item.type });
        }
    };

    const confirmDelete = () => {
        if (deleteConfirmation.itemId) {
            deleteItem(deleteConfirmation.itemId);
            if (activeItemId === deleteConfirmation.itemId) {
                setActiveItemId(null);
                setActiveItemType(null);
            }
        }
        setDeleteConfirmation({ isOpen: false, itemId: null, itemType: null });
    };

    const handleRequestRename = () => {
        if (activeItemId) {
          setRenamingItemId(activeItemId);
        }
    };
  
    const handleRequestDelete = () => {
        if (activeItemId) {
            handleDeleteRequest(activeItemId);
        }
    };

    const handlePrint = useCallback(() => {
        if (activeItemId && activeItemType === 'note') {
            window.print();
        } else {
            showToast('Please select a note to print.', 'error');
        }
    }, [activeItemId, activeItemType, showToast]);

    const handleToggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    const handleDragStartItem = (id: string) => {
        setDraggedItemId(id);
    };

    const handleDropItem = (targetFolderId: string) => {
        if (draggedItemId) {
            moveItem(draggedItemId, targetFolderId);
        }
        setDraggedItemId(null);
    };
    
    const handleExportMarkdown = async () => {
        if (!activeItemId) return;

        const { item } = findItemAndParent(fileSystem, activeItemId);
        if (!item) return;

        // Server-side export
        if (settings.storageLocation === 'server') {
            const { token } = settings.serverProvider;
            if (!token) {
                showToast('You must be logged in to export files.', 'error');
                return;
            }
            showToast('Preparing download...', 'info');
            try {
                if (item.type === 'note') {
                    const blob = await downloadFile(item.path);
                    triggerDownload(blob, `${item.name}.md`);
                } else { // folder
                    const blob = await downloadFolder(item.path);
                    triggerDownload(blob, `${item.name}.zip`);
                }
            } catch (e: any) {
                showToast(`Export failed: ${e.message}`, 'error');
            }
            return;
        }

        // Local storage / file system export
        if (item.type === 'note') {
            const contentWithFrontmatter = stringifyFrontMatter({ id: item.id, tags: item.tags }, item.content);
            const blob = new Blob([contentWithFrontmatter], { type: 'text/markdown;charset=utf-8' });
            triggerDownload(blob, `${item.name}.md`);
        } else if (item.type === 'folder') {
            const zip = new JSZip();
            const toc: string[] = [];

            const addFolderToZip = (folder: Folder, zipFolder: JSZip) => {
                const depth = folder.path.split('/').length - 1;
                toc.push(`${'  '.repeat(depth)}- ${folder.name}/`);

                folder.children.forEach(child => {
                    if (child.type === 'note') {
                        toc.push(`${'  '.repeat(depth + 1)}- [${child.name}](./${child.name}.md)`);
                        const contentWithFrontmatter = stringifyFrontMatter({ id: child.id, tags: child.tags }, child.content);
                        zipFolder.file(`${child.name}.md`, contentWithFrontmatter);
                    } else {
                        const subFolder = zipFolder.folder(child.name);
                        if (subFolder) {
                            addFolderToZip(child, subFolder);
                        }
                    }
                });
            };
            
            const rootZipFolder = zip.folder(item.name);
            if (rootZipFolder) {
                addFolderToZip(item, rootZipFolder);
            }
            zip.file(`_toc.md`, `# Table of Contents for ${item.name}\n\n${toc.join('\n')}`);
            
            zip.generateAsync({ type: 'blob' }).then(blob => {
                triggerDownload(blob, `${item.name}.zip`);
            });
        }
    };

    const activeNote = useMemo(() => {
        if (activeItemId && activeItemType === 'note') {
            const { item } = findItemAndParent(fileSystem, activeItemId);
            return item as Note | null;
        }
        return null;
    }, [activeItemId, activeItemType, fileSystem]);

    const handleSaveSettings = (newSettings: AISettings) => {
        setSettings(newSettings);
        showToast('Settings saved successfully!', 'success');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            importFiles(Array.from(files), activeItemId);
        }
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const handleExportFromServer = async (exportType: 'pdf' | 'zip') => {
        if (!activeItemId) return;
        if (settings.storageLocation !== 'server') {
            showToast('This export option is only available for server storage.', 'info');
            return;
        }

        const { token } = settings.serverProvider;
        const { item } = findItemAndParent(fileSystem, activeItemId);
        if (!item || !token) return;

        const fileExtension = exportType === 'pdf' ? 'PDF' : 'ZIP';
        showToast(`Generating ${fileExtension}...`, 'info');
        try {
            const blob = await exportItem(item.path, exportType);
            triggerDownload(blob, `${item.name}.${exportType}`);
        } catch (e: any) {
            showToast(`${fileExtension} export failed: ${e.message}`, 'error');
        }
    };
    
    return (
        <div
            className={`h-screen w-screen flex antialiased text-slate-800 dark:text-slate-200 bg-white dark:bg-gray-900 overflow-hidden`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd} // Also end on system-interrupted touches
        >
            <div ref={sidebarRef} className={`not-printable transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-full max-w-xs' : 'w-0'} flex-shrink-0`}>
                <Sidebar
                    items={fileSystem}
                    onSelectItem={handleSelectItem}
                    onToggleFolder={toggleFolderOpen}
                    activeItemId={activeItemId}
                    activeItemType={activeItemType}
                    onAddItem={handleAddItem}
                    onRenameItem={handleRenameItem}
                    onDeleteItem={handleDeleteRequest}
                    onRequestRename={handleRequestRename}
                    onRequestDelete={handleRequestDelete}
                    onRequestPrint={handlePrint}
                    renamingItemId={renamingItemId}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onExportMarkdown={handleExportMarkdown}
                    onExportFromServer={handleExportFromServer}
                    onImport={handleImportClick}
                    draggedItemId={draggedItemId}
                    onDragStartItem={handleDragStartItem}
                    onDropItem={handleDropItem}
                    onPeekStart={handlePeekStart}
                    onPeekEnd={handlePeekEnd}
                />
            </div>
            <main className="flex-1 flex flex-col min-w-0">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <p>Loading notes...</p>
                    </div>
                ) : error && !needsPicker && !needsLogin ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-red-500">
                        <p className="font-semibold">An error occurred:</p>
                        <p className="mt-2 text-sm max-w-md">{error}</p>
                    </div>
                ) : needsPicker ? (
                    <DirectoryPicker onDirectoryPick={pickDirectory} error={error} />
                ) : needsLogin ? (
                    <LoginPrompt onOpenSettings={() => setIsSettingsOpen(true)} />
                ) : (
                    <Editor
                        note={activeNote}
                        onUpdateNote={handleUpdateNote}
                        onToggleSidebar={handleToggleSidebar}
                    />
                )}
            </main>
            <ConfirmationDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() => setDeleteConfirmation({ isOpen: false, itemId: null, itemType: null })}
                onConfirm={confirmDelete}
                title={`Delete ${deleteConfirmation.itemType || 'item'}`}
            >
                Are you sure you want to delete this {deleteConfirmation.itemType}? This action cannot be undone.
            </ConfirmationDialog>
            <SettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={handleSaveSettings}
                currentSettings={settings}
            />
            {peekedNote && peekPosition && (
                <PeekPreview note={peekedNote} position={peekPosition} />
            )}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                className="hidden"
                multiple
                accept=".md,.zip"
            />
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <SettingsProvider>
                <ToastProvider>
                    <AppBody />
                </ToastProvider>
            </SettingsProvider>
        </ThemeProvider>
    );
};

export default App;
