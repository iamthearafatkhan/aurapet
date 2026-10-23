const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
    sendHitRegion: (region) => ipcRenderer.send('hit-region', region),
    showPetMenu: () => ipcRenderer.send('show-pet-menu'),
    toggleFocus: (isFocused) => ipcRenderer.send('toggle-focus', isFocused),
    sendAction: (data) => ipcRenderer.send('pet-action', data),
    sendChatMessage: (text) => ipcRenderer.send('chat-message', text),
    copyCode: (text) => ipcRenderer.send('copy-code', text),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    toggleFullScreen: () => ipcRenderer.send('toggle-fullscreen'),
    log: (msg) => ipcRenderer.send('log-to-terminal', msg),
    openExternal: (url) => ipcRenderer.send('open-external', url),

    setPetName: (name) => ipcRenderer.send('set-pet-name', name),
    setUserName: (name) => ipcRenderer.send('set-user-name', name),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    downloadModel: (modelName) => ipcRenderer.send('download-model', modelName),
    uninstallModel: (modelName) => ipcRenderer.send('uninstall-model', modelName),

    // NEW: Bridges for the Setup Screen
    startInitialSetup: (modelName) => ipcRenderer.send('start-initial-setup', modelName),
    onInitialDownloadProgress: (callback) => ipcRenderer.on('initial-download-progress', (_, data) => callback(data)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),

    onSwitchPet: (callback) => ipcRenderer.on('switch-pet', (_, petType) => callback(petType)),
    onCommand: (callback) => ipcRenderer.on('command', (_, cmd) => callback(cmd)),
    onSpeak: (callback) => ipcRenderer.on('pet-speak', (_, text) => callback(text)),
    onChatResponse: (callback) => ipcRenderer.on('chat-response', (_, text) => callback(text)),
    onGlobalClick: (callback) => ipcRenderer.on('global-click', () => callback()),
    onSetName: (callback) => ipcRenderer.on('set-name', () => callback()),
    onSetUserName: (callback) => ipcRenderer.on('set-user-name', () => callback())
});