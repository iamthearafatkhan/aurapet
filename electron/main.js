const { app, BrowserWindow, screen, ipcMain, Menu, session, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { ElectronOllama } = require('electron-ollama');
const { executeAction, getSelectedPath } = require('./action-executor');
const { uIOhook } = require('uiohook-napi');
const { askBrain } = require('./brain-router');
const { startIdleWatcher } = require('./idle-welcome');

let win = null;
let currentPetName = "Miko";
let currentUserName = "Arafat";
let chatHistory = [];
let currentDownloadProcess = null;
let ollamaInstance = null;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const iconPath = path.join(__dirname, '..', 'icon.ico'); // Path to your logo

app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media' || permission === 'audioCapture') callback(true);
        else callback(false);
    });

    try {
        const eo = new ElectronOllama({ basePath: app.getPath('userData') });
        if (!(await eo.isRunning())) {
            console.log("Starting bundled Ollama...");
            ollamaInstance = await eo.serve('latest');
        }
    } catch (error) {
        console.error("Ollama Bundle Error:", error);
    }

    // Start Global Listeners
    startIdleWatcher(() => {
        if (win && !win.isDestroyed() && fs.existsSync(settingsPath)) {
            win.webContents.send('pet-speak', `Welcome back, ${currentUserName}!`);
        }
    });
    uIOhook.on('mousedown', () => {
        if (win && !win.isDestroyed()) win.webContents.send('global-click');
    });
    uIOhook.start();

    const isFirstRun = !fs.existsSync(settingsPath);
    if (isFirstRun) {
        createSetupWindow();
    } else {
        createPetWindow();
    }
});

// --- WINDOW CREATION FUNCTIONS ---
function createSetupWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    if (win) win.close();

    win = new BrowserWindow({
        width: width, height: height,
        resizable: false, transparent: false, frame: true,
        autoHideMenuBar: true, backgroundColor: '#212529',
        icon: iconPath, // ADDED ICON
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false,
        },
    });

    win.setMenu(null);
    win.loadFile(path.join(__dirname, '../renderer/setup.html'));
}

function createPetWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    if (win) win.close();

    win = new BrowserWindow({
        width: width, height: height, x: 0, y: 0,
        transparent: true, // Must be true at creation
        frame: false, alwaysOnTop: true, skipTaskbar: true,
        hasShadow: false, resizable: false, focusable: false,
        icon: iconPath, // ADDED ICON
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false,
        },
    });

    win.setIgnoreMouseEvents(true, { forward: true });
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

// --- IPC LISTENERS (GLOBAL) ---
ipcMain.on('log-to-terminal', (_, msg) => console.log(msg));
ipcMain.on('open-external', (_, url) => shell.openExternal(url));
ipcMain.on('set-pet-name', (_, name) => { currentPetName = name; });
ipcMain.on('set-user-name', (_, name) => { currentUserName = name; });
ipcMain.on('copy-code', (_, text) => clipboard.writeText(text));
ipcMain.on('minimize-window', () => { if (win) win.minimize(); });
ipcMain.on('toggle-fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });

ipcMain.on('start-initial-setup', async (_, modelName) => {
    try {
        if (win) win.webContents.send('initial-download-progress', { status: 'Connecting to Ollama...', percent: 0 });

        const response = await fetch('http://localhost:11434/api/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: true })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const data = JSON.parse(line);
                    if (data.total && data.completed) {
                        const percent = Math.round((data.completed / data.total) * 100);
                        if (win) win.webContents.send('initial-download-progress', { status: data.status, percent });
                    }
                } catch (e) { }
            }
        }

        if (win) win.webContents.send('initial-download-progress', { status: 'Complete!', percent: 100 });

        // TRANSITION: Destroy setup window and open Pet window
        setTimeout(() => {
            createPetWindow();
        }, 1000);

    } catch (err) {
        if (win) win.webContents.send('initial-download-progress', { status: 'Error downloading.', percent: 0 });
        console.error(err);
    }
});

ipcMain.handle('get-settings', () => {
    if (fs.existsSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        currentPetName = data.petName || "Miko";
        currentUserName = data.userName || "Arafat";
        return data;
    }
    return { petName: "Miko", userName: "Arafat", model: "qwen:latest", petType: "parrot" };
});

ipcMain.on('save-settings', (_, settings) => {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    currentPetName = settings.petName;
    currentUserName = settings.userName;
    if (win) win.webContents.send('pet-speak', "Settings saved!");
});

ipcMain.on('uninstall-model', (_, modelName) => {
    if (!modelName) return;
    if (win) win.webContents.send('download-progress', { status: `Uninstalling ${modelName}...`, percent: 0 });
    const uninstallProcess = spawn('ollama', ['rm', modelName]);
    uninstallProcess.on('close', (code) => {
        if (code === 0) { if (win) win.webContents.send('download-progress', { status: 'Uninstalled successfully!', percent: 100 }); }
        else { if (win) win.webContents.send('download-progress', { status: 'Uninstall failed.', percent: 0 }); }
    });
});

ipcMain.on('download-model', (_, modelName) => {
    if (currentDownloadProcess) currentDownloadProcess.kill();
    if (win) win.webContents.send('download-progress', { status: 'Starting download...', percent: 0 });
    currentDownloadProcess = spawn('ollama', ['pull', modelName]);

    currentDownloadProcess.stdout.on('data', (data) => {
        const output = data.toString();
        const match = output.match(/(\d+)%/);
        if (match) {
            if (win) win.webContents.send('download-progress', { status: 'Downloading...', percent: parseInt(match[1]) });
        } else if (output.includes('success')) {
            if (win) win.webContents.send('download-progress', { status: 'Complete!', percent: 100 });
            currentDownloadProcess = null;
        }
    });
});

ipcMain.on('chat-message', async (_, userText) => {
    if (!win || win.isDestroyed()) return;
    const lowerText = userText.toLowerCase();

    if (lowerText.includes("delete") || lowerText.includes("remove")) {
        const pathToDelete = await getSelectedPath();
        if (pathToDelete) {
            win.webContents.send('pet-speak', "Deleting...");
            const resultMessage = await executeAction('delete', pathToDelete);
            win.webContents.send('chat-response', resultMessage);
            win.webContents.send('pet-speak', resultMessage);
            return;
        } else {
            win.webContents.send('chat-response', "Please select a file or folder in Windows Explorer first.");
            return;
        }
    }

    if (lowerText.includes("open") || lowerText.includes("show")) {
        const pathToOpen = await getSelectedPath();
        if (pathToOpen) {
            win.webContents.send('pet-speak', "Opening...");
            const resultMessage = await executeAction('open', pathToOpen);
            win.webContents.send('chat-response', resultMessage);
            win.webContents.send('pet-speak', resultMessage);
            return;
        } else {
            win.webContents.send('chat-response', "Please select a file or folder in Windows Explorer first.");
            return;
        }
    }

    const brainResponse = await askBrain(userText, null, currentPetName, currentUserName, chatHistory);
    chatHistory.push({ role: 'user', content: userText });
    chatHistory.push({ role: 'assistant', content: brainResponse.text });
    if (chatHistory.length > 10) chatHistory.shift();

    win.webContents.send('chat-response', brainResponse.text);
    win.webContents.send('pet-speak', brainResponse.text);
});

ipcMain.on('hit-region', (_, region) => {
    if (!win || win.isDestroyed()) return;
    if (region.active) win.setIgnoreMouseEvents(false);
    else win.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('toggle-focus', (_, isFocused) => {
    if (!win || win.isDestroyed()) return;
    win.setFocusable(isFocused);
    if (isFocused) {
        win.focus();
        win.setIgnoreMouseEvents(false);
    } else {
        win.setIgnoreMouseEvents(true, { forward: true });
    }
});

ipcMain.on('show-pet-menu', () => {
    const menu = Menu.buildFromTemplate([
        { label: '💬 Open Chat', click: () => win.webContents.send('command', 'chat') },
        { label: '✏️ Set Pet Name', click: () => win.webContents.send('set-name') },
        { label: '👤 Set Your Name', click: () => win.webContents.send('set-user-name') },
        { type: 'separator' },
        { label: '📍 Stay Here', click: () => win.webContents.send('command', 'stay') },
        { label: '🏃 Follow Cursor', click: () => win.webContents.send('command', 'follow') },
        { type: 'separator' },
        { label: '🐱 Cat', click: () => win.webContents.send('switch-pet', 'cat') },
        { label: '🐶 Dog', click: () => win.webContents.send('switch-pet', 'dog') },
        { label: '🐦 Parrot', click: () => win.webContents.send('switch-pet', 'parrot') },
        { label: '🐉 Dragon', click: () => win.webContents.send('switch-pet', 'dragon') },
        { label: '🪰 Dragonfly', click: () => win.webContents.send('switch-pet', 'dragonfly') },
        { type: 'separator' },
        { label: 'Quit AuraPet', click: () => app.quit() }
    ]);
    menu.popup({ window: win });
});

app.on('window-all-closed', () => app.quit());