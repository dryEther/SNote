# <img src="https://raw.githubusercontent.com/dryEther/SNote/64508a53345b49e2634499ba2944fc7c5cc0a56b/Assets/snote_icon.png" alt="SNote" width="30"/>SNote 
**Your intelligent, customizable, and private workspace.**

![Docker Pulls](https://img.shields.io/docker/pulls/ritabanguha/snote)

SNote is an AI-powered Markdown note-taking app that puts you in full control of your data. Whether you’re writing, coding, or organizing projects, SNote gives you a powerful, distraction-free environment with smart AI assistance.

[![Watch the video](https://github.com/dryEther/SNote/blob/main/Assets/snote.jpeg?raw=true)](https://youtu.be/qImTjP04OlU)
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
git clone https://github.com/dryEther/snote.git
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

| Variable | Default | Description |
| --- | --- | --- |
| PORT | 3000 | Port for backend server |
| JWT_SECRET | SuperSecret | Use a strong key |
| TOKEN_EXPIRY | 2h | user session duraiton control |
| DATA_ROOT | ./Data | Folder where all Users' Files are Orgamized. |
| USERS_ROOT | ./Users | Folder where all Users' encrypted keys are kept |
| DEBUG | false | if set to true the log will start showing more details |
| OPENAI_API_KEY | your_openai_key | add your OPEN API KEY to access their models  |
| API_KEY | your_gemini_key | Add your GEMINI KEY to access their models |
| API_URL | https://generativelanguage.googleapis.com/v1beta | Gemini AI service API |
| OLLAMA_HOST_URL | http://host.docker.internal:11434 | Ollama API |
| CUSTOM_CHAT_COMPLETION_URL |  | Any other AI Provider's Chat EndPoint |
| CUSTOM_MODEL_LIST_URL |  |  Any other AI Provider's Model List EndPoint |
| CUSTOM_API_KEY |  |  Any other AI Provider's API Access Key |


### Volumes / Mapped Directories
These directories are bind-mountable from the host for persistence:

| Container Path       | Host Path (example)   | Purpose |
|----------------------|-----------------------|---------|
| `/app/Data`          | `./Data`             | Stores notes, folders, and metadata.|
| `/app/Users`        | `./User`           | User Data |
| `/app/Configs`        | `./Config`           | User Personalization and Configuration |

*(You can edit these in `docker-compose.yaml` before running `docker-compose up`.)*

---

## 📦 Docker Hub

Pull and run directly:

```bash
docker pull ritabanguha/snote:latest
docker run -d   -p 3000:3000   -e PORT = 3000 -e OLLAMA_HOST_URL = 'http://host.docker.internal:11434'    -v ./Data:/app/Data    ritabanguha/snote:latest
```

---

## 🧭 Next Release Updates
- AI availabiliy in Browser Storage Mode and Local Storage Mode
- Dynamic App logo on the Brouser Tab
- Double Click to expand/close directories
- Double Click AI Enhance to serially run all #prompts in the note at one go.
- Add formatted auto generated ToC to Zip exports.
- 2FA
- Shift to simple DB storage
- Email as attachment
- Allow more markdown formats (currently only supports github markdown format)

---

## 📜 License
MIT License © 2025 — Contributions welcome!
