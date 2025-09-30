
import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import type { Note } from '../types';
import { enrichNote, formatSelectionWithAI } from '../services/aiService';
import { AILoadingIcon, FileIcon, PencilIcon, EyeIcon } from './icons';
import { useHistory } from '../hooks/useHistory';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { useToast } from './ToastProvider';
import { formatMarkdown } from '../services/markdownFormatter';
import TagEditor from './TagEditor';
import { ALL_TOOLBAR_ACTIONS } from '../constants';
import EditorContextMenu, { MarkdownAction } from './EditorContextMenu';

// Using a dynamic import for react-markdown as it can be a large library
const ReactMarkdown = React.lazy(() => import('react-markdown'));


interface EditorProps {
  note: Note | null;
  onUpdateNote: (id: string, content: string, name: string, tags: string[]) => void;
  onToggleSidebar: () => void;
}

const PrintPreview: React.FC<{ name: string; content: string; theme: string }> = ({ name, content, theme }) => {
    return (
        <div className="print-only">
            <h1 className="print-title">{name}</h1>
            <div
                data-color-mode={theme}
                className="markdown-body"
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    );
};


const Editor: React.FC<EditorProps> = ({ note, onUpdateNote, onToggleSidebar }) => {
  const [localName, setLocalName] = useState('');
  const [localContent, setLocalContent] = useState(''); // Live state for inputs
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectionExists, setSelectionExists] = useState(false);
  // FIX: Initialize contextMenu state with `null` instead of itself to resolve the "used before declaration" error.
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { settings } = useSettingsContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevNoteRef = useRef<Note | null>(null);

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }, []);
  const modKey = isMac ? '⌘' : 'Ctrl';
  const redoModKeyText = isMac ? `⇧${modKey}Z` : `${modKey}+Y`;


  // History state management for both name and content
  const {
    state: historyState,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useHistory({ name: '', content: '', tags: [] as string[] });

  // This effect is responsible for syncing the editor's state with the `note` prop.
  useEffect(() => {
    if (note) {
      const isNewNote = prevNoteRef.current?.id !== note.id;

      // If it's a new note, reset everything to match the prop.
      if (isNewNote) {
        setLocalName(note.name);
        setLocalContent(note.content);
        setLocalTags(note.tags || []);
        resetHistory({ name: note.name, content: note.content, tags: note.tags || [] });
        setIsPreview(false);
        setSelectionExists(false);
      } else {
        // It's the same note, but content might have loaded asynchronously.
        // We update local state only if content appears for the first time
        // to avoid overwriting user edits.
        const contentWasLoaded = prevNoteRef.current?.isContentLoaded;
        
        if (note.isContentLoaded && !contentWasLoaded) {
          setLocalContent(note.content);
          setLocalTags(note.tags || []); // Also sync tags on first load
          resetHistory({ name: note.name, content: note.content, tags: note.tags || [] });
        }
      }
    } else {
        // When no note is selected, clear the editor state.
        setLocalName('');
        setLocalContent('');
        setLocalTags([]);
        resetHistory({ name: '', content: '', tags: [] });
        setIsPreview(false);
    }
    // Update the ref for the next render.
    prevNoteRef.current = note;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, resetHistory]);

  // Sync history state (from undo/redo) back to the live input states
  useEffect(() => {
    // This effect should only run when an undo/redo happens (historyState changes).
    // The conditional state setters prevent an infinite loop with the other effect
    // that pushes changes to the history.
    if (historyState.name !== localName) {
      setLocalName(historyState.name);
    }
    if (historyState.content !== localContent) {
        setLocalContent(historyState.content);
    }
    if (JSON.stringify(historyState.tags) !== JSON.stringify(localTags)) {
        setLocalTags(historyState.tags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyState]);

  // Debounce updates from the live input states to the history state
  useEffect(() => {
    if (!note || (localName === historyState.name && localContent === historyState.content && JSON.stringify(localTags) === JSON.stringify(historyState.tags))) return;
    
    const handler = setTimeout(() => {
      setHistoryState({ name: localName, content: localContent, tags: localTags });
    }, 500); // 500ms debounce before adding to history
    
    return () => clearTimeout(handler);
  }, [localName, localContent, localTags, historyState, setHistoryState, note]);
  
  const isDirty = note ? (
    localName !== note.name ||
    localContent !== note.content ||
    JSON.stringify(localTags) !== JSON.stringify(note.tags || [])
  ) : false;

  // Auto-save logic (watches live state)
  useEffect(() => {
    // Only run if the note is dirty
    if (!note || !isDirty) {
      return;
    }

    const handler = setTimeout(() => {
      setIsSaving(true);
      onUpdateNote(note.id, localContent, localName, localTags);
    }, 1500);

    return () => clearTimeout(handler);
  }, [localContent, localName, localTags, note, onUpdateNote, isDirty]);

  // This effect ensures the "Saving..." indicator is turned off once the note prop is updated.
  useEffect(() => {
    if (!isDirty) {
      setIsSaving(false);
    }
  }, [isDirty]);


  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      setSelectionExists(textarea.selectionStart !== textarea.selectionEnd);
    }
  };

  const handleEnrich = useCallback(async () => {
    if (!note) return;
    setIsEnriching(true);
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart;
    const selectionEnd = textarea?.selectionEnd;
    const currentContent = textarea?.value ?? '';

    // Case 1: Text is selected, enrich only the selection
    if (textarea && selectionStart !== undefined && selectionEnd !== undefined && selectionStart < selectionEnd) {
      const selectedText = currentContent.substring(selectionStart, selectionEnd);
      if (selectedText.trim() === '') {
          setIsEnriching(false);
          return;
      }
      const enrichedSnippet = await enrichNote(selectedText, settings, { isSelection: true });
      if (!enrichedSnippet.startsWith('Error:')) {
          const before = currentContent.substring(0, selectionStart);
          const after = currentContent.substring(selectionEnd);
          setLocalContent(`${before}${enrichedSnippet}${after}`);
      } else {
          showToast(enrichedSnippet, 'error');
      }
    // Case 2: No text is selected, enrich the whole note
    } else {
      const enrichedContent = await enrichNote(currentContent, settings);
      if (!enrichedContent.startsWith('Error:')) {
          setLocalContent(enrichedContent);
      } else {
          showToast(enrichedContent, 'error');
      }
    }
    setIsEnriching(false);
  }, [note, settings, showToast]);

  const wrapSelection = useCallback((wrapper: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea || isPreview) return;
    const { selectionStart, selectionEnd, value } = textarea;

    const selectedText = value.substring(selectionStart, selectionEnd);
    const textBefore = value.substring(0, selectionStart);
    const textAfter = value.substring(selectionEnd);

    // Case 1: The selection itself is wrapped (e.g., user selected "**bold**")
    if (selectedText.startsWith(wrapper) && selectedText.endsWith(wrapper)) {
        const unwrappedText = selectedText.slice(wrapper.length, -wrapper.length);
        // FIX: Use the 'textAfter' variable instead of the undefined 'after'.
        const newContent = `${textBefore}${unwrappedText}${textAfter}`;
        setLocalContent(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(selectionStart, selectionStart + unwrappedText.length);
        }, 0);
        return;
    }

    // Case 2: The text surrounding the selection is wrapped (e.g., user selected "bold" inside "**bold**")
    if (textBefore.endsWith(wrapper) && textAfter.startsWith(wrapper)) {
        const newContent = `${textBefore.slice(0, -wrapper.length)}${selectedText}${textAfter.slice(wrapper.length)}`;
        setLocalContent(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(selectionStart - wrapper.length, selectionEnd - wrapper.length);
        }, 0);
        return;
    }

    // Case 3: Nothing is wrapped, so we wrap it. Handles both selection and no selection.
    const textToWrap = selectedText || placeholder;
    // FIX: Use the 'textAfter' variable instead of the undefined 'after'.
    const newContent = `${textBefore}${wrapper}${textToWrap}${wrapper}${textAfter}`;
    setLocalContent(newContent);
    setTimeout(() => {
        textarea.focus();
        const newSelectionStart = selectionStart + wrapper.length;
        const newSelectionEnd = newSelectionStart + textToWrap.length;
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }, 0);
}, [isPreview]);


  const handleInsertLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || isPreview) return;
    const { selectionStart, selectionEnd, value } = textarea;
    const selectedText = value.substring(selectionStart, selectionEnd) || 'link text';

    const before = `[${selectedText}]`;
    const after = '(url)';
    
    const newContent = `${value.substring(0, selectionStart)}${before}${after}${value.substring(selectionEnd)}`;
    setLocalContent(newContent);
    
    setTimeout(() => {
        textarea.focus();
        const urlStartPosition = selectionStart + before.length + 1;
        const urlEndPosition = urlStartPosition + 'url'.length;
        textarea.setSelectionRange(urlStartPosition, urlEndPosition);
    }, 0);
  }, [isPreview]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.id === 'tag-input' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text')) return;

        const modifier = isMac ? event.metaKey : event.ctrlKey;
        if (!modifier) return;
        
        let handled = false;

        switch (event.key.toLowerCase()) {
            case 'b':
                if (!isPreview && note) {
                    wrapSelection('**', 'bold text');
                    handled = true;
                }
                break;
            case 'i':
                if (!isPreview && note) {
                    wrapSelection('*', 'italic text');
                    handled = true;
                }
                break;
            case '\'':
                 if (note) {
                    handleEnrich();
                    handled = true;
                }
                break;
            case 'p':
                 if (event.shiftKey && note) {
                    setIsPreview(p => !p);
                    handled = true;
                }
                break;
            case 'z':
                if (event.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                handled = true;
                break;
            case 'y':
                if (!isMac) {
                    redo();
                    handled = true;
                }
                break;
        }

        if (handled) {
            event.preventDefault();
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [note, isMac, isPreview, wrapSelection, handleEnrich, undo, redo, onToggleSidebar]);
  
  const handleFormatSelection = async () => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
        return;
    }
    setIsFormatting(true);

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = localContent.substring(selectionStart, selectionEnd);

    if (selectedText.trim() === '') {
        setIsFormatting(false);
        return;
    }
    
    const formattedSnippet = await formatSelectionWithAI(selectedText, settings);

    if (!formattedSnippet.startsWith('Error:')) {
        const before = localContent.substring(0, selectionStart);
        const after = localContent.substring(selectionEnd);
        const newContent = `${before}${formattedSnippet}${after}`;
        setLocalContent(newContent);

        // Re-select the newly formatted text for better UX
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(selectionStart, selectionStart + formattedSnippet.length);
            handleSelectionChange();
        }, 0);
    } else {
        showToast(formattedSnippet, 'error');
    }

    setIsFormatting(false);
  };
  
  const handleFormatOnBlur = () => {
    // No need to format if in preview mode or there's no content
    if (isPreview || !localContent) return;

    const formattedContent = formatMarkdown(localContent);
    
    // Only update state if the content actually changed
    if (formattedContent !== localContent) {
      setLocalContent(formattedContent);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (isPreview) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleContextMenuAction = (action: MarkdownAction) => {
    const textarea = textareaRef.current;
    if (!textarea || isPreview) return;
    const { selectionStart, selectionEnd, value } = textarea;

    switch (action) {
      case 'bold':
        wrapSelection('**', 'bold text');
        break;
      case 'italic':
        wrapSelection('*', 'italic text');
        break;
      case 'link':
        handleInsertLink();
        break;
      case 'heading1':
      case 'heading2':
      case 'heading3': {
        const prefixMap = { heading1: '# ', heading2: '## ', heading3: '### ' };
        const prefix = prefixMap[action];
        const lineStartIndex = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEndIndex = value.indexOf('\n', lineStartIndex);
        const currentLine = value.substring(lineStartIndex, lineEndIndex === -1 ? value.length : lineEndIndex);
        const existingHeadingRegex = /^(#+ )/;
        const match = currentLine.match(existingHeadingRegex);
        let newContent;
        let newSelectionStart;
        if (match) {
            const existingPrefix = match[0];
            const textAfterPrefix = value.substring(lineStartIndex + existingPrefix.length);
            if (existingPrefix === prefix) { // Same heading, toggle off
                newContent = value.substring(0, lineStartIndex) + textAfterPrefix;
                newSelectionStart = selectionStart - existingPrefix.length;
            } else { // Different heading, replace
                newContent = value.substring(0, lineStartIndex) + prefix + textAfterPrefix;
                newSelectionStart = selectionStart - existingPrefix.length + prefix.length;
            }
        } else { // No heading, add it
            newContent = value.substring(0, lineStartIndex) + prefix + value.substring(lineStartIndex);
            newSelectionStart = selectionStart + prefix.length;
        }
        setLocalContent(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newSelectionStart, newSelectionStart + (selectionEnd - selectionStart));
        }, 0);
        break;
      }
      case 'table': {
        const tableTemplate = `| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |`;
        const textBefore = value.substring(0, selectionStart);
        // FIX: Correctly get the text after the selection using selectionEnd.
        const textAfter = value.substring(selectionEnd);
        const prefix = (textBefore.endsWith('\n') || textBefore.length === 0) ? '' : '\n\n';
        // FIX: Use the 'textAfter' variable instead of the undefined 'after'.
        const newContent = `${textBefore}${prefix}${tableTemplate}${textAfter}`;
        setLocalContent(newContent);
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = selectionStart + prefix.length + 2; // Inside "| Header 1 |"
            textarea.setSelectionRange(newCursorPos, newCursorPos + 'Header 1'.length);
        }, 0);
        break;
      }
      case 'code-block': {
        const selectedText = value.substring(selectionStart, selectionEnd) || 'code here';
        const textBefore = value.substring(0, selectionStart);
        const textAfter = value.substring(selectionEnd);
        const prefix = textBefore.endsWith('\n') || textBefore.length === 0 ? '' : '\n';
        const suffix = textAfter.startsWith('\n') || textAfter.length === 0 ? '' : '\n';
        // FIX: Use the 'textAfter' variable instead of the undefined 'after'.
        const newContent = `${textBefore}${prefix}\`\`\`\n${selectedText}\n\`\`\`${suffix}${textAfter}`;
        setLocalContent(newContent);
        setTimeout(() => {
            textarea.focus();
            const newSelectionStart = selectionStart + prefix.length + 4; // after ```\n
            textarea.setSelectionRange(newSelectionStart, newSelectionStart + selectedText.length);
        }, 0);
        break;
      }
      case 'format-selection':
        handleFormatSelection();
        break;
    }
    setContextMenu(null);
  };

  let saveStatus: 'Saved' | 'Saving...' | 'Unsaved changes';
  if (isSaving) {
    saveStatus = 'Saving...';
  } else if (isDirty) {
    saveStatus = 'Unsaved changes';
  } else {
    saveStatus = 'Saved';
  }
  
  const statusColorClass = saveStatus === 'Saved' ? 'text-gray-400' : 'text-accent-500 dark:text-accent-400';
  
  const toolbarButtonBaseClass = "p-2 text-slate-700 dark:text-white transition-colors duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-accent-500";
  const toolbarButtonEnabledClass = "hover:enabled:bg-slate-300 dark:hover:enabled:bg-gray-600";
  const toolbarButtonDisabledClass = "disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed";
  
  return (
    <>
      <div className="not-printable flex-1 bg-white dark:bg-gray-900 flex flex-col h-full relative">
          <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-gray-700 flex flex-col gap-2">
              <div className="flex items-center gap-2 sm:gap-4">
                  <button 
                      onClick={onToggleSidebar} 
                      className="p-2 bg-slate-100 dark:bg-gray-800 rounded-md border border-slate-200 dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                      aria-label="Toggle Sidebar"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                  </button>

                  <div className="flex flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
                    <input
                        type="text"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        disabled={!note}
                        className="bg-transparent text-slate-800 dark:text-white text-lg font-semibold focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 px-2 py-1 rounded-md focus:bg-slate-100 dark:focus:bg-gray-800 focus:ring-1 focus:ring-accent-500 transition-all flex-grow min-w-[150px] truncate disabled:cursor-not-allowed disabled:bg-transparent"
                        placeholder={note ? "Untitled Note" : "No note selected"}
                        title={note ? localName : "No note selected"}
                    />
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {note && <span className={`text-xs italic w-auto text-right transition-colors ${statusColorClass} hidden sm:inline`}>{saveStatus}</span>}
                        <div className="flex items-center space-x-1 bg-slate-200 dark:bg-gray-700 rounded-md p-0.5">
                            {settings.toolbarActions.map(actionId => {
                                const action = ALL_TOOLBAR_ACTIONS.find(a => a.id === actionId);
                                if (!action) return null;

                                let onClick;
                                let disabled = !note;
                                let className = `${toolbarButtonBaseClass} ${toolbarButtonEnabledClass} ${toolbarButtonDisabledClass}`;
                                let title = action.label;

                                switch (actionId) {
                                    case 'enrich':
                                        onClick = handleEnrich;
                                        disabled = isEnriching || !note;
                                        className = `${toolbarButtonBaseClass} ${isEnriching ? 'bg-accent-400 animate-pulse' : 'bg-accent-500 hover:bg-accent-400 text-accent-contrast'}`;
                                        title = `${action.label} (${modKey}+')`;
                                        break;
                                    case 'format-selection':
                                        onClick = handleFormatSelection;
                                        disabled = isFormatting || !selectionExists || !note;
                                        break;
                                    case 'undo':
                                        onClick = undo;
                                        disabled = !canUndo; // Keep this independent of note
                                        title = `${action.label} (${modKey}+Z)`;
                                        break;
                                    case 'redo':
                                        onClick = redo;
                                        disabled = !canRedo; // Keep this independent of note
                                        title = `${action.label} (${redoModKeyText})`;
                                        break;
                                    case 'bold':
                                        onClick = () => wrapSelection('**', 'bold text');
                                        disabled = isPreview || !note;
                                        title = `${action.label} (${modKey}+B)`;
                                        break;
                                    case 'italic':
                                        onClick = () => wrapSelection('*', 'italic text');
                                        disabled = isPreview || !note;
                                        title = `${action.label} (${modKey}+I)`;
                                        break;
                                    case 'link':
                                        onClick = handleInsertLink;
                                        disabled = isPreview || !note;
                                        break;
                                    default:
                                        onClick = () => {};
                                }

                                return (
                                    <button
                                        key={action.id}
                                        onClick={onClick}
                                        disabled={disabled}
                                        title={title}
                                        className={className}
                                        aria-label={title}
                                    >
                                        { (isEnriching && action.id === 'enrich') || 
                                          (isFormatting && action.id === 'format-selection')
                                          ? <AILoadingIcon className="w-5 h-5"/> 
                                          : <action.icon className="w-5 h-5" />
                                        }
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="bg-slate-200 dark:bg-gray-700 p-0.5 rounded-md flex">
                            <button 
                              onClick={() => setIsPreview(false)} 
                              disabled={!note}
                              className={`p-2 rounded transition-colors ${!isPreview ? 'bg-white dark:bg-gray-600 text-slate-800 dark:text-white' : 'text-gray-500 hover:bg-slate-300/50 dark:hover:bg-gray-600/50'} ${!note ? 'disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed' : ''}`}
                              title={`Edit (${modKey}+Shift+P)`}
                              aria-label="Edit mode"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => setIsPreview(true)} 
                              disabled={!note}
                              className={`p-2 rounded transition-colors ${isPreview ? 'bg-white dark:bg-gray-600 text-slate-800 dark:text-white' : 'text-gray-500 hover:bg-slate-300/50 dark:hover:bg-gray-600/50'} ${!note ? 'disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed' : ''}`}
                              title={`Preview (${modKey}+Shift+P)`}
                              aria-label="Preview mode"
                            >
                              <EyeIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                  </div>
              </div>
              {note && <TagEditor tags={localTags} onTagsChange={setLocalTags} />}
          </div>
        <div key={note ? `${note.id}-${isPreview}` : 'no-note'} className="flex-grow overflow-y-auto animate-fade-in hide-scrollbar">
          {!note ? (
            <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-gray-500 dark:text-gray-500 text-center p-8 h-full">
                <FileIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-700" />
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-400">Select a Note</h2>
                <p className="mt-2 max-w-sm">Choose a note from the sidebar to read or edit. If you're just getting started, create a new note to capture your thoughts!</p>
            </div>
          ) : isPreview ? (
              <div className="w-full min-h-full p-8 bg-white dark:bg-gray-900">
                <div
                  data-color-mode={theme}
                  className="markdown-body"
                >
                    <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading preview...</div>}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeHighlight]}
                          components={{
                            // Open links in a new tab for better UX
                            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                          }}
                        >
                          {localContent}
                        </ReactMarkdown>
                    </Suspense>
                </div>
              </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onBlur={handleFormatOnBlur}
              onSelect={handleSelectionChange}
              onMouseUp={handleSelectionChange}
              onKeyUp={handleSelectionChange}
              onContextMenu={handleContextMenu}
              className="w-full h-full p-8 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-300 resize-none focus:outline-none text-base leading-relaxed tracking-wide placeholder-gray-400 dark:placeholder-gray-600"
              placeholder="Just start writing... Use Markdown for styling and click the ✨ button for magic"
            />
          )}
        </div>
         {contextMenu && !isPreview && note && (
          <EditorContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onSelectAction={handleContextMenuAction}
              selectionExists={selectionExists}
          />
        )}
      </div>
      {note && <PrintPreview name={localName} content={localContent} theme={theme} />}
    </>
  );
};

export default Editor;
