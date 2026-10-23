// electron/brain-setup.js
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function ensureModel(modelName) {
    try {
        const { stdout } = await execAsync('ollama list');
        if (stdout.includes(modelName)) return; // already installed

        // Not installed: pull silently
        await execAsync(`ollama pull ${modelName}`, {
            maxBuffer: 10 * 1024 * 1024,
        });
    } catch (err) {
        console.error('Brain setup failed:', err);
        // Fallback: show a small dialog telling the user to install Ollama
    }
}

// In your app startup:
// Low-end:  ensureModel('hf.co/unlimitedpipe/decide-0.5b-GGUF:latest')
// High-end: ensureModel('qwen:latest')