# SNote 📝
**Your intelligent, customizable, and private workspace.**

SNote is an AI-powered Markdown note-taking app that puts you in full control of your data. Whether you’re writing, coding, or organizing projects, SNote gives you a powerful, distraction-free environment with smart AI assistance.

---

## ✨ Features

### 🚀 AI-Powered Editor
- **Enrich Content**: Improve grammar, expand ideas, or rewrite text with one click (`Ctrl/Cmd + '`).
- **Format Code**: Clean up messy code snippets with AI-powered Markdown formatting.
- **Custom Prompts** with inline tags (`#prompt{}` / `#context{}`).
- **Bring Your Own AI**: Choose between Google Gemini, OpenAI, Ollama, or any OpenAI-compatible API.

### ✍️ Mastering Markdown
- Full **Markdown support** with live preview.
- GitHub-style **checklists**.
- Right-click to insert tables, headings, and links.
- Auto-formatting for lists and code blocks.

### 🗂️ Organize Your Workspace
- **Folders & Notes** with drag-and-drop.
- **Tags & Search** across all notes.
- **Peek Preview** (`Alt + Hover`).
- **File Operations**: Rename, delete, export.

### 💾 Your Data, Your Way
- **Storage Modes**: Browser, Local Files, or Remote Server.
- **Import/Export** single notes (`.md`) or full folders (`.zip`).

### 🎨 Make It Your Own
- Light/Dark themes.
- Customizable toolbar.
- Upload your own sidebar logo.

---

## 🐳 Deployment with Docker

### Clone the repository
```bash
git clone https://github.com/<your-username>/snote.git
cd snote
```

### Run with Docker Compose
```bash
docker-compose up -d
```

SNote will now be running at:  
👉 [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Configuration

### Environment Variables
You can configure SNote via `.env` or in your `docker-compose.yaml`:

| Variable         | Default      | Description |
|------------------|-------------|-------------|
| `AI_PROVIDER`    | `openai`    | AI provider (`openai`, `gemini`, `ollama`, or any OpenAI-compatible API). |
| `AI_API_KEY`     | *(empty)*   | API key for the chosen provider. |
| `STORAGE_MODE`   | `browser`   | Storage backend: `browser`, `local`, or `server`. |
| `PORT`           | `3000`      | Port SNote will listen on inside the container. |

> You can add more providers or keys as needed in the future.

### Volumes / Mapped Directories
These directories are bind-mountable from the host for persistence:

| Container Path       | Host Path (example)   | Purpose |
|----------------------|-----------------------|---------|
| `/app/data`          | `./data`             | Stores notes, folders, and metadata. |
| `/app/config`        | `./config`           | Configuration files and settings. |

*(You can edit these in `docker-compose.yaml` before running `docker-compose up`.)*

---

## 📦 Docker Hub

Pull and run directly:

```bash
docker pull <your-dockerhub-username>/snote:latest
docker run -d   -p 3000:3000   -e AI_PROVIDER=openai   -e AI_API_KEY=your-key-here   -e STORAGE_MODE=local   -v ./data:/app/data   -v ./config:/app/config   <your-dockerhub-username>/snote:latest
```

---

## 🛠️ Development

Run locally without Docker:

```bash
npm install
npm run dev
```

---

## 📜 License
MIT License © 2025 — Contributions welcome!
