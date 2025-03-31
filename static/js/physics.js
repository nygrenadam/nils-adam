// static/js/js.js

// --- Base Font Settings ---
const BASE_WEIGHT = 300; // Corresponds to 'wght' in CSS (Range: 100-1000)
const BASE_WIDTH = 125   ;  // Corresponds to 'wdth' in CSS (Range: 75-125)
const BASE_SLANT = 0;    // Corresponds to 'slnt' in CSS (Range: -10-10 typical)

// --- Simplified Physics Parameters ---
// Tuned for smoother collisions & spacing
const RETURN_FORCE = 0.035;     // How strongly letters return to home (scaled by 60fps equivalent)
const DRAG_FACTOR = 0.12;       // Velocity remaining per frame (e.g., 0.95 = 5% drag) - Higher = less drag
const BOUNCINESS = 0.8;         // Lowered bounciness for less jitter with spacing force
const MOUSE_FORCE = 3.5;        // Multiplier for mouse velocity impulse (when NOT charging, scaled by 60fps equivalent)
const MOUSE_RADIUS = 125;       // Pixels: Distance within which the mouse affects letters
const MOUSE_ATTRACTION_STRENGTH = 2000; // How strongly letters are pulled to cursor while charging (higher = stronger)
const MAX_SPEED = 350;           // Increased speed limit slightly for more visible effect
const MIN_LETTER_SPACING = 15;   // Minimum desired pixels between letter *edges*
const SPACING_FORCE_STRENGTH = 0.02; // How strongly letters push apart below min spacing (adjust as needed)
const MIN_RETURN_SPEED_THRESHOLD = 0.25; // ADJUSTED: Speed below which return force re-engages after shockwave

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
const SQUASH_STRETCH_FACTOR = 5; // How much letters squash/stretch with speed (Reduced)
const SCALE_SMOOTHING = 0.98;       // Smoothing for squash/stretch effect (0-1, Lower = smoother/slower)
const ROTATION_FACTOR = 33;        // How much letters rotate based on horizontal velocity
const ROTATION_SMOOTHING = 0.98;   // Smoothing for rotation (0-1, Lower = smoother/slower rotation changes)

// --- Random Oscillation Parameters ---
const WEIGHT_OSCILLATION_RANGE = 100;
const WIDTH_OSCILLATION_RANGE = 75;
const SLANT_OSCILLATION_RANGE = 0;
const FONT_OSCILLATION_SPEED = 0.0003;
const GOLDEN_RATIO = 1.61803398875; // Used for phase variation
const SCALE_OSCILLATION_RANGE = 0.4;
const SCALE_OSCILLATION_SPEED = FONT_OSCILLATION_SPEED * GOLDEN_RATIO;

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
const DEBUG_SHOCKWAVE_COLOR = "rgba(255, 255, 255, 0.8)"; // Color for shockwave visualization (Increased opacity)
const DEBUG_SHOCKWAVE_LINEWIDTH = 10; // Line width for shockwave visualization

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
let isMouseDown = false;        // Track if mouse button is down
let mouseDownStartTime = 0;     // Time when mouse was pressed
let mouseDownX = 0;             // Viewport X where mouse was pressed
let mouseDownY = 0;             // Viewport Y where mouse was pressed

// --- Container Offset ---
let containerOffsetX = 0;
let containerOffsetY = 0;

function updateContainerOffset() {
    // No changes needed here
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
    letterStates = [];
    if (!container) {
        console.error("Title container '.title-wrapper' not found.");
        return;
    }
    updateContainerOffset(); // Update offset before calculating home positions

    debugCanvas = document.getElementById('debug-canvas');
    if (debugCanvas) {
        debugCtx = debugCanvas.getContext('2d');
        debugCanvas.width = window.innerWidth;
        debugCanvas.height = window.innerHeight;
        console.log("Debug canvas initialized.");
    } else {
        console.warn("Debug canvas '#debug-canvas' not found.");
        debugCtx = null;
    }

    letters.forEach((letter) => {
        const rect = letter.getBoundingClientRect();
        // Skip letters with no dimensions (e.g., if hidden initially)
        if (rect.width === 0 || rect.height === 0) {
            console.warn("Skipping letter with zero dimensions:", letter);
            return;
        }
        const homeX = rect.left - containerOffsetX + rect.width / 2;
        const homeY = rect.top - containerOffsetY + rect.height / 2;

        letterStates.push({
            el: letter,
            homeX, homeY,
            x: homeX, y: homeY,
            vx: 0, vy: 0,
            speed: 0, // Initialize speed cache
            width: rect.width, height: rect.height,
            scaleX: 1, scaleY: 1,
            physicsTargetScaleX: 1, physicsTargetScaleY: 1,
            wght: BASE_WEIGHT, wdth: BASE_WIDTH, slnt: BASE_SLANT,
            physicsTargetWght: BASE_WEIGHT, physicsTargetWdth: BASE_WIDTH, physicsTargetSlnt: BASE_SLANT,
            currentRotation: 0,
            oscillationPhaseWght: Math.random() * Math.PI * 2,
            oscillationPhaseWdth: Math.random() * Math.PI * 2,
            oscillationPhaseSlnt: Math.random() * Math.PI * 2,
            oscillationPhaseScaleX: Math.random() * Math.PI * 2,
            oscillationPhaseScaleY: Math.random() * Math.PI * 2 * GOLDEN_RATIO, // Use constant
            wasInDebugMode: false,
            wasHitByShockwaveRecently: false, // Flag for shockwave coasting
        });

        // Initialize styles immediately
        const state = letterStates[letterStates.length - 1];
        const initialTranslateX = state.x - state.homeX;
        const initialTranslateY = state.y - state.homeY;
        state.el.style.transform = `translate(${initialTranslateX}px, ${initialTranslateY}px) rotate(0deg) scale(1, 1)`;
        state.el.style.fontVariationSettings = `"wght" ${state.wght}, "wdth" ${state.wdth}, "slnt" ${state.slnt}`;
        // Ensure any debug styles are removed initially
        state.el.style.removeProperty('background-color');
        state.el.style.removeProperty('border');
        state.el.style.removeProperty('color');
        state.el.style.removeProperty('box-sizing');
    });

    console.log("Letters initialized:", letterStates.length, "active.");
    lastFrameTime = performance.now(); // Reset frame timer

    if (!animationFrameId && letterStates.length > 0) {
        console.log("Starting animation.");
        updateLetters(); // Start the main loop
    } else if (letterStates.length === 0) {
        console.log("No letters initialized, animation not started.");
    }
}

// --- Spacing Force ---
function applySpacingForce() {
    // No functional changes, structure remains O(n^2)
    for (let i = 0; i < letterStates.length; i++) {
        for (let j = i + 1; j < letterStates.length; j++) {
            const stateA = letterStates[i];
            const stateB = letterStates[j];
            if (!stateA || !stateB) continue; // Should not happen with current init logic

            const dx = stateB.x - stateA.x;
            const dy = stateB.y - stateA.y;
            const distSq = dx * dx + dy * dy;

            // Calculate effective widths based on current scale
            const effHalfWidthA = (stateA.width * stateA.scaleX) / 2;
            const effHalfWidthB = (stateB.width * stateB.scaleX) / 2;
            const targetDist = effHalfWidthA + effHalfWidthB + MIN_LETTER_SPACING;
            const targetDistSq = targetDist * targetDist;

            // Apply force if closer than target distance (and not exactly overlapping)
            if (distSq < targetDistSq && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const penetration = targetDist - dist;
                const forceMagnitude = penetration * SPACING_FORCE_STRENGTH; // Force proportional to penetration

                // Normalized direction vector
                const forceDirX = dx / dist;
                const forceDirY = dy / dist;

                // Apply equal and opposite force
                const forceApplied = forceMagnitude * 0.5; // Split force between the two letters
                stateA.vx -= forceDirX * forceApplied;
                stateA.vy -= forceDirY * forceApplied;
                stateB.vx += forceDirX * forceApplied;
                stateB.vy += forceDirY * forceApplied;
            }
        }
    }
}


// --- Collision Detection and Resolution ---
function checkCollisions() {
    // No functional changes, structure remains O(n^2) with iterations
    const collisionIterations = 8; // Iterative resolution helps stability
    for (let iter = 0; iter < collisionIterations; iter++) {
        for (let i = 0; i < letterStates.length; i++) {
            for (let j = i + 1; j < letterStates.length; j++) {
                const stateA = letterStates[i];
                const stateB = letterStates[j];
                if (!stateA || !stateB) continue;

                // Calculate effective dimensions based on current scale
                const effWidthA = stateA.width * stateA.scaleX;
                const effHeightA = stateA.height * stateA.scaleY;
                const effWidthB = stateB.width * stateB.scaleX;
                const effHeightB = stateB.height * stateB.scaleY;
                const halfWidthA = effWidthA / 2;
                const halfHeightA = effHeightA / 2;
                const halfWidthB = effWidthB / 2;
                const halfHeightB = effHeightB / 2;

                const dx = stateB.x - stateA.x;
                const dy = stateB.y - stateA.y;

                const combinedHalfWidths = halfWidthA + halfWidthB;
                const combinedHalfHeights = halfHeightA + halfHeightB;

                // AABB collision check
                if (Math.abs(dx) < combinedHalfWidths && Math.abs(dy) < combinedHalfHeights) {
                    const overlapX = combinedHalfWidths - Math.abs(dx);
                    const overlapY = combinedHalfHeights - Math.abs(dy);

                    // Resolve collision along the axis of minimum penetration
                    let sepAxisX = 0, sepAxisY = 0;
                    const penetrationFactor = 0.5; // How much to push out per iteration

                    if (overlapX < overlapY) { // Penetration is primarily horizontal
                        sepAxisX = dx > 0 ? 1 : -1; // Direction of separation for A
                        const separationAmount = (overlapX / collisionIterations) * penetrationFactor;
                        stateA.x -= sepAxisX * separationAmount;
                        stateB.x += sepAxisX * separationAmount;
                    } else { // Penetration is primarily vertical
                        sepAxisY = dy > 0 ? 1 : -1; // Direction of separation for A
                        const separationAmount = (overlapY / collisionIterations) * penetrationFactor;
                        stateA.y -= sepAxisY * separationAmount;
                        stateB.y += sepAxisY * separationAmount;
                    }

                    // --- Resolve Velocity (Impulse) ---
                    const rvX = stateB.vx - stateA.vx; // Relative velocity
                    const rvY = stateB.vy - stateA.vy;

                    // Use the separation axis as the collision normal
                    let normalX = 0, normalY = 0;
                    if (sepAxisX !== 0) { normalX = sepAxisX; }
                    else if (sepAxisY !== 0) { normalY = sepAxisY; }
                    else { continue; } // Should not happen if there was overlap

                    const velAlongNormal = rvX * normalX + rvY * normalY;

                    // Only resolve if velocities are moving towards each other
                    if (velAlongNormal > 0) continue;

                    const impulseScalar = -(1 + BOUNCINESS) * velAlongNormal / 2; // Divide by 2 for two bodies
                    const impulseX = impulseScalar * normalX;
                    const impulseY = impulseScalar * normalY;

                    // Apply impulse (equal and opposite)
                    stateA.vx -= impulseX;
                    stateA.vy -= impulseY;
                    stateB.vx += impulseX;
                    stateB.vy += impulseY;
                }
            }
        }
    }
}

// --- Shockwave Force ---
function applyShockwaveForces(deltaTime) {
    // Logic remains unchanged, use shockwave.strength
    const now = performance.now();
    const shockwavesToRemove = []; // Store indices to remove later

    activeShockwaves.forEach((shockwave, index) => {
        const elapsedTime = (now - shockwave.startTime) / 1000; // seconds
        shockwave.currentRadius = elapsedTime * SHOCKWAVE_SPEED;

        // Check if shockwave has expired
        if (elapsedTime > SHOCKWAVE_DURATION) {
            shockwavesToRemove.push(index);
            return; // Skip force calculation for this expired shockwave
        }

        letterStates.forEach((state) => {
            if (!state || !state.el) return; // Safety check

            // Convert letter position to viewport coordinates for distance check
            const letterViewportX = state.x + containerOffsetX;
            const letterViewportY = state.y + containerOffsetY;

            const dx = letterViewportX - shockwave.x;
            const dy = letterViewportY - shockwave.y;
            const distSq = dx * dx + dy * dy;

            // Optimization: Broad phase check - skip if letter is too far away
            const maxPossibleRadius = SHOCKWAVE_DURATION * SHOCKWAVE_SPEED + SHOCKWAVE_EFFECT_RADIUS;
            const maxPossibleRadiusSq = maxPossibleRadius * maxPossibleRadius;
            if (distSq > maxPossibleRadiusSq) return;

            const dist = Math.sqrt(distSq);
            const deltaRadius = dist - shockwave.currentRadius; // Distance from letter center to wave center

            // Check if the letter is within the "thickness" of the shockwave front
            if (Math.abs(deltaRadius) < SHOCKWAVE_EFFECT_RADIUS && dist > 1) { // Avoid division by zero if dist is tiny
                // Calculate falloff based on distance from origin
                const falloff = Math.pow(dist, SHOCKWAVE_FALLOFF) + 1; // Add 1 to prevent division by zero near origin
                // Calculate force magnitude using stored strength and falloff
                let forceMagnitude = Math.max(0, (shockwave.strength / falloff));

                // Normalized direction vector (away from shockwave origin)
                const forceDirX = dx / dist;
                const forceDirY = dy / dist;

                // Apply force as acceleration (scaled by deltaTime)
                state.vx += forceDirX * forceMagnitude * deltaTime;
                state.vy += forceDirY * forceMagnitude * deltaTime;

                // Mark the letter as recently hit so return force is suspended
                state.wasHitByShockwaveRecently = true;
            }
        });
    });

    // Remove expired shockwaves (iterate backwards to avoid index issues)
    for (let i = shockwavesToRemove.length - 1; i >= 0; i--) {
        activeShockwaves.splice(shockwavesToRemove[i], 1);
    }
}

// --- Debug Drawing ---
function drawDebugInfo() {
    // No functional changes needed
    if (!debugCtx || !debugCanvas) return; // Ensure canvas context exists

    // Clear previous frame
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

    // Only draw if debug mode is active
    if (!isDebugMode) return;

    // Draw active shockwaves
    debugCtx.strokeStyle = DEBUG_SHOCKWAVE_COLOR;
    debugCtx.lineWidth = DEBUG_SHOCKWAVE_LINEWIDTH;
    activeShockwaves.forEach(shockwave => {
        // Only draw if radius is positive (shockwave has started expanding)
        if (shockwave.currentRadius > 0) {
            debugCtx.beginPath();
            debugCtx.arc(shockwave.x, shockwave.y, shockwave.currentRadius, 0, Math.PI * 2);
            debugCtx.stroke();
        }
    });

    // Optionally draw letter bounding boxes, velocity vectors etc. here if needed
}


function updateLetters() {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1); // Clamp max delta time
    lastFrameTime = currentTime;
    // Pre-calculate deltaTime * 60 for smoothing calculations if desired, though direct pow is fine.
    // const deltaTimeSixty = deltaTime * 60; // Represents scaling to a 60fps frame budget

    if (letterStates.length === 0) {
        animationFrameId = null; // Stop loop if no letters
        return;
    }
    if (!container) {
        console.error("Container lost during animation loop.");
        animationFrameId = null;
        return;
    }

    updateContainerOffset(); // Ensure offset is current
    // Optional: Check container dimensions less frequently if performance is critical and size rarely changes
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
        console.warn("Container has zero dimensions, pausing animation.");
        animationFrameId = null;
        return;
    }

    // Calculate mouse velocity (pixels per frame)
    mouseVX = mouseX - prevMouseX;
    mouseVY = mouseY - prevMouseY;
    prevMouseX = mouseX;
    prevMouseY = mouseY;

    // Mouse position relative to the container origin
    const mouseRelativeX = mouseX - containerOffsetX;
    const mouseRelativeY = mouseY - containerOffsetY;
    const mouseRadiusSq = MOUSE_RADIUS * MOUSE_RADIUS; // Cache squared radius

    // Apply forces from active shockwaves (this might set wasHitByShockwaveRecently flag)
    applyShockwaveForces(deltaTime);

    // --- Calculate charge state ---
    let holdDuration = 0;
    let chargeRatio = 0;
    if (isMouseDown) {
        holdDuration = (currentTime - mouseDownStartTime) / 1000;
        chargeRatio = Math.min(holdDuration / SHOCKWAVE_CHARGE_DURATION_CAP, 1.0); // Clamp ratio
    }

    // --- Physics Update Loop ---
    letterStates.forEach((state) => {
        if (!state || !state.el) return; // Safety check

        // Calculate speed *before* applying drag and return force for this frame's logic
        // Note: speed calculation is moved *after* velocity clamping later for appearance updates
        const currentSpeedForLogic = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

        // Check if we should re-enable return force
        // If recently hit by a shockwave, check if it has slowed down enough
        if (state.wasHitByShockwaveRecently && currentSpeedForLogic < MIN_RETURN_SPEED_THRESHOLD) {
            state.wasHitByShockwaveRecently = false; // Re-enable return force
        }

        // 1. Mouse Interaction
        if (isMouseDown) {
            // --- Attraction Force (while charging) ---
            const dxAttract = mouseRelativeX - state.x;
            const dyAttract = mouseRelativeY - state.y;
            const distAttractSq = dxAttract * dxAttract + dyAttract * dyAttract;

            if (distAttractSq > 1) { // Avoid division by zero
                const distAttract = Math.sqrt(distAttractSq);
                const dirXAttract = dxAttract / distAttract;
                const dirYAttract = dyAttract / distAttract;

                // Attraction strength increases with charge
                const attractionMagnitude = MOUSE_ATTRACTION_STRENGTH * chargeRatio;

                // Apply force as acceleration scaled by deltaTime
                state.vx += dirXAttract * attractionMagnitude * deltaTime;
                state.vy += dirYAttract * attractionMagnitude * deltaTime;
            }
        } else {
            // --- Repulsion/Impulse Force (when not charging) ---
            const dxMouse = mouseRelativeX - state.x;
            const dyMouse = mouseRelativeY - state.y;
            const distSq = dxMouse * dxMouse + dyMouse * dyMouse;

            // Check if mouse is within radius
            if (distSq < mouseRadiusSq && distSq > 0.01) { // Avoid division by zero/strong force at center
                const dist = Math.sqrt(distSq);
                const proximityFactor = (1 - dist / MOUSE_RADIUS); // 1 near center, 0 at edge

                // Apply impulse based on mouse velocity (scaled by proximity and MOUSE_FORCE)
                const impulseMagnitude = MOUSE_FORCE * proximityFactor; // Base impulse magnitude
                state.vx += mouseVX * impulseMagnitude * deltaTime * 60; // Scale by approx 60fps equiv
                state.vy += mouseVY * impulseMagnitude * deltaTime * 60; // Scale by approx 60fps equiv

                // Apply outward push force (scaled by proximity)
                const pushMagnitude = 0.05 * proximityFactor; // Base push magnitude
                const pushForceX = (dxMouse / dist) * pushMagnitude * deltaTime * 60; // Scale by approx 60fps equiv
                const pushForceY = (dyMouse / dist) * pushMagnitude * deltaTime * 60; // Scale by approx 60fps equiv
                state.vx -= pushForceX;
                state.vy -= pushForceY;
            }
        }

        // 2. Return Force (towards home position) - ONLY if not coasting from shockwave
        if (!state.wasHitByShockwaveRecently) { // MODIFIED: Check the flag
            const dxHome = state.homeX - state.x;
            const dyHome = state.homeY - state.y;
            // Apply force as acceleration (scaled by deltaTime and RETURN_FORCE)
            const returnAccel = RETURN_FORCE;
            state.vx += dxHome * returnAccel * deltaTime * 60; // Scale by approx 60fps equiv
            state.vy += dyHome * returnAccel * deltaTime * 60; // Scale by approx 60fps equiv
        }

        // 3. Drag (velocity reduction)
        // effectiveDrag needs to scale with deltaTime to provide consistent damping
        const effectiveDrag = Math.pow(DRAG_FACTOR, deltaTime * 60); // Scale exponent by approx 60fps equiv
        state.vx *= effectiveDrag;
        state.vy *= effectiveDrag;

        // 4. Update Position (based on velocity)
        // Scale position update by deltaTime to make movement frame-rate independent
        state.x += state.vx * deltaTime * 60; // Scale by approx 60fps equiv
        state.y += state.vy * deltaTime * 60; // Scale by approx 60fps equiv

        // 5. Clamp Velocity (prevent excessive speeds) and Cache Speed for Appearance
        const speedSq = state.vx * state.vx + state.vy * state.vy;
        if (speedSq > MAX_SPEED * MAX_SPEED) {
            state.speed = MAX_SPEED; // Cache the clamped speed
            const scaleFactor = MAX_SPEED / Math.sqrt(speedSq);
            state.vx *= scaleFactor;
            state.vy *= scaleFactor;
        } else {
            state.speed = Math.sqrt(speedSq); // Cache the current speed
        }

    }); // End physics update loop

    // Apply inter-letter forces after individual updates
    applySpacingForce();
    checkCollisions(); // Resolve overlaps and apply collision impulses

    // --- Appearance Update Loop ---
    letterStates.forEach((state) => {
        if (!state || !state.el) return;

        // --- Calculate Target Visual Properties Based on Physics ---
        const currentSpeed = state.speed; // Use cached speed from physics loop

        // Squash and Stretch based on speed
        const baseScaleFactor = currentSpeed * SQUASH_STRETCH_FACTOR * 0.05; // Scale factor intensity
        const scaleFactor = 1 + Math.max(0, baseScaleFactor); // Ensure scale doesn't go below 1 here

        if (currentSpeed > 0.1) { // Avoid instability at very low speeds
            // Calculate scale direction based on velocity vector
            const angle = Math.atan2(state.vy, state.vx);
            const cosAngle = Math.abs(Math.cos(angle)); // Stretch axis
            const sinAngle = Math.abs(Math.sin(angle)); // Squash axis
            // Target scale: stretch along motion axis, squash perpendicular (with some adjustment)
            state.physicsTargetScaleX = 1 + (scaleFactor - 1) * sinAngle - (scaleFactor - 1) * cosAngle * 0.5;
            state.physicsTargetScaleY = 1 + (scaleFactor - 1) * cosAngle - (scaleFactor - 1) * sinAngle * 0.5;
        } else {
            // Return to base scale when slow
            state.physicsTargetScaleX = 1;
            state.physicsTargetScaleY = 1;
        }

        // Font variations based on speed and velocity X
        state.physicsTargetWght = BASE_WEIGHT + currentSpeed * WEIGHT_SPEED_FACTOR;
        state.physicsTargetWdth = BASE_WIDTH + currentSpeed * WIDTH_SPEED_FACTOR;
        state.physicsTargetSlnt = BASE_SLANT + state.vx * SLANT_VELOCITY_FACTOR; // Slant based on horizontal velocity

        // Rotation based on velocity X
        const targetRotation = state.vx * ROTATION_FACTOR;

        // --- Smooth Visual Properties Towards Target Values (Lerping) ---
        // Calculate effective smoothing factor based on deltaTime
        const effectiveScaleSmoothing = Math.pow(SCALE_SMOOTHING, deltaTime * 60);
        const effectiveFontSmoothing = Math.pow(VAR_FONT_SMOOTHING, deltaTime * 60);
        const effectiveRotationSmoothing = Math.pow(ROTATION_SMOOTHING, deltaTime * 60);

        // Lerp factor (amount of change per frame)
        const lerpFactorScale = 1 - effectiveScaleSmoothing;
        const lerpFactorFont = 1 - effectiveFontSmoothing;
        const lerpFactorRotation = 1 - effectiveRotationSmoothing;

        state.scaleX += (state.physicsTargetScaleX - state.scaleX) * lerpFactorScale;
        state.scaleY += (state.physicsTargetScaleY - state.scaleY) * lerpFactorScale;
        state.wght += (state.physicsTargetWght - state.wght) * lerpFactorFont;
        state.wdth += (state.physicsTargetWdth - state.wdth) * lerpFactorFont;
        state.slnt += (state.physicsTargetSlnt - state.slnt) * lerpFactorFont;
        state.currentRotation += (targetRotation - state.currentRotation) * lerpFactorRotation;

        // Snap rotation to 0 if it's very close and target is 0 (prevents lingering micro-rotations)
        if (Math.abs(state.currentRotation) < 0.01 && Math.abs(targetRotation) < 0.01) {
            state.currentRotation = 0;
        }

        // --- Apply Oscillations ---
        const time = currentTime; // Use the same time for all oscillations in this frame
        const oscWght = (Math.sin(state.oscillationPhaseWght + time * FONT_OSCILLATION_SPEED) * WEIGHT_OSCILLATION_RANGE / 2);
        const oscWdth = (Math.sin(state.oscillationPhaseWdth + time * FONT_OSCILLATION_SPEED) * WIDTH_OSCILLATION_RANGE / 2);
        // Only calculate slant oscillation if range is > 0
        const oscSlnt = (SLANT_OSCILLATION_RANGE > 0)
            ? (Math.sin(state.oscillationPhaseSlnt + time * FONT_OSCILLATION_SPEED) * SLANT_OSCILLATION_RANGE / 2)
            : 0;
        const oscScaleX = (Math.sin(state.oscillationPhaseScaleX + time * SCALE_OSCILLATION_SPEED) * SCALE_OSCILLATION_RANGE / 2);
        const oscScaleY = (Math.sin(state.oscillationPhaseScaleY + time * SCALE_OSCILLATION_SPEED) * SCALE_OSCILLATION_RANGE / 2);

        // Combine smoothed physics-based values with oscillations
        let displayWght = state.wght + oscWght;
        let displayWdth = state.wdth + oscWdth;
        let displaySlnt = state.slnt + oscSlnt;
        let displayScaleX = state.scaleX + oscScaleX;
        let displayScaleY = state.scaleY + oscScaleY;

        // --- Clamp Final Visual Values ---
        displayWght = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, displayWght));
        displayWdth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, displayWdth));
        // Note: MIN_SLANT is negative, MAX_SLANT is 0. Max clamps towards 0, Min clamps towards -10.
        displaySlnt = Math.max(MIN_SLANT, Math.min(MAX_SLANT, displaySlnt));
        displayScaleX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, displayScaleX));
        displayScaleY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, displayScaleY));

        // --- Apply Styles to DOM Element ---
        const translateX = state.x - state.homeX;
        const translateY = state.y - state.homeY;
        const rotation = state.currentRotation;

        // Use toFixed for potentially smoother rendering and smaller string size
        state.el.style.transform = `translate(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px) rotate(${rotation.toFixed(2)}deg) scale(${displayScaleX.toFixed(2)}, ${displayScaleY.toFixed(2)})`;
        state.el.style.fontVariationSettings = `"wght" ${displayWght.toFixed(1)}, "wdth" ${displayWdth.toFixed(1)}, "slnt" ${displaySlnt.toFixed(1)}`;

        // --- Apply/Remove Debug Styling ---
        if (isDebugMode) {
            const normalizedSpeed = MAX_SPEED > 0 ? Math.min(1, currentSpeed / MAX_SPEED) : 0;
            // Hue shifts from Blue (0 speed) to Red (max speed)
            const colorHue = 360 * (1 - normalizedSpeed);
            const colorLum = 1 - (normalizedSpeed*0.5)+0.5;

            state.el.style.backgroundColor = `hsla(${colorHue.toFixed(0)}, 5%, 100%, 1)`;
            state.el.style.border = '1px solid rgba(0, 0, 0, 0)';
            state.el.style.color = 'transparent'; // Hide original text color
            state.el.style.boxSizing = 'border-box';
            state.wasInDebugMode = true;
        } else {
            // If previously in debug mode, remove the styles
            if (state.wasInDebugMode) {
                state.el.style.removeProperty('background-color');
                state.el.style.removeProperty('border');
                state.el.style.removeProperty('color');
                state.el.style.removeProperty('box-sizing');
                state.wasInDebugMode = false;
            }
        }
    }); // End appearance loop

    // Draw debug overlays (like shockwaves) if enabled
    drawDebugInfo();

    // Request the next frame
    animationFrameId = requestAnimationFrame(updateLetters);
}

// --- Event Listeners ---

// Mouse Movement: Update global mouse coordinates
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});

// Mouse Down: Start charging interaction
document.addEventListener('mousedown', (event) => {
    // Ignore clicks that aren't the main button (left-click)
    if (event.button !== 0) return;

    isMouseDown = true;
    mouseDownStartTime = performance.now();
    mouseDownX = event.clientX; // Record viewport coordinates for shockwave origin
    mouseDownY = event.clientY;
    // Shockwave is created on mouseup
});

// Mouse Up: Release shockwave
document.addEventListener('mouseup', (event) => {
    // Ignore if not left-click or if mouse wasn't pressed down initially
    if (event.button !== 0 || !isMouseDown) return;

    const holdDuration = (performance.now() - mouseDownStartTime) / 1000; // seconds
    // Calculate charge ratio (0 to 1) based on hold duration
    const chargeRatio = Math.min(holdDuration / SHOCKWAVE_CHARGE_DURATION_CAP, 1.0);
    // Interpolate shockwave strength based on charge ratio
    const currentShockwaveStrength = SHOCKWAVE_MIN_STRENGTH + (SHOCKWAVE_MAX_STRENGTH - SHOCKWAVE_MIN_STRENGTH) * chargeRatio;

    // Create the shockwave originating from the initial mousedown position
    activeShockwaves.push({
        x: mouseDownX,          // Use stored viewport X
        y: mouseDownY,          // Use stored viewport Y
        startTime: performance.now(), // Start expansion timer now
        currentRadius: 0,        // Initial radius
        strength: currentShockwaveStrength // Store the calculated strength
    });

    isMouseDown = false; // Reset mouse down state
});


// Window Resize: Re-initialize letters and canvas
let resizeTimeout;
window.addEventListener('resize', () => {
    // Debounce resize event to avoid rapid re-initializations
    clearTimeout(resizeTimeout);
    // Pause animation during resize calculations
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Animation paused for resize.");
    }
    resizeTimeout = setTimeout(() => {
        console.log("Recalculating layout on resize...");
        // Reset mouse state and positions (center screen)
        mouseX = window.innerWidth / 2;
        mouseY = window.innerHeight / 2;
        prevMouseX = mouseX; prevMouseY = mouseY;
        mouseVX = 0; mouseVY = 0;
        activeShockwaves = []; // Clear existing shockwaves
        isMouseDown = false;   // Reset mouse down state

        // Resize debug canvas if it exists
        if (debugCanvas) {
            debugCanvas.width = window.innerWidth;
            debugCanvas.height = window.innerHeight;
            console.log("Debug canvas resized.");
        }

        // Re-initialize letter positions and start animation
        initializeLetters();
    }, 250); // Wait 250ms after last resize event
});

// Keydown: Toggle debug mode
document.addEventListener('keydown', (event) => {
    // Ignore key presses if focus is on an input element
    const targetTagName = event.target.tagName.toLowerCase();
    if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'select' || event.target.isContentEditable) {
        return;
    }

    // Toggle debug mode on 'd' key press
    if (event.key.toLowerCase() === 'd') {
        isDebugMode = !isDebugMode;
        console.log(`Debug mode ${isDebugMode ? 'enabled' : 'disabled'}.`);
        // Clear debug canvas immediately when disabling debug mode
        if (!isDebugMode && debugCtx && debugCanvas) {
            debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        }
        // Trigger a visual update if animation is running (already handled by loop)
        // If paused, debug styles might need manual update if desired
    }
});

// --- Initialization ---

// Function to run the main setup
function runInitialization() {
    // Set initial mouse state
    mouseX = window.innerWidth / 2;
    mouseY = window.innerHeight / 2;
    prevMouseX = mouseX; prevMouseY = mouseY;
    mouseVX = 0; mouseVY = 0;
    activeShockwaves = [];
    isMouseDown = false; // Ensure mouse state is reset on init

    // Use document.fonts API for better font loading detection
    if (document.fonts) {
        document.fonts.load('1em "Roboto Flex"') // Check for the specific font
            .then(() => {
                console.log('Font "Roboto Flex" loaded.');
                initializeLetters();
            })
            .catch(err => {
                console.error('Font loading error:', err);
                // Fallback initialization if font loading check fails
                setTimeout(initializeLetters, 500);
            });
    } else {
        // Fallback for browsers not supporting document.fonts
        console.warn('FontFaceSet API not supported. Using fallback timer for initialization.');
        setTimeout(initializeLetters, 500); // Wait a bit and hope font is ready
    }
}

// Wait for the DOM to be ready before running initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialization);
} else {
    // DOM is already loaded
    runInitialization();
}