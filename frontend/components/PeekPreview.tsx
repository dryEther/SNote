
import React from 'react';
import ReactDOM from 'react-dom';
import type { Note } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import ReactMarkdown from 'react-markdown';

interface PeekPreviewProps {
    note: Note;
    position: { x: number; y: number };
}

const PeekPreview: React.FC<PeekPreviewProps> = ({ note, position }) => {
    const { theme } = useTheme();

    const style: React.CSSProperties = {
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
        zIndex: 1000,
    };

    return ReactDOM.createPortal(
        <div
            style={style}
            className="not-printable w-96 max-h-[60vh] bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-2xl p-1 animate-fade-in overflow-hidden flex flex-col"
        >
            <div className="p-3 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
                <h3 className="font-semibold text-slate-800 dark:text-white truncate">{note.name}</h3>
            </div>
            <div className="overflow-y-auto p-4 hide-scrollbar">
                 <div
                    data-color-mode={theme}
                    className="markdown-body"
                  >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeHighlight]}
                      >
                        {note.content}
                      </ReactMarkdown>
                  </div>
            </div>
        </div>,
        document.body
    );
};

export default PeekPreview;