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
        this.width = 20;
        this.height = 40;
        this.speed = 0;
        this.maxSpeedAsphalt = 300 * speedScale; // Fast for arcade feel
        this.tiresOnTrackRatio = 1.0;
        this.acceleration = 0.6 * speedScale;
        this.deceleration = 0.3 * speedScale;
        this.onGrass = false;
        this.turnSpeed = 0;
        this.maxTurnSpeed = 4;
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

        this.turnSpeed *= 0.8;
        this.angle += this.turnSpeed * 0.02;

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
        const bodyWidth = this.width + (this.style.bodyWidthDelta || 0);
        const bodyHeight = this.height + (this.style.bodyHeightDelta || 0);
        const roofColor =
            this.style.roofColor || this.getDarkerColor(this.color);
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
                    base: "#f4e6d2",
                    pattern: {
                        type: "dots",
                        fg: "#ead7c2",
                        size: 40,
                        alpha: 0.45,
                    },
                },
                track: {
                    base: "#b57a45",
                    edge: "#7e4f2d",
                    stripe: "#fff3de",
                    dash: [18, 10],
                    texture: {
                        type: "grain",
                        fg: "#c58d5a",
                        size: 16,
                        alpha: 0.35,
                    },
                },
                checkpoint: "#ffd24a",
                vehicle: { shape: "roadster" },
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
                        size: 36,
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
                        size: 28,
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
                        size: 18,
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
                        size: 18,
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
                        size: 18,
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
                        size: 16,
                        alpha: 0.45,
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
                        size: 14,
                        alpha: 0.4,
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
                    const start = 11;
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
        const segmentIndex = Math.floor(t * (this.points.length - 1));
        const nextIndex = (segmentIndex + 1) % (this.points.length - 1);
        const localT = t * (this.points.length - 1) - segmentIndex;

        const p1 = this.points[segmentIndex];
        const p2 = this.points[nextIndex];

        return {
            x: p1.x + (p2.x - p1.x) * localT,
            y: p1.y + (p2.y - p1.y) * localT,
        };
    }

    getTrackDirection(t) {
        const epsilon = 0.001;
        const p1 = this.getTrackPoint(Math.max(0, t - epsilon));
        const p2 = this.getTrackPoint(Math.min(1, t + epsilon));

        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
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
    constructor(playerCount = 1, trackIndex = 0, settings = {}) {
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

        // Key mappings for each player
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
            const keyMap = this.keyMaps[index];

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

            if (this.keys[keyMap.left]) {
                car.turnSpeed = Math.max(
                    car.turnSpeed - 0.3,
                    -car.maxTurnSpeed
                );
            }

            if (this.keys[keyMap.right]) {
                car.turnSpeed = Math.min(car.turnSpeed + 0.3, car.maxTurnSpeed);
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

        this.ctx.save();
        this.ctx.globalAlpha = 0.45;
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

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText(label, centerX, topY + 45);
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

        const finishLineWidth = this.track.width * 1.1;
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

        const checkpointWidth = this.track.width * 1.1;

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

        this.ctx.font = "24px Arial";
        this.ctx.fillText(
            "Press any key to return to menu",
            this.canvas.width / 2,
            this.canvas.height / 2 + 50
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

    function updateControlsInfo() {
        controlsInfo.innerHTML = "";
        for (let i = 0; i < selectedPlayers; i++) {
            const div = document.createElement("div");
            div.className = "control-item";
            div.innerHTML = `
                <span class="player-label">${controlsData[i].player}</span>
                <span class="keys">${controlsData[i].keys}</span>
            `;
            controlsInfo.appendChild(div);
        }
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

        // Initialize audio on user interaction (required by browsers)
        soundManager.init();
        soundManager.setMusicEnabled(gameSettings.musicEnabled);
        soundManager.setSfxEnabled(gameSettings.sfxEnabled);
        soundManager.startMusic();

        currentGame = new Game(
            selectedPlayers,
            selectedTrack,
            gameSettings
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
    });

    // Return to menu on any key after winner
    document.addEventListener("keydown", (e) => {
        if (currentGame && currentGame.winner) {
            backBtn.click();
        }
    });
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", initMenu);
