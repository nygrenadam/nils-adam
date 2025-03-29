// static/js/js.js

// --- Base Font Settings ---
const BASE_WEIGHT = 400; // Corresponds to 'wght' in CSS (Range: 100-1000)
const BASE_WIDTH = 100;  // Corresponds to 'wdth' in CSS (Range: 75-125)
const BASE_SLANT = 0;    // Corresponds to 'slnt' in CSS (Range: -10-0)

// --- Animation Parameters ---
const WEIGHT_SPEED_FACTOR = 800;
const WIDTH_SPEED_FACTOR = 25;
const SLANT_VELOCITY_FACTOR = 1.5;
// const MAX_SLANT_PHYSICS = 10; // No longer strictly needed here
const VAR_FONT_SMOOTHING = 0.55; // Smoothing for js effect (0-1, lower = smoother)

// --- Physics Parameters ---
const SPRING_STIFFNESS = 0.02;
const DAMPING = 0.1;
const LETTER_REPEL_FORCE = 0.12;
const MIN_LETTER_DISTANCE = 5;
const MOUSE_REPEL_FORCE = 0.7;
const MOUSE_RADIUS = 50;
const SQUASH_STRETCH_FACTOR = 0.4;
const SCALE_SMOOTHING = 0.3;
const ROTATION_FACTOR = 1.5;

// --- Random Oscillation Parameters ---
const RANDOM_OSCILLATION_INTENSITY = 150;
const RANDOM_OSCILLATION_SPEED = 15;
const WEIGHT_OSCILLATION_SCALE = 1.0;
const WIDTH_OSCILLATION_SCALE = 1.0;
const SLANT_OSCILLATION_SCALE = 1.0;

// --- Font Axis Ranges (Important for clamping) ---
const MIN_WEIGHT = 100;
const MAX_WEIGHT = 1000;
const MIN_WIDTH = 75;
const MAX_WIDTH = 125;
const MIN_SLANT = -100;
const MAX_SLANT = 100;

const letters = document.querySelectorAll('.letter');
const container = document.querySelector('.title-wrapper');

let letterStates = [];
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let animationFrameId = null;

function initializeLetters() {
    letterStates = [];
    if (!container) {
        console.error("Title wrapper container not found!");
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }
    const containerRect = container.getBoundingClientRect();

    letters.forEach((letter, index) => {
        const rect = letter.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            console.warn(`Letter ${index} (${letter.dataset.char}) has zero dimensions, skipping initialization.`);
            return;
        }
        const homeX = rect.left - containerRect.left + rect.width / 2;
        const homeY = rect.top - containerRect.top + rect.height / 2;

        letterStates[index] = {
            el: letter,
            homeX: homeX, homeY: homeY,
            x: homeX + (Math.random() - 0.5) * 15,
            y: homeY + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            scaleX: 1, scaleY: 1,
            targetScaleX: 1, targetScaleY: 1,
            width: rect.width, height: rect.height,
            // Current font variation values (representing the js-smoothed state)
            wght: BASE_WEIGHT,
            wdth: BASE_WIDTH,
            slnt: BASE_SLANT,
            // Physics-driven target values (calculated each frame)
            physicsTargetWght: BASE_WEIGHT,
            physicsTargetWdth: BASE_WIDTH,
            physicsTargetSlnt: BASE_SLANT,
            // Random oscillation state
            oscillationPhaseWght: Math.random() * Math.PI * 2000,
            oscillationPhaseWdth: Math.random() * Math.PI * 2000,
            oscillationPhaseSlnt: Math.random() * Math.PI * 2000,
        };
        const initialTranslateX = letterStates[index].x - homeX;
        const initialTranslateY = letterStates[index].y - homeY;
        letter.style.transform = `translate(${initialTranslateX}px, ${initialTranslateY}px)`;
        letter.style.fontVariationSettings = `"wght" ${BASE_WEIGHT}, "wdth" ${BASE_WIDTH}, "slnt" ${BASE_SLANT}`;
    });
    console.log("Letters initialized:", letterStates.length, "active.");
    if (!animationFrameId && letterStates.length > 0) {
        console.log("Starting animation loop.");
        updateLetters();
    } else if (letterStates.length === 0){
        console.log("No letters initialized properly, animation not started.");
    }
}

function updateLetters() {
    if (letterStates.length === 0) {
        console.warn("updateLetters called with no initialized states.");
        animationFrameId = null; // Stop the loop if it was somehow started
        return;
    }
    if (!container) {
        console.error("updateLetters called but container not found.");
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }

    const containerRect = container.getBoundingClientRect();
    // Prevent errors if containerRect is invalid (e.g., hidden)
    if (containerRect.width === 0 && containerRect.height === 0) {
        console.warn("Container has zero dimensions, pausing animation.");
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }
    const mouseRelativeX = mouseX - containerRect.left;
    const mouseRelativeY = mouseY - containerRect.top;

    letterStates.forEach((state, index) => {
        if (!state || !state.el) { // Check if element exists too
            // console.warn(`Skipping update for invalid state at index ${index}`);
            return;
        }

        // --- Physics Calculations (Position/Velocity) ---
        // 1. Spring Force
        const dxHome = state.homeX - state.x;
        const dyHome = state.homeY - state.y;
        state.vx += dxHome * SPRING_STIFFNESS;
        state.vy += dyHome * SPRING_STIFFNESS;

        // 2. Mouse Repulsion
        const dxMouse = state.x - mouseRelativeX;
        const dyMouse = state.y - mouseRelativeY;
        const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;
        const mouseRadiusSq = MOUSE_RADIUS * MOUSE_RADIUS;
        if (distMouseSq < mouseRadiusSq && distMouseSq > 1) {
            const distMouse = Math.sqrt(distMouseSq);
            const force = (1 - distMouse / MOUSE_RADIUS) * MOUSE_REPEL_FORCE;
            state.vx += (dxMouse / distMouse) * force * 50;
            state.vy += (dyMouse / distMouse) * force * 50;
        }

        // 3. Letter Repulsion
        letterStates.forEach((otherState, otherIndex) => {
            if (index === otherIndex || !otherState) return;
            const dx = state.x - otherState.x;
            const dy = state.y - otherState.y;
            const distSq = dx * dx + dy * dy;
            const minDistSq = MIN_LETTER_DISTANCE * MIN_LETTER_DISTANCE;
            if (distSq < minDistSq && distSq > 1) {
                const dist = Math.sqrt(distSq);
                const overlap = MIN_LETTER_DISTANCE - dist;
                const force = overlap * LETTER_REPEL_FORCE * 1.5;
                const angle = Math.atan2(dy, dx);
                state.vx += Math.cos(angle) * force;
                state.vy += Math.sin(angle) * force;
                // Ensure otherState velocity is updated only if it's valid
                if (otherState.vx !== undefined && otherState.vy !== undefined) {
                    otherState.vx -= Math.cos(angle) * force;
                    otherState.vy -= Math.sin(angle) * force;
                }
            }
        });

        // 4. Damping
        state.vx *= DAMPING;
        state.vy *= DAMPING;

        // --- Appearance Calculations ---
        const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

        // 5. Soft Body (Scale) - Smoothing applied directly here
        const scaleFactor = 1 + Math.max(0, speed - 0.2) * SQUASH_STRETCH_FACTOR;
        if (speed > 0.2) {
            const angle = Math.atan2(state.vy, state.vx);
            const cosAngle = Math.abs(Math.cos(angle));
            const sinAngle = Math.abs(Math.sin(angle));
            state.targetScaleX = 1 + (scaleFactor - 1) * cosAngle * 1.0 - (scaleFactor - 1) * sinAngle * 0.5;
            state.targetScaleY = 1 + (scaleFactor - 1) * sinAngle * 1.0 - (scaleFactor - 1) * cosAngle * 0.5;
        } else {
            state.targetScaleX = 1;
            state.targetScaleY = 1;
        }
        state.targetScaleX = Math.max(0.7, Math.min(1.4, state.targetScaleX));
        state.targetScaleY = Math.max(0.7, Math.min(1.4, state.targetScaleY));
        state.scaleX += (state.targetScaleX - state.scaleX) * SCALE_SMOOTHING;
        state.scaleY += (state.targetScaleY - state.scaleY) * SCALE_SMOOTHING;


        // 6. Calculate Physics Target for Font Variations
        state.physicsTargetWght = BASE_WEIGHT + speed * WEIGHT_SPEED_FACTOR;
        state.physicsTargetWdth = BASE_WIDTH + speed * WIDTH_SPEED_FACTOR;
        state.physicsTargetSlnt = BASE_SLANT + state.vx * SLANT_VELOCITY_FACTOR;

        // Clamp the js *target* to prevent it from going wildly out of bounds
        state.physicsTargetWght = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, state.physicsTargetWght));
        state.physicsTargetWdth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, state.physicsTargetWdth));
        state.physicsTargetSlnt = Math.max(MIN_SLANT, Math.min(MAX_SLANT, state.physicsTargetSlnt));


        // 7. Smooth Current State Towards Physics Target (MODIFIED LOGIC)
        // state.wght now represents the smoothly changing value based *only* on js
        state.wght += (state.physicsTargetWght - state.wght) * VAR_FONT_SMOOTHING;
        state.wdth += (state.physicsTargetWdth - state.wdth) * VAR_FONT_SMOOTHING;
        state.slnt += (state.physicsTargetSlnt - state.slnt) * VAR_FONT_SMOOTHING;
        // Note: We don't clamp state.wght/wdth/slnt here, allowing smooth transitions even if target changes abruptly. Clamping happens on the final display value.

        // 8. Calculate Random Oscillation Value (No change here)
        let oscillationWght = 0;
        let oscillationWdth = 0;
        let oscillationSlnt = 0;

        if (RANDOM_OSCILLATION_INTENSITY > 0) {
            const rawOscWght = Math.sin(state.oscillationPhaseWght);
            const rawOscWdth = Math.sin(state.oscillationPhaseWdth);
            const rawOscSlnt = Math.sin(state.oscillationPhaseSlnt);

            oscillationWght = rawOscWght * RANDOM_OSCILLATION_INTENSITY * WEIGHT_OSCILLATION_SCALE;
            oscillationWdth = rawOscWdth * RANDOM_OSCILLATION_INTENSITY * WIDTH_OSCILLATION_SCALE;
            oscillationSlnt = rawOscSlnt * RANDOM_OSCILLATION_INTENSITY * SLANT_OSCILLATION_SCALE;

            // Update phases
            state.oscillationPhaseWght += RANDOM_OSCILLATION_SPEED;
            state.oscillationPhaseWdth += RANDOM_OSCILLATION_SPEED;
            state.oscillationPhaseSlnt += RANDOM_OSCILLATION_SPEED;
        }

        // 9. Calculate Final Display Value by Adding Oscillation (NEW LOGIC)
        let displayWght = state.wght + oscillationWght;
        let displayWdth = state.wdth + oscillationWdth;
        let displaySlnt = state.slnt + oscillationSlnt;

        // --- IMPORTANT: Clamp final DISPLAY values to VALID font ranges ---
        displayWght = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, displayWght));
        displayWdth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, displayWdth));
        displaySlnt = Math.max(MIN_SLANT, Math.min(MAX_SLANT, displaySlnt));


        // 10. Update Position
        state.x += state.vx;
        state.y += state.vy;

        // 11. Apply Styles (Using displayWght/wdth/slnt)
        const translateX = state.x - state.homeX;
        const translateY = state.y - state.homeY;
        const rotation = state.vx * ROTATION_FACTOR; // Rotation still based on velocity

        // Check el again just before using it
        if (state.el) {
            state.el.style.transform = `
                translate(${translateX}px, ${translateY}px)
                rotate(${rotation}deg)
                scale(${state.scaleX}, ${state.scaleY})
             `;
            // Apply the final, clamped display values including oscillation
            state.el.style.fontVariationSettings = `
                "wght" ${displayWght.toFixed(1)},
                "wdth" ${displayWdth.toFixed(1)},
                "slnt" ${displaySlnt.toFixed(1)}
             `;
        } else {
            // This should ideally not happen if checked earlier, but good as a safeguard
            console.warn(`Element for letter index ${index} became null during update loop.`);
        }
    });

    animationFrameId = requestAnimationFrame(updateLetters);
}

// --- Event Listeners ---
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Animation paused for resize.");
    }
    resizeTimeout = setTimeout(() => {
        console.log("Recalculating layout on resize...");
        // Re-select elements in case the DOM structure changed (unlikely here, but good practice)
        // letters = document.querySelectorAll('.letter');
        // container = document.querySelector('.title-wrapper');
        initializeLetters(); // Re-initialize positions and start animation
    }, 250);
});

// --- Initialization ---
function runInitialization() {
    if (document.fonts) {
        // Check if 'Roboto Flex' is already loaded or start loading
        document.fonts.load('1em "Roboto Flex"').then(() => {
            console.log('Roboto Flex font loaded or already available.');
            initializeLetters();
        }).catch(err => {
            console.error('Font loading error or timeout:', err);
            // Fallback initialization if font loading fails/times out
            console.warn('Attempting initialization after font load failure/timeout.');
            setTimeout(initializeLetters, 500);
        });
    } else {
        console.warn('FontFaceSet API not supported, using setTimeout fallback for initialization.');
        // Fallback for browsers without FontFaceSet support
        setTimeout(initializeLetters, 500);
    }
}

// Ensure the DOM is ready before trying to query elements and load fonts
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialization);
} else {
    // DOMContentLoaded has already fired
    runInitialization();
}