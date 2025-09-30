import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FileSystemItem, Note } from '../types';
import SidebarItem from './SidebarItem';
import { SearchIcon, FilePlusIcon, FolderPlusIcon, PencilIcon, TrashIcon, SettingsIcon, ExportIcon, ImportIcon, PrintIcon, ArchiveIcon, FileIcon } from './icons';
import ThemeToggle from './ThemeToggle';
import { useSettingsContext } from '../contexts/SettingsContext';
import Logo from './Logo';

interface SidebarProps {
  items: FileSystemItem[];
  onSelectItem: (id: string, type: 'note' | 'folder') => void;
  onToggleFolder: (id: string) => void;
  activeItemId: string | null;
  activeItemType: 'note' | 'folder' | null;
  onAddItem: (type: 'note' | 'folder') => void;
  onRenameItem: (id: string, newName: string) => void;
  onDeleteItem: (id: string) => void;
  onRequestRename: () => void;
  onRequestDelete: () => void;
  onRequestPrint: () => void;
  renamingItemId: string | null;
  onOpenSettings: () => void;
  onExportMarkdown: () => void;
  onExportFromServer: (type: 'pdf' | 'zip') => void;
  onImport: () => void;
  // Drag and drop props
  draggedItemId: string | null;
  onDragStartItem: (id: string) => void;
  onDropItem: (targetFolderId: string) => void;
  // Peek preview props
  onPeekStart: (note: Note, rect: DOMRect) => void;
  onPeekEnd: () => void;
}

const searchNotes = (itemsToSearch: FileSystemItem[], query: string): Note[] => {
    const results: Note[] = [];
    if (!query) return results;
    
    const lowerCaseQuery = query.toLowerCase();

    const traverse = (children: FileSystemItem[]) => {
        for (const item of children) {
            if (item.type === 'note') {
                const nameMatch = item.name.toLowerCase().includes(lowerCaseQuery);
                const contentMatch = item.content.toLowerCase().includes(lowerCaseQuery);
                const tagMatch = item.tags?.some(tag => tag.toLowerCase().includes(lowerCaseQuery)) ?? false;
                if (nameMatch || contentMatch || tagMatch) {
                    results.push(item);
                }
            } else if (item.type === 'folder') {
                traverse(item.children);
            }
        }
    };

    traverse(itemsToSearch);
    return results;
};


const Sidebar: React.FC<SidebarProps> = ({ 
  items, 
  onSelectItem, 
  onToggleFolder,
  activeItemId, 
  activeItemType,
  onAddItem, 
  onRenameItem, 
  onDeleteItem, 
  onRequestRename,
  onRequestDelete,
  onRequestPrint,
  renamingItemId,
  onOpenSettings,
  onExportMarkdown,
  onExportFromServer,
  onImport,
  draggedItemId,
  onDragStartItem,
  onDropItem,
  onPeekStart,
  onPeekEnd
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { settings } = useSettingsContext();
  const [exportMenuState, setExportMenuState] = useState<'closed' | 'main' | 'pdf'>('closed');
  const exportContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportContainerRef.current && 
        !exportContainerRef.current.contains(event.target as Node)
      ) {
        setExportMenuState('closed');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNotes = useMemo(() => {
    return searchNotes(items, searchQuery);
  }, [items, searchQuery]);

  const showSearchResults = searchQuery.length > 0;
  
  const isActionDisabled = !activeItemId;
  const isPrintDisabled = !activeItemId || activeItemType !== 'note';
  const buttonBaseClass = "p-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500";
  const enabledClass = "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white";
  const disabledClass = "text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50";
  
  const isServerMode = settings.storageLocation === 'server';
  
  const handleExportClick = () => {
    if (isServerMode) {
        setExportMenuState(prev => prev === 'closed' ? 'main' : 'closed');
    } else {
        onExportMarkdown();
    }
  };

  const handleExportMdClick = () => {
    onExportMarkdown();
    setExportMenuState('closed');
  };
  
  const handleServerExport = (type: 'pdf' | 'zip') => {
    onExportFromServer(type);
    setExportMenuState('closed');
  };

  const handlePdfMenuClick = () => {
    if (activeItemType === 'note') {
        handleServerExport('pdf');
    } else {
        setExportMenuState('pdf');
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 h-full flex flex-col w-full overflow-y-auto border-r border-slate-200 dark:border-gray-700 hide-scrollbar">
      <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{settings.appName}</h1>
             {settings.appLogoUrl ? (
                <img src={settings.appLogoUrl} alt="App Logo" className="w-8 h-8 rounded-md object-cover" />
            ) : (
                <Logo className="w-8 h-8 text-slate-800 dark:text-white" />
            )}
        </div>
        <p className="text-sm text-slate-500 dark:text-gray-400">{settings.appSubtitle}</p>
      </div>

      <div className="p-2 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="w-4 h-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-md pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-gray-300 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
      </div>
      
      <div className="p-2 flex-shrink-0 border-b border-slate-200 dark:border-gray-700 flex items-center justify-around">
        <button onClick={() => onAddItem('note')} className={`${buttonBaseClass} ${enabledClass}`} title="New Note">
            <FilePlusIcon className="w-5 h-5"/>
        </button>
        <button onClick={() => onAddItem('folder')} className={`${buttonBaseClass} ${enabledClass}`} title="New Folder">
            <FolderPlusIcon className="w-5 h-5"/>
        </button>
        <button onClick={onRequestRename} disabled={isActionDisabled} className={`${buttonBaseClass} ${isActionDisabled ? disabledClass : enabledClass}`} title="Rename Selected">
            <PencilIcon className="w-5 h-5"/>
        </button>
        <button onClick={onRequestPrint} disabled={isPrintDisabled} className={`${buttonBaseClass} ${isPrintDisabled ? disabledClass : enabledClass}`} title="Print Note">
            <PrintIcon className="w-5 h-5"/>
        </button>
        <button onClick={onRequestDelete} disabled={isActionDisabled} className={`${buttonBaseClass} ${isActionDisabled ? disabledClass : 'text-red-500 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-300'}`} title="Delete Selected">
           <TrashIcon className="w-5 h-5"/>
        </button>
      </div>
      
      <nav className="flex-grow p-2 space-y-1">
        {showSearchResults ? (
            <>
                <p className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Search Results</p>
                {filteredNotes.length > 0 ? (
                    filteredNotes.map((note) => (
                    // Note: Context menu, D&D, and toggle actions are not available on search results
                    <SidebarItem
                        key={note.id}
                        item={note}
                        onSelectItem={onSelectItem}
                        onToggleFolder={() => {}}
                        activeItemId={activeItemId}
                        onRenameItem={() => {}}
                        onDeleteItem={() => {}}
                        renamingItemId={null}
                        draggedItemId={null}
                        onDragStartItem={() => {}}
                        onDropItem={() => {}}
                        onPeekStart={onPeekStart}
                        onPeekEnd={onPeekEnd}
                    />
                    ))
                ) : (
                    <p className="text-center text-gray-500 text-sm p-4">No notes found.</p>
                )}
            </>
        ) : (
          items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              onSelectItem={onSelectItem}
              onToggleFolder={onToggleFolder}
              activeItemId={activeItemId}
              onRenameItem={onRenameItem}
              onDeleteItem={onDeleteItem}
              renamingItemId={renamingItemId}
              draggedItemId={draggedItemId}
              onDragStartItem={onDragStartItem}
              onDropItem={onDropItem}
              onPeekStart={onPeekStart}
              onPeekEnd={onPeekEnd}
            />
          ))
        )}
      </nav>
      <div className="flex-shrink-0 p-2 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between">
          <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-2 rounded-md text-sm transition-colors duration-150 text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500">
            <SettingsIcon className="w-5 h-5" />
            <span>Settings</span>
          </button>
           <div className="flex items-center">
            <button
              onClick={onImport}
              className="p-2 rounded-md transition-colors duration-150 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
              title="Import notes"
              aria-label="Import notes from .md or .zip file"
            >
              <ImportIcon className="w-5 h-5" />
            </button>
            <div ref={exportContainerRef} className="relative">
                {isServerMode && (
                    <div 
                        className={`absolute bottom-full right-[-4px] mb-2 flex flex-col-reverse items-center gap-2 z-10 transition-all duration-300 ease-out ${exportMenuState !== 'closed' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
                    >
                        {exportMenuState === 'main' && (
                            <>
                                <button 
                                    onClick={handlePdfMenuClick} 
                                    className="flex items-center justify-center w-10 h-10 bg-slate-200 dark:bg-gray-700 rounded-full shadow-md text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-gray-600 transition-transform hover:scale-110"
                                    title={activeItemType === 'note' ? 'Export as PDF' : 'Export as PDF / ZIP'}
                                >
                                    <span className="font-bold text-xs">PDF</span>
                                </button>
                                <button 
                                    onClick={handleExportMdClick} 
                                    className="flex items-center justify-center w-10 h-10 bg-slate-200 dark:bg-gray-700 rounded-full shadow-md text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-gray-600 transition-transform hover:scale-110"
                                    title="Export as Markdown"
                                >
                                    <span className="font-bold text-xs">MD</span>
                                </button>
                            </>
                        )}
                         {exportMenuState === 'pdf' && (
                            <>
                                <button 
                                    onClick={() => handleServerExport('zip')} 
                                    className="flex items-center justify-center w-10 h-10 bg-slate-200 dark:bg-gray-700 rounded-full shadow-md text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-gray-600 transition-transform hover:scale-110"
                                    title="Export as ZIP File"
                                >
                                    <ArchiveIcon className="w-5 h-5" />
                                </button>
                                 <button 
                                    onClick={() => handleServerExport('pdf')} 
                                    className="flex items-center justify-center w-10 h-10 bg-slate-200 dark:bg-gray-700 rounded-full shadow-md text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-gray-600 transition-transform hover:scale-110"
                                    title="Export as Single PDF"
                                >
                                    <FileIcon className="w-5 h-5" />
                                </button>
                            </>
                        )}
                    </div>
                )}
                <button
                    onClick={handleExportClick}
                    disabled={isActionDisabled}
                    className="p-2 rounded-md transition-colors duration-150 text-gray-500 hover:bg-gray-200 disabled:text-gray-400/50 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-accent-500"
                    title="Export selected item"
                    aria-label="Export selected item"
                >
                    <ExportIcon className="w-5 h-5" />
                </button>
            </div>
            <ThemeToggle />
          </div>
      </div>
    </div>
  );
};

export default Sidebar;