const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
    // Setup APIs
    startInitialSetup: (modelName) => ipcRenderer.send('start-initial-setup', modelName),
    onInitialDownloadProgress: (cb) => ipcRenderer.on('initial-download-progress', (_, data) => cb(data)),
    finishSetup: () => ipcRenderer.send('finish-setup'),

    // Main App APIs
    showChat: () => ipcRenderer.send('show-chat'),
    minimizeChat: () => ipcRenderer.send('minimize-chat'),
    closeChat: () => ipcRenderer.send('close-chat'),
    toggleFullscreenChat: () => ipcRenderer.send('toggle-fullscreen-chat'),
    openFileDialog: () => ipcRenderer.send('open-file-dialog'),

    sendHitRegion: (region) => ipcRenderer.send('hit-region', region),
    showPetMenu: () => ipcRenderer.send('show-pet-menu'),
    toggleFocus: (isFocused) => ipcRenderer.send('toggle-focus', isFocused),
    sendChatMessage: (text) => ipcRenderer.send('chat-message', text),
    copyCode: (text) => ipcRenderer.send('copy-code', text),
    log: (msg) => ipcRenderer.send('log-to-terminal', msg),
    openExternal: (url) => ipcRenderer.send('open-external', url),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    downloadModel: (modelName) => ipcRenderer.send('download-model', modelName),
    uninstallModel: (modelName) => ipcRenderer.send('uninstall-model', modelName),

    onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, data) => cb(data)),
    onSwitchPet: (cb) => ipcRenderer.on('switch-pet', (_, petType) => cb(petType)),
    onCommand: (cb) => ipcRenderer.on('command', (_, cmd) => cb(cmd)),
    onSpeak: (cb) => ipcRenderer.on('pet-speak', (_, text) => cb(text)),
    onChatResponse: (cb) => ipcRenderer.on('chat-response', (_, text) => cb(text)),
    onGlobalMouseMove: (cb) => ipcRenderer.on('global-mousemove', (_, data) => cb(data)),
    onFileSelected: (cb) => ipcRenderer.on('file-selected', (_, path) => cb(path))
});