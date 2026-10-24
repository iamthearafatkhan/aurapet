# 🐾 AuraPet

> Your AI-powered desktop companion. A tiny animated pet that lives on your screen, follows your cursor, chats with you, and runs entirely on your local machine.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ What is AuraPet?

AuraPet is a lightweight Electron desktop application that turns a Lottie animation into an interactive AI pet. It sits on top of all your other windows, follows your cursor around the screen, idles with cute wander animations, and — when you open its chat — answers questions using a **local Ollama model** running on your own hardware.

No accounts. No cloud. No API keys. Everything runs on your computer.

---

## 🎬 What's new in v1.2.0

- **Error-Free Setup:** The setup screen now shows live progress for the Ollama engine download, preventing the 15-minute freeze and the `spawn ENOENT` crash.
- **Faster Launch:** The app now opens instantly on first launch instead of waiting for background downloads.
- **NPM Package Ready:** The source code is now available on GitHub Packages for developers.
- **Fixed Settings Crash:** The `ipcMain.handle('get-settings')` crash on the setup screen is resolved.

---

## 🚀 Installation (for end users)

1. Go to the [Releases page](https://github.com/iamthearafatkhan/aurapet/releases/latest).
2. Download **`AuraPet Setup 1.2.0.exe`**.
3. Run it and follow the installer wizard.
4. Launch **AuraPet** from the Start Menu or Desktop shortcut.
5. On first launch, the **setup screen** opens instantly. Pick your pet and your brain (AI model), then click **Start AuraPet**.
6. Watch the progress bar as it downloads the AI engine and your model.
7. Enjoy your new desktop companion! 🐾

> **You do not need to install Ollama, Python, or anything else.**
> AuraPet automatically downloads and manages the Ollama engine for you on first run.

---

## 🧠 Choosing a brain — what does "model size" mean?

AuraPet gives you five local AI models. Each one is a **tradeoff between speed, quality, and disk space**. Bigger models give smarter answers but need more RAM and take longer to download.

| Option | Model | Download size | RAM needed | Good for |
|---|---|---|---|---|
| **Low (0.5B)** | `decide-0.5b` | **~0.4 GB** | ~1 GB | Very old PCs, quick replies, casual chat |
| **Mid (4B)** ⭐ | `qwen:latest` | **~2.5 GB** | ~4 GB | **Best default.** Balanced speed & quality |
| **High (6.7B)** | `deepseek-coder:6.7b` | **~3.8 GB** | ~6 GB | Writing and debugging code |
| **Max (8B)** | `llama3:8b` | **~4.7 GB** | ~8 GB | General-purpose smart assistant |
| **Ultra (14B)** | `qwen:14b` | **~9.0 GB** | ~16 GB | Deep reasoning, complex tasks |

**Which should I pick?**
- **Just want a fun pet?** → *Mid (4B)*. It's what we recommend.
- **Mostly asking for code?** → *High (6.7B)*.
- **Old laptop with 8 GB RAM?** → *Low (0.5B)*.

> 💡 **The first download can take a few minutes** depending on your internet. Once downloaded, the model lives in `%USERPROFILE%\.ollama\models\` and is shared with any other Ollama app on your system.

---

## 🎨 Where do the pet animations come from?

All pet animations used in AuraPet (cat, dog, parrot, dragon) are **Lottie JSON files** sourced from [**LottieFiles.com**](https://lottiefiles.com/), a free community repository of motion graphics.

Huge thanks to the LottieFiles creators whose work makes AuraPet feel alive. If you'd like to add your own pet:

1. Download a Lottie `.json` file from LottieFiles.
2. Drop it into `renderer/assets/animations/`.
3. Add a menu entry in `electron/main.js` → `show-pet-menu`.

Lottie is rendered in-app using [`lottie-web`](https://github.com/airbnb/lottie-web) by Airbnb.

---

## 🛠️ Building from source

### Requirements
- **Node.js** 18+ ([download](https://nodejs.org/))
- **Windows 10 / 11** (the primary target)
- **~1.5 GB free disk space**

### Steps

```bash
git clone https://github.com/iamthearafatkhan/aurapet.git
cd aurapet
npm install
npx electron-rebuild
npm start
```

To produce the Windows installer:

```bash
npm run build
```

Output goes to `dist/`:

- `AuraPet Setup 1.1.0.exe` — the NSIS installer
- `AuraPet 1.1.0.exe` — the portable single-file build

---

## 📁 Project structure

```
aurapet/
├── electron/
│   ├── main.js               # Main process: windows, IPC, Ollama bootstrap
│   ├── preload.js            # contextBridge API exposed to renderer
│   ├── brain-router.js       # Talks to local Ollama HTTP API
│   ├── brain-setup.js        # Ensures a model is pulled before chat
│   ├── action-executor.js    # File open/delete helpers
│   └── idle-welcome.js       # "Welcome back" idle watcher
├── renderer/
│   ├── index.html            # Shared UI (pet view + chat view)
│   ├── pet.js                # Pet physics, animation loop, IPC handlers
│   ├── sound.js              # Sound effects (meow / bark / chirp / roar)
│   └── assets/animations/    # Lottie JSON files (cat, dog, parrot, dragon)
├── icon.ico                  # App icon
├── package.json
└── README.md
```

---

## ⚙️ How it works under the hood

1. **Ollama is auto-installed.** On first launch, `electron-ollama` checks whether Ollama is running. If not, it downloads the correct Ollama binary into `%APPDATA%/aurapet/` and starts the server in the background. End users never touch a terminal.
2. **The pet window** is a transparent, frameless, always-on-top Electron window that covers the entire screen but ignores mouse events except where the pet is drawn.
3. **The chat window** is a normal window that can be minimized to the taskbar independently.
4. **Global cursor tracking** is done by polling `screen.getCursorScreenPoint()` at ~60 Hz in the main process — no native mouse hooks needed, so it works on every Windows build without extra dependencies.
5. **Model downloads** stream from Ollama's HTTP API (`POST /api/pull`) and are parsed for progress percentages in real time.
6. **Animations** are Lottie JSON files rendered by `lottie-web` inside the pet window.

---

## 🔒 Privacy

- **Everything runs locally.** No telemetry, no analytics, no cloud calls.
- Your chat history is kept in memory only and is cleared when the app closes.
- Settings are stored in `%APPDATA%/aurapet/settings.json` on your own machine.
- Models are stored in `%USERPROFILE%\.ollama\models\` — the same folder used by the official Ollama app.

---

## 🙏 Credits

- **Animations** — [LottieFiles.com](https://lottiefiles.com/) community creators
- **Lottie renderer** — [`lottie-web`](https://github.com/airbnb/lottie-web) by Airbnb
- **AI engine** — [Ollama](https://ollama.com/) by Ollama Inc.
- **Models** — Qwen, Llama 3, DeepSeek-Coder, and Decide (via Ollama Hub)
- **Electron wrapper** — [`electron-ollama`](https://www.npmjs.com/package/electron-ollama)
- **Built with** — Electron, Lottie-Web, and a lot of coffee ☕

---

## 📄 License

MIT © Arafat Khan — see [LICENSE](LICENSE) for details.

---

## 🐞 Found a bug?

Open an issue at [github.com/iamthearafatkhan/aurapet/issues](https://github.com/iamthearafatkhan/aurapet/issues) with:

- Your Windows version
- Which model you selected
- A screenshot or the terminal output if the app crashed

---

<p align="center">Made with ❤️ by <a href="https://github.com/iamthearafatkhan">Arafat Khan</a></p>
