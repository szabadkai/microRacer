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
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Master gain nodes
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = 0.3;
            this.musicGain.connect(this.audioContext.destination);
            
            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = 0.5;
            this.sfxGain.connect(this.audioContext.destination);
            
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    // Simple beep sound
    beep(frequency = 440, duration = 0.1, type = 'sine') {
        if (!this.initialized || !this.sfxEnabled) return;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = type;
        osc.frequency.value = frequency;
        
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
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
                this.beep(freqs[i], durations[i], 'square');
            }, time);
        });
        
        setTimeout(callback, 3500);
    }
    
    // Lap completion sound
    playLapComplete() {
        if (!this.initialized || !this.sfxEnabled) return;
        
        // Rising arpeggio
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => this.beep(freq, 0.15, 'square'), i * 80);
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
            setTimeout(() => this.beep(freq, durations[i], 'square'), time);
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
        car.rpm = rpm;  // Store for HUD if needed
        
        // Base frequency from RPM (engine fires 2 times per revolution for 4-cyl)
        const baseFreq = rpm / 60 * 2;
        
        // Create engine oscillators if they don't exist
        if (this.engineOscillators.length === 0) {
            // 4 harmonics for rich, layered sound
            const harmonics = [
                { mult: 0.5, type: 'sawtooth', vol: 0.03 },  // Subharmonic rumble (low growl)
                { mult: 1.0, type: 'sawtooth', vol: 0.05 },  // Fundamental (main engine tone)
                { mult: 2.0, type: 'square', vol: 0.02 },    // 1st harmonic (overtone)
                { mult: 3.0, type: 'triangle', vol: 0.01 }, // 2nd harmonic (higher overtone)
            ];
            
            harmonics.forEach(h => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                osc.type = h.type;
                osc.frequency.value = baseFreq * h.mult;
                
                // Low-pass filter - opens up at higher speeds for aggressive sound
                filter.type = 'lowpass';
                filter.frequency.value = 600;
                filter.Q.value = 1;
                
                gain.gain.value = 0;
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);
                osc.start();
                
                this.engineOscillators.push({ osc, gain, filter, mult: h.mult, baseVol: h.vol });
            });
        }
        
        // Update engine sound parameters
        const time = this.audioContext.currentTime;
        const rpmPercent = (rpm - car.idleRPM) / (car.maxRPM - car.idleRPM);
        
        this.engineOscillators.forEach(e => {
            // Update frequency based on RPM
            const targetFreq = baseFreq * e.mult;
            e.osc.frequency.setTargetAtTime(targetFreq, time, 0.05);
            
            // Volume scaling - gets louder as you accelerate
            const targetVol = speedRatio > 0.01 ? e.baseVol * (0.5 + rpmPercent * 0.5) : 0;
            e.gain.gain.setTargetAtTime(targetVol, time, 0.1);
            
            // Filter opens up at higher RPM for more aggressive sound
            const filterFreq = 600 + rpmPercent * 1500;
            e.filter.frequency.setTargetAtTime(filterFreq, time, 0.1);
        });
    }
    
    stopEngineSound() {
        this.engineOscillators.forEach(e => {
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
            this.musicElement = document.getElementById('bgMusic');
            if (this.musicElement) {
                // Randomly select one of the action tracks
                const tracks = [
                    'music/bgm_action_1.mp3',
                    'music/bgm_action_2.mp3',
                    'music/bgm_action_3.mp3',
                    'music/bgm_action_4.mp3',
                    'music/bgm_action_5.mp3'
                ];
                const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
                this.musicElement.src = randomTrack;
                this.musicElement.volume = 0.08;  // Very low - let engines be heard
                this.musicElement.loop = true;
            }
        }
        
        if (this.musicElement) {
            this.musicElement.play().catch(e => console.log('Music autoplay blocked'));
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
}

// Global sound manager
const soundManager = new SoundManager();

class Car {
    constructor(x, y, startAngle = 0, color = '#ff4444', playerIndex = 0) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 40;
        this.speed = 0;
        this.maxSpeedAsphalt = 300;  // Fast for arcade feel
        this.tiresOnTrackRatio = 1.0;
        this.acceleration = 0.6;
        this.deceleration = 0.3;
        this.onGrass = false;
        this.turnSpeed = 0;
        this.maxTurnSpeed = 4;
        this.angle = startAngle;
        this.color = color;
        this.playerIndex = playerIndex;
        
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
    
    update() {
        this.x += Math.cos(this.angle - Math.PI / 2) * this.speed;
        this.y += Math.sin(this.angle - Math.PI / 2) * this.speed;
        
        const grassFriction = 0.7;
        const asphaltFriction = 0.95;
        const frictionBlend = asphaltFriction * this.tiresOnTrackRatio + grassFriction * (1.0 - this.tiresOnTrackRatio);
        this.speed *= frictionBlend;
        
        this.turnSpeed *= 0.8;
        this.angle += this.turnSpeed * 0.02;
        
        this.currentLapTime = Date.now() - this.lapStartTime;
    }
    
    getCurrentMaxSpeed() {
        const speedReduction = (1.0 - this.tiresOnTrackRatio) * 0.1;
        return this.maxSpeedAsphalt * (1.0 - speedReduction);
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Car body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Car roof (darker version of color)
        ctx.fillStyle = this.getDarkerColor(this.color);
        ctx.fillRect(-this.width / 2 + 3, -this.height / 2 + 8, this.width - 6, this.height - 20);
        
        // Windshield
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(-this.width / 2 + 4, -this.height / 2 + 9, this.width - 8, 8);
        
        // Wheels
        ctx.fillStyle = '#000';
        ctx.fillRect(-this.width / 2 - 2, -this.height / 2 + 5, 4, 8);
        ctx.fillRect(this.width / 2 - 2, -this.height / 2 + 5, 4, 8);
        ctx.fillRect(-this.width / 2 - 2, this.height / 2 - 13, 4, 8);
        ctx.fillRect(this.width / 2 - 2, this.height / 2 - 13, 4, 8);
        
        // Headlights
        ctx.fillStyle = '#ffff99';
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2, 4, 3);
        ctx.fillRect(this.width / 2 - 6, -this.height / 2, 4, 3);
        
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
            'Breakfast Table',
            'Pool Table', 
            'Office Desk',
            'Garden Path',
            'Bathtub Ring',
            'Bookshelf Slalom',
            'Treehouse',
            'Toy Box',
            'Kitchen Counter',
            'Dinner Plate'
        ];
        
        this.generateTrack();
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
                radiusVariation = 200 + Math.sin(angle * 2) * 200 + Math.sin(angle * 3) * 100 + seededRandom(i) * 150;
            }
            
            const radius = baseRadius + radiusVariation;
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            this.points.push({ x, y });
        }
        
        // Close the loop with the exact first point for seamless connection
        this.points.push({ x: this.points[0].x, y: this.points[0].y });
    }
    
    getTrackPoint(t) {
        const segmentIndex = Math.floor(t * (this.points.length - 1));
        const nextIndex = (segmentIndex + 1) % (this.points.length - 1);
        const localT = (t * (this.points.length - 1)) - segmentIndex;
        
        const p1 = this.points[segmentIndex];
        const p2 = this.points[nextIndex];
        
        return {
            x: p1.x + (p2.x - p1.x) * localT,
            y: p1.y + (p2.y - p1.y) * localT
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
            { x: 8, y: 15 }
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
    constructor(playerCount = 1, trackIndex = 0) {
        this.playerCount = playerCount;
        this.trackIndex = trackIndex;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.track = new Track(trackIndex);
        this.cars = [];
        this.keys = {};
        this.running = false;
        this.winner = null;
        this.lapsToWin = 3;
        
        // Player colors
        this.playerColors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
        
        // Key mappings for each player
        this.keyMaps = [
            { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright' },
            { up: 'w', down: 's', left: 'a', right: 'd' },
            { up: 'i', down: 'k', left: 'j', right: 'l' },
            { up: '8', down: '5', left: '4', right: '6' }
        ];
        
        // Resize canvas to fill screen
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.initCars();
        this.setupEventListeners();
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
            { along: -120, perp: 25 }
        ];
        
        const perpX = Math.cos(trackDirection + Math.PI / 2);
        const perpY = Math.sin(trackDirection + Math.PI / 2);
        const alongX = Math.cos(trackDirection);
        const alongY = Math.sin(trackDirection);
        
        for (let i = 0; i < this.playerCount; i++) {
            const offset = offsets[i];
            const x = startPoint.x + alongX * offset.along + perpX * offset.perp;
            const y = startPoint.y + alongY * offset.along + perpY * offset.perp;
            
            this.cars.push(new Car(x, y, startAngle, this.playerColors[i], i));
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    handleInput() {
        this.cars.forEach((car, index) => {
            const keyMap = this.keyMaps[index];
            
            if (this.keys[keyMap.up]) {
                car.speed = Math.min(car.speed + car.acceleration, car.getCurrentMaxSpeed());
            }
            
            if (this.keys[keyMap.down]) {
                car.speed = Math.max(car.speed - car.acceleration, -car.getCurrentMaxSpeed() * 0.5);
            }
            
            if (this.keys[keyMap.left]) {
                car.turnSpeed = Math.max(car.turnSpeed - 0.3, -car.maxTurnSpeed);
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
    
    checkLapCompletion(car) {
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
                    
                    if (!car.bestLapTime || car.currentLapTime < car.bestLapTime) {
                        car.bestLapTime = car.currentLapTime;
                    }
                    
                    car.lapStartTime = Date.now();
                    car.crossedCheckpoint = false;
                    
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
        
        this.handleInput();
        
        this.cars.forEach(car => {
            car.update();
            this.checkCheckpoint(car);
            this.checkLapCompletion(car);
        });
        
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
            if (playerIndex === 0) return { x: 0, y: 0, width: w / 2, height: h / 2 };
            if (playerIndex === 1) return { x: w / 2, y: 0, width: w / 2, height: h / 2 };
            return { x: w / 4, y: h / 2, width: w / 2, height: h / 2 };
        } else {
            const col = playerIndex % 2;
            const row = Math.floor(playerIndex / 2);
            return { x: col * w / 2, y: row * h / 2, width: w / 2, height: h / 2 };
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
            this.ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
            this.ctx.clip();
            
            // Calculate camera position centered on this car
            const camera = {
                x: car.x - viewport.width / 2,
                y: car.y - viewport.height / 2
            };
            
            // Translate to viewport position then apply camera offset
            this.ctx.translate(viewport.x - camera.x, viewport.y - camera.y);
            
            // Draw grass background
            this.ctx.fillStyle = '#228b22';
            this.ctx.fillRect(camera.x - 500, camera.y - 500, viewport.width + 1000, viewport.height + 1000);
            
            // Draw track
            this.drawTrack();
            
            // Check tire positions for this car (distance-based, no pixel sampling)
            car.tiresOnTrackRatio = this.track.checkCarOnTrack(car);
            
            // Draw all cars
            this.cars.forEach(c => c.draw(this.ctx));
            
            // Draw finish line and checkpoint
            this.drawFinishLine();
            this.drawCheckpoint();
            
            this.ctx.restore();
            
            // Draw HUD for this viewport
            this.drawHUD(car, viewport);
            
            // Draw viewport border
            if (this.playerCount > 1) {
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);
            }
        });
        
        // Draw winner overlay
        if (this.winner) {
            this.drawWinnerOverlay();
        }
    }
    
    drawTrack() {
        const points = this.track.points;
        
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = this.track.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.drawSmoothPath(points);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([20, 10]);
        
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
            
            this.ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
        }
        
        const lastPoint = points[points.length - 1];
        const firstPoint = points[0];
        this.ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, firstPoint.x, firstPoint.y);
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
            const x = -finishLineWidth / 2 + (i * segmentWidth);
            const isBlack = i % 2 === 0;
            
            this.ctx.fillStyle = isBlack ? '#000000' : '#ffffff';
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
        
        this.ctx.strokeStyle = '#ffff00';
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
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(x, y, 140, 70);
        
        // Player label with color
        this.ctx.fillStyle = car.color;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(`P${car.playerIndex + 1}`, x + 10, y + 16);
        
        // Lap counter
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${car.lap}/${this.lapsToWin}`, x + 100, y + 16);
        
        // Speed display (large, centered)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${car.getSpeedKmh()}`, x + 70, y + 48);
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#888888';
        this.ctx.fillText('km/h', x + 70, y + 62);
        this.ctx.textAlign = 'left';
    }
    
    drawWinnerOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `🏆 Player ${this.winner.playerIndex + 1} Wins! 🏆`,
            this.canvas.width / 2,
            this.canvas.height / 2
        );
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText(
            'Press any key to return to menu',
            this.canvas.width / 2,
            this.canvas.height / 2 + 50
        );
        
        this.ctx.textAlign = 'left';
    }
    
    formatTime(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        const ms = Math.floor((milliseconds % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    start() {
        this.running = true;
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

const trackNames = [
    'Breakfast Table',
    'Pool Table', 
    'Office Desk',
    'Garden Path',
    'Bathtub Ring',
    'Bookshelf Slalom',
    'Treehouse',
    'Toy Box',
    'Kitchen Counter',
    'Dinner Plate'
];

function initMenu() {
    const menuScreen = document.getElementById('menuScreen');
    const gameCanvas = document.getElementById('gameCanvas');
    const backBtn = document.getElementById('backBtn');
    const startBtn = document.getElementById('startBtn');
    const playerButtons = document.querySelectorAll('.player-btn');
    const controlsInfo = document.getElementById('controlsInfo');
    const prevTrackBtn = document.getElementById('prevTrack');
    const nextTrackBtn = document.getElementById('nextTrack');
    const trackNumberEl = document.getElementById('trackNumber');
    const trackNameEl = document.getElementById('trackName');
    
    const controlsData = [
        { player: 'Player 1', keys: '↑ ↓ ← →' },
        { player: 'Player 2', keys: 'W A S D' },
        { player: 'Player 3', keys: 'I J K L' },
        { player: 'Player 4', keys: '8 4 5 6 (Numpad)' }
    ];
    
    function updateControlsInfo() {
        controlsInfo.innerHTML = '';
        for (let i = 0; i < selectedPlayers; i++) {
            const div = document.createElement('div');
            div.className = 'control-item';
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
    
    playerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            playerButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPlayers = parseInt(btn.dataset.players);
            updateControlsInfo();
        });
    });
    
    prevTrackBtn.addEventListener('click', () => {
        selectedTrack = (selectedTrack - 1 + 10) % 10;
        updateTrackDisplay();
    });
    
    nextTrackBtn.addEventListener('click', () => {
        selectedTrack = (selectedTrack + 1) % 10;
        updateTrackDisplay();
    });
    
    startBtn.addEventListener('click', () => {
        menuScreen.style.display = 'none';
        gameCanvas.style.display = 'block';
        backBtn.style.display = 'block';
        
        // Initialize audio on user interaction (required by browsers)
        soundManager.init();
        soundManager.startMusic();
        
        currentGame = new Game(selectedPlayers, selectedTrack);
        currentGame.start();
    });
    
    backBtn.addEventListener('click', () => {
        if (currentGame) {
            currentGame.stop();
            currentGame = null;
        }
        
        soundManager.stopMusic();
        soundManager.stopEngineSound();
        
        menuScreen.style.display = 'flex';
        gameCanvas.style.display = 'none';
        backBtn.style.display = 'none';
    });
    
    // Return to menu on any key after winner
    document.addEventListener('keydown', (e) => {
        if (currentGame && currentGame.winner) {
            backBtn.click();
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initMenu);