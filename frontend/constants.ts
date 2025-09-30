
import React from 'react';
import {
    EnrichIcon, CodeBracketIcon, UndoIcon, RedoIcon, BoldIcon, ItalicIcon, LinkIcon
} from './components/icons';

export interface ToolbarAction {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

export const ALL_TOOLBAR_ACTIONS: ToolbarAction[] = [
  { id: 'enrich', label: 'Enrich with AI', icon: EnrichIcon },
  { id: 'format-selection', label: 'Format Selection as Code', icon: CodeBracketIcon },
  { id: 'undo', label: 'Undo', icon: UndoIcon },
  { id: 'redo', label: 'Redo', icon: RedoIcon },
  { id: 'bold', label: 'Bold', icon: BoldIcon },
  { id: 'italic', label: 'Italic', icon: ItalicIcon },
  { id: 'link', label: 'Insert Link', icon: LinkIcon },
];

export const WELCOME_CONTENT = `
# Welcome to SNote!

SNote is your intelligent, customizable, and private workspace. Here's a guide to all the features designed to boost your productivity and creativity.

---

## 🚀 The AI-Powered Editor

Unlock your best work with built-in AI.

- **Enrich Content**: Select any text or leave nothing selected and click the **✨ Enrich** button (or press \`Cmd/Ctrl + '\`) to have the AI improve grammar, expand on ideas, or rewrite your content.
- **Format Code**: Select a messy code snippet, right-click, and choose "Format Selection with AI" to get a perfectly formatted Markdown code block.
- **Advanced Control**: For precise tasks, use special tags in your note. For example:
  \`\`\`markdown
  #prompt{summarize this in three bullet points}
  #context{
  All the text you want the AI to process goes here. It can be a long article, meeting notes, or just a brainstorm. The AI will only consider the text inside the context block.
  }
  \`\`\`
- **Bring Your Own AI**: Head over to **Settings > AI Provider** to switch between Google Gemini, OpenAI, a local Ollama server, or any other OpenAI-compatible API.

---

## ✍️ Mastering Markdown

Write beautifully structured notes with ease.

- **Full Markdown Support**: Use standard syntax for **bold**, *italic*, \`code\`, [links](https://www.markdownguide.org/), and more.
- **Live Preview**: Toggle between the **Edit** and **Preview** modes to see your rendered Markdown.
- **Checklists**: Create to-do lists with GitHub Flavored Markdown:
  - [x] Learn SNote features
  - [ ] Write my masterpiece
- **Right-Click Menu**: Can't remember the syntax? Just right-click in the editor to insert headings, tables, links, and more.
- **Auto-Formatting**: The editor automatically cleans up list formatting and code block indentation when you click away.

### Essential Keyboard Shortcuts

| Action            | Windows/Linux | macOS         |
|-------------------|---------------|---------------|
| **Bold**          | \`Ctrl + B\`    | \`Cmd + B\`     |
| *Italic*          | \`Ctrl + I\`    | \`Cmd + I\`     |
| ✨ Enrich with AI | \`Ctrl + '\`   | \`Cmd + '\`    |
| Undo              | \`Ctrl + Z\`    | \`Cmd + Z\`     |
| Redo              | \`Ctrl + Y\`    | \`Cmd + Shift + Z\` |
| Toggle Preview    | \`Ctrl+Shift+P\`| \`Cmd+Shift+P\` |

---

## 🗂️ Organize Your Workspace

Keep your thoughts tidy and accessible.

- **Folders & Notes**: Create a nested hierarchy of folders to structure your projects. Drag and drop to move items around.
- **Tagging**: Add tags to any note using the tag editor below the title. This is great for grouping related ideas across different folders.
- **Powerful Search**: Use the search bar to instantly find notes by their title, content, or tags.
- **Peek Preview**: Quickly preview a note without opening it. Just hold the \`Alt\` key and hover over any note in the sidebar to see its content in a floating window.
- **File Operations**: Use the toolbar buttons or right-click a folder in the sidebar to rename and delete items.

---

## 💾 Your Data, Your Way

You are in complete control of your data.

- **Storage Options**: In **Settings > Storage**, choose between:
  1.  **Browser Storage**: Quick and easy, stored securely in your browser.
  2.  **Local File System**: Saves your notes as \`.md\` files in a folder on your computer for maximum control and portability.
  3.  **Server**: Saves notes to a remote server for access from anywhere.
- **Import/Export Everything**: Use the import/export icons in the sidebar to manage your data. Single notes are saved as \`.md\` files. Folders are zipped up with all their contents, including a handy \`_toc.md\` (Table of Contents) file!

---

## 🎨 Make It Your Own

Customize the app to fit your style.

- **Light & Dark Themes**: Switch between themes using the sun/moon icon in the bottom right.
- **Customizable Toolbar**: Go to **Settings > Toolbar** to add, remove, and reorder the buttons in the editor's quick access toolbar.
- **Custom Logo**: Upload your own logo in **Settings > Appearance** to personalize the sidebar.

Enjoy your new intelligent journal!
`.trim();