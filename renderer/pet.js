import { playSound } from './sound.js';

window.onerror = function (message, source, lineno, colno, error) {
    if (window.petAPI) window.petAPI.log(`❌ JS Error: ${message} at line ${lineno}`);
    return false;
};

const lottie = window.lottie;
const $ = (id) => document.getElementById(id);

const petContainer = $('pet-container');
const animContainer = $('lottie-animation');
const nameBox = $('name-box');
const nameInput = $('pet-name-input');
const saveNameBtn = $('save-name-btn');
const speechBubble = $('speech-bubble');

const chatContainer = $('chat-container');
const chatMessages = $('chat-messages');
const chatInput = $('chat-input');
const chatSend = $('chat-send');
const chatClose = $('chat-close');
const btnMin = $('chat-min');
const btnMax = $('chat-max');
const chatSettingsBtn = $('chat-settings');
const chatMuteBtn = $('chat-mute');

const settingsModal = $('settings-modal');
const setUserName = $('set-user-name');
const setPetName = $('set-pet-name');
const setModel = $('set-model');
const btnCloseSettings = $('btn-close-settings');
const btnSaveSettings = $('btn-save-settings');
const btnDownloadModel = $('btn-download-model');
const btnUninstallModel = $('btn-uninstall-model');
const downloadStatus = $('download-status');
const downloadBar = $('download-bar');

let lottieAnim = null;
let currentPet = 'parrot';
let petSound = 'chirp';
let petName = localStorage.getItem('petName') || 'Miko';
let userName = localStorage.getItem('userName') || "Arafat";
let faceMultiplier = -1;
let isMuted = false;

let petX = window.innerWidth / 2;
let petY = window.innerHeight / 2;
let velX = 0; let velY = 0;
let targetX = petX; let targetY = petY;
let mouseX = petX; let mouseY = petY;

let isFacingRight = true;
let isDragging = false;
let wasHovering = false;
let isEditingUser = false;
let isChatOpen = false;

let isStaying = false;
let lastMouseMoveTime = Date.now();
let wanderCooldown = 0;
let isResting = false;

let speechTimeout;
let isSpeaking = false;

// Initialize Settings
if (window.petAPI) {
    window.petAPI.setPetName(petName);
    window.petAPI.setUserName(userName);

    window.petAPI.getSettings().then(settings => {
        if (settings.petType) loadPet(settings.petType);
        if (settings.petName) petName = settings.petName;
        if (settings.userName) userName = settings.userName;
    });
}

function loadPet(petType) {
    currentPet = petType;
    if (lottieAnim) lottieAnim.destroy();

    if (petType === 'cat') { petSound = 'meow'; faceMultiplier = 1; }
    if (petType === 'dog') { petSound = 'bark'; faceMultiplier = -1; }
    if (petType === 'dragon') { petSound = 'roar'; faceMultiplier = -1; }
    if (petType === 'parrot') { petSound = 'chirp'; faceMultiplier = -1; }
    if (petType === 'dragonfly') { petSound = 'chirp'; faceMultiplier = 1; }

    isFacingRight = true;
    if (petContainer) petContainer.style.transform = `scaleX(${1 * faceMultiplier})`;

    if (lottie && animContainer) {
        lottieAnim = lottie.loadAnimation({
            container: animContainer, renderer: 'svg', loop: true, autoplay: true,
            path: `./assets/animations/${petType}.json`
        });
    }
}

if (window.petAPI) window.petAPI.onSwitchPet((type) => loadPet(type));

function toggleChat() {
    isChatOpen = !isChatOpen;
    if (chatContainer) chatContainer.style.display = isChatOpen ? 'flex' : 'none';
    if (isChatOpen) {
        if (window.petAPI) window.petAPI.toggleFocus(true);
        if (chatInput) chatInput.focus();
    } else {
        if (window.petAPI) window.petAPI.toggleFocus(false);
    }
}

if (chatClose) chatClose.addEventListener('click', toggleChat);
if (btnMin) btnMin.addEventListener('click', () => window.petAPI && window.petAPI.minimizeWindow());
if (btnMax) btnMax.addEventListener('click', () => {
    if (!chatContainer) return;
    chatContainer.classList.toggle('fullscreen');
    btnMax.innerHTML = chatContainer.classList.contains('fullscreen') ? '🗗' : '⛶';
});

if (chatMuteBtn) {
    chatMuteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        chatMuteBtn.innerHTML = isMuted ? '🔇' : '🔊';
        if (isMuted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    });
}

if (chatSettingsBtn) {
    chatSettingsBtn.addEventListener('click', async () => {
        if (!window.petAPI) return;
        const settings = await window.petAPI.getSettings();
        if (setUserName) setUserName.value = settings.userName;
        if (setPetName) setPetName.value = settings.petName;
        if (setModel) setModel.value = settings.model;
        if (settingsModal) settingsModal.style.display = 'block';
    });
}

if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => { if (settingsModal) settingsModal.style.display = 'none'; });

if (btnSaveSettings) btnSaveSettings.addEventListener('click', () => {
    if (!window.petAPI) return;
    window.petAPI.saveSettings({ userName: setUserName.value, petName: setPetName.value, model: setModel.value });
    if (settingsModal) settingsModal.style.display = 'none';
});

if (btnDownloadModel) btnDownloadModel.addEventListener('click', () => {
    if (!window.petAPI) return;
    window.petAPI.downloadModel(setModel.value);
});

if (btnUninstallModel) btnUninstallModel.addEventListener('click', () => {
    if (!window.petAPI) return;
    window.petAPI.uninstallModel(setModel.value);
});

if (window.petAPI) window.petAPI.onDownloadProgress((data) => {
    if (downloadStatus) downloadStatus.textContent = `Status: ${data.status}`;
    if (downloadBar) downloadBar.style.width = `${data.percent}%`;
    if (data.percent === 100 && downloadStatus) {
        downloadStatus.textContent = "Status: Complete!";
        downloadStatus.style.color = "#4ade80";
    }
});

if (chatSend) chatSend.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessageToUI(userName, text, true);
    chatInput.value = '';
    if (window.petAPI) window.petAPI.sendChatMessage(text);
});

if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatSend) chatSend.click();
});

function formatMessage(text) {
    const codeRegex = /```(?:[a-z]+)?\n([\s\S]*?)```/g;
    let formatted = text.replace(codeRegex, (match, code) => {
        return `<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code><button class="copy-btn" data-code="${encodeURIComponent(code)}">📋 Copy Code</button></pre>`;
    });
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return formatted.replace(/\n/g, '<br>');
}

function addMessageToUI(sender, text, isUser) {
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isUser ? 'user' : 'pet'}`;
    if (isUser) {
        msgDiv.innerHTML = `<strong>${sender}:</strong><br>${text}`;
    } else {
        msgDiv.innerHTML = `<strong>${sender}:</strong><br>${formatMessage(text)}`;
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) {
        const codeText = decodeURIComponent(e.target.getAttribute('data-code'));
        if (window.petAPI) window.petAPI.copyCode(codeText);
        e.target.textContent = '✅ Copied!';
        setTimeout(() => { e.target.textContent = '📋 Copy Code'; }, 2000);
    }
});

if (window.petAPI) window.petAPI.onChatResponse((response) => {
    addMessageToUI(petName, response, false);
});

if (window.petAPI) window.petAPI.onCommand((cmd) => {
    if (cmd === 'stay') { isStaying = true; targetX = petX; targetY = petY; velX = 0; velY = 0; }
    else if (cmd === 'follow') { isStaying = false; lastMouseMoveTime = Date.now(); }
    else if (cmd === 'chat') { toggleChat(); }
});

if (window.petAPI) window.petAPI.onSpeak((text) => {
    if (speechBubble) {
        speechBubble.style.display = 'block';
        speechBubble.textContent = text;
        speechBubble.style.left = `${petX}px`;
        speechBubble.style.top = `${petY - 100}px`;
        clearTimeout(speechTimeout);
        speechTimeout = setTimeout(() => { speechBubble.style.display = 'none'; }, 4000);
    }

    playSound(petSound);

    if (!isMuted && 'speechSynthesis' in window && text.trim() !== "") {
        if (isSpeaking) window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        if (currentPet === 'parrot') { utterance.pitch = 2.0; utterance.rate = 1.8; }
        else if (currentPet === 'dragonfly') { utterance.pitch = 2.0; utterance.rate = 1.6; }
        else if (currentPet === 'cat') { utterance.pitch = 2.0; utterance.rate = 1.3; }
        else if (currentPet === 'dog') { utterance.pitch = 1.2; utterance.rate = 1.1; }
        else if (currentPet === 'dragon') { utterance.pitch = 0.1; utterance.rate = 0.6; }
        else { utterance.pitch = 1.5; utterance.rate = 1.0; }

        utterance.volume = 1.0;
        utterance.onstart = () => { isSpeaking = true; };
        utterance.onend = () => { isSpeaking = false; };
        window.speechSynthesis.speak(utterance);
    }
});

if (window.petAPI) window.petAPI.onSetName(() => {
    isEditingUser = false;
    window.petAPI.toggleFocus(true);
    if (document.querySelector('#name-box h3')) document.querySelector('#name-box h3').textContent = "Name your pet:";
    if (nameInput) nameInput.value = petName;
    if (nameBox) nameBox.style.display = 'block';
    if (nameInput) nameInput.focus();
});

if (window.petAPI) window.petAPI.onSetUserName(() => {
    isEditingUser = true;
    window.petAPI.toggleFocus(true);
    if (document.querySelector('#name-box h3')) document.querySelector('#name-box h3').textContent = "What is your name?";
    if (nameInput) nameInput.value = userName;
    if (nameBox) nameBox.style.display = 'block';
    if (nameInput) nameInput.focus();
});

if (saveNameBtn) saveNameBtn.onclick = () => {
    const newName = nameInput.value.trim();
    if (!newName) return;

    if (isEditingUser) {
        userName = newName;
        localStorage.setItem('userName', userName);
        if (window.petAPI) window.petAPI.setUserName(userName);
    } else {
        petName = newName;
        localStorage.setItem('petName', petName);
        if (window.petAPI) window.petAPI.setPetName(petName);
    }

    if (nameBox) nameBox.style.display = 'none';
    setTimeout(() => { if (window.petAPI) window.petAPI.toggleFocus(false); }, 100);
};

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    lastMouseMoveTime = Date.now();
    isResting = false;

    if (isDragging) {
        petX = e.clientX; petY = e.clientY; velX = 0; velY = 0; targetX = petX; targetY = petY;
        return;
    }

    if (!isStaying && !isChatOpen) {
        const distToMouse = Math.hypot(e.clientX - petX, e.clientY - petY);
        if (distToMouse > 150) { targetX = e.clientX; targetY = e.clientY; }
        else { targetX = petX; targetY = petY; velX *= 0.5; velY *= 0.5; }
    }

    const petRect = petContainer.getBoundingClientRect();
    const isHoveringPet = (e.clientX >= petRect.left && e.clientX <= petRect.right && e.clientY >= petRect.top && e.clientY <= petRect.bottom);
    let isHoveringChat = false;
    if (isChatOpen && chatContainer) {
        const chatRect = chatContainer.getBoundingClientRect();
        isHoveringChat = (e.clientX >= chatRect.left && e.clientX <= chatRect.right && e.clientY >= chatRect.top && e.clientY <= chatRect.bottom);
    }
    let isHoveringSettings = false;
    if (settingsModal && settingsModal.style.display === 'block') {
        const settingsRect = settingsModal.getBoundingClientRect();
        isHoveringSettings = (e.clientX >= settingsRect.left && e.clientX <= settingsRect.right && e.clientY >= settingsRect.top && e.clientY <= settingsRect.bottom);
    }

    const isHovering = isHoveringPet || isHoveringChat || isHoveringSettings;
    if (isHovering !== wasHovering) {
        if (window.petAPI) window.petAPI.sendHitRegion({ active: isHovering });
        wasHovering = isHovering;
    }
});

window.addEventListener('mousedown', (e) => {
    const petRect = petContainer.getBoundingClientRect();
    const isHoveringPet = (e.clientX >= petRect.left && e.clientX <= petRect.right && e.clientY >= petRect.top && e.clientY <= petRect.bottom);
    if (!isHoveringPet) return;

    if (e.button === 2) { if (window.petAPI) window.petAPI.showPetMenu(); }
    else if (e.button === 0) { playSound(petSound); isDragging = true; }
});

window.addEventListener('mouseup', () => {
    if (isDragging) { isDragging = false; targetX = petX; targetY = petY; }
});

function animate() {
    requestAnimationFrame(animate);
    if (isDragging || isChatOpen) {
        if (petContainer) {
            petContainer.style.left = `${petX - 90}px`;
            petContainer.style.top = `${petY - 90}px`;
        }
        return;
    }

    const dx = targetX - petX;
    const dy = targetY - petY;
    const distance = Math.hypot(dx, dy);

    if (dx > 5 && !isFacingRight) { isFacingRight = true; if (petContainer) petContainer.style.transform = `scaleX(${1 * faceMultiplier})`; }
    else if (dx < -5 && isFacingRight) { isFacingRight = false; if (petContainer) petContainer.style.transform = `scaleX(${-1 * faceMultiplier})`; }

    const timeSinceMove = Date.now() - lastMouseMoveTime;
    if (!isStaying && timeSinceMove > 4000) {
        if (!isResting && distance < 30) { isResting = true; wanderCooldown = Date.now() + 3000; }
        else if (isResting && Date.now() > wanderCooldown) {
            isResting = false;
            targetX = Math.random() * (window.innerWidth - 200) + 100;
            targetY = Math.random() * (window.innerHeight - 200) + 100;
        }
    }

    if (distance > 30 && !isResting && !isStaying) { velX += dx * 0.0008; velY += dy * 0.0008; }
    else { velX *= 0.6; velY *= 0.6; }

    velX *= 0.90; velY *= 0.90;
    const maxSpeed = 2.5;
    if (velX > maxSpeed) velX = maxSpeed;
    if (velX < -maxSpeed) velX = -maxSpeed;
    if (velY > maxSpeed) velY = maxSpeed;
    if (velY < -maxSpeed) velY = -maxSpeed;

    petX += velX; petY += velY;

    const speed = Math.hypot(velX, velY);
    let bob = speed > 0.2 ? Math.abs(Math.sin(Date.now() * 0.004)) * 3 : 0;

    if (petContainer) {
        petContainer.style.left = `${petX - 90}px`;
        petContainer.style.top = `${petY - 90 - bob}px`;
    }

    if (speechBubble && speechBubble.style.display === 'block') {
        speechBubble.style.left = `${petX}px`;
        speechBubble.style.top = `${petY - 100 - bob}px`;
    }
}

const creditLink = document.getElementById('credit-link');
if (creditLink) {
    creditLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.petAPI) window.petAPI.openExternal('https://github.com/iamthearafatkhan');
    });
}

animate();