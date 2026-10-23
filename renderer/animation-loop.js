let idleFrames = 0;
const IDLE_THRESHOLD = 120; // ~2 seconds at 60fps

export function createLoop(renderer, scene, camera, onFrame) {
    let lastTime = 0;
    let frameCount = 0;

    function animate(time) {
        requestAnimationFrame(animate);
        const delta = time - lastTime;
        lastTime = time;

        // Idle throttling: skip alternate frames when nothing is happening
        if (idleFrames > IDLE_THRESHOLD && frameCount % 2 !== 0) {
            frameCount++;
            return;
        }
        frameCount++;

        onFrame(delta);
        renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);

    return {
        markActive: () => { idleFrames = 0; },
        markIdle: () => { idleFrames++; },
    };
}