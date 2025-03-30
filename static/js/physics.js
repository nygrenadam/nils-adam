// static/js/js.js

// --- Base Font Settings ---
const BASE_WEIGHT = 300; // Corresponds to 'wght' in CSS (Range: 100-1000)
const BASE_WIDTH = 125   ;  // Corresponds to 'wdth' in CSS (Range: 75-125)
const BASE_SLANT = 0;    // Corresponds to 'slnt' in CSS (Range: -10-10 typical)

// --- Simplified Physics Parameters ---
// Tuned for smoother collisions & spacing
const RETURN_FORCE = 0.035;     // How strongly letters return to home
const DRAG_FACTOR = 0.12;       // Velocity remaining per frame (e.g., 0.95 = 5% drag) - Higher = less drag
const BOUNCINESS = 0.8;         // Lowered bounciness for less jitter with spacing force
const MOUSE_FORCE = 3.5;        // Multiplier for mouse velocity impulse (when NOT charging)
const MOUSE_RADIUS = 125;       // Pixels: Distance within which the mouse affects letters
const MOUSE_ATTRACTION_STRENGTH = 2000; // How strongly letters are pulled to cursor while charging (higher = stronger)
const MAX_SPEED = 350;           // Increased speed limit slightly for more visible effect
const MIN_LETTER_SPACING = 15;   // Minimum desired pixels between letter *edges*
const SPACING_FORCE_STRENGTH = 0.02; // How strongly letters push apart below min spacing (adjust as needed)

// --- Shockwave Parameters ---
const SHOCKWAVE_MIN_STRENGTH = 100;  // Minimum strength when clicked briefly
const SHOCKWAVE_MAX_STRENGTH = 4000000; // Maximum strength after full charge duration
const SHOCKWAVE_CHARGE_DURATION_CAP = 32; // Max seconds to hold for full charge
const SHOCKWAVE_SPEED = 500;     // Speed at which the shockwave radius expands (pixels per second)
const SHOCKWAVE_DURATION = 32.0; // How long the shockwave force lasts on a letter (seconds) - affects thickness perception
const SHOCKWAVE_FALLOFF = 0.95;   // How quickly the shockwave strength diminishes with distance (higher = faster falloff)
const SHOCKWAVE_EFFECT_RADIUS = 100; // Thickness of the wave front (pixels).

// --- Appearance Parameters ---
const WEIGHT_SPEED_FACTOR = 15;    // How much weight changes with speed
const WIDTH_SPEED_FACTOR = 50;     // How much width changes with speed
const SLANT_VELOCITY_FACTOR = 1.5; // How much slant changes with horizontal velocity
const VAR_FONT_SMOOTHING = 0.98;    // Smoothing for visual font changes (0-1, Lower = smoother/slower)
const SQUASH_STRETCH_FACTOR = 15; // How much letters squash/stretch with speed (Reduced)
const SCALE_SMOOTHING = 0.98;       // Smoothing for squash/stretch effect (0-1, Lower = smoother/slower)
const ROTATION_FACTOR = 33;        // How much letters rotate based on horizontal velocity
const ROTATION_SMOOTHING = 0.98;   // Smoothing for rotation (0-1, Lower = smoother/slower rotation changes)

// --- Random Oscillation Parameters ---
const WEIGHT_OSCILLATION_RANGE = 100;
const WIDTH_OSCILLATION_RANGE = 75;
const SLANT_OSCILLATION_RANGE = 0;
const FONT_OSCILLATION_SPEED = 0.0003;
const SCALE_OSCILLATION_RANGE = 0.4;
const SCALE_OSCILLATION_SPEED = FONT_OSCILLATION_SPEED * 1.61803398875;

// --- Font Axis Ranges (Important for clamping) ---
const MIN_WEIGHT = 100;
const MAX_WEIGHT = 1000;
const MIN_WIDTH = 25;
const MAX_WIDTH = 151;
const MIN_SLANT = -10;
const MAX_SLANT = 0;

// --- Scale Clamping ---
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.4;

// --- Debug Settings ---
const DEBUG_MAX_SPEED_COLOR = MAX_SPEED * 0.03; // Speed at which color becomes fully red in debug mode
const DEBUG_SHOCKWAVE_COLOR = "rgba(0, 150, 255, 0.8)"; // Color for shockwave visualization (Increased opacity)
const DEBUG_SHOCKWAVE_LINEWIDTH = 3; // Line width for shockwave visualization

// --- Global State ---
const letters = document.querySelectorAll('.letter');
const container = document.querySelector('.title-wrapper');
let letterStates = [];
let animationFrameId = null;
let isDebugMode = false; // Debug mode flag
let activeShockwaves = []; // Array to store active shockwaves
let lastFrameTime = performance.now(); // For calculating deltaTime

// --- Debug Canvas State ---
let debugCanvas = null;
let debugCtx = null;

// --- Mouse State ---
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let prevMouseX = mouseX;
let prevMouseY = mouseY;
let mouseVX = 0;
let mouseVY = 0;
let isMouseDown = false;        // NEW: Track if mouse button is down
let mouseDownStartTime = 0;     // NEW: Time when mouse was pressed
let mouseDownX = 0;             // NEW: Viewport X where mouse was pressed
let mouseDownY = 0;             // NEW: Viewport Y where mouse was pressed

// --- Container Offset ---
let containerOffsetX = 0;
let containerOffsetY = 0;

function updateContainerOffset() {
    if (container) {
        const rect = container.getBoundingClientRect();
        containerOffsetX = rect.left;
        containerOffsetY = rect.top;
    } else {
        containerOffsetX = 0;
        containerOffsetY = 0;
    }
}

function initializeLetters() {
    // Unchanged except for calling updateContainerOffset
    letterStates = [];
    if (!container) { console.error("..."); return; }
    updateContainerOffset();
    const containerRect = container.getBoundingClientRect();
    debugCanvas = document.getElementById('debug-canvas');
    if (debugCanvas) {
        debugCtx = debugCanvas.getContext('2d');
        debugCanvas.width = window.innerWidth;
        debugCanvas.height = window.innerHeight;
        console.log("Debug canvas initialized.");
    } else { console.warn("..."); debugCtx = null; }

    letters.forEach((letter, index) => {
        const rect = letter.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) { console.warn("..."); return; }
        const homeX = rect.left - containerOffsetX + rect.width / 2;
        const homeY = rect.top - containerOffsetY + rect.height / 2;
        letterStates.push({
            el: letter, homeX, homeY, x: homeX, y: homeY, vx: 0, vy: 0,
            width: rect.width, height: rect.height, scaleX: 1, scaleY: 1,
            physicsTargetScaleX: 1, physicsTargetScaleY: 1,
            wght: BASE_WEIGHT, wdth: BASE_WIDTH, slnt: BASE_SLANT,
            physicsTargetWght: BASE_WEIGHT, physicsTargetWdth: BASE_WIDTH, physicsTargetSlnt: BASE_SLANT,
            currentRotation: 0, oscillationPhaseWght: Math.random() * Math.PI * 2,
            oscillationPhaseWdth: Math.random() * Math.PI * 2, oscillationPhaseSlnt: Math.random() * Math.PI * 2,
            oscillationPhaseScaleX: Math.random() * Math.PI * 2, oscillationPhaseScaleY: Math.random() * Math.PI * 2 * 1.61803398875,
            wasInDebugMode: false,
        });
        const state = letterStates[letterStates.length - 1];
        const initialTranslateX = state.x - state.homeX;
        const initialTranslateY = state.y - state.homeY;
        state.el.style.transform = `translate(${initialTranslateX}px, ${initialTranslateY}px) rotate(0deg) scale(1, 1)`;
        state.el.style.fontVariationSettings = `"wght" ${state.wght}, "wdth" ${state.wdth}, "slnt" ${state.slnt}`;
        state.el.style.removeProperty('background-color'); state.el.style.removeProperty('border');
        state.el.style.removeProperty('color'); state.el.style.removeProperty('box-sizing');
    });
    console.log("Letters initialized:", letterStates.length, "active.");
    lastFrameTime = performance.now();
    if (!animationFrameId && letterStates.length > 0) { console.log("Starting animation."); updateLetters(); }
    else if (letterStates.length === 0) { console.log("No letters initialized."); }
}

// --- Spacing Force ---
function applySpacingForce() {
    // Unchanged
    for (let i = 0; i < letterStates.length; i++) {
        for (let j = i + 1; j < letterStates.length; j++) {
            const stateA = letterStates[i]; const stateB = letterStates[j];
            if (!stateA || !stateB) continue;
            const dx = stateB.x - stateA.x; const dy = stateB.y - stateA.y;
            const distSq = dx * dx + dy * dy;
            const effHalfWidthA = (stateA.width * stateA.scaleX) / 2; const effHalfWidthB = (stateB.width * stateB.scaleX) / 2;
            const targetDist = effHalfWidthA + effHalfWidthB + MIN_LETTER_SPACING; const targetDistSq = targetDist * targetDist;
            if (distSq < targetDistSq && distSq > 0.001) {
                const dist = Math.sqrt(distSq); const penetration = targetDist - dist;
                const forceMagnitude = penetration * SPACING_FORCE_STRENGTH;
                const forceDirX = dx / dist; const forceDirY = dy / dist;
                stateA.vx -= forceDirX * forceMagnitude * 0.5; stateA.vy -= forceDirY * forceMagnitude * 0.5;
                stateB.vx += forceDirX * forceMagnitude * 0.5; stateB.vy += forceDirY * forceMagnitude * 0.5;
            }
        }
    }
}


// --- Collision Detection and Resolution ---
function checkCollisions() {
    // Unchanged
    const collisionIterations = 8;
    for (let iter = 0; iter < collisionIterations; iter++) {
        for (let i = 0; i < letterStates.length; i++) {
            for (let j = i + 1; j < letterStates.length; j++) {
                const stateA = letterStates[i]; const stateB = letterStates[j];
                if (!stateA || !stateB) continue;
                const effWidthA = stateA.width * stateA.scaleX; const effHeightA = stateA.height * stateA.scaleY;
                const effWidthB = stateB.width * stateB.scaleX; const effHeightB = stateB.height * stateB.scaleY;
                const halfWidthA = effWidthA / 2; const halfHeightA = effHeightA / 2;
                const halfWidthB = effWidthB / 2; const halfHeightB = effHeightB / 2;
                const dx = stateB.x - stateA.x; const dy = stateB.y - stateA.y;
                const combinedHalfWidths = halfWidthA + halfWidthB; const combinedHalfHeights = halfHeightA + halfHeightB;
                if (Math.abs(dx) < combinedHalfWidths && Math.abs(dy) < combinedHalfHeights) {
                    const overlapX = combinedHalfWidths - Math.abs(dx); const overlapY = combinedHalfHeights - Math.abs(dy);
                    let sepAxisX = 0, sepAxisY = 0; const penetrationFactor = 0.5;
                    if (overlapX < overlapY) {
                        sepAxisX = dx > 0 ? 1 : -1; const separationAmount = (overlapX / collisionIterations) * penetrationFactor;
                        stateA.x -= sepAxisX * separationAmount; stateB.x += sepAxisX * separationAmount;
                    } else {
                        sepAxisY = dy > 0 ? 1 : -1; const separationAmount = (overlapY / collisionIterations) * penetrationFactor;
                        stateA.y -= sepAxisY * separationAmount; stateB.y += sepAxisY * separationAmount;
                    }
                    const rvX = stateB.vx - stateA.vx; const rvY = stateB.vy - stateA.vy;
                    let normalX = 0, normalY = 0;
                    if (sepAxisX !== 0) { normalX = sepAxisX; } else if (sepAxisY !== 0) { normalY = sepAxisY; } else { continue; }
                    const velAlongNormal = rvX * normalX + rvY * normalY; if (velAlongNormal > 0) continue;
                    const impulseScalar = -(1 + BOUNCINESS) * velAlongNormal / 2;
                    const impulseX = impulseScalar * normalX; const impulseY = impulseScalar * normalY;
                    stateA.vx -= impulseX; stateA.vy -= impulseY; stateB.vx += impulseX; stateB.vy += impulseY;
                }
            }
        }
    }
}

// --- Shockwave Force ---
function applyShockwaveForces(deltaTime) {
    // Changed: Use shockwave.strength
    const now = performance.now();
    const shockwavesToRemove = [];

    activeShockwaves.forEach((shockwave, index) => {
        const elapsedTime = (now - shockwave.startTime) / 1000;
        shockwave.currentRadius = elapsedTime * SHOCKWAVE_SPEED;

        if (elapsedTime > SHOCKWAVE_DURATION) {
            shockwavesToRemove.push(index);
            return;
        }

        letterStates.forEach((state) => {
            if (!state || !state.el) return;
            const letterViewportX = state.x + containerOffsetX;
            const letterViewportY = state.y + containerOffsetY;
            const dx = letterViewportX - shockwave.x;
            const dy = letterViewportY - shockwave.y;
            const distSq = dx * dx + dy * dy;
            const maxPossibleRadiusSq = Math.pow(SHOCKWAVE_DURATION * SHOCKWAVE_SPEED + SHOCKWAVE_EFFECT_RADIUS, 2);
            if (distSq > maxPossibleRadiusSq) return;
            const dist = Math.sqrt(distSq);
            const deltaRadius = dist - shockwave.currentRadius;

            if (Math.abs(deltaRadius) < SHOCKWAVE_EFFECT_RADIUS && dist > 1) {
                const falloff = Math.pow(dist, SHOCKWAVE_FALLOFF) + 1;
                // Use the strength stored in the shockwave object
                let forceMagnitude = Math.max(0, (shockwave.strength / falloff));
                const forceDirX = dx / dist;
                const forceDirY = dy / dist;
                state.vx += forceDirX * forceMagnitude * deltaTime;
                state.vy += forceDirY * forceMagnitude * deltaTime;
            }
        });
    });

    for (let i = shockwavesToRemove.length - 1; i >= 0; i--) {
        activeShockwaves.splice(shockwavesToRemove[i], 1);
    }
}

// --- Debug Drawing ---
function drawDebugInfo() {
    // Unchanged
    if (!debugCtx || !debugCanvas) return;
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    if (!isDebugMode) return;
    debugCtx.strokeStyle = DEBUG_SHOCKWAVE_COLOR;
    debugCtx.lineWidth = DEBUG_SHOCKWAVE_LINEWIDTH;
    activeShockwaves.forEach(shockwave => {
        if (shockwave.currentRadius > 0) {
            debugCtx.beginPath();
            debugCtx.arc(shockwave.x, shockwave.y, shockwave.currentRadius, 0, Math.PI * 2);
            debugCtx.stroke();
        }
    });
}


function updateLetters() {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = currentTime;

    if (letterStates.length === 0) { animationFrameId = null; return; }
    if (!container) { console.error("..."); animationFrameId = null; return; }

    updateContainerOffset();
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) { console.warn("..."); animationFrameId = null; return; }

    mouseVX = mouseX - prevMouseX;
    mouseVY = mouseY - prevMouseY;
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    const mouseRelativeX = mouseX - containerOffsetX;
    const mouseRelativeY = mouseY - containerOffsetY;
    const mouseRadiusSq = MOUSE_RADIUS * MOUSE_RADIUS;

    applyShockwaveForces(deltaTime);

    // --- Calculate hold duration if mouse is down ---
    let holdDuration = 0;
    let chargeRatio = 0;
    if (isMouseDown) {
        holdDuration = (currentTime - mouseDownStartTime) / 1000;
        chargeRatio = Math.min(holdDuration / SHOCKWAVE_CHARGE_DURATION_CAP, 1.0);
    }

    letterStates.forEach((state) => {
        if (!state || !state.el) return;

        // --- Mouse Interaction Logic ---
        if (isMouseDown) {
            // --- NEW: Apply Attraction Force ---
            const dxAttract = mouseRelativeX - state.x;
            const dyAttract = mouseRelativeY - state.y;
            const distAttractSq = dxAttract * dxAttract + dyAttract * dyAttract;

            if (distAttractSq > 1) { // Avoid division by zero
                const distAttract = Math.sqrt(distAttractSq);
                const dirXAttract = dxAttract / distAttract;
                const dirYAttract = dyAttract / distAttract;

                // Attraction strength increases with charge ratio
                const attractionMagnitude = MOUSE_ATTRACTION_STRENGTH * chargeRatio;

                // Apply force as acceleration scaled by deltaTime
                state.vx += dirXAttract * attractionMagnitude * deltaTime;
                state.vy += dirYAttract * attractionMagnitude * deltaTime;
            }
        } else {
            // --- Original Mouse Interaction (Repulsion/Impulse) ---
            const dxMouse = mouseRelativeX - state.x;
            const dyMouse = mouseRelativeY - state.y;
            const distSq = dxMouse * dxMouse + dyMouse * dyMouse;

            if (distSq < mouseRadiusSq && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const proximityFactor = (1 - dist / MOUSE_RADIUS);
                const impulseMagnitude = MOUSE_FORCE * proximityFactor * 60; // Use MOUSE_FORCE here

                // Apply mouse velocity impulse
                state.vx += mouseVX * impulseMagnitude * deltaTime;
                state.vy += mouseVY * impulseMagnitude * deltaTime;

                // Apply outward push
                const pushMagnitude = 0.05 * proximityFactor * 60;
                state.vx -= (dxMouse / dist) * pushMagnitude * deltaTime;
                state.vy -= (dyMouse / dist) * pushMagnitude * deltaTime;
            }
        }

        // 2. Return Force
        const dxHome = state.homeX - state.x;
        const dyHome = state.homeY - state.y;
        const returnAccel = RETURN_FORCE * 60;
        state.vx += dxHome * returnAccel * deltaTime;
        state.vy += dyHome * returnAccel * deltaTime;

        // 4. Drag
        const effectiveDrag = Math.pow(DRAG_FACTOR, deltaTime * 60);
        state.vx *= effectiveDrag;
        state.vy *= effectiveDrag;

        // 5. Update Position
        state.x += state.vx * deltaTime * 60;
        state.y += state.vy * deltaTime * 60;

        // 6. Clamp Velocity
        const speedSq = state.vx * state.vx + state.vy * state.vy;
        if (speedSq > MAX_SPEED * MAX_SPEED) {
            const speed = Math.sqrt(speedSq);
            state.vx = (state.vx / speed) * MAX_SPEED;
            state.vy = (state.vy / speed) * MAX_SPEED;
        }
    }); // End physics update loop

    applySpacingForce();
    checkCollisions();

    letterStates.forEach((state, index) => {
        // --- Appearance calculations and style application ---
        // Unchanged from previous version
        if (!state || !state.el) return;
        const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
        const baseScaleFactor = speed * SQUASH_STRETCH_FACTOR * 0.05;
        const scaleFactor = 1 + Math.max(0, baseScaleFactor);
        if (speed > 0.1) {
            const angle = Math.atan2(state.vy, state.vx); const cosAngle = Math.abs(Math.cos(angle)); const sinAngle = Math.abs(Math.sin(angle));
            state.physicsTargetScaleX = 1 + (scaleFactor - 1) * sinAngle - (scaleFactor - 1) * cosAngle * 0.5;
            state.physicsTargetScaleY = 1 + (scaleFactor - 1) * cosAngle - (scaleFactor - 1) * sinAngle * 0.5;
        } else { state.physicsTargetScaleX = 1; state.physicsTargetScaleY = 1; }
        const effectiveScaleSmoothing = Math.pow(SCALE_SMOOTHING, deltaTime * 60); const lerpFactorScale = 1 - effectiveScaleSmoothing;
        state.scaleX += (state.physicsTargetScaleX - state.scaleX) * lerpFactorScale; state.scaleY += (state.physicsTargetScaleY - state.scaleY) * lerpFactorScale;
        state.physicsTargetWght = BASE_WEIGHT + speed * WEIGHT_SPEED_FACTOR; state.physicsTargetWdth = BASE_WIDTH + speed * WIDTH_SPEED_FACTOR;
        state.physicsTargetSlnt = BASE_SLANT + state.vx * SLANT_VELOCITY_FACTOR; const effectiveFontSmoothing = Math.pow(VAR_FONT_SMOOTHING, deltaTime * 60); const lerpFactorFont = 1 - effectiveFontSmoothing;
        state.wght += (state.physicsTargetWght - state.wght) * lerpFactorFont; state.wdth += (state.physicsTargetWdth - state.wdth) * lerpFactorFont; state.slnt += (state.physicsTargetSlnt - state.slnt) * lerpFactorFont;
        const targetRotation = state.vx * ROTATION_FACTOR; const effectiveRotationSmoothing = Math.pow(ROTATION_SMOOTHING, deltaTime * 60); const lerpFactorRotation = 1 - effectiveRotationSmoothing;
        state.currentRotation += (targetRotation - state.currentRotation) * lerpFactorRotation; if (Math.abs(state.currentRotation) < 0.01 && Math.abs(targetRotation) < 0.01) { state.currentRotation = 0; }
        const time = currentTime;
        const oscWght = (Math.sin(state.oscillationPhaseWght + time * FONT_OSCILLATION_SPEED) * WEIGHT_OSCILLATION_RANGE / 2);
        const oscWdth = (Math.sin(state.oscillationPhaseWdth + time * FONT_OSCILLATION_SPEED) * WIDTH_OSCILLATION_RANGE / 2);
        const oscSlnt = (SLANT_OSCILLATION_RANGE > 0) ? (Math.sin(state.oscillationPhaseSlnt + time * FONT_OSCILLATION_SPEED) * SLANT_OSCILLATION_RANGE / 2) : 0;
        const oscScaleX = (Math.sin(state.oscillationPhaseScaleX + time * SCALE_OSCILLATION_SPEED) * SCALE_OSCILLATION_RANGE / 2);
        const oscScaleY = (Math.sin(state.oscillationPhaseScaleY + time * SCALE_OSCILLATION_SPEED) * SCALE_OSCILLATION_RANGE / 2);
        let displayWght = state.wght + oscWght; let displayWdth = state.wdth + oscWdth; let displaySlnt = state.slnt + oscSlnt;
        let displayScaleX = state.scaleX + oscScaleX; let displayScaleY = state.scaleY + oscScaleY;
        displayWght = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, displayWght)); displayWdth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, displayWdth));
        displaySlnt = Math.max(MAX_SLANT, Math.min(MIN_SLANT, displaySlnt)); displayScaleX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, displayScaleX)); displayScaleY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, displayScaleY));
        const translateX = state.x - state.homeX; const translateY = state.y - state.homeY; const rotation = state.currentRotation;
        state.el.style.transform = `translate(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px) rotate(${rotation.toFixed(2)}deg) scale(${displayScaleX.toFixed(2)}, ${displayScaleY.toFixed(2)})`;
        state.el.style.fontVariationSettings = `"wght" ${displayWght.toFixed(1)}, "wdth" ${displayWdth.toFixed(1)}, "slnt" ${displaySlnt.toFixed(1)}`;
        if (isDebugMode) {
            const normalizedSpeed = MAX_SPEED > 0 ? Math.min(1, speed / MAX_SPEED) : 0; const colorHue = 240 * (1 - normalizedSpeed);
            state.el.style.backgroundColor = `hsla(${colorHue.toFixed(0)}, 100%, 60%, 0.7)`; state.el.style.border = '1px solid rgba(0, 0, 0, 0.5)'; state.el.style.color = 'transparent'; state.el.style.boxSizing = 'border-box'; state.wasInDebugMode = true;
        } else { if (state.wasInDebugMode) { state.el.style.removeProperty('background-color'); state.el.style.removeProperty('border'); state.el.style.removeProperty('color'); state.el.style.removeProperty('box-sizing'); state.wasInDebugMode = false; } }
    }); // End appearance loop

    drawDebugInfo();
    animationFrameId = requestAnimationFrame(updateLetters);
}

// --- Event Listeners ---
// mousemove - Unchanged
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});

// --- NEW: Mousedown Listener (Starts Charge) ---
document.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return; // Only left click

    isMouseDown = true;
    mouseDownStartTime = performance.now();
    mouseDownX = event.clientX; // Store viewport X for shockwave origin
    mouseDownY = event.clientY; // Store viewport Y for shockwave origin
    // Do NOT create shockwave here anymore
});

// --- NEW: Mouseup Listener (Releases Shockwave) ---
document.addEventListener('mouseup', (event) => {
    if (event.button !== 0 || !isMouseDown) return; // Only left click release that started here

    const holdDuration = (performance.now() - mouseDownStartTime) / 1000;
    // Clamp charge ratio between 0 and 1
    const chargeRatio = Math.min(holdDuration / SHOCKWAVE_CHARGE_DURATION_CAP, 1.0);
    // Interpolate strength based on charge ratio
    const currentShockwaveStrength = SHOCKWAVE_MIN_STRENGTH + (SHOCKWAVE_MAX_STRENGTH - SHOCKWAVE_MIN_STRENGTH) * chargeRatio;

    // Create the shockwave with calculated strength at the original mousedown location
    activeShockwaves.push({
        x: mouseDownX,          // Use stored viewport X
        y: mouseDownY,          // Use stored viewport Y
        startTime: performance.now(), // Start expansion now
        currentRadius: 0,
        strength: currentShockwaveStrength // Store calculated strength
    });

    isMouseDown = false; // Reset mouse down state
});


// resize - Unchanged
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Paused for resize."); }
    resizeTimeout = setTimeout(() => {
        console.log("Recalculating on resize...");
        mouseX = window.innerWidth / 2; mouseY = window.innerHeight / 2;
        prevMouseX = mouseX; prevMouseY = mouseY; mouseVX = 0; mouseVY = 0; activeShockwaves = [];
        isMouseDown = false; // Reset mouse state on resize
        if(debugCanvas) { debugCanvas.width = window.innerWidth; debugCanvas.height = window.innerHeight; console.log("Debug canvas resized."); }
        initializeLetters();
    }, 250);
});
// keydown - Unchanged
document.addEventListener('keydown', (event) => {
    const targetTagName = event.target.tagName.toLowerCase();
    if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'select' || event.target.isContentEditable) { return; }
    if (event.key.toLowerCase() === 'd') {
        isDebugMode = !isDebugMode; console.log(`Debug mode ${isDebugMode ? 'enabled' : 'disabled'}.`);
        if (!isDebugMode && debugCtx && debugCanvas) { debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height); }
    }
});

// --- Initialization ---
// runInitialization - Unchanged
function runInitialization() {
    mouseX = window.innerWidth / 2; mouseY = window.innerHeight / 2;
    prevMouseX = mouseX; prevMouseY = mouseY; mouseVX = 0; mouseVY = 0; activeShockwaves = [];
    isMouseDown = false; // Ensure mouse state is reset on init
    if (document.fonts) {
        document.fonts.load('1em "Roboto Flex"').then(() => { console.log('Font loaded.'); initializeLetters(); })
            .catch(err => { console.error('Font loading error:', err); setTimeout(initializeLetters, 500); });
    } else { console.warn('FontFaceSet API not supported.'); setTimeout(initializeLetters, 500); }
}
// DOMContentLoaded check - Unchanged
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', runInitialization); }
else { runInitialization(); }