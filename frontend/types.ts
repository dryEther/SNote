
export interface Note {
  id: string;
  name: string;
  content: string;
  tags?: string[];
  type: 'note';
  path: string; // Relative path from the root directory
  isContentLoaded?: boolean;
}

export interface Folder {
  id:string;
  name: string;
  children: FileSystemItem[];
  type: 'folder';
  isOpen?: boolean;
  path: string; // Relative path from the root directory
  isLoadingContents?: boolean;
}

export type FileSystemItem = Note | Folder;

// This represents a note object as it is handled for server storage,
// which is a plain object before being stringified with frontmatter.
export interface ServerNote {
    id: string;
    name: string;
    content: string;
    tags: string[];
    path: string;
}