class Car {
    constructor(x, y, startAngle = 0, color = '#ff4444') {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 40;
        this.speed = 0;
        this.maxSpeedAsphalt = 140;
        this.tiresOnTrackRatio = 1.0; // 1.0 = all tires on track, 0.0 = all off track
        this.acceleration = 0.35;
        this.deceleration = 0.2;
        this.onGrass = false;
        this.turnSpeed = 0;
        this.maxTurnSpeed = 4;
        this.angle = startAngle;
        this.color = color;
    }
    
    update() {
        // Car sprite points up, so we need to offset the angle by -90 degrees (-π/2)
        this.x += Math.cos(this.angle - Math.PI / 2) * this.speed;
        this.y += Math.sin(this.angle - Math.PI / 2) * this.speed;
        
        // Apply friction based on tire contact with track
        const grassFriction = 0.7;
        const asphaltFriction = 0.95;
        const frictionBlend = asphaltFriction * this.tiresOnTrackRatio + grassFriction * (1.0 - this.tiresOnTrackRatio);
        this.speed *= frictionBlend;
        
        this.turnSpeed *= 0.8;
        this.angle += this.turnSpeed * 0.02;
    }
    
    getCurrentMaxSpeed() {
        // Reduce max speed by 10% for each tire off the track
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
        
        // Car roof (darker)
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(-this.width / 2 + 3, -this.height / 2 + 8, this.width - 6, this.height - 20);
        
        // Windshield
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(-this.width / 2 + 4, -this.height / 2 + 9, this.width - 8, 8);
        
        // Wheels
        ctx.fillStyle = '#000';
        ctx.fillRect(-this.width / 2 - 2, -this.height / 2 + 5, 4, 8);  // Front left
        ctx.fillRect(this.width / 2 - 2, -this.height / 2 + 5, 4, 8);   // Front right
        ctx.fillRect(-this.width / 2 - 2, this.height / 2 - 13, 4, 8);  // Rear left
        ctx.fillRect(this.width / 2 - 2, this.height / 2 - 13, 4, 8);   // Rear right
        
        // Headlights
        ctx.fillStyle = '#ffff99';
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2, 4, 3);
        ctx.fillRect(this.width / 2 - 6, -this.height / 2, 4, 3);
        
        ctx.restore();
    }
}

class Track {
    constructor() {
        this.width = 120; // Constant track width
        this.points = [];
        this.generateTrack();
    }
    
    generateTrack() {
        const carLength = 40; // Car is 40 pixels long
        const minTrackLength = 200 * carLength; // 8000 pixels minimum
        
        // Generate a series of connected curves that form a loop
        const segments = 25; // Increased to make track 200 car lengths
        const angleStep = (Math.PI * 2) / segments;
        const baseRadius = 800; // Increased radius for longer track
        
        this.points = [];
        
        for (let i = 0; i < segments; i++) {
            const angle = i * angleStep;
            // Add random variation to create interesting curves
            const radiusVariation = 200 + Math.sin(angle * 3) * 150 + Math.sin(angle * 5) * 100 + Math.random() * 300;
            const radius = baseRadius + radiusVariation;
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            this.points.push({ x, y });
        }
        
        // Ensure the track loops back to start
        this.points.push({ x: this.points[0].x, y: this.points[0].y });
    }
    
    getTrackPoint(t) {
        // t goes from 0 to 1 around the track
        const segmentIndex = Math.floor(t * (this.points.length - 1));
        const nextIndex = (segmentIndex + 1) % (this.points.length - 1);
        const localT = (t * (this.points.length - 1)) - segmentIndex;
        
        const p1 = this.points[segmentIndex];
        const p2 = this.points[nextIndex];
        
        // Linear interpolation between points
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
    
    checkTirePosition(ctx, x, y) {
        // Check if a single tire position is on track
        try {
            const pixelData = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];
            
            // Check if pixel is black (asphalt) or white (track markings)
            const isBlack = r < 80 && g < 80 && b < 80;
            const isWhite = r > 180 && g > 180 && b > 180;
            
            return isBlack || isWhite;
        } catch (e) {
            return true; // Assume on track if sampling fails
        }
    }
    
    getTirePositions(car) {
        // Calculate the 4 tire positions relative to car center
        const cos = Math.cos(car.angle);
        const sin = Math.sin(car.angle);
        
        // Tire positions relative to car center (accounting for car dimensions)
        const tireOffsets = [
            { x: -8, y: -15 }, // Front left
            { x: 8, y: -15 },  // Front right
            { x: -8, y: 15 },  // Rear left
            { x: 8, y: 15 }    // Rear right
        ];
        
        return tireOffsets.map(offset => ({
            x: car.x + offset.x * cos - offset.y * sin,
            y: car.y + offset.x * sin + offset.y * cos
        }));
    }
    
    checkCarOnTrack(ctx, car, camera) {
        const tirePositions = this.getTirePositions(car);
        let tiresOnTrack = 0;
        
        for (const tire of tirePositions) {
            // Convert world coordinates to screen coordinates
            const screenX = tire.x - camera.x;
            const screenY = tire.y - camera.y;
            
            if (this.checkTirePosition(ctx, screenX, screenY)) {
                tiresOnTrack++;
            }
        }
        
        // Return the percentage of tires on track
        return tiresOnTrack / 4;
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.track = new Track();
        
        // Start car at the finish line
        const startPoint = this.track.getTrackPoint(0);
        const trackDirection = this.track.getTrackDirection(0);
        // Adjust angle so car sprite (which points up at 0) aligns with track direction, then add PI to reverse
        const startAngle = trackDirection + Math.PI / 2 + Math.PI;
        this.car = new Car(startPoint.x, startPoint.y, startAngle, '#ff4444'); // Red car
        this.keys = {};
        
        // Camera system
        this.camera = {
            x: 0,
            y: 0
        };
        
        // Lap timing system
        this.lapStartTime = Date.now();
        this.currentLapTime = 0;
        this.bestLapTime = null;
        this.lapCompleted = false;
        this.crossedFinishLine = false;
        this.crossedCheckpoint = false;
        
        this.setupEventListeners();
        this.gameLoop();
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
        // Car controls (Arrow keys or WASD)
        if (this.keys['arrowup'] || this.keys['w']) {
            this.car.speed = Math.min(this.car.speed + this.car.acceleration, this.car.getCurrentMaxSpeed());
        }
        
        if (this.keys['arrowdown'] || this.keys['s']) {
            this.car.speed = Math.max(this.car.speed - this.car.acceleration, -this.car.getCurrentMaxSpeed() * 0.5);
        }
        
        if (this.keys['arrowleft'] || this.keys['a']) {
            this.car.turnSpeed = Math.max(this.car.turnSpeed - 0.3, -this.car.maxTurnSpeed);
        }
        
        if (this.keys['arrowright'] || this.keys['d']) {
            this.car.turnSpeed = Math.min(this.car.turnSpeed + 0.3, this.car.maxTurnSpeed);
        }
    }
    
    update() {
        // Collision detection will be done after rendering in draw() method
        // for accurate pixel sampling
        
        this.handleInput();
        this.car.update();
        
        // Check checkpoint and lap completion
        this.checkCheckpoint();
        this.checkLapCompletion();
        
        // Update current lap time
        this.currentLapTime = Date.now() - this.lapStartTime;
        
        // Update camera to follow car
        this.camera.x = this.car.x - this.canvas.width / 2;
        this.camera.y = this.car.y - this.canvas.height / 2;
    }
    
    checkCheckpoint() {
        // Check if car is near the checkpoint (track point 0.5 - halfway around)
        const checkpointPoint = this.track.getTrackPoint(0.5);
        const distance = Math.sqrt(
            (this.car.x - checkpointPoint.x) * (this.car.x - checkpointPoint.x) +
            (this.car.y - checkpointPoint.y) * (this.car.y - checkpointPoint.y)
        );
        
        const tolerance = 100;
        
        if (distance < tolerance) {
            if (!this.crossedCheckpoint) {
                this.crossedCheckpoint = true;
            }
        } else if (distance > tolerance * 2) {
            // Reset checkpoint if far away (but don't reset if we haven't crossed finish line yet)
        }
    }
    
    checkLapCompletion() {
        // Check if car is near the start/finish line (track point 0)
        const startPoint = this.track.getTrackPoint(0);
        const distance = Math.sqrt(
            (this.car.x - startPoint.x) * (this.car.x - startPoint.x) +
            (this.car.y - startPoint.y) * (this.car.y - startPoint.y)
        );
        
        const tolerance = 100;
        
        if (distance < tolerance) {
            if (!this.crossedFinishLine && this.crossedCheckpoint) {
                this.crossedFinishLine = true;
                
                // Complete lap if we've moved around the track and crossed checkpoint
                if (this.currentLapTime > 5000) { // Minimum 5 seconds for a valid lap
                    this.lapCompleted = true;
                    const lapTime = this.currentLapTime;
                    
                    if (!this.bestLapTime || lapTime < this.bestLapTime) {
                        this.bestLapTime = lapTime;
                    }
                    
                    // Start new lap
                    this.lapStartTime = Date.now();
                    this.crossedCheckpoint = false; // Reset for next lap
                }
            }
        } else if (distance > tolerance * 2) {
            this.crossedFinishLine = false;
        }
    }
    
    drawCheckpoint() {
        // Draw checkpoint at halfway point of track
        const checkpointPoint = this.track.getTrackPoint(0.5);
        const direction = this.track.getTrackDirection(0.5);
        
        this.ctx.save();
        this.ctx.translate(checkpointPoint.x, checkpointPoint.y);
        this.ctx.rotate(direction + Math.PI / 2); // Perpendicular to track
        
        const checkpointWidth = this.track.width * 1.1;
        
        // Draw yellow checkpoint line
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.moveTo(-checkpointWidth/2, 0);
        this.ctx.lineTo(checkpointWidth/2, 0);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    formatTime(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        const ms = Math.floor((milliseconds % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    draw() {
        // Apply camera transform
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Green grass background (much larger)
        this.ctx.fillStyle = '#228b22';
        this.ctx.fillRect(-5000, -5000, 10000, 10000);
        
        this.drawTrack();
        
        // Check tire positions after track is drawn but BEFORE car is drawn
        this.car.tiresOnTrackRatio = this.track.checkCarOnTrack(this.ctx, this.car, this.camera);
        
        this.car.draw(this.ctx);
        
        // Draw checkpoint
        this.drawCheckpoint();
        
        this.ctx.restore();
        
        // Draw UI (not affected by camera transform)
        this.drawUI();
    }
    
    drawUI() {
        // Current lap time in top right
        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'right';
        
        const currentTimeText = `Current: ${this.formatTime(this.currentLapTime)}`;
        this.ctx.fillText(currentTimeText, this.canvas.width - 20, 40);
        
        // Best lap time
        if (this.bestLapTime) {
            const bestTimeText = `Best: ${this.formatTime(this.bestLapTime)}`;
            this.ctx.fillText(bestTimeText, this.canvas.width - 20, 70);
        }
        
        this.ctx.textAlign = 'left'; // Reset text alignment
        
        // Digital speed display at top left
        this.drawDigitalSpeedometer();
    }
    
    drawDigitalSpeedometer() {
        const x = 20;
        const y = 20;
        const width = 200;
        const height = 80;
        
        // Calculate speed as percentage then multiply by 20 for display
        const maxSpeed = this.car.maxSpeedAsphalt;
        const speedPercentage = (Math.abs(this.car.speed) / maxSpeed) * 100;
        const speedValue = Math.round(speedPercentage * 20); // Display speed * 20
        
        // Draw background panel
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(x, y, width, height);
        
        // Draw border
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw speed label
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('SPEED', x + 10, y + 20);
        
        // Draw digital speed display with 7-segment style
        this.drawDigitalNumber(speedValue, x + 10, y + 35, 3);
        
        // Draw speed bar
        const barWidth = width - 20;
        const barHeight = 8;
        const barX = x + 10;
        const barY = y + height - 20;
        
        // Background bar
        this.ctx.fillStyle = '#222222';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Speed bar fill (based on percentage, not the displayed value)
        const fillWidth = (barWidth * speedPercentage) / 100;
        let barColor = '#00ff00'; // Green
        if (speedPercentage > 80) {
            barColor = '#ff0000'; // Red above 80%
        } else if (speedPercentage > 60) {
            barColor = '#ffff00'; // Yellow above 60%
        }
        
        this.ctx.fillStyle = barColor;
        this.ctx.fillRect(barX, barY, fillWidth, barHeight);
        
        // Draw segments on the bar
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        for (let i = 1; i < 10; i++) {
            const segmentX = barX + (barWidth * i) / 10;
            this.ctx.beginPath();
            this.ctx.moveTo(segmentX, barY);
            this.ctx.lineTo(segmentX, barY + barHeight);
            this.ctx.stroke();
        }
    }
    
    drawDigitalNumber(number, x, y, digits) {
        const numStr = number.toString().padStart(digits, '0');
        const digitWidth = 20;
        const digitHeight = 25;
        
        for (let i = 0; i < numStr.length; i++) {
            const digit = parseInt(numStr[i]);
            const digitX = x + i * (digitWidth + 5);
            this.drawDigit(digit, digitX, y, digitWidth, digitHeight);
        }
    }
    
    drawDigit(digit, x, y, width, height) {
        const segmentThickness = 3;
        this.ctx.fillStyle = '#00ff00';
        
        // 7-segment display patterns
        const segments = {
            0: [1,1,1,1,1,1,0], // top, top-right, bottom-right, bottom, bottom-left, top-left, middle
            1: [0,1,1,0,0,0,0],
            2: [1,1,0,1,1,0,1],
            3: [1,1,1,1,0,0,1],
            4: [0,1,1,0,0,1,1],
            5: [1,0,1,1,0,1,1],
            6: [1,0,1,1,1,1,1],
            7: [1,1,1,0,0,0,0],
            8: [1,1,1,1,1,1,1],
            9: [1,1,1,1,0,1,1]
        };
        
        const pattern = segments[digit];
        const segW = width - 4;
        const segH = (height - 6) / 2;
        
        // Top
        if (pattern[0]) this.ctx.fillRect(x + 2, y, segW, segmentThickness);
        // Top-right
        if (pattern[1]) this.ctx.fillRect(x + width - segmentThickness, y + 2, segmentThickness, segH);
        // Bottom-right
        if (pattern[2]) this.ctx.fillRect(x + width - segmentThickness, y + segH + 4, segmentThickness, segH);
        // Bottom
        if (pattern[3]) this.ctx.fillRect(x + 2, y + height - segmentThickness, segW, segmentThickness);
        // Bottom-left
        if (pattern[4]) this.ctx.fillRect(x, y + segH + 4, segmentThickness, segH);
        // Top-left
        if (pattern[5]) this.ctx.fillRect(x, y + 2, segmentThickness, segH);
        // Middle
        if (pattern[6]) this.ctx.fillRect(x + 2, y + segH + 1, segW, segmentThickness);
    }
    
    drawTrack() {
        // Draw track surface with smooth curves
        const points = this.track.points;
        
        // Draw track surface (black asphalt)
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = this.track.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.drawSmoothPath(points);
        this.ctx.stroke();
        
        // Draw center line with smooth curves
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([20, 10]);
        
        this.drawSmoothPath(points);
        this.ctx.stroke();
        
        // No borders - clean track appearance
        
        // Draw finish line at start point
        this.drawFinishLine();
    }
    
    drawSmoothPath(points) {
        this.ctx.beginPath();
        
        if (points.length < 3) return;
        
        // Start at first point
        this.ctx.moveTo(points[0].x, points[0].y);
        
        // Use quadratic curves for smooth transitions
        for (let i = 1; i < points.length - 1; i++) {
            const currentPoint = points[i];
            const nextPoint = points[i + 1];
            
            // Control point is the midpoint between current and next
            const controlX = (currentPoint.x + nextPoint.x) / 2;
            const controlY = (currentPoint.y + nextPoint.y) / 2;
            
            this.ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, controlX, controlY);
        }
        
        // Close the loop smoothly
        const lastPoint = points[points.length - 1];
        const firstPoint = points[0];
        this.ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, firstPoint.x, firstPoint.y);
    }
    
    drawSmoothBoundary(offset) {
        const points = this.track.points;
        
        // Calculate all boundary points with smooth normals
        const boundaryPoints = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const prevIndex = i === 0 ? points.length - 2 : i - 1;
            const nextIndex = i + 1;
            
            const prev = points[prevIndex];
            const curr = points[i];
            const next = points[nextIndex];
            
            // Calculate smooth normal by averaging adjacent segments
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            if (len1 > 0 && len2 > 0) {
                // Normalize and average the normals
                const nx1 = -dy1 / len1;
                const ny1 = dx1 / len1;
                const nx2 = -dy2 / len2;
                const ny2 = dx2 / len2;
                
                const avgNx = (nx1 + nx2) / 2;
                const avgNy = (ny1 + ny2) / 2;
                const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy);
                
                if (avgLen > 0) {
                    boundaryPoints.push({
                        x: curr.x + (avgNx / avgLen) * offset,
                        y: curr.y + (avgNy / avgLen) * offset
                    });
                }
            }
        }
        
        // Draw smooth boundary using the same technique as the track
        if (boundaryPoints.length > 2) {
            this.drawSmoothPath(boundaryPoints);
            this.ctx.stroke();
        }
    }
    
    drawInnerBoundaryWithStripes() {
        const stripeLength = 60; // Length of each stripe along the track (made longer)
        const samples = this.track.points.length * 4; // Reduced sampling for better performance
        let accumulatedDistance = 0;
        
        // Create continuous boundary path first
        const boundaryPoints = [];
        
        // Sample the track at high resolution to create smooth curved boundary
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            
            // Get track point and direction
            const trackPoint = this.track.getTrackPoint(t);
            const direction = this.track.getTrackDirection(t);
            
            // Calculate curvature at this point
            let curvature = 0;
            if (i > 0 && i < samples) {
                const prevDirection = this.track.getTrackDirection(Math.max(0, (i - 1) / samples));
                const nextDirection = this.track.getTrackDirection(Math.min(1, (i + 1) / samples));
                let angleDiff = Math.abs(nextDirection - prevDirection);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                curvature = angleDiff * 20; // Scale curvature for better detection
            }
            
            // Calculate inner boundary point (exactly at track edge)
            const offset = -this.track.width / 2; // Negative for inner boundary
            const nx = Math.cos(direction + Math.PI / 2);
            const ny = Math.sin(direction + Math.PI / 2);
            
            const innerPoint = {
                x: trackPoint.x + nx * offset,
                y: trackPoint.y + ny * offset,
                curvature: curvature,
                distance: accumulatedDistance
            };
            
            boundaryPoints.push(innerPoint);
            
            // Calculate distance for next iteration
            if (i > 0) {
                const prev = boundaryPoints[i - 1];
                const dx = innerPoint.x - prev.x;
                const dy = innerPoint.y - prev.y;
                accumulatedDistance += Math.sqrt(dx * dx + dy * dy);
                innerPoint.distance = accumulatedDistance;
            }
        }
        
        // Draw the boundary with stripes
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        for (let i = 0; i < boundaryPoints.length - 1; i++) {
            const curr = boundaryPoints[i];
            const next = boundaryPoints[i + 1];
            
            // Determine if this is a corner (high curvature)
            const isCorner = curr.curvature > 0.8;
            
            if (isCorner) {
                // Draw red and white stripes in corners
                const currentStripePos = curr.distance % (stripeLength * 2);
                const isRed = currentStripePos < stripeLength;
                
                this.ctx.strokeStyle = isRed ? '#ff0000' : '#ffffff';
            } else {
                // Draw regular white boundary on straights
                this.ctx.strokeStyle = '#ffffff';
            }
            
            // Draw the segment
            this.ctx.beginPath();
            this.ctx.moveTo(curr.x, curr.y);
            this.ctx.lineTo(next.x, next.y);
            this.ctx.stroke();
        }
    }
    
    drawFinishLine() {
        // Draw a single finish line perpendicular to the track at the start point
        const startPoint = this.track.getTrackPoint(0);
        const direction = this.track.getTrackDirection(0);
        
        this.ctx.save();
        this.ctx.translate(startPoint.x, startPoint.y);
        this.ctx.rotate(direction + Math.PI / 2); // Perpendicular to track
        
        const finishLineWidth = this.track.width * 1.1;
        const segments = 12;
        const segmentWidth = finishLineWidth / segments;
        
        // Draw single checkered finish line
        for (let i = 0; i < segments; i++) {
            const x = -finishLineWidth/2 + (i * segmentWidth);
            const isBlack = i % 2 === 0;
            
            this.ctx.fillStyle = isBlack ? '#000000' : '#ffffff';
            this.ctx.fillRect(x, -4, segmentWidth, 8);
        }
        
        this.ctx.restore();
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

const game = new Game();