export function playSound(type) {
    let soundFile = 'meow.mp3';

    if (type === 'bark') soundFile = 'bark.mp3';
    if (type === 'roar') soundFile = 'roar.mp3';
    if (type === 'chirp') soundFile = 'chirp.mp3';

    const audio = new Audio(`./assets/sounds/${soundFile}`);
    audio.volume = 0.4; // Keep it at 40% volume so it's not annoying
    audio.play().catch(e => console.log("Click the screen first to allow audio:", e));
}