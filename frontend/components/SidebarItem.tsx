
import React, { useState, useEffect, useRef } from 'react';
import type { FileSystemItem, Folder, Note } from '../types';
import { FolderIcon, FileIcon, ChevronRightIcon, AILoadingIcon } from './icons';
import ContextMenu from './ContextMenu';

interface SidebarItemProps {
  item: FileSystemItem;
  onSelectItem: (id: string, type: 'note' | 'folder') => void;
  onToggleFolder: (id: string) => void;
  activeItemId: string | null;
  level?: number;
  onRenameItem: (id:string, newName: string) => void;
  onDeleteItem: (id: string) => void;
  renamingItemId: string | null;
  // Drag and drop props
  draggedItemId: string | null;
  onDragStartItem: (id: string) => void;
  onDropItem: (targetFolderId: string) => void;
  // Peek preview props
  onPeekStart: (note: Note, rect: DOMRect) => void;
  onPeekEnd: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  item, 
  onSelectItem,
  onToggleFolder,
  activeItemId, 
  level = 0, 
  onRenameItem, 
  onDeleteItem, 
  renamingItemId,
  draggedItemId,
  onDragStartItem,
  onDropItem,
  onPeekStart,
  onPeekEnd,
}) => {
  const [isRenaming, setIsRenaming] = useState(renamingItemId === item.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Sync local renaming state with the global renamingItemId from the parent.
    // This ensures only one item is in renaming mode at a time.
    setIsRenaming(renamingItemId === item.id);
  }, [renamingItemId, item.id]);

  useEffect(() => {
    if (isRenaming) {
        inputRef.current?.focus();
        inputRef.current?.select();
    }
  }, [isRenaming]);

  const handleToggle = () => {
    if (item.type === 'folder') {
      onToggleFolder(item.id);
    }
  };

  const handleFinishRename = () => {
    const newName = inputRef.current?.value.trim();

    // If the new name is blank or unchanged, we treat it as a cancellation.
    // We call onRenameItem with the original name, which allows the parent component
    // to reset the global 'renamingItemId' state without performing an actual rename.
    if (newName && newName !== item.name) {
        onRenameItem(item.id, newName);
    } else {
        onRenameItem(item.id, item.name);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishRename();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsRenaming(false);
      onRenameItem(item.id, item.name); // Cancel rename state in parent
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
      setContextMenu(null);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragStartItem(item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (item.type === 'folder' && item.id !== draggedItemId) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (item.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      onDropItem(item.id);
    }
  };

  const handleDragEnd = () => {
      setIsDragOver(false);
  };

  const handleMouseEnter = () => {
    if (item.type === 'note' && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        onPeekStart(item as Note, rect);
    }
  };

  const handleMouseLeave = () => {
      onPeekEnd();
  };
  
  const isFolder = item.type === 'folder';
  const isOpen = isFolder && (item as Folder).isOpen;
  const hasToggle = isFolder && (item as Folder).children.length > 0;

  const isSelected = item.id === activeItemId;
  const isBeingDragged = item.id === draggedItemId;
  const itemBaseClasses = 'flex items-center w-full text-left p-2 rounded-md text-sm transition-colors duration-150';
  const selectedClasses = 'bg-accent-100 text-accent-800 dark:bg-accent-500/20 dark:text-accent-300';
  const hoverClasses = 'hover:bg-slate-200 dark:hover:bg-gray-700';
  const dragOverClasses = isDragOver ? 'ring-2 ring-accent-500 ring-inset bg-accent-100/50 dark:bg-accent-500/10' : '';
  const beingDraggedClasses = isBeingDragged ? 'opacity-40' : '';

  const RenamingInput = (
    <input
      ref={inputRef}
      type="text"
      defaultValue={item.name}
      className="bg-slate-200 dark:bg-gray-600 text-slate-800 dark:text-white w-full h-full outline-none focus:ring-1 focus:ring-accent-500 rounded-sm px-1"
      onClick={(e) => e.stopPropagation()}
      onBlur={handleFinishRename}
      onKeyDown={handleRenameKeyDown}
    />
  );

  return (
    <div className="relative">
      {isFolder ? (
        <div className="w-full">
          <button
            onClick={() => onSelectItem(item.id, 'folder')}
            onContextMenu={handleContextMenu}
            style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
            className={`${itemBaseClasses} ${isSelected ? selectedClasses : hoverClasses} ${dragOverClasses} ${beingDraggedClasses}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <span 
              onClick={(e) => { e.stopPropagation(); handleToggle(); }} 
              className={`mr-2 p-1 rounded-md ${hasToggle ? 'hover:bg-slate-300 dark:hover:bg-gray-600' : 'invisible'}`}
              aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
            >
              <ChevronRightIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </span>
            {(item as Folder).isLoadingContents 
              ? <AILoadingIcon className="w-5 h-5 mr-2 flex-shrink-0 text-accent-600 dark:text-accent-400" /> 
              : <FolderIcon className="w-5 h-5 mr-2 flex-shrink-0 text-accent-600 dark:text-accent-400" />
            }
            {isRenaming ? RenamingInput : <span className="truncate flex-grow">{item.name}</span>}
          </button>
          {isOpen && (
            <div className="w-full">
              {(item as Folder).children.map((child) => (
                <SidebarItem
                  key={child.id}
                  item={child}
                  onSelectItem={onSelectItem}
                  onToggleFolder={onToggleFolder}
                  activeItemId={activeItemId}
                  level={level + 1}
                  onRenameItem={onRenameItem}
                  onDeleteItem={onDeleteItem}
                  renamingItemId={renamingItemId}
                  draggedItemId={draggedItemId}
                  onDragStartItem={onDragStartItem}
                  onDropItem={onDropItem}
                  onPeekStart={onPeekStart}
                  onPeekEnd={onPeekEnd}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          ref={buttonRef}
          onClick={() => onSelectItem(item.id, 'note')}
          onContextMenu={handleContextMenu}
          style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
          className={`${itemBaseClasses} ${isSelected ? selectedClasses : hoverClasses} ${beingDraggedClasses}`}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <FileIcon className="w-5 h-5 mr-2 flex-shrink-0 text-gray-400" />
          {isRenaming ? RenamingInput : <span className="truncate">{item.name}</span>}
        </button>
      )}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu}>
          <button onClick={() => { onRenameItem(item.id, item.name); setIsRenaming(true); closeContextMenu(); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">Rename</button>
          <button onClick={() => { onDeleteItem(item.id); closeContextMenu(); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-600">Delete</button>
        </ContextMenu>
      )}
    </div>
  );
};

export default SidebarItem;