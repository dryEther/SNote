import React, { useEffect, useRef } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  CodeBracketIcon,
  EnrichIcon,
  HeadingIcon,
  TableIcon,
} from './icons';

export type MarkdownAction = 
  | 'bold' 
  | 'italic' 
  | 'link' 
  | 'code-block' 
  | 'format-selection'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'table';

interface EditorContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelectAction: (action: MarkdownAction) => void;
  selectionExists: boolean;
}

interface MenuAction {
  id: MarkdownAction;
  label: string;
  icon: React.FC<{ className?: string }>;
  requiresSelection?: boolean;
}

interface MenuSeparator {
  type: 'separator';
}

type MenuItem = MenuAction | MenuSeparator;
const SEPARATOR: MenuSeparator = { type: 'separator' };

const menuActions: readonly MenuItem[] = [
  { id: 'bold', label: 'Bold', icon: BoldIcon },
  { id: 'italic', label: 'Italic', icon: ItalicIcon },
  SEPARATOR,
  { id: 'heading1', label: 'Heading 1', icon: HeadingIcon },
  { id: 'heading2', label: 'Heading 2', icon: HeadingIcon },
  { id: 'heading3', label: 'Heading 3', icon: HeadingIcon },
  { id: 'table', label: 'Insert Table', icon: TableIcon },
  SEPARATOR,
  { id: 'link', label: 'Insert Link', icon: LinkIcon },
  { id: 'code-block', label: 'Code Block', icon: CodeBracketIcon },
  SEPARATOR,
  { id: 'format-selection', label: 'Format Selection with AI', icon: EnrichIcon, requiresSelection: true },
];

const EditorContextMenu: React.FC<EditorContextMenuProps> = ({ x, y, onClose, onSelectAction, selectionExists }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    top: `${y}px`,
    left: `${x}px`,
  };

  const buttonBaseClasses = 'flex items-center w-full text-left px-3 py-2 text-sm transition-colors duration-150';
  const enabledClasses = 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600';
  const disabledClasses = 'text-gray-400 dark:text-gray-500 cursor-not-allowed';

  return (
    <div
      ref={menuRef}
      style={style}
      className="absolute z-50 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-md shadow-lg py-1 w-56 animate-fade-in"
    >
      {menuActions.map((action, index) => {
          // FIX: Use a robust type guard to differentiate between MenuAction and MenuSeparator items. This resolves errors from accessing properties on the union type.
          if ('id' in action) { // This is a MenuAction
            const isDisabled = action.requiresSelection && !selectionExists;
            return (
              <button
                  key={action.id}
                  onClick={() => {
                      if (!isDisabled) {
                          onSelectAction(action.id);
                      }
                  }}
                  disabled={isDisabled}
                  className={`${buttonBaseClasses} ${isDisabled ? disabledClasses : enabledClasses}`}
              >
                  <action.icon className="w-4 h-4 mr-3" />
                  <span>{action.label}</span>
              </button>
            );
          } else { // This is a MenuSeparator
            return <div key={`sep-${index}`} className="my-1 h-px bg-slate-200 dark:bg-gray-600" />;
          }
      })}
    </div>
  );
};

export default EditorContextMenu;