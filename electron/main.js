const { app, BrowserWindow, screen, ipcMain, Menu, session, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronOllama } = require('electron-ollama');
const { executeAction, getSelectedPath } = require('./action-executor');
const { askBrain } = require('./brain-router');
const { startIdleWatcher } = require('./idle-welcome');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    process.exit(0);
}

let setupWin = null;
let petWin = null;
let chatWin = null;
let currentPetName = "Miko";
let currentUserName = "Arafat";
let chatHistory = [];
let mousePollInterval = null;
let lastCursorPoint = { x: 0, y: 0 };
let isQuitting = false;

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

app.on('second-instance', () => {
    if (chatWin) {
        if (chatWin.isMinimized()) chatWin.restore();
        chatWin.show();
        chatWin.focus();
    }
});

app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media' || permission === 'audioCapture') callback(true);
        else callback(false);
    });

    try {
        const eo = new ElectronOllama({ basePath: app.getPath('userData') });
        if (!(await eo.isRunning())) await eo.serve('latest');
    } catch (error) { console.error(error); }

    setupIPC();

    if (!fs.existsSync(settingsPath)) {
        createSetupWindow();
    } else {
        createAppWindows();
    }
});

function createSetupWindow() {
    setupWin = new BrowserWindow({
        width: 600, height: 700, frame: false, resizable: false,
        icon: path.join(__dirname, '..', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    setupWin.loadFile(path.join(__dirname, '../renderer/setup.html'));
}

function createAppWindows() {
    // FIX: Prevent multiple pets from spawning
    if (petWin) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    petWin = new BrowserWindow({
        width, height, x: 0, y: 0,
        transparent: true, frame: false, alwaysOnTop: true,
        skipTaskbar: true, hasShadow: false, resizable: false, focusable: false,
        icon: path.join(__dirname, '..', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
            backgroundThrottling: false,
            sandbox: false
        },
    });
    petWin.loadFile(path.join(__dirname, '../renderer/index.html'), { query: { view: 'pet' } });
    petWin.setIgnoreMouseEvents(true, { forward: true });

    chatWin = new BrowserWindow({
        width: 400, height: 600, frame: false, show: false, skipTaskbar: false,
        resizable: false, alwaysOnTop: true,
        icon: path.join(__dirname, '..', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
            backgroundThrottling: false,
            sandbox: false
        },
    });
    chatWin.loadFile(path.join(__dirname, '../renderer/index.html'), { query: { view: 'chat' } });

    chatWin.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            chatWin.hide();
        }
    });

    chatWin.on('restore', () => {
        chatWin.setAlwaysOnTop(true);
        chatWin.moveTop();
        chatWin.focus();
    });

    startMousePolling();
}

function startMousePolling() {
    if (mousePollInterval) clearInterval(mousePollInterval);
    mousePollInterval = setInterval(() => {
        const point = screen.getCursorScreenPoint();
        lastCursorPoint = point;
        if (petWin && !petWin.isDestroyed()) {
            petWin.webContents.send('global-mousemove', { x: point.x, y: point.y });
        }
    }, 16);
}

async function downloadOllamaModel(modelName, targetWin, progressChannel) {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.status === 'success') {
                        targetWin.webContents.send(progressChannel, { status: 'Complete!', percent: 100 });
                    } else if (data.total && data.completed) {
                        const percent = Math.round((data.completed / data.total) * 100);
                        targetWin.webContents.send(progressChannel, { status: `Downloading...`, percent: percent });
                    } else if (data.status) {
                        targetWin.webContents.send(progressChannel, { status: data.status, percent: 0 });
                    }
                } catch (e) { }
            }
        }
    } catch (err) {
        console.error('Download error:', err);
        targetWin.webContents.send(progressChannel, { status: 'Failed to connect to Ollama.', percent: 0 });
    }
}

function setupIPC() {
    ipcMain.on('start-initial-setup', (event, modelName) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        downloadOllamaModel(modelName, win, 'initial-download-progress');
    });

    ipcMain.on('finish-setup', () => {
        if (petWin) return; // FIX: Prevent multiple triggers
        if (setupWin) {
            setupWin.close();
            setupWin = null;
        }
        createAppWindows();
    });

    ipcMain.on('download-model', (event, modelName) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        downloadOllamaModel(modelName, win, 'download-progress');
    });

    ipcMain.on('uninstall-model', (_, modelName) => {
        if (!modelName || !chatWin) return;
        chatWin.webContents.send('download-progress', { status: `Uninstalling...`, percent: 0 });
        const { spawn } = require('child_process');
        const p = spawn('ollama', ['rm', modelName]);
        p.on('close', (code) => {
            if (chatWin) chatWin.webContents.send('download-progress', { status: code === 0 ? 'Uninstalled!' : 'Failed.', percent: 0 });
        });
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
        if (chatWin) chatWin.webContents.send('pet-speak', "Settings saved!");
    });

    ipcMain.on('show-chat', () => {
        if (!chatWin) return;
        if (chatWin.isMinimized()) chatWin.restore();
        chatWin.setAlwaysOnTop(true);
        chatWin.show();
        chatWin.moveTop();
        chatWin.focus();
    });

    ipcMain.on('minimize-chat', () => {
        if (chatWin) {
            chatWin.setAlwaysOnTop(false);
            chatWin.minimize();
        }
    });

    ipcMain.on('close-chat', () => { if (chatWin) chatWin.hide(); });
    ipcMain.on('toggle-fullscreen-chat', () => { if (chatWin) chatWin.setFullScreen(!chatWin.isFullScreen()); });

    ipcMain.on('open-file-dialog', async () => {
        if (!chatWin) return;
        const result = await dialog.showOpenDialog(chatWin, {
            properties: ['openFile'],
            filters: [{ name: 'Images/Videos', extensions: ['jpg', 'png', 'jpeg', 'gif', 'mp4'] }]
        });
        if (!result.canceled && result.filePaths.length > 0) {
            chatWin.webContents.send('file-selected', result.filePaths[0]);
        }
    });

    ipcMain.on('hit-region', (_, region) => {
        if (!petWin || petWin.isDestroyed()) return;
        if (region.active) petWin.setIgnoreMouseEvents(false);
        else petWin.setIgnoreMouseEvents(true, { forward: true });
    });

    ipcMain.on('show-pet-menu', () => {
        if (!petWin || petWin.isDestroyed() || !chatWin) return;
        const wasFocusable = petWin.isFocusable();
        petWin.setFocusable(true);
        petWin.focus();

        const menu = Menu.buildFromTemplate([
            { label: '💬 Open Chat', click: () => { chatWin.show(); chatWin.focus(); } },
            { type: 'separator' },
            { label: '📍 Stay Here', click: () => petWin.webContents.send('command', 'stay') },
            { label: '🏃 Follow Cursor', click: () => petWin.webContents.send('command', 'follow') },
            { type: 'separator' },
            { label: '🐱 Cat', click: () => petWin.webContents.send('switch-pet', 'cat') },
            { label: '🐶 Dog', click: () => petWin.webContents.send('switch-pet', 'dog') },
            { label: '🐦 Parrot', click: () => petWin.webContents.send('switch-pet', 'parrot') },
            { label: '🐉 Dragon', click: () => petWin.webContents.send('switch-pet', 'dragon') },
            { type: 'separator' },
            {
                label: 'Quit AuraPet',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        menu.popup({
            window: petWin,
            x: Math.round(lastCursorPoint.x),
            y: Math.round(lastCursorPoint.y),
            callback: () => { if (petWin) petWin.setFocusable(wasFocusable); }
        });
    });

    ipcMain.on('toggle-focus', (_, isFocused) => {
        if (!petWin || petWin.isDestroyed()) return;
        petWin.setFocusable(isFocused);
        if (isFocused) petWin.focus();
    });

    ipcMain.on('copy-code', (_, text) => clipboard.writeText(text));
    ipcMain.on('log-to-terminal', (_, msg) => console.log(msg));
    ipcMain.on('open-external', (_, url) => shell.openExternal(url));

    startIdleWatcher(() => { if (chatWin) chatWin.webContents.send('pet-speak', `Welcome back, ${currentUserName}!`); });
}

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => app.quit());