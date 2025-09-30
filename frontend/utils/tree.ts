import type { FileSystemItem, Folder } from '../types';

export const sortFileSystemItems = (a: FileSystemItem, b: FileSystemItem): number => {
    if (a.type === 'folder' && b.type === 'note') return -1;
    if (a.type === 'note' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
};

export const findItemAndParent = (items: FileSystemItem[], itemId: string, parent: Folder | null = null): { item: FileSystemItem | null, parent: Folder | null } => {
    for (const item of items) {
        if (item.id === itemId) return { item, parent };
        if (item.type === 'folder') {
            const result = findItemAndParent(item.children, itemId, item);
            if (result.item) return result;
        }
    }
    return { item: null, parent: null };
};

export const findAndRemoveItem = (items: FileSystemItem[], itemId: string): { newItems: FileSystemItem[], foundItem: FileSystemItem | null } => {
    let foundItem: FileSystemItem | null = null;
    
    const filteredItems = items.filter(item => {
        if (item.id === itemId) {
            foundItem = item;
            return false;
        }
        return true;
    });

    if (foundItem) {
        return { newItems: filteredItems, foundItem };
    }

    const newItems = items.map(item => {
        if (item.type === 'folder') {
            const result = findAndRemoveItem(item.children, itemId);
            if (result.foundItem) {
                foundItem = result.foundItem;
                return { ...item, children: result.newItems };
            }
        }
        return item;
    });
    
    return { newItems, foundItem };
};

// FIX: Update function signature to accept multiple items to add via a rest parameter.
export const addItemToFolder = (items: FileSystemItem[], targetFolderId: string, ...itemsToAdd: FileSystemItem[]): FileSystemItem[] => {
    return items.map(item => {
        if (item.type === 'folder') {
            if (item.id === targetFolderId) {
                const newChildren = [...item.children, ...itemsToAdd].sort(sortFileSystemItems);
                return { ...item, children: newChildren, isOpen: true };
            }
            return { ...item, children: addItemToFolder(item.children, targetFolderId, ...itemsToAdd) };
        }
        return item;
    });
};

export const updateItemRecursive = (items: FileSystemItem[], updatedItem: FileSystemItem): FileSystemItem[] => {
    return items.map(item => {
        if (item.id === updatedItem.id) return updatedItem;
        if (item.type === 'folder') {
            return { ...item, children: updateItemRecursive(item.children, updatedItem) };
        }
        return item;
    });
};

export const deleteItemRecursive = (items: FileSystemItem[], itemId: string): FileSystemItem[] => {
    const newItems = items.filter(item => item.id !== itemId);
    if (newItems.length === items.length) {
        return items.map(item => {
            if (item.type === 'folder') {
                return { ...item, children: deleteItemRecursive(item.children, itemId) };
            }
            return item;
        });
    }
    return newItems;
};

/**
 * Recursively searches the file system tree for an item by its ID and replaces it with a new item.
 * After replacement, it re-sorts the children of the parent folder to maintain alphabetical order.
 * @param items The array of file system items to search through.
 * @param itemId The ID of the item to find and replace.
 * @param newItem The new item to insert in place of the old one.
 * @returns A new array of file system items with the item replaced and sorted.
 */
export const findAndReplaceItem = (
    items: FileSystemItem[],
    itemId: string,
    newItem: FileSystemItem
): FileSystemItem[] => {
    let itemFoundAndReplaced = false;

    const recurseAndReplace = (currentItems: FileSystemItem[]): FileSystemItem[] => {
        // First, check if the item is in the current level
        const itemIndex = currentItems.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            itemFoundAndReplaced = true;
            const updatedItems = [...currentItems];
            updatedItems[itemIndex] = newItem;
            return updatedItems.sort(sortFileSystemItems);
        }

        // If not at this level, recurse into folders
        return currentItems.map(item => {
            if (item.type === 'folder' && !itemFoundAndReplaced) {
                const newChildren = recurseAndReplace(item.children);
                // If the children array has changed, it means the item was found and replaced
                if (newChildren !== item.children) {
                    return { ...item, children: newChildren };
                }
            }
            return item;
        });
    };

    return recurseAndReplace(items);
};
