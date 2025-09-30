

import React, { useState } from 'react';
import { TagIcon, XIcon } from './icons';

interface TagEditorProps {
  tags: string[];
  onTagsChange: (newTags: string[]) => void;
}

const TagEditor: React.FC<TagEditorProps> = ({ tags, onTagsChange }) => {
  const [inputValue, setInputValue] = useState('');

  const addTags = (tagsToAdd: string[]) => {
    const newTags = [...tags];
    tagsToAdd.forEach(tag => {
      const formattedTag = tag.trim();
      if (formattedTag && !newTags.includes(formattedTag)) {
        newTags.push(formattedTag);
      }
    });
    onTagsChange(newTags);
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTags([inputValue]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text');
      const pastedTags = pasteData.split(/[\s,]+/).filter(Boolean);
      addTags(pastedTags);
  };

  return (
    <div className="flex items-center flex-wrap gap-2 p-2 rounded-md border border-transparent focus-within:border-accent-500 transition-colors">
      <TagIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
      {tags.map(tag => (
        <span key={tag} className="flex items-center bg-accent-100 dark:bg-accent-500/20 text-accent-800 dark:text-accent-300 text-sm font-medium px-2 py-0.5 rounded-full">
          {tag}
          <button onClick={() => removeTag(tag)} className="ml-1.5 p-0.5 rounded-full hover:bg-accent-200 dark:hover:bg-accent-500/40" aria-label={`Remove tag ${tag}`}>
            <XIcon className="w-3 h-3"/>
          </button>
        </span>
      ))}
      <input
        id="tag-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="Add a tag..."
        className="bg-transparent focus:outline-none text-sm flex-grow min-w-[100px]"
      />
    </div>
  );
};

export default TagEditor;