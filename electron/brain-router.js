const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getSelectedModel() {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return data.model || 'qwen:latest';
    } catch {
        return 'qwen:latest';
    }
}

async function askBrain(userText, targetPath, petName, userName, chatHistory) {
    const selectedModel = getSelectedModel();

    let messages = [
        {
            role: "system",
            content: `You are a helpful desktop pet named "${petName}". 
            Your owner's name is "${userName}". 
            CRITICAL RULES:
            1. You are talking to "${userName}". If asked "what is my name?", you MUST answer "${userName}". Do not say your name is "${userName}". Your name is "${petName}".
            2. If asked to open a file, reply exactly with {"action": "open"}.
            3. If asked to delete a file, reply exactly with {"action": "delete"}.
            4. For everything else, answer naturally and keep your answers relatively short since you are a desktop pet.
            5. If asked for code, write clean, efficient, and bug-free code. Provide the ENTIRE complete code in standard markdown blocks.`
        }
    ];

    chatHistory.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
    });

    messages.push({ role: "user", content: userText });

    try {
        const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: false,
                options: {
                    num_ctx: 8192,
                    num_predict: 4096,
                    temperature: 0.3
                }
            })
        });

        const data = await res.json();
        let reply = data.message.content;

        if (reply.includes('{"action": "open"}')) return { action: "open", text: "Opening..." };
        if (reply.includes('{"action": "delete"}')) return { action: "delete", text: "Deleting..." };

        return { action: "speak", text: reply };

    } catch (e) {
        return { action: "speak", text: "My brain is offline. Make sure Ollama is running." };
    }
}

module.exports = { askBrain };