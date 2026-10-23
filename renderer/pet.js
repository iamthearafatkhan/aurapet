import { playSound } from './sound.js';

const $ = (id) => document.getElementById(id);
const urlParams = new URLSearchParams(window.location.search);
const viewMode = urlParams.get('view') || 'pet';

const petContainer = $('pet-container');
const animContainer = $('lottie-animation');
const speechBubble = $('speech-bubble');
const chatContainer = $('chat-container');
const chatMessages = $('chat-messages');
const chatInput = $('chat-input');
const chatSend = $('chat-send');
const chatClose = $('chat-close');
const btnMin = $('chat-min');
const btnMax = $('chat-max');
const btnFile = $('chat-file');
const chatSettingsBtn = $('chat-settings');
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
let userName = localStorage.getItem('userName') || 'Arafat';
let faceMultiplier = -1;

let petX = window.innerWidth / 2;
let petY = window.innerHeight / 2;
let velX = 0; let velY = 0;
let targetX = petX; let targetY = petY;
let mouseX = petX; let mouseY = petY;
let lastMouseX = mouseX;   // last known *reported* position (for movement detection)
let lastMouseY = mouseY;

let isFacingRight = true;
let isDragging = false;
let wasHovering = false;
let isStaying = false;
let lastMouseMoveTime = Date.now();
let wanderCooldown = 0;
let isResting = false;
let speechTimeout;

// Animation feel-state
let squash = 1;
let bounceY = 0;
let bounceVel = 0;
let lastSpeed = 0;

// ------------------------------------------------------------------
// CHAT VIEW
// ------------------------------------------------------------------
if (viewMode === 'chat') {
    document.body.style.background = '#212529';
    petContainer.style.display = 'none';
    speechBubble.style.display = 'none';
    chatContainer.style.display = 'flex';

    btnMin.addEventListener('click', () => window.petAPI.minimizeChat());
    chatClose.addEventListener('click', () => window.petAPI.closeChat());
    btnMax.addEventListener('click', () => window.petAPI.toggleFullscreenChat());
    btnFile.addEventListener('click', () => window.petAPI.openFileDialog());

    chatSend.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (!text) return;
        addMessageToUI(userName, text, true);
        chatInput.value = '';
        window.petAPI.sendChatMessage(text);
    });
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') chatSend.click(); });

    window.petAPI.onChatResponse((res) => addMessageToUI(petName, res, false));
    window.petAPI.onFileSelected((path) => {
        const safePath = path.replace(/\\/g, '/');
        const imgHtml = `<img src="file:///${safePath}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;" />`;
        addMessageToUI('System', `Attached file:<br>${imgHtml}`, true);
        window.petAPI.sendChatMessage(`[User attached an image: ${path.split('\\').pop()}]`);
    });

    chatSettingsBtn.addEventListener('click', async () => {
        const settings = await window.petAPI.getSettings();
        setUserName.value = settings.userName;
        setPetName.value = settings.petName;
        setModel.value = settings.model;
        settingsModal.style.display = 'block';
    });
    btnCloseSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });
    btnSaveSettings.addEventListener('click', () => {
        window.petAPI.saveSettings({ userName: setUserName.value, petName: setPetName.value, model: setModel.value });
        userName = setUserName.value;
        petName = setPetName.value;
        settingsModal.style.display = 'none';
    });
    btnDownloadModel.addEventListener('click', () => window.petAPI.downloadModel(setModel.value));
    btnUninstallModel.addEventListener('click', () => window.petAPI.uninstallModel(setModel.value));
    window.petAPI.onDownloadProgress((data) => {
        downloadStatus.textContent = `Status: ${data.status}`;
        downloadBar.style.width = `${data.percent}%`;
        if (data.percent === 100) downloadStatus.style.color = '#4ade80';
    });

    const creditLink = document.getElementById('credit-link');
    if (creditLink) {
        creditLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.petAPI.openExternal('https://github.com/iamthearafatkhan');
        });
    }

    // ------------------------------------------------------------------
    // PET VIEW
    // ------------------------------------------------------------------
} else {
    document.body.style.background = 'transparent';
    chatContainer.style.display = 'none';

    window.petAPI.getSettings().then(settings => {
        if (settings.petType) loadPet(settings.petType);
        if (settings.petName) petName = settings.petName;
        if (settings.userName) userName = settings.userName;
    });

    window.petAPI.onSwitchPet((type) => loadPet(type));
    window.petAPI.onCommand((cmd) => {
        if (cmd === 'stay') {
            isStaying = true;
            targetX = petX; targetY = petY;
            velX = 0; velY = 0;
        } else if (cmd === 'follow') {
            isStaying = false;
            lastMouseMoveTime = Date.now();
        }
    });

    window.petAPI.onSpeak((text) => {
        if (speechBubble) {
            speechBubble.style.display = 'block';
            speechBubble.textContent = text;
            speechBubble.style.left = `${petX}px`;
            speechBubble.style.top = `${petY - 100}px`;
            clearTimeout(speechTimeout);
            speechTimeout = setTimeout(() => { speechBubble.style.display = 'none'; }, 4000);
        }
        playSound(petSound);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.pitch = currentPet === 'parrot' ? 2.0 : currentPet === 'dragon' ? 0.1 : 1.5;
            window.speechSynthesis.speak(utterance);
        }
    });

    // ------------------------------------------------------------------
    // POLLING HANDLER — this is where the two bug fixes live
    // ------------------------------------------------------------------
    window.petAPI.onGlobalMouseMove((data) => {
        // Detect *real* movement (not the 60 fps idle heartbeat)
        const movedX = Math.abs(data.x - lastMouseX) > 1;
        const movedY = Math.abs(data.y - lastMouseY) > 1;
        const moved = movedX || movedY;

        if (moved) {
            lastMouseX = data.x;
            lastMouseY = data.y;
            lastMouseMoveTime = Date.now();
            isResting = false;
        }

        mouseX = data.x;
        mouseY = data.y;

        // FIX 2: hit-region detection from polling (reliable) instead of
        // relying on forwarded local mousemove events.
        if (isDragging) {
            if (!wasHovering) {
                window.petAPI.sendHitRegion({ active: true });
                wasHovering = true;
            }
            return; // local mousemove drives the drag position
        }

        const petRect = petContainer.getBoundingClientRect();
        const isOverPet =
            data.x >= petRect.left && data.x <= petRect.right &&
            data.y >= petRect.top && data.y <= petRect.bottom;

        if (isOverPet !== wasHovering) {
            window.petAPI.sendHitRegion({ active: isOverPet });
            wasHovering = isOverPet;
        }
    });

    // Local mousemove only handles the drag (smoother than the poll interval)
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            petX = e.clientX;
            petY = e.clientY;
            targetX = petX;
            targetY = petY;
            petContainer.style.left = `${petX - 90}px`;
            petContainer.style.top = `${petY - 90}px`;
        }
    });

    window.addEventListener('mousedown', (e) => {
        const petRect = petContainer.getBoundingClientRect();
        const isHoveringPet =
            e.clientX >= petRect.left && e.clientX <= petRect.right &&
            e.clientY >= petRect.top && e.clientY <= petRect.bottom;
        if (!isHoveringPet) return;

        if (e.button === 2) {
            window.petAPI.showPetMenu();
        } else if (e.button === 0) {
            playSound(petSound);
            bounceVel = -3.5;
            isDragging = true;
            lastMouseMoveTime = Date.now();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            targetX = petX; targetY = petY;
        }
    });

    // ------------------------------------------------------------------
    // ANIMATION LOOP
    // ------------------------------------------------------------------
    function animate() {
        if (isDragging) {
            petContainer.style.left = `${petX - 90}px`;
            petContainer.style.top = `${petY - 90}px`;
            const sxDrag = (isFacingRight ? 1 : -1) * faceMultiplier;
            petContainer.style.transform = `scaleX(${sxDrag}) scale(1.08)`;
            if (speechBubble.style.display === 'block') {
                speechBubble.style.left = `${petX}px`;
                speechBubble.style.top = `${petY - 100}px`;
            }
            return;
        }

        const now = Date.now();
        const timeSinceMove = now - lastMouseMoveTime;

        // ---- FIX 1: IDLE WANDER (mouse branch only when active) ----
        if (!isStaying) {
            if (timeSinceMove > 5000) {
                // Idle: ignore cursor entirely, wander around the screen
                if (!isResting) {
                    isResting = true;
                    wanderCooldown = now + 2000; // pause 2 s before first wander
                } else if (now > wanderCooldown) {
                    // Pick a random target anywhere on screen
                    targetX = Math.random() * (window.innerWidth - 200) + 100;
                    targetY = Math.random() * (window.innerHeight - 200) + 100;
                    wanderCooldown = now + 4000 + Math.random() * 4000;
                }
            } else {
                // Active: follow the cursor
                isResting = false;
                const distToMouse = Math.hypot(mouseX - petX, mouseY - petY);
                if (distToMouse > 55) {
                    targetX = mouseX;
                    targetY = mouseY;
                } else {
                    targetX = petX;
                    targetY = petY;
                }
            }
        }

        // ---- SPRING PHYSICS ----
        const dx = targetX - petX;
        const dy = targetY - petY;
        const distance = Math.hypot(dx, dy);

        if (distance > 8) {
            const force = Math.min(distance * 0.0025, 0.7);
            velX += (dx / distance) * force;
            velY += (dy / distance) * force;
        }
        velX *= 0.88;
        velY *= 0.88;

        const speed = Math.hypot(velX, velY);
        const maxSpeed = 4.2;
        if (speed > maxSpeed) {
            velX = (velX / speed) * maxSpeed;
            velY = (velY / speed) * maxSpeed;
        }

        petX += velX;
        petY += velY;
        petX = Math.max(50, Math.min(window.innerWidth - 50, petX));
        petY = Math.max(50, Math.min(window.innerHeight - 50, petY));

        // ---- BOUNCE ON STOP ----
        if (speed < 0.4 && lastSpeed > 1.8) bounceVel = -2.8;
        lastSpeed = speed;
        bounceVel += 0.45;
        bounceY += bounceVel;
        if (bounceY > 0) { bounceY = 0; bounceVel = 0; }

        // ---- FACING ----
        if (Math.abs(velX) > 0.25) {
            const wantRight = velX > 0;
            if (wantRight !== isFacingRight) isFacingRight = wantRight;
        } else if (!isStaying && !isResting) {
            const dxM = mouseX - petX;
            if (Math.abs(dxM) > 15) {
                const wantRight = dxM > 0;
                if (wantRight !== isFacingRight) isFacingRight = wantRight;
            }
        }

        // ---- SQUASH & STRETCH ----
        const targetSquash = 1 + Math.min(Math.abs(velX) * 0.03 + Math.abs(bounceVel) * 0.02, 0.15);
        squash += (targetSquash - squash) * 0.2;

        // ---- BOB ----
        const intensity = Math.min(speed / maxSpeed, 1);
        const bob = Math.abs(Math.sin(now * 0.012)) * 6 * intensity;

        // ---- APPLY ----
        const sx = (isFacingRight ? 1 : -1) * faceMultiplier;
        petContainer.style.transform = `scaleX(${sx}) scaleY(${squash})`;
        petContainer.style.left = `${petX - 90}px`;
        petContainer.style.top = `${petY - 90 - bob + bounceY}px`;

        if (speechBubble.style.display === 'block') {
            speechBubble.style.left = `${petX}px`;
            speechBubble.style.top = `${petY - 100 - bob + bounceY}px`;
        }
    }

    setInterval(animate, 16);
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------
function loadPet(petType) {
    currentPet = petType;
    if (lottieAnim) lottieAnim.destroy();
    if (petType === 'cat') { petSound = 'meow'; faceMultiplier = 1; }
    if (petType === 'dog') { petSound = 'bark'; faceMultiplier = -1; }
    if (petType === 'dragon') { petSound = 'roar'; faceMultiplier = -1; }
    if (petType === 'parrot') { petSound = 'chirp'; faceMultiplier = -1; }
    if (petType === 'dragonfly') { petSound = 'chirp'; faceMultiplier = 1; }

    isFacingRight = true;
    petContainer.style.transform = `scaleX(${1 * faceMultiplier})`;

    if (window.lottie && animContainer) {
        lottieAnim = window.lottie.loadAnimation({
            container: animContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: `./assets/animations/${petType}.json`
        });
    }
}

function addMessageToUI(sender, text, isUser) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isUser ? 'user' : 'pet'}`;
    msgDiv.innerHTML = `<strong>${sender}:</strong><br>${isUser ? text : formatMessage(text)}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(text) {
    const codeRegex = /```(?:[a-z]+)?\n([\s\S]*?)```/g;
    const formatted = text.replace(codeRegex, (match, code) =>
        `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code><button class="copy-btn" onclick="navigator.clipboard.writeText('${code.replace(/'/g, "\\'")}')">📋 Copy</button></pre>`
    );
    return formatted.replace(/\n/g, '<br>');
}