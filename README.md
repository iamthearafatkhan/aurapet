<div align="center">
  <img src="docs/assets/ak-logo.png" width="100" alt="AuraPet Logo">
  <h1>AuraPet</h1>
  <p>Your AI-powered desktop companion. A tiny animated pet that lives on your screen, chats with you, and runs entirely on your local machine.</p>

  <a href="https://github.com/iamthearafatkhan/aurapet/releases/latest">
    <img src="https://img.shields.io/badge/Download-Windows-blue?style=for-the-badge&logo=windows" alt="Download">
  </a>
  <img src="https://img.shields.io/badge/version-1.4.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
</div>

---

## 🌟 Meet Your Companion

<div align="center">
  <img src="docs/assets/parrot.gif" width="120" alt="Parrot">
  <img src="docs/assets/cat.gif" width="120" alt="Cat">
  <img src="docs/assets/dog.gif" width="120" alt="Dog">
  <img src="docs/assets/dragon.gif" width="120" alt="Dragon">
</div>

AuraPet is a lightweight Electron desktop application that turns a Lottie animation into an interactive AI pet. It sits on top of all your other windows, follows your cursor around the screen, idles with cute wander animations, and answers questions using a **local Ollama model**.

No accounts. No cloud. No API keys. Everything runs 100% locally on your computer.

---

## 🚀 Installation

1. Go to the [Releases page](https://github.com/iamthearafatkhan/aurapet/releases/latest).
2. Download **`AuraPet Setup 1.4.0.exe`**.
3. Run the installer and launch AuraPet.
4. Pick your pet and your AI model on the setup screen, and you're ready to go!

> **You do not need to install Ollama, Python, or anything else.** AuraPet automatically manages the AI engine for you.

---

## 📸 How It Works

<div align="center">
  <img src="docs/assets/setup.png" width="400" alt="Setup Screen">
  <br>
  <em>Zero-Config Setup</em>
</div>
<br>

<div align="center">
  <img src="docs/assets/chatbox.png" width="300" alt="Chat Interface">
  <img src="docs/assets/option.png" width="300" alt="Right-Click Menu">
</div>

---

## 🧠 Choosing an AI Brain

Bigger models are smarter, but require more RAM and storage. You can change this anytime in the app settings.

| Option | Model | Download size | RAM needed | Good for |
|---|---|---|---|---|
| **Low (0.5B)** | `decide-0.5b` | **~0.4 GB** | ~1 GB | Old PCs, casual chat |
| **Mid (4B)** ⭐ | `qwen:latest` | **~2.5 GB** | ~4 GB | **Recommended.** Balanced |
| **High (6.7B)** | `deepseek-coder:6.7b` | **~3.8 GB** | ~6 GB | Writing and coding |
| **Max (8B)** | `llama3:8b` | **~4.7 GB** | ~8 GB | Smart assistant |
| **Ultra (14B)** | `qwen:14b` | **~9.0 GB** | ~16 GB | Deep reasoning |

---

## 🔧 Troubleshooting & FAQ

**How do I reset the app to see the setup screen again?**
Press `Windows Key + R`, type `%appdata%\AuraPet`, and delete the `settings.json` file. Restart the app.

**Where is the app installed vs. where is my data saved?**
- **Program Files:** `AppData\Local\Programs\AuraPet`
- **User Data (Settings & Models):** `AppData\Roaming\AuraPet`

**The chat window is transparent over YouTube videos.**
This is a known Electron/Windows GPU compositing bug. It does not affect functionality. We are looking into a fix.

---

## 🎨 Credits

- **Animations** — [LottieFiles.com](https://lottiefiles.com/) community creators
- **AI engine** — [Ollama](https://ollama.com/)
- **Built with** — Electron & Lottie-Web

## 📄 License

MIT © Arafat Khan — see [LICENSE](LICENSE) for details.
