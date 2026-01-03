// Sound Manager using Web Audio API for procedural sounds
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.musicGain = null;
        this.sfxGain = null;
        this.engineOscillators = [];
        this.musicInterval = null;
    }

    init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext ||
                window.webkitAudioContext)();

            // Master gain nodes
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = 0.3;
            this.musicGain.connect(this.audioContext.destination);

            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = 0.5;
            this.sfxGain.connect(this.audioContext.destination);

            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported");
        }
    }

    // Simple beep sound
    beep(frequency = 440, duration = 0.1, type = "sine") {
        if (!this.initialized || !this.sfxEnabled) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            this.audioContext.currentTime + duration
        );

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    // Countdown beeps (3, 2, 1, GO!)
    playCountdown(callback) {
        if (!this.initialized) return callback?.();

        const times = [0, 1000, 2000, 3000];
        const freqs = [440, 440, 440, 880];
        const durations = [0.2, 0.2, 0.2, 0.5];

        times.forEach((time, i) => {
            setTimeout(() => {
                this.beep(freqs[i], durations[i], "square");
            }, time);
        });

        setTimeout(callback, 3500);
    }

    // Lap completion sound
    playLapComplete() {
        if (!this.initialized || !this.sfxEnabled) return;

        // Rising arpeggio
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => this.beep(freq, 0.15, "square"), i * 80);
        });
    }

    // Win fanfare
    playWin() {
        if (!this.initialized || !this.sfxEnabled) return;

        // Victory fanfare melody
        const notes = [523, 659, 784, 1047, 784, 1047];
        const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.5];
        let time = 0;

        notes.forEach((freq, i) => {
            setTimeout(() => this.beep(freq, durations[i], "square"), time);
            time += durations[i] * 1000 + 50;
        });
    }

    // Realistic engine sound with 4 harmonic oscillators
    updateEngineSound(cars) {
        if (!this.initialized || !this.sfxEnabled) return;

        const car = cars[0];
        if (!car) return;

        // Calculate RPM from speed (800 idle to 6000 max)
        const speedRatio = car.getSpeedRatio();
        const rpm = car.idleRPM + speedRatio * (car.maxRPM - car.idleRPM);
        car.rpm = rpm; // Store for HUD if needed

        // Base frequency from RPM (engine fires 2 times per revolution for 4-cyl)
        const baseFreq = (rpm / 60) * 2;

        // Create engine oscillators if they don't exist
        if (this.engineOscillators.length === 0) {
            // 4 harmonics for rich, layered sound
            const harmonics = [
                { mult: 0.5, type: "sawtooth", vol: 0.03 }, // Subharmonic rumble (low growl)
                { mult: 1.0, type: "sawtooth", vol: 0.05 }, // Fundamental (main engine tone)
                { mult: 2.0, type: "square", vol: 0.02 }, // 1st harmonic (overtone)
                { mult: 3.0, type: "triangle", vol: 0.01 }, // 2nd harmonic (higher overtone)
            ];

            harmonics.forEach((h) => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();

                osc.type = h.type;
                osc.frequency.value = baseFreq * h.mult;

                // Low-pass filter - opens up at higher speeds for aggressive sound
                filter.type = "lowpass";
                filter.frequency.value = 600;
                filter.Q.value = 1;

                gain.gain.value = 0;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);
                osc.start();

                this.engineOscillators.push({
                    osc,
                    gain,
                    filter,
                    mult: h.mult,
                    baseVol: h.vol,
                });
            });
        }

        // Update engine sound parameters
        const time = this.audioContext.currentTime;
        const rpmPercent = (rpm - car.idleRPM) / (car.maxRPM - car.idleRPM);

        this.engineOscillators.forEach((e) => {
            // Update frequency based on RPM
            const targetFreq = baseFreq * e.mult;
            e.osc.frequency.setTargetAtTime(targetFreq, time, 0.05);

            // Volume scaling - gets louder as you accelerate
            const targetVol =
                speedRatio > 0.01 ? e.baseVol * (0.5 + rpmPercent * 0.5) : 0;
            e.gain.gain.setTargetAtTime(targetVol, time, 0.1);

            // Filter opens up at higher RPM for more aggressive sound
            const filterFreq = 600 + rpmPercent * 1500;
            e.filter.frequency.setTargetAtTime(filterFreq, time, 0.1);
        });
    }

    stopEngineSound() {
        this.engineOscillators.forEach((e) => {
            e.gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
            setTimeout(() => e.osc.stop(), 200);
        });
        this.engineOscillators = [];
    }

    // Load and play background music from music folder
    startMusic() {
        if (!this.musicEnabled) return;

        // Check if music element exists
        if (!this.musicElement) {
            this.musicElement = document.getElementById("bgMusic");
            if (this.musicElement) {
                // Randomly select one of the action tracks
                const tracks = [
                    "music/bgm_action_1.mp3",
                    "music/bgm_action_2.mp3",
                    "music/bgm_action_3.mp3",
                    "music/bgm_action_4.mp3",
                    "music/bgm_action_5.mp3",
                ];
                const randomTrack =
                    tracks[Math.floor(Math.random() * tracks.length)];
                this.musicElement.src = randomTrack;
                this.musicElement.volume = 0.08; // Very low - let engines be heard
                this.musicElement.loop = true;
            }
        }

        if (this.musicElement) {
            this.musicElement
                .play()
                .catch((e) => console.log("Music autoplay blocked"));
        }
    }

    stopMusic() {
        if (this.musicElement) {
            this.musicElement.pause();
            this.musicElement.currentTime = 0;
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.stopMusic();
        } else {
            this.startMusic();
        }
        return this.musicEnabled;
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        if (!this.sfxEnabled) {
            this.stopEngineSound();
        }
        return this.sfxEnabled;
    }

    setMusicEnabled(enabled) {
        this.musicEnabled = enabled;
        if (!this.musicEnabled) {
            this.stopMusic();
        } else if (this.initialized) {
            this.startMusic();
        }
    }

    setSfxEnabled(enabled) {
        this.sfxEnabled = enabled;
        if (!this.sfxEnabled) {
            this.stopEngineSound();
        }
    }
}

// Global sound manager
const soundManager = new SoundManager();

const SETTINGS_KEY = "microRacer.settings";
const defaultSettings = {
    ghostEnabled: true,
    musicEnabled: true,
    sfxEnabled: true,
};

function loadSettings() {
    try {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        return { ...defaultSettings, ...(stored || {}) };
    } catch (e) {
        return { ...defaultSettings };
    }
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Gamepad Manager for controller support
class GamepadManager {
    constructor() {
        this.gamepads = {};
        this.deadzone = 0.15;
        
        window.addEventListener("gamepadconnected", (e) => {
            console.log(`Gamepad connected: ${e.gamepad.id}`);
            this.gamepads[e.gamepad.index] = e.gamepad;
        });
        
        window.addEventListener("gamepaddisconnected", (e) => {
            console.log(`Gamepad disconnected: ${e.gamepad.id}`);
            delete this.gamepads[e.gamepad.index];
        });
    }
    
    // Poll gamepads (must be called each frame as gamepad state isn't event-driven)
    poll() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepads[i] = gamepads[i];
            }
        }
    }
    
    getGamepad(index) {
        this.poll();
        return this.gamepads[index] || null;
    }
    
    getConnectedCount() {
        this.poll();
        return Object.keys(this.gamepads).filter(k => this.gamepads[k]).length;
    }
    
    getConnectedIndices() {
        this.poll();
        return Object.keys(this.gamepads)
            .filter(k => this.gamepads[k])
            .map(k => parseInt(k));
    }
    
    // Get steering input (-1 to 1) from left stick or d-pad
    getSteerInput(gamepadIndex) {
        const gamepad = this.getGamepad(gamepadIndex);
        if (!gamepad) return 0;
        
        // Left stick X axis (usually axis 0)
        let steer = gamepad.axes[0] || 0;
        
        // Apply deadzone
        if (Math.abs(steer) < this.deadzone) steer = 0;
        
        // Also check d-pad (buttons 14=left, 15=right on standard mapping)
        if (gamepad.buttons[14]?.pressed) steer = -1;
        if (gamepad.buttons[15]?.pressed) steer = 1;
        
        return steer;
    }
    
    // Get acceleration input (0 to 1) from right trigger or A button
    getAccelInput(gamepadIndex) {
        const gamepad = this.getGamepad(gamepadIndex);
        if (!gamepad) return 0;
        
        // Right trigger (button 7) or A button (button 0)
        const trigger = gamepad.buttons[7]?.value || 0;
        const aButton = gamepad.buttons[0]?.pressed ? 1 : 0;
        
        return Math.max(trigger, aButton);
    }
    
    // Get brake input (0 to 1) from left trigger or B button
    getBrakeInput(gamepadIndex) {
        const gamepad = this.getGamepad(gamepadIndex);
        if (!gamepad) return 0;
        
        // Left trigger (button 6) or B button (button 1)
        const trigger = gamepad.buttons[6]?.value || 0;
        const bButton = gamepad.buttons[1]?.pressed ? 1 : 0;
        
        return Math.max(trigger, bButton);
    }
    
    // Check if any button is pressed (for menu navigation)
    isAnyButtonPressed(gamepadIndex) {
        const gamepad = this.getGamepad(gamepadIndex);
        if (!gamepad) return false;
        
        return gamepad.buttons.some(b => b.pressed);
    }
}

// Global gamepad manager
const gamepadManager = new GamepadManager();


// Car Images - SVG cartoon cars
// Structure: CarImages[style][colorHex] = ImageObject
const CarImages = {
    loaded: false,
};

// Helper: Darken hex color for accents
function darkenColor(hex, amount = 0.3) {
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);

    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));

    return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// SVG Templates
const CarSVGTemplates = {
    roadster: (c, d) => `
        <svg width="23" height="43" viewBox="0 0 20 40" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="16" height="31" rx="3" fill="${c}"/>
            <rect x="4" y="12" width="12" height="16" rx="2" fill="${d}"/>
            <rect x="5" y="13" width="10" height="6" rx="1" fill="#87ceeb"/>
            <rect x="2" y="4" width="16" height="4" rx="2" fill="${d}"/>
            <circle cx="6" cy="5.5" r="1.2" fill="#ffff99"/>
            <circle cx="14" cy="5.5" r="1.2" fill="#ffff99"/>
            <rect x="-1" y="10" width="4" height="7" rx="1" fill="#222"/>
            <rect x="17" y="10" width="4" height="7" rx="1" fill="#222"/>
            <rect x="-1" y="25" width="4" height="7" rx="1" fill="#222"/>
            <rect x="17" y="25" width="4" height="7" rx="1" fill="#222"/>
            <rect x="8.5" y="8" width="3" height="27" fill="#ffffff" opacity="0.6"/>
        </svg>`,
    formula: (c, d) => `
        <svg width="24" height="42" viewBox="0 0 24 42" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="35" width="20" height="5" rx="1" fill="${d}"/>
            <rect x="0" y="24" width="6" height="10" rx="2" fill="#333"/>
            <rect x="18" y="24" width="6" height="10" rx="2" fill="#333"/>
            <path d="M 8 10 L 8 36 L 16 36 L 16 10 L 12 4 Z" fill="${c}"/>
            <path d="M 6 20 L 6 32 L 8 32 L 8 20 Z" fill="${d}"/>
            <path d="M 16 20 L 16 32 L 18 32 L 18 20 Z" fill="${d}"/>
            <rect x="1" y="8" width="5" height="8" rx="2" fill="#333"/>
            <rect x="18" y="8" width="5" height="8" rx="2" fill="#333"/>
            <path d="M 2 2 L 22 2 L 22 6 L 18 6 L 12 4 L 6 6 L 2 6 Z" fill="${d}"/>
            <rect x="10" y="16" width="4" height="8" rx="2" fill="#333"/>
            <circle cx="12" cy="20" r="3" fill="#ffff00"/>
            <rect x="11.5" y="4" width="1" height="10" fill="#ffffff" opacity="0.5"/>
        </svg>`,
    buggy: (c, d) => `
        <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="6" width="16" height="23" rx="2" fill="${c}"/>
            <rect x="7" y="8" width="12" height="19" rx="2" fill="none" stroke="${d}" stroke-width="2"/>
            <rect x="3" y="4" width="20" height="2.5" rx="1" fill="${d}"/>
            <circle cx="8" cy="5" r="1" fill="#ffff99"/>
            <circle cx="18" cy="5" r="1" fill="#ffff99"/>
            <circle cx="13" cy="28" r="4" fill="#333"/>
            <circle cx="13" cy="28" r="2" fill="#666"/>
            <rect x="-2" y="9" width="6" height="9" rx="2" fill="#222"/>
            <rect x="22" y="9" width="6" height="9" rx="2" fill="#222"/>
            <rect x="-2" y="18" width="6" height="9" rx="2" fill="#222"/>
            <rect x="22" y="18" width="6" height="9" rx="2" fill="#222"/>
        </svg>`,
    soapboat: (c, d) => `
        <svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="18" height="27" rx="8" fill="${c}"/>
            <ellipse cx="13" cy="5" rx="7" ry="3" fill="${d}"/>
            <circle cx="9" cy="5" r="1" fill="#ffff99"/>
            <circle cx="17" cy="5" r="1" fill="#ffff99"/>
            <rect x="6" y="10" width="14" height="16" rx="6" fill="${d}"/>
            <circle cx="13" cy="15" r="5" fill="#87ceeb" opacity="0.7"/>
            <circle cx="13" cy="15" r="3" fill="#ffffff" opacity="0.3"/>
            <rect x="0" y="10" width="4" height="7" rx="2" fill="#222"/>
            <rect x="22" y="10" width="4" height="7" rx="2" fill="#222"/>
            <rect x="0" y="19" width="4" height="7" rx="2" fill="#222"/>
            <rect x="22" y="19" width="4" height="7" rx="2" fill="#222"/>
        </svg>`,
    compact: (c, d) => `
        <svg width="18" height="34" viewBox="0 0 18 34" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="5" width="14" height="23" rx="5" fill="${c}"/>
            <ellipse cx="9" cy="6" rx="6" ry="2.5" fill="${d}"/>
            <circle cx="6" cy="6" r="1.2" fill="#ffff99"/>
            <circle cx="12" cy="6" r="1.2" fill="#ffff99"/>
            <rect x="4" y="11" width="10" height="12" rx="3" fill="${d}"/>
            <rect x="5" y="12" width="8" height="5" rx="1" fill="#87ceeb"/>
            <rect x="-1" y="10" width="4" height="7" rx="1" fill="#222"/>
            <rect x="15" y="10" width="4" height="7" rx="1" fill="#222"/>
            <rect x="-1" y="17" width="4" height="7" rx="1" fill="#222"/>
            <rect x="15" y="17" width="4" height="7" rx="1" fill="#222"/>
            <path d="M 6 30 Q 9 32 12 30" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`,
    truck: (c, d) => `
        <svg width="24" height="46" viewBox="0 0 24 46" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="16" width="16" height="24" rx="2" fill="${c}"/>
            <rect x="5" y="5" width="14" height="14" rx="2" fill="${d}"/>
            <rect x="5" y="4" width="14" height="3" rx="1" fill="#224422"/>
            <circle cx="8" cy="5.5" r="1" fill="#ffff99"/>
            <circle cx="16" cy="5.5" r="1" fill="#ffff99"/>
            <rect x="7" y="8" width="10" height="7" rx="1" fill="#87ceeb"/>
            <rect x="-1" y="10" width="5" height="8" rx="1" fill="#222"/>
            <rect x="20" y="10" width="5" height="8" rx="1" fill="#222"/>
            <rect x="-1" y="28" width="5" height="8" rx="1" fill="#222"/>
            <rect x="20" y="28" width="5" height="8" rx="1" fill="#222"/>
            <rect x="6" y="19" width="12" height="3" fill="#ffffff" opacity="0.3"/>
        </svg>`,
};

// Preload car SVG images by generating them
function preloadCarImages() {
    return new Promise((resolve) => {
        // Player colors: Red, Blue, Green, Yellow, plus Ghost (White)
        const colors = ["#ff4444", "#4444ff", "#44ff44", "#ffff44", "#ffffff"];
        const styles = Object.keys(CarSVGTemplates);
        const totalImages = styles.length * colors.length;
        let loadCount = 0;

        styles.forEach((style) => {
            CarImages[style] = {};
            colors.forEach((color) => {
                const darkColor = darkenColor(color);
                const svgString = CarSVGTemplates[style](color, darkColor);
                const blob = new Blob([svgString], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const img = new Image();

                img.onload = () => {
                    CarImages[style][color] = img;
                    URL.revokeObjectURL(url); // Clean up memory
                    loadCount++;
                    if (loadCount === totalImages) {
                        CarImages.loaded = true;
                        resolve();
                    }
                };
                img.src = url;
            });
        });
    });
}


class Car {
    constructor(
        x,
        y,
        startAngle = 0,
        color = "#ff4444",
        playerIndex = 0,
        style = {}
    ) {
        const speedScale = 0.5;
        this.x = x;
        this.y = y;
        this.width = 23;
        this.height = 43;
        this.speed = 0;
        this.maxSpeedAsphalt = 300 * speedScale; // Fast for arcade feel
        this.tiresOnTrackRatio = 1.0;
        this.acceleration = 0.6 * speedScale;
        this.deceleration = 0.3 * speedScale;
        this.onGrass = false;
        this.turnSpeed = 0;
        this.maxTurnSpeed = 4;
        this.steerInput = 0;
        this.angle = startAngle;
        this.color = color;
        this.playerIndex = playerIndex;
        this.style = style;

        // Engine/RPM system for sound (not visible gears, just sound)
        this.rpm = 800;
        this.idleRPM = 800;
        this.maxRPM = 6000;

        // Lap tracking
        this.lap = 0;
        this.crossedCheckpoint = false;
        this.crossedFinishLine = false;
        this.lapStartTime = Date.now();
        this.currentLapTime = 0;
        this.bestLapTime = null;
        this.slipstreamEndTime = 0;
    }

    getSpeedKmh() {
        // Convert game speed to km/h
        return Math.abs(Math.round(this.speed * 3.6));
    }

    getSpeedRatio() {
        return Math.min(Math.abs(this.speed) / this.maxSpeedAsphalt, 1);
    }

    getCollisionRadius() {
        return Math.max(this.width, this.height) * 0.45;
    }

    update() {
        this.x += Math.cos(this.angle - Math.PI / 2) * this.speed;
        this.y += Math.sin(this.angle - Math.PI / 2) * this.speed;

        const grassFriction = 0.82;
        const asphaltFriction = 0.95;
        const frictionBlend =
            asphaltFriction * this.tiresOnTrackRatio +
            grassFriction * (1.0 - this.tiresOnTrackRatio);
        this.speed *= frictionBlend;

        const speedRatio = this.getSpeedRatio();
        const steerFactor = Math.max(0.6, 1.2 - speedRatio * 0.6);
        const tractionFactor = 0.6 + 0.4 * this.tiresOnTrackRatio;
        const targetTurn =
            this.steerInput * this.maxTurnSpeed * steerFactor * tractionFactor;
        this.turnSpeed += (targetTurn - this.turnSpeed) * 0.25;

        const direction = this.speed < -0.5 ? -1 : 1;
        const turnScale = 0.35 + speedRatio * 0.75;
        this.angle += this.turnSpeed * 0.02 * direction * turnScale;

        this.currentLapTime = Date.now() - this.lapStartTime;
    }

    getCurrentMaxSpeed() {
        const speedReduction = (1.0 - this.tiresOnTrackRatio) * 0.04;
        return this.maxSpeedAsphalt * (1.0 - speedReduction);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        const shape = this.style.shape || "roadster";
        
        // Try to use SVG image if loaded
        if (CarImages.loaded && CarImages[shape] && CarImages[shape][this.color]) {
            const img = CarImages[shape][this.color];
            // Draw centered and scaled appropriately
            ctx.drawImage(
                img,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
            ctx.restore();
            return;
        }
        
        // Fallback to procedural drawing if images not loaded
        const bodyWidth = this.width + (this.style.bodyWidthDelta || 0);
        const bodyHeight = this.height + (this.style.bodyHeightDelta || 0);
        const roofColor =
            this.style.roofColor || darkenColor(this.color);
        const windowColor = this.style.windowColor || "#87ceeb";

        let drawWidth = bodyWidth;
        let drawHeight = bodyHeight;

        if (shape === "formula") {
            drawWidth = bodyWidth - 2;
            drawHeight = bodyHeight + 2;
            ctx.fillStyle = this.color;
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );

            // Cockpit
            ctx.fillStyle = windowColor;
            ctx.beginPath();
            ctx.ellipse(0, -drawHeight / 6, 6, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Front wing
            ctx.fillStyle = roofColor;
            ctx.fillRect(
                -drawWidth / 2 - 6,
                -drawHeight / 2 - 4,
                drawWidth + 12,
                4
            );

            // Rear wing
            ctx.fillRect(-drawWidth / 2 - 6, drawHeight / 2, drawWidth + 12, 4);
        } else if (shape === "buggy") {
            drawWidth = bodyWidth + 6;
            drawHeight = bodyHeight - 6;
            ctx.fillStyle = this.color;
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );

            // Roll cage
            ctx.strokeStyle = roofColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(
                -drawWidth / 2 + 4,
                -drawHeight / 2 + 4,
                drawWidth - 8,
                drawHeight - 8
            );

            // Spare tire
            ctx.fillStyle = "#222222";
            ctx.beginPath();
            ctx.arc(0, drawHeight / 2 - 4, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "soapboat") {
            drawWidth = bodyWidth + 6;
            drawHeight = bodyHeight - 4;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.roundRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight,
                8
            );
            ctx.fill();

            // Deck
            ctx.fillStyle = roofColor;
            ctx.beginPath();
            ctx.roundRect(
                -drawWidth / 2 + 4,
                -drawHeight / 2 + 8,
                drawWidth - 8,
                drawHeight - 18,
                6
            );
            ctx.fill();

            // Bubble dome
            ctx.fillStyle = windowColor;
            ctx.beginPath();
            ctx.arc(0, -drawHeight / 6, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === "truck") {
            drawWidth = bodyWidth + 4;
            drawHeight = bodyHeight + 6;
            ctx.fillStyle = this.color;
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );

            // Cab
            ctx.fillStyle = roofColor;
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth * 0.6,
                drawHeight * 0.55
            );

            // Windshield
            ctx.fillStyle = windowColor;
            ctx.fillRect(
                -drawWidth / 2 + 3,
                -drawHeight / 2 + 4,
                drawWidth * 0.45,
                10
            );
        } else if (shape === "compact") {
            drawWidth = bodyWidth - 2;
            drawHeight = bodyHeight - 6;
            ctx.fillStyle = this.color;
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );

            ctx.fillStyle = roofColor;
            ctx.fillRect(
                -drawWidth / 2 + 3,
                -drawHeight / 2 + 6,
                drawWidth - 6,
                drawHeight - 18
            );

            ctx.fillStyle = windowColor;
            ctx.fillRect(
                -drawWidth / 2 + 4,
                -drawHeight / 2 + 7,
                drawWidth - 8,
                6
            );
        } else {
            drawWidth = bodyWidth;
            drawHeight = bodyHeight;
            ctx.fillStyle = this.color;
            ctx.fillRect(
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );

            ctx.fillStyle = roofColor;
            ctx.fillRect(
                -drawWidth / 2 + 3,
                -drawHeight / 2 + 8,
                drawWidth - 6,
                drawHeight - 20
            );

            ctx.fillStyle = windowColor;
            ctx.fillRect(
                -drawWidth / 2 + 4,
                -drawHeight / 2 + 9,
                drawWidth - 8,
                8
            );
        }

        const wheelWidth = shape === "buggy" ? 6 : 4;
        const wheelHeight = shape === "formula" ? 10 : 8;
        const halfW = drawWidth / 2;
        const halfH = drawHeight / 2;
        const frontY = -halfH + 7;
        const rearY = halfH - 15;

        ctx.fillStyle = "#000";
        ctx.fillRect(-halfW - 2, frontY, wheelWidth, wheelHeight);
        ctx.fillRect(halfW - 2, frontY, wheelWidth, wheelHeight);
        ctx.fillRect(-halfW - 2, rearY, wheelWidth, wheelHeight);
        ctx.fillRect(halfW - 2, rearY, wheelWidth, wheelHeight);

        // Headlights
        ctx.fillStyle = "#ffff99";
        ctx.fillRect(-halfW + 2, -halfH, 4, 3);
        ctx.fillRect(halfW - 6, -halfH, 4, 3);

        ctx.restore();
    }

    getDarkerColor(hex) {
        // Convert hex to RGB and darken
        const r = parseInt(hex.slice(1, 3), 16) * 0.7;
        const g = parseInt(hex.slice(3, 5), 16) * 0.7;
        const b = parseInt(hex.slice(5, 7), 16) * 0.7;
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }
}

class Track {
    constructor(trackIndex = 0) {
        this.width = 120;
        this.points = [];
        this.trackIndex = trackIndex;

        // 10 track names matching household themes from PRD
        this.trackNames = [
            "Breakfast Table",
            "Pool Table",
            "Office Desk",
            "Garden Path",
            "Bathtub Ring",
            "Bookshelf Slalom",
            "Treehouse",
            "Toy Box",
            "Kitchen Counter",
            "Dinner Plate",
        ];

        this.themes = [
            {
                name: "Breakfast Table",
                background: {
                    base: "#1a3d1a",
                    pattern: {
                        type: "tartan",
                        fg: "#0d2610",
                        fg2: "#2a5c2a",
                        size: 48,
                        alpha: 0.5,
                    },
                },
                track: {
                    base: "#3a3a3a",
                    edge: "#2a2a2a",
                    stripe: "#ffffff",
                    dash: [18, 10],
                    texture: {
                        type: "speckles",
                        fg: "#4a4a4a",
                        size: 28,
                        alpha: 0.3,
                    },
                },
                checkpoint: "#ffcc00",
                vehicle: { shape: "formula" },
            },
            {
                name: "Pool Table",
                background: {
                    base: "#0f5a3a",
                    pattern: {
                        type: "grid",
                        fg: "#134f35",
                        size: 48,
                        alpha: 0.4,
                    },
                },
                track: {
                    base: "#15452c",
                    edge: "#0c2f1e",
                    stripe: "#f5f2e8",
                    dash: [14, 12],
                    texture: {
                        type: "speckles",
                        fg: "#1c5a39",
                        size: 20,
                        alpha: 0.4,
                    },
                },
                checkpoint: "#f4c95d",
                vehicle: { shape: "formula" },
            },
            {
                name: "Office Desk",
                background: {
                    base: "#dad4cc",
                    pattern: {
                        type: "grid",
                        fg: "#c6beb3",
                        size: 48,
                        alpha: 0.5,
                    },
                },
                track: {
                    base: "#4f5258",
                    edge: "#2f3236",
                    stripe: "#f0f0f0",
                    dash: [22, 12],
                    texture: {
                        type: "stripes",
                        fg: "#5d6168",
                        size: 24,
                        alpha: 0.35,
                    },
                },
                checkpoint: "#ffcc66",
                vehicle: { shape: "compact" },
            },
            {
                name: "Garden Path",
                background: {
                    base: "#6d8b57",
                    pattern: {
                        type: "speckles",
                        fg: "#5a7648",
                        size: 44,
                        alpha: 0.45,
                    },
                },
                track: {
                    base: "#8b643a",
                    edge: "#5f4325",
                    stripe: "#f4e7d2",
                    dash: [16, 14],
                    texture: {
                        type: "speckles",
                        fg: "#9a7347",
                        size: 28,
                        alpha: 0.4,
                    },
                },
                checkpoint: "#ffe082",
                vehicle: { shape: "buggy" },
            },
            {
                name: "Bathtub Ring",
                background: {
                    base: "#e7f0f2",
                    pattern: {
                        type: "waves",
                        fg: "#d3e2e6",
                        size: 48,
                        alpha: 0.45,
                    },
                },
                track: {
                    base: "#c3c9cd",
                    edge: "#9ea6ab",
                    stripe: "#ffffff",
                    dash: [20, 14],
                    texture: {
                        type: "stripes",
                        fg: "#d5dadf",
                        size: 30,
                        alpha: 0.35,
                    },
                },
                checkpoint: "#ffe17a",
                vehicle: { shape: "soapboat" },
            },
            {
                name: "Bookshelf Slalom",
                background: {
                    base: "#7a5b3a",
                    pattern: {
                        type: "planks",
                        fg: "#6b4d32",
                        size: 60,
                        alpha: 0.45,
                    },
                },
                track: {
                    base: "#5a3f2a",
                    edge: "#3d2a1b",
                    stripe: "#f3e5cf",
                    dash: [16, 10],
                    texture: {
                        type: "grain",
                        fg: "#6b4b30",
                        size: 28,
                        alpha: 0.4,
                    },
                },
                checkpoint: "#ffd66e",
                vehicle: { shape: "truck" },
            },
            {
                name: "Treehouse",
                background: {
                    base: "#597447",
                    pattern: {
                        type: "speckles",
                        fg: "#4a643c",
                        size: 30,
                        alpha: 0.45,
                    },
                },
                track: {
                    base: "#a0744e",
                    edge: "#6b4b32",
                    stripe: "#fff1d6",
                    dash: [18, 12],
                    texture: {
                        type: "planks",
                        fg: "#8a6440",
                        size: 40,
                        alpha: 0.4,
                    },
                },
                checkpoint: "#ffe08c",
                vehicle: { shape: "truck" },
            },
            {
                name: "Toy Box",
                background: {
                    base: "#ffe5c2",
                    pattern: {
                        type: "confetti",
                        colors: ["#ff6b6b", "#2ec4b6", "#ffd166", "#5fa8ff"],
                        size: 50,
                        alpha: 0.5,
                    },
                },
                track: {
                    base: "#ff7f50",
                    edge: "#c85c38",
                    stripe: "#ffffff",
                    dash: [12, 10],
                    texture: {
                        type: "dots",
                        fg: "#ff966d",
                        size: 26,
                        alpha: 0.4,
                    },
                },
                checkpoint: "#fff1a1",
                vehicle: { shape: "compact" },
            },
            {
                name: "Kitchen Counter",
                background: {
                    base: "#e9ecef",
                    pattern: {
                        type: "tiles",
                        fg: "#cfd6dd",
                        size: 52,
                        alpha: 0.5,
                    },
                },
                track: {
                    base: "#7b8086",
                    edge: "#5b5f64",
                    stripe: "#ffffff",
                    dash: [20, 12],
                    texture: {
                        type: "speckles",
                        fg: "#90959b",
                        size: 28,
                        alpha: 0.4,
                    },
                },
                checkpoint: "#ffdd77",
                vehicle: { shape: "roadster" },
            },
            {
                name: "Dinner Plate",
                background: {
                    base: "#f5f1e6",
                    pattern: {
                        type: "rings",
                        fg: "#e0d8cc",
                        size: 80,
                        alpha: 0.35,
                    },
                },
                track: {
                    base: "#c23b22",
                    edge: "#8f2b18",
                    stripe: "#fff0d8",
                    dash: [14, 8],
                    texture: {
                        type: "speckles",
                        fg: "#d34a2f",
                        size: 26,
                        alpha: 0.35,
                    },
                },
                checkpoint: "#ffe7a1",
                vehicle: { shape: "formula" },
            },
        ];

        this.generateTrack();
    }

    getTheme() {
        return this.themes[this.trackIndex % this.themes.length];
    }

    generateTrack() {
        // Different seed for each track for variety
        const seed = 42 + this.trackIndex * 1337;
        const seededRandom = (i) => {
            const x = Math.sin(seed + i * 9999) * 10000;
            return x - Math.floor(x);
        };

        const segments = 28;
        const angleStep = (Math.PI * 2) / segments;
        const baseRadius = 800;

        this.points = [];

        // Generate points with a straight section at the start
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;

            // Make the first few and last few segments straight (near angle 0)
            // This creates a straight start/finish area
            let radiusVariation;

            // Segments 0, 1, 27, 26 are near the start - keep them at consistent radius
            if (i <= 2 || i >= segments - 2) {
                radiusVariation = 300; // Consistent radius for straight section
            } else {
                // Smooth variation for the rest, using sine waves for gentle curves
                radiusVariation =
                    200 +
                    Math.sin(angle * 2) * 200 +
                    Math.sin(angle * 3) * 100 +
                    seededRandom(i) * 150;
            }

            const radius = baseRadius + radiusVariation;

            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            this.points.push({ x, y });
        }

        const isProtectedIndex = (index) => index <= 2 || index >= segments - 2;
        const applyLateralOffset = (index, offset) => {
            if (isProtectedIndex(index)) return;
            const prevIndex = (index - 1 + segments) % segments;
            const nextIndex = (index + 1) % segments;
            const prev = this.points[prevIndex];
            const next = this.points[nextIndex];
            const dir = Math.atan2(next.y - prev.y, next.x - prev.x);
            const normalX = -Math.sin(dir);
            const normalY = Math.cos(dir);
            this.points[index].x += normalX * offset;
            this.points[index].y += normalY * offset;
        };

        const applyFeature = () => {
            const feature = this.trackIndex % 10;
            switch (feature) {
                case 0: {
                    // Chicane: quick left-right S
                    const start = 6;
                    [180, -180, 140, -140].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 1: {
                    // Hairpin: tight, sharp turn
                    const start = 7;
                    [-260, -340, -260].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 2: {
                    // Kink: subtle jog on a straight
                    const start = 8;
                    [120, -80].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 3: {
                    // Esses: flowing S curve
                    const start = 9;
                    [140, 100, -120, -160].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 4: {
                    // Carousel: long, tightening curve
                    const start = 13;
                    [120, 180, 220, 180, 120].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 5: {
                    // Slalom: repeated quick direction changes
                    const start = 7;
                    [140, -140, 140, -140, 120, -120].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 6: {
                    // Switchback: double hairpin feel
                    const start = 12;
                    [-220, -300, -220, 220, 300, 220].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 7: {
                    // Sweeper: big, fast arc
                    const start = 15;
                    [120, 160, 200, 220, 200, 160, 120].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 8: {
                    // Bus stop chicane: sharper, closer offsets
                    const start = 10;
                    [200, -220, 200].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                case 9: {
                    // Dogleg + pinch: small offset then tighter bend
                    const start = 14;
                    [120, 180, 240].forEach((offset, i) =>
                        applyLateralOffset(start + i, offset)
                    );
                    break;
                }
                default:
                    break;
            }
        };

        applyFeature();

        // Close the loop with the exact first point for seamless connection
        this.points.push({ x: this.points[0].x, y: this.points[0].y });
    }

    getTrackPoint(t) {
        const totalSegments = this.points.length - 1;
        const segmentIndex = Math.floor(t * totalSegments);
        const index = segmentIndex % totalSegments; // 0 to 27
        const u = t * totalSegments - segmentIndex;
        
        // Map index to control point index (1-based relative to points[0])
        // The track is drawn using points[1]..points[N] as control points
        // Segment 0 uses points[1] as control
        const i = index + 1;
        
        let start, control, end;
        
        control = this.points[i];
        
        if (index === 0) {
            // First segment: P[0] -> P[1] -> Mid(P[1], P[2])
            start = this.points[0];
            end = {
                x: (this.points[1].x + this.points[2].x) / 2,
                y: (this.points[1].y + this.points[2].y) / 2
            };
        } else if (index === totalSegments - 1) {
            // Last segment: Mid(P[N-1], P[N]) -> P[N] -> P[0]
            start = {
                x: (this.points[i-1].x + this.points[i].x) / 2,
                y: (this.points[i-1].y + this.points[i].y) / 2
            };
            end = this.points[0]; // Closes loop exactly
        } else {
            // Middle segments: Mid -> Control -> Mid
            start = {
                x: (this.points[i-1].x + this.points[i].x) / 2,
                y: (this.points[i-1].y + this.points[i].y) / 2
            };
            end = {
                x: (this.points[i].x + this.points[i+1].x) / 2,
                y: (this.points[i].y + this.points[i+1].y) / 2
            };
        }

        // Quadratic Bezier Interpolation
        // P(t) = (1-u)^2 S + 2(1-u)u C + u^2 E
        const u1 = 1 - u;
        return {
            x: u1 * u1 * start.x + 2 * u1 * u * control.x + u * u * end.x,
            y: u1 * u1 * start.y + 2 * u1 * u * control.y + u * u * end.y
        };
    }

    getTrackDirection(t) {
        // Analytical derivative of Quadratic Bezier
        // P'(t) = 2(1-u)(C - S) + 2u(E - C)
        const totalSegments = this.points.length - 1;
        const segmentIndex = Math.floor(t * totalSegments);
        const index = segmentIndex % totalSegments;
        const u = t * totalSegments - segmentIndex;
        
        const i = index + 1;
        
        let start, control, end;
        control = this.points[i];
        
        if (index === 0) {
            start = this.points[0];
            end = {
                x: (this.points[1].x + this.points[2].x) / 2,
                y: (this.points[1].y + this.points[2].y) / 2
            };
        } else if (index === totalSegments - 1) {
            start = {
                x: (this.points[i-1].x + this.points[i].x) / 2,
                y: (this.points[i-1].y + this.points[i].y) / 2
            };
            end = this.points[0];
        } else {
            start = {
                x: (this.points[i-1].x + this.points[i].x) / 2,
                y: (this.points[i-1].y + this.points[i].y) / 2
            };
            end = {
                x: (this.points[i].x + this.points[i+1].x) / 2,
                y: (this.points[i].y + this.points[i+1].y) / 2
            };
        }

        const u1 = 1 - u;
        const dx = 2 * u1 * (control.x - start.x) + 2 * u * (end.x - control.x);
        const dy = 2 * u1 * (control.y - start.y) + 2 * u * (end.y - control.y);
        
        return Math.atan2(dy, dx);
    }

    // Check if a point is on the track using distance calculation (more reliable than pixel sampling)
    isPointOnTrack(x, y) {
        // Sample the track at many points and find minimum distance to center line
        const samples = 100;
        let minDistance = Infinity;

        for (let i = 0; i < samples; i++) {
            const t = i / samples;
            const point = this.getTrackPoint(t);
            const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
            if (dist < minDistance) {
                minDistance = dist;
            }
        }

        // Car is on track if within half the track width from center line
        return minDistance < this.width / 2;
    }

    // Check what percentage of the car's tires are on track
    checkCarOnTrack(car) {
        const cos = Math.cos(car.angle);
        const sin = Math.sin(car.angle);

        // Tire positions relative to car center
        const tireOffsets = [
            { x: -8, y: -15 },
            { x: 8, y: -15 },
            { x: -8, y: 15 },
            { x: 8, y: 15 },
        ];

        let tiresOnTrack = 0;

        for (const offset of tireOffsets) {
            const tireX = car.x + offset.x * cos - offset.y * sin;
            const tireY = car.y + offset.x * sin + offset.y * cos;

            if (this.isPointOnTrack(tireX, tireY)) {
                tiresOnTrack++;
            }
        }

        return tiresOnTrack / 4;
    }
}

class Game {
    constructor(playerCount = 1, trackIndex = 0, settings = {}, controllerConfig = []) {
        this.playerCount = playerCount;
        this.trackIndex = trackIndex;
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.track = new Track(trackIndex);
        this.trackTheme = this.track.getTheme();
        this.patternCache = new Map();
        this.cars = [];
        this.keys = {};
        this.running = false;
        this.winner = null;
        this.lapsToWin = 3;
        this.ghostEnabled = settings.ghostEnabled !== false;
        this.lapSamples = Array.from({ length: this.playerCount }, () => []);
        this.lastSampleTimes = Array(this.playerCount).fill(0);
        this.bestLap = this.loadBestLap();
        this.ghostSamples = this.bestLap ? this.bestLap.samples : null;
        this.ghostLapTime = this.bestLap ? this.bestLap.time : null;
        this.ghostStartTime = Date.now();
        this.ghostCursor = 0;
        this.ghostLastTime = 0;
        this.countdownActive = false;
        this.countdownStartTime = 0;
        this.countdownEndTime = null;
        this.countdownDuration = 3500;
        this.slipstreamDistance = 140;
        this.slipstreamAngle = Math.PI / 6;
        this.slipstreamDuration = 450;
        this.slipstreamBoostAccel = 0.45;
        this.slipstreamMaxFactor = 1.08;
        this.ghostCar = new Car(
            0,
            0,
            0,
            "#ffffff",
            -1,
            this.trackTheme.vehicle || {}
        );

        // Player colors
        this.playerColors = ["#ff4444", "#4444ff", "#44ff44", "#ffff44"];

        // Controller configuration: array where each index is a player
        // null = keyboard, number = gamepad index
        this.controllerConfig = controllerConfig;

        // Key mappings for each player (used when not using controller)
        this.keyMaps = [
            {
                up: "arrowup",
                down: "arrowdown",
                left: "arrowleft",
                right: "arrowright",
            },
            { up: "w", down: "s", left: "a", right: "d" },
            { up: "i", down: "k", left: "j", right: "l" },
            { up: "8", down: "5", left: "4", right: "6" },
        ];

        // Resize canvas to fill screen
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());

        this.initCars();
        this.setupEventListeners();
    }

    getBestLapStorageKey() {
        return `microRacer.bestLap.${this.trackIndex}`;
    }

    loadBestLap() {
        try {
            const stored = JSON.parse(
                localStorage.getItem(this.getBestLapStorageKey())
            );
            if (!stored || !stored.time || !Array.isArray(stored.samples)) {
                return null;
            }
            return stored;
        } catch (e) {
            return null;
        }
    }

    saveBestLap(bestLap) {
        localStorage.setItem(
            this.getBestLapStorageKey(),
            JSON.stringify(bestLap)
        );
    }

    recordLapSample(car, index) {
        const sampleTime = car.currentLapTime;
        if (sampleTime - this.lastSampleTimes[index] < 30) return;
        this.lastSampleTimes[index] = sampleTime;
        this.lapSamples[index].push({
            t: sampleTime,
            x: car.x,
            y: car.y,
            angle: car.angle,
        });
    }

    setBestLap(lapTime, lapSamples) {
        const samples = lapSamples.map((sample) => ({ ...sample }));
        const bestLap = { time: lapTime, samples };
        this.bestLap = bestLap;
        this.ghostSamples = samples;
        this.ghostLapTime = lapTime;
        this.ghostStartTime = Date.now();
        this.ghostCursor = 0;
        this.ghostLastTime = 0;
        this.saveBestLap(bestLap);
    }

    interpolateAngle(a, b, t) {
        const twoPi = Math.PI * 2;
        const delta = ((b - a + Math.PI * 3) % twoPi) - Math.PI;
        return a + delta * t;
    }

    getGhostSampleAt(sampleTime) {
        if (!this.ghostSamples || this.ghostSamples.length === 0) return null;

        if (sampleTime < this.ghostLastTime) {
            this.ghostCursor = 0;
        }
        this.ghostLastTime = sampleTime;

        const samples = this.ghostSamples;
        let index = this.ghostCursor;

        while (index < samples.length - 1 && samples[index + 1].t < sampleTime) {
            index++;
        }

        this.ghostCursor = index;
        const current = samples[index];
        const next = samples[Math.min(index + 1, samples.length - 1)];

        if (!next || next.t === current.t) {
            return current;
        }

        const ratio = Math.min(
            Math.max((sampleTime - current.t) / (next.t - current.t), 0),
            1
        );

        return {
            x: current.x + (next.x - current.x) * ratio,
            y: current.y + (next.y - current.y) * ratio,
            angle: this.interpolateAngle(current.angle, next.angle, ratio),
        };
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initCars() {
        const startPoint = this.track.getTrackPoint(0);
        const trackDirection = this.track.getTrackDirection(0);
        const startAngle = trackDirection + Math.PI / 2 + Math.PI;

        // Stagger start positions
        const offsets = [
            { along: 0, perp: -25 },
            { along: -40, perp: 25 },
            { along: -80, perp: -25 },
            { along: -120, perp: 25 },
        ];

        const perpX = Math.cos(trackDirection + Math.PI / 2);
        const perpY = Math.sin(trackDirection + Math.PI / 2);
        const alongX = Math.cos(trackDirection);
        const alongY = Math.sin(trackDirection);

        for (let i = 0; i < this.playerCount; i++) {
            const offset = offsets[i];
            const x =
                startPoint.x + alongX * offset.along + perpX * offset.perp;
            const y =
                startPoint.y + alongY * offset.along + perpY * offset.perp;
            const style = this.trackTheme.vehicle || {};

            this.cars.push(
                new Car(x, y, startAngle, this.playerColors[i], i, style)
            );
        }
    }

    setupEventListeners() {
        document.addEventListener("keydown", (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        document.addEventListener("keyup", (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    handleInput() {
        if (this.countdownActive) return;

        this.cars.forEach((car, index) => {
            const gamepadIndex = this.controllerConfig[index];
            
            // Check if this player is using a controller
            if (gamepadIndex !== null && gamepadIndex !== undefined) {
                // Gamepad input
                const steerInput = gamepadManager.getSteerInput(gamepadIndex);
                const accelInput = gamepadManager.getAccelInput(gamepadIndex);
                const brakeInput = gamepadManager.getBrakeInput(gamepadIndex);
                
                car.steerInput = steerInput;
                
                if (accelInput > 0.1) {
                    car.speed = Math.min(
                        car.speed + car.acceleration * accelInput,
                        car.getCurrentMaxSpeed()
                    );
                }
                
                if (brakeInput > 0.1) {
                    car.speed = Math.max(
                        car.speed - car.acceleration * brakeInput,
                        -car.getCurrentMaxSpeed() * 0.5
                    );
                }
            } else {
                // Keyboard input
                const keyMap = this.keyMaps[index];
                const steerInput =
                    (this.keys[keyMap.right] ? 1 : 0) -
                    (this.keys[keyMap.left] ? 1 : 0);
                car.steerInput = steerInput;

                if (this.keys[keyMap.up]) {
                    car.speed = Math.min(
                        car.speed + car.acceleration,
                        car.getCurrentMaxSpeed()
                    );
                }

                if (this.keys[keyMap.down]) {
                    car.speed = Math.max(
                        car.speed - car.acceleration,
                        -car.getCurrentMaxSpeed() * 0.5
                    );
                }
            }
        });
    }

    checkCheckpoint(car) {
        const checkpointPoint = this.track.getTrackPoint(0.5);
        const distance = Math.sqrt(
            (car.x - checkpointPoint.x) ** 2 + (car.y - checkpointPoint.y) ** 2
        );

        if (distance < 100 && !car.crossedCheckpoint) {
            car.crossedCheckpoint = true;
        }
    }

    checkLapCompletion(car, index) {
        const startPoint = this.track.getTrackPoint(0);
        const distance = Math.sqrt(
            (car.x - startPoint.x) ** 2 + (car.y - startPoint.y) ** 2
        );

        if (distance < 100) {
            if (!car.crossedFinishLine && car.crossedCheckpoint) {
                car.crossedFinishLine = true;

                if (car.currentLapTime > 5000) {
                    car.lap++;

                    // Play lap completion sound
                    soundManager.playLapComplete();

                    this.lapSamples[index].push({
                        t: car.currentLapTime,
                        x: car.x,
                        y: car.y,
                        angle: car.angle,
                    });

                    if (
                        !this.bestLap ||
                        car.currentLapTime < this.bestLap.time
                    ) {
                        this.setBestLap(
                            car.currentLapTime,
                            this.lapSamples[index]
                        );
                    }

                    if (
                        !car.bestLapTime ||
                        car.currentLapTime < car.bestLapTime
                    ) {
                        car.bestLapTime = car.currentLapTime;
                    }

                    car.lapStartTime = Date.now();
                    car.crossedCheckpoint = false;
                    this.lapSamples[index] = [];
                    this.lastSampleTimes[index] = 0;
                    this.ghostStartTime = car.lapStartTime;
                    this.ghostCursor = 0;
                    this.ghostLastTime = 0;

                    // Check for winner
                    if (car.lap >= this.lapsToWin && !this.winner) {
                        this.winner = car;
                        soundManager.stopMusic();
                        soundManager.stopEngineSound();
                        soundManager.playWin();

                        // Show finish button
                        document.getElementById("finishBackBtn").style.display = "block";
                        document.getElementById("backBtn").style.display = "none";
                    }
                }
            }
        } else if (distance > 200) {
            car.crossedFinishLine = false;
        }
    }

    update() {
        if (this.winner) return;
        if (this.countdownActive) {
            this.cars.forEach((car) => {
                car.currentLapTime = 0;
            });
            return;
        }

        this.handleInput();

        this.cars.forEach((car, index) => {
            car.tiresOnTrackRatio = this.track.checkCarOnTrack(car);
            car.update();
            this.checkCheckpoint(car);
            this.recordLapSample(car, index);
            this.checkLapCompletion(car, index);
        });

        this.applySlipstream();

        const now = Date.now();
        this.cars.forEach((car) => {
            if (now < car.slipstreamEndTime && car.speed > 0) {
                const maxBoostSpeed =
                    car.getCurrentMaxSpeed() * this.slipstreamMaxFactor;
                car.speed = Math.min(
                    car.speed + this.slipstreamBoostAccel,
                    maxBoostSpeed
                );
            }
        });

        this.resolveCarCollisions();

        // Update engine sound based on car speed
        soundManager.updateEngineSound(this.cars);
    }

    getViewport(playerIndex) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.playerCount === 1) {
            return { x: 0, y: 0, width: w, height: h };
        } else if (this.playerCount === 2) {
            return playerIndex === 0
                ? { x: 0, y: 0, width: w / 2, height: h }
                : { x: w / 2, y: 0, width: w / 2, height: h };
        } else if (this.playerCount === 3) {
            if (playerIndex === 0)
                return { x: 0, y: 0, width: w / 2, height: h / 2 };
            if (playerIndex === 1)
                return { x: w / 2, y: 0, width: w / 2, height: h / 2 };
            return { x: w / 4, y: h / 2, width: w / 2, height: h / 2 };
        } else {
            const col = playerIndex % 2;
            const row = Math.floor(playerIndex / 2);
            return {
                x: (col * w) / 2,
                y: (row * h) / 2,
                width: w / 2,
                height: h / 2,
            };
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each player's viewport
        this.cars.forEach((car, index) => {
            const viewport = this.getViewport(index);

            this.ctx.save();

            // Set up clipping region for this viewport
            this.ctx.beginPath();
            this.ctx.rect(
                viewport.x,
                viewport.y,
                viewport.width,
                viewport.height
            );
            this.ctx.clip();

            // Calculate camera position centered on this car
            const camera = {
                x: car.x - viewport.width / 2,
                y: car.y - viewport.height / 2,
            };

            // Translate to viewport position then apply camera offset
            this.ctx.translate(viewport.x - camera.x, viewport.y - camera.y);

            this.drawBackground(camera, viewport);

            // Draw track
            this.drawTrack();

            // Draw ghost lap
            this.drawGhost();

            // Draw all cars
            this.cars.forEach((c) => c.draw(this.ctx));

            // Draw finish line and checkpoint
            this.drawFinishLine();
            this.drawCheckpoint();

            this.ctx.restore();

            // Draw HUD for this viewport
            this.drawHUD(car, viewport);

            // Draw viewport border
            if (this.playerCount > 1) {
                this.ctx.strokeStyle = "#333";
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(
                    viewport.x,
                    viewport.y,
                    viewport.width,
                    viewport.height
                );
            }
        });

        this.drawCountdownOverlay();

        // Draw winner overlay
        if (this.winner) {
            this.drawWinnerOverlay();
        }
    }

    getPattern(pattern) {
        if (!pattern) return null;
        const key = JSON.stringify(pattern);
        if (this.patternCache.has(key)) {
            return this.patternCache.get(key);
        }

        const size = pattern.size || 40;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        const setSeededRandom = (seed) => {
            return () => {
                const x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };
        };

        switch (pattern.type) {
            case "dots": {
                ctx.fillStyle = pattern.fg;
                const radius = Math.max(2, size * 0.08);
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case "grid": {
                ctx.strokeStyle = pattern.fg;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, size / 2);
                ctx.lineTo(size, size / 2);
                ctx.moveTo(size / 2, 0);
                ctx.lineTo(size / 2, size);
                ctx.stroke();
                break;
            }
            case "planks": {
                ctx.fillStyle = pattern.fg;
                const plankWidth = Math.max(10, size / 3);
                ctx.fillRect(0, 0, plankWidth, size);
                ctx.fillRect(plankWidth + 6, 0, plankWidth, size);
                break;
            }
            case "speckles": {
                ctx.fillStyle = pattern.fg;
                const rand = setSeededRandom(7);
                for (let i = 0; i < 24; i++) {
                    const x = rand() * size;
                    const y = rand() * size;
                    const r = 1 + rand() * 2;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case "waves": {
                ctx.strokeStyle = pattern.fg;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let y = 10; y < size; y += 16) {
                    ctx.moveTo(0, y);
                    ctx.bezierCurveTo(
                        size * 0.25,
                        y - 4,
                        size * 0.75,
                        y + 4,
                        size,
                        y
                    );
                }
                ctx.stroke();
                break;
            }
            case "tiles": {
                ctx.strokeStyle = pattern.fg;
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, size, size);
                ctx.beginPath();
                ctx.moveTo(size / 2, 0);
                ctx.lineTo(size / 2, size);
                ctx.moveTo(0, size / 2);
                ctx.lineTo(size, size / 2);
                ctx.stroke();
                break;
            }
            case "stripes": {
                ctx.strokeStyle = pattern.fg;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-size / 2, size);
                ctx.lineTo(size, -size / 2);
                ctx.stroke();
                break;
            }
            case "rings": {
                ctx.strokeStyle = pattern.fg;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case "confetti": {
                const rand = setSeededRandom(11);
                for (let i = 0; i < 10; i++) {
                    const color = pattern.colors[i % pattern.colors.length];
                    ctx.fillStyle = color;
                    const x = rand() * size;
                    const y = rand() * size;
                    ctx.fillRect(x, y, 4, 4);
                }
                break;
            }
            case "grain": {
                ctx.strokeStyle = pattern.fg;
                ctx.lineWidth = 1;
                const rand = setSeededRandom(5);
                for (let i = 0; i < 16; i++) {
                    const x = rand() * size;
                    const y = rand() * size;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 6, y + 2);
                    ctx.stroke();
                }
                break;
            }
            case "tartan": {
                // Classic tartan/plaid crosshatch pattern for racing tracks
                const lineWidth = Math.max(2, size * 0.08);
                const spacing = size / 4;
                
                // Draw vertical stripes
                ctx.fillStyle = pattern.fg;
                for (let x = 0; x < size; x += spacing) {
                    ctx.fillRect(x, 0, lineWidth, size);
                }
                
                // Draw horizontal stripes
                for (let y = 0; y < size; y += spacing) {
                    ctx.fillRect(0, y, size, lineWidth);
                }
                
                // Draw secondary accent stripes (offset)
                if (pattern.fg2) {
                    ctx.fillStyle = pattern.fg2;
                    const offset = spacing / 2;
                    for (let x = offset; x < size; x += spacing) {
                        ctx.fillRect(x, 0, lineWidth * 0.6, size);
                    }
                    for (let y = offset; y < size; y += spacing) {
                        ctx.fillRect(0, y, size, lineWidth * 0.6);
                    }
                }
                
                // Add crosshatch intersections for depth
                ctx.fillStyle = pattern.fg;
                for (let x = 0; x < size; x += spacing) {
                    for (let y = 0; y < size; y += spacing) {
                        ctx.fillRect(x - lineWidth/2, y - lineWidth/2, lineWidth * 1.5, lineWidth * 1.5);
                    }
                }
                break;
            }
            default:
                break;
        }

        const patternFill = this.ctx.createPattern(canvas, "repeat");
        this.patternCache.set(key, patternFill);
        return patternFill;
    }

    drawBackground(camera, viewport) {
        const theme = this.trackTheme;
        const drawX = camera.x - 600;
        const drawY = camera.y - 600;
        const drawW = viewport.width + 1200;
        const drawH = viewport.height + 1200;

        this.ctx.fillStyle = theme.background.base;
        this.ctx.fillRect(drawX, drawY, drawW, drawH);

        if (theme.background.pattern) {
            this.ctx.save();
            this.ctx.globalAlpha = theme.background.pattern.alpha || 0.4;
            this.ctx.fillStyle = this.getPattern(theme.background.pattern);
            this.ctx.fillRect(drawX, drawY, drawW, drawH);
            this.ctx.restore();
        }
    }

    drawGhost() {
        if (
            this.countdownActive ||
            !this.ghostEnabled ||
            !this.ghostSamples ||
            !this.ghostLapTime
        ) {
            return;
        }

        const elapsed = Date.now() - this.ghostStartTime;
        const sampleTime = elapsed % this.ghostLapTime;
        const sample = this.getGhostSampleAt(sampleTime);
        if (!sample) return;

        this.ghostCar.x = sample.x;
        this.ghostCar.y = sample.y;
        this.ghostCar.angle = sample.angle;

        // Draw ghost with desaturation
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        this.ctx.filter = 'grayscale(70%) brightness(1.1)';
        this.ghostCar.draw(this.ctx);
        this.ctx.restore();
    }

    drawCountdownOverlay() {
        if (!this.countdownActive && !this.countdownEndTime) return;

        const now = Date.now();
        const elapsed = now - this.countdownStartTime;
        const showGo =
            !this.countdownActive &&
            this.countdownEndTime &&
            now - this.countdownEndTime < 700;

        if (!this.countdownActive && !showGo) {
            return;
        }

        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const topY = 30;
        const lightSpacing = 40;
        const lightRadius = 12;

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(centerX - 90, topY - 10, 180, 50);

        const colors = ["#ff4d4d", "#ffd166", "#4ade80"];
        const dim = "rgba(255, 255, 255, 0.15)";
        let label = "";
        let activeIndex = 0;

        if (this.countdownActive) {
            if (elapsed < 1000) {
                label = "3";
                activeIndex = 0;
            } else if (elapsed < 2000) {
                label = "2";
                activeIndex = 1;
            } else if (elapsed < 3000) {
                label = "1";
                activeIndex = 2;
            } else {
                label = "GO";
                activeIndex = 2;
            }
        } else {
            label = "GO";
            activeIndex = 2;
        }

        for (let i = 0; i < 3; i++) {
            const x = centerX - lightSpacing + i * lightSpacing;
            const isActive =
                this.countdownActive && i === activeIndex
                    ? true
                    : !this.countdownActive && i === 2;
            ctx.fillStyle = isActive ? colors[i] : dim;
            ctx.beginPath();
            ctx.arc(x, topY + 15, lightRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (label === "GO") {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "center";
            ctx.fillText(label, centerX, topY + 45);
        }
        ctx.textAlign = "left";
        ctx.restore();
    }

    drawTrack() {
        const theme = this.trackTheme;
        const points = this.track.points;

        this.ctx.strokeStyle = theme.track.edge;
        this.ctx.lineWidth = this.track.width + 14;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        this.drawSmoothPath(points);
        this.ctx.stroke();

        this.ctx.strokeStyle = theme.track.base;
        this.ctx.lineWidth = this.track.width;
        this.drawSmoothPath(points);
        this.ctx.stroke();

        if (theme.track.texture) {
            this.ctx.save();
            this.ctx.globalAlpha = theme.track.texture.alpha || 0.35;
            this.ctx.strokeStyle = this.getPattern(theme.track.texture);
            this.ctx.lineWidth = this.track.width - 8;
            this.drawSmoothPath(points);
            this.ctx.stroke();
            this.ctx.restore();
        }

        this.ctx.strokeStyle = theme.track.stripe;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash(theme.track.dash || [20, 10]);

        this.drawSmoothPath(points);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }

    drawSmoothPath(points) {
        this.ctx.beginPath();

        if (points.length < 3) return;

        this.ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i++) {
            const currentPoint = points[i];
            const nextPoint = points[i + 1];

            const controlX = (currentPoint.x + nextPoint.x) / 2;
            const controlY = (currentPoint.y + nextPoint.y) / 2;

            this.ctx.quadraticCurveTo(
                currentPoint.x,
                currentPoint.y,
                controlX,
                controlY
            );
        }

        const lastPoint = points[points.length - 1];
        const firstPoint = points[0];
        this.ctx.quadraticCurveTo(
            lastPoint.x,
            lastPoint.y,
            firstPoint.x,
            firstPoint.y
        );
    }

    drawFinishLine() {
        const startPoint = this.track.getTrackPoint(0);
        const direction = this.track.getTrackDirection(0);

        this.ctx.save();
        this.ctx.translate(startPoint.x, startPoint.y);
        this.ctx.rotate(direction + Math.PI / 2);

        const finishLineWidth = this.track.width;
        const segments = 12;
        const segmentWidth = finishLineWidth / segments;

        for (let i = 0; i < segments; i++) {
            const x = -finishLineWidth / 2 + i * segmentWidth;
            const isBlack = i % 2 === 0;

            this.ctx.fillStyle = isBlack ? "#000000" : "#ffffff";
            this.ctx.fillRect(x, -4, segmentWidth, 8);
        }

        this.ctx.restore();
    }

    drawCheckpoint() {
        const checkpointPoint = this.track.getTrackPoint(0.5);
        const direction = this.track.getTrackDirection(0.5);

        this.ctx.save();
        this.ctx.translate(checkpointPoint.x, checkpointPoint.y);
        this.ctx.rotate(direction + Math.PI / 2);

        const checkpointWidth = this.track.width;

        this.ctx.strokeStyle = this.trackTheme.checkpoint;
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.moveTo(-checkpointWidth / 2, 0);
        this.ctx.lineTo(checkpointWidth / 2, 0);
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawHUD(car, viewport) {
        const padding = 10;
        const x = viewport.x + padding;
        const y = viewport.y + padding;

        // TrackMania-style clean HUD
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        this.ctx.fillRect(x, y, 140, 70);

        // Player label with color
        this.ctx.fillStyle = car.color;
        this.ctx.font = "bold 12px Arial";
        this.ctx.fillText(`P${car.playerIndex + 1}`, x + 10, y + 16);

        // Lap counter
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "12px Arial";
        this.ctx.fillText(`${car.lap}/${this.lapsToWin}`, x + 100, y + 16);

        // Speed display (large, centered)
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 32px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`${car.getSpeedKmh()}`, x + 70, y + 48);
        this.ctx.font = "10px Arial";
        this.ctx.fillStyle = "#888888";
        this.ctx.fillText("km/h", x + 70, y + 62);
        this.ctx.textAlign = "left";
    }

    resolveCarCollisions() {
        const restitution = 0.5;
        const speedDamp = 0.9;

        for (let i = 0; i < this.cars.length; i++) {
            for (let j = i + 1; j < this.cars.length; j++) {
                const carA = this.cars[i];
                const carB = this.cars[j];
                const dx = carB.x - carA.x;
                const dy = carB.y - carA.y;
                const dist = Math.hypot(dx, dy);
                const minDist =
                    carA.getCollisionRadius() + carB.getCollisionRadius();

                if (dist === 0 || dist >= minDist) continue;

                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;

                carA.x -= nx * overlap * 0.5;
                carA.y -= ny * overlap * 0.5;
                carB.x += nx * overlap * 0.5;
                carB.y += ny * overlap * 0.5;

                const forwardAX = Math.cos(carA.angle - Math.PI / 2);
                const forwardAY = Math.sin(carA.angle - Math.PI / 2);
                const forwardBX = Math.cos(carB.angle - Math.PI / 2);
                const forwardBY = Math.sin(carB.angle - Math.PI / 2);

                const velAX = forwardAX * carA.speed;
                const velAY = forwardAY * carA.speed;
                const velBX = forwardBX * carB.speed;
                const velBY = forwardBY * carB.speed;

                const relVelX = velBX - velAX;
                const relVelY = velBY - velAY;
                const velAlongNormal = relVelX * nx + relVelY * ny;

                if (velAlongNormal > 0) continue;

                const impulse = (-(1 + restitution) * velAlongNormal) / 2;
                const impulseX = impulse * nx;
                const impulseY = impulse * ny;

                const newVelAX = velAX - impulseX;
                const newVelAY = velAY - impulseY;
                const newVelBX = velBX + impulseX;
                const newVelBY = velBY + impulseY;

                carA.speed =
                    (newVelAX * forwardAX + newVelAY * forwardAY) * speedDamp;
                carB.speed =
                    (newVelBX * forwardBX + newVelBY * forwardBY) * speedDamp;

                carA.speed = Math.max(
                    Math.min(carA.speed, carA.getCurrentMaxSpeed()),
                    -carA.getCurrentMaxSpeed() * 0.5
                );
                carB.speed = Math.max(
                    Math.min(carB.speed, carB.getCurrentMaxSpeed()),
                    -carB.getCurrentMaxSpeed() * 0.5
                );
            }
        }
    }

    applySlipstream() {
        const now = Date.now();
        const minDot = Math.cos(this.slipstreamAngle);

        for (let i = 0; i < this.cars.length; i++) {
            const car = this.cars[i];
            const forwardX = Math.cos(car.angle - Math.PI / 2);
            const forwardY = Math.sin(car.angle - Math.PI / 2);

            for (let j = 0; j < this.cars.length; j++) {
                if (i === j) continue;
                const target = this.cars[j];
                if (Math.abs(target.speed) < 0.5) continue;

                const dx = target.x - car.x;
                const dy = target.y - car.y;
                const dist = Math.hypot(dx, dy);
                if (dist > this.slipstreamDistance || dist === 0) continue;

                const dirX = dx / dist;
                const dirY = dy / dist;
                const aheadDot = forwardX * dirX + forwardY * dirY;
                if (aheadDot < minDot) continue;

                car.slipstreamEndTime = now + this.slipstreamDuration;
                break;
            }
        }
    }

    drawWinnerOverlay() {
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 48px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
            `🏆 Player ${this.winner.playerIndex + 1} Wins! 🏆`,
            this.canvas.width / 2,
            this.canvas.height / 2
        );

        this.ctx.textAlign = "left";
    }

    formatTime(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        const ms = Math.floor((milliseconds % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms
            .toString()
            .padStart(2, "0")}`;
    }

    startCountdown() {
        this.countdownActive = true;
        this.countdownStartTime = Date.now();
        this.countdownEndTime = null;

        soundManager.playCountdown(() => {
            const now = Date.now();
            this.countdownActive = false;
            this.countdownEndTime = now;
            this.ghostStartTime = now;
            this.ghostCursor = 0;
            this.ghostLastTime = 0;
            this.cars.forEach((car) => {
                car.lapStartTime = now;
                car.currentLapTime = 0;
            });
        });
    }

    start() {
        this.running = true;
        this.startCountdown();
        this.gameLoop();
    }

    stop() {
        this.running = false;
    }

    gameLoop() {
        if (!this.running) return;

        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Menu and game state management
let currentGame = null;
let selectedPlayers = 1;
let selectedTrack = 0;
let gameSettings = loadSettings();

const trackNames = [
    "Breakfast Table",
    "Pool Table",
    "Office Desk",
    "Garden Path",
    "Bathtub Ring",
    "Bookshelf Slalom",
    "Treehouse",
    "Toy Box",
    "Kitchen Counter",
    "Dinner Plate",
];

function initMenu() {
    const menuScreen = document.getElementById("menuScreen");
    const settingsScreen = document.getElementById("settingsScreen");
    const gameCanvas = document.getElementById("gameCanvas");
    const backBtn = document.getElementById("backBtn");
    const finishBackBtn = document.getElementById("finishBackBtn");
    const startBtn = document.getElementById("startBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsBackBtn = document.getElementById("settingsBackBtn");
    const ghostToggle = document.getElementById("ghostToggle");
    const musicToggle = document.getElementById("musicToggle");
    const sfxToggle = document.getElementById("sfxToggle");
    const playerButtons = document.querySelectorAll(".player-btn");
    const controlsInfo = document.getElementById("controlsInfo");
    const prevTrackBtn = document.getElementById("prevTrack");
    const nextTrackBtn = document.getElementById("nextTrack");
    const trackNumberEl = document.getElementById("trackNumber");
    const trackNameEl = document.getElementById("trackName");

    const controlsData = [
        { player: "Player 1", keys: "↑ ↓ ← →" },
        { player: "Player 2", keys: "W A S D" },
        { player: "Player 3", keys: "I J K L" },
        { player: "Player 4", keys: "8 4 5 6 (Numpad)" },
    ];

    // Controller configuration: null = keyboard, number = gamepad index
    const playerControllerConfig = [null, null, null, null];
    
    // Track which gamepad indices are already assigned
    function getAvailableGamepads() {
        const connectedIndices = gamepadManager.getConnectedIndices();
        const usedIndices = playerControllerConfig.filter(c => c !== null);
        return connectedIndices.filter(i => !usedIndices.includes(i));
    }

    function updateControlsInfo() {
        controlsInfo.innerHTML = "";
        for (let i = 0; i < selectedPlayers; i++) {
            const div = document.createElement("div");
            div.className = "control-item";
            div.dataset.playerIndex = i;
            
            const isController = playerControllerConfig[i] !== null;
            if (isController) {
                div.classList.add("controller-mode");
            }
            
            const inputLabel = isController 
                ? `🎮 Gamepad ${playerControllerConfig[i] + 1}`
                : controlsData[i].keys;
            
            div.innerHTML = `
                <span class="player-label">${controlsData[i].player}</span>
                <span class="keys">${inputLabel}</span>
            `;
            
            // Add click handler to toggle controller
            div.addEventListener("click", () => {
                togglePlayerController(i);
            });
            
            controlsInfo.appendChild(div);
        }
    }
    
    function togglePlayerController(playerIndex) {
        if (playerControllerConfig[playerIndex] !== null) {
            // Currently using controller, switch to keyboard
            playerControllerConfig[playerIndex] = null;
        } else {
            // Currently using keyboard, try to assign a controller
            const available = getAvailableGamepads();
            if (available.length > 0) {
                playerControllerConfig[playerIndex] = available[0];
            } else {
                // No controllers available, poll once to check for new ones
                gamepadManager.poll();
                const newAvailable = getAvailableGamepads();
                if (newAvailable.length > 0) {
                    playerControllerConfig[playerIndex] = newAvailable[0];
                }
            }
        }
        updateControlsInfo();
    }

    function updateTrackDisplay() {
        trackNumberEl.textContent = `${selectedTrack + 1}/10`;
        trackNameEl.textContent = trackNames[selectedTrack];
    }

    ghostToggle.checked = gameSettings.ghostEnabled;
    musicToggle.checked = gameSettings.musicEnabled;
    sfxToggle.checked = gameSettings.sfxEnabled;

    playerButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            playerButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            selectedPlayers = parseInt(btn.dataset.players);
            updateControlsInfo();
        });
    });

    prevTrackBtn.addEventListener("click", () => {
        selectedTrack = (selectedTrack - 1 + 10) % 10;
        updateTrackDisplay();
    });

    nextTrackBtn.addEventListener("click", () => {
        selectedTrack = (selectedTrack + 1) % 10;
        updateTrackDisplay();
    });

    settingsBtn.addEventListener("click", () => {
        menuScreen.style.display = "none";
        settingsScreen.style.display = "flex";
    });

    settingsBackBtn.addEventListener("click", () => {
        settingsScreen.style.display = "none";
        menuScreen.style.display = "flex";
    });

    ghostToggle.addEventListener("change", () => {
        gameSettings.ghostEnabled = ghostToggle.checked;
        saveSettings(gameSettings);
    });

    musicToggle.addEventListener("change", () => {
        gameSettings.musicEnabled = musicToggle.checked;
        saveSettings(gameSettings);
        if (currentGame) {
            soundManager.setMusicEnabled(gameSettings.musicEnabled);
        }
    });

    sfxToggle.addEventListener("change", () => {
        gameSettings.sfxEnabled = sfxToggle.checked;
        saveSettings(gameSettings);
        if (currentGame) {
            soundManager.setSfxEnabled(gameSettings.sfxEnabled);
        }
    });

    startBtn.addEventListener("click", () => {
        menuScreen.style.display = "none";
        settingsScreen.style.display = "none";
        gameCanvas.style.display = "block";
        backBtn.style.display = "block";
        finishBackBtn.style.display = "none";

        // Initialize audio on user interaction (required by browsers)
        soundManager.init();
        soundManager.setMusicEnabled(gameSettings.musicEnabled);
        soundManager.setSfxEnabled(gameSettings.sfxEnabled);
        soundManager.startMusic();

        currentGame = new Game(
            selectedPlayers,
            selectedTrack,
            gameSettings,
            playerControllerConfig.slice(0, selectedPlayers)
        );
        currentGame.start();
    });

    backBtn.addEventListener("click", () => {
        if (currentGame) {
            currentGame.stop();
            currentGame = null;
        }

        soundManager.stopMusic();
        soundManager.stopEngineSound();

        settingsScreen.style.display = "none";
        menuScreen.style.display = "flex";
        gameCanvas.style.display = "none";
        backBtn.style.display = "none";
        finishBackBtn.style.display = "none";
    });

    finishBackBtn.addEventListener("click", () => {
        backBtn.click();
    });

}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", async () => {
    // Preload car images
    await preloadCarImages();
    initMenu();
});
