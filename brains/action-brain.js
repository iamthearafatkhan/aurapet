// Sends state to a tiny 0.5B model and expects an action JSON back.
export async function decideAction(state, ollamaEndpoint = 'http://localhost:11434') {
    const prompt = `
You are the action policy for a desktop pet. Return ONLY valid JSON.
Allowed actions: open, delete, speak, animate, ignore.
State: ${JSON.stringify(state)}
Rules:
- If the user says "delete this" and a path is selected, return {"action":"delete","path":"..."}.
- If the user asks to open a folder, return {"action":"open","path":"..."}.
- If the user is just moving the cursor, return {"action":"animate","clip":"look_at"}.
- Never delete system folders. If unsure, return {"action":"speak","text":"I need confirmation."}.
`;

    const res = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'unlimitedpipe/decide-0.5b', // ~531 MB, low-end friendly
            prompt,
            stream: false,
            format: 'json',
        }),
    });

    const data = await res.json();
    return JSON.parse(data.response);
}