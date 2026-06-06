// --- DSC UHAMKA Arena Game Logic ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;
canvas.style.width = '800px';
canvas.style.height = '600px';

const canvasWidth = 800;
const canvasHeight = 600;

const timerEl = document.getElementById('timer');
const difficultyEl = document.getElementById('difficulty');
const messageOverlay = document.getElementById('messageOverlay');
const startButton = document.getElementById('startButton');
const bgMusic = document.getElementById('bgMusic');
const loseSfx = document.getElementById('loseSfx');
const clickSfx = document.getElementById('clickSfx');
const gotHitSfx = document.getElementById('gotHitSfx');
const jumpSfx = document.getElementById('jumpSfx');
const winSfx = document.getElementById('winSfx');
const shieldSfx = document.getElementById('shieldSfx');
const shieldHitSfx = document.getElementById('shieldHitSfx');
const botIndicator = document.getElementById('botIndicator');

let player, projectiles, platforms, keys, gravity, gameTime, difficulty, gameInterval, projectileInterval, platformInterval, gameActive, animationFrameId;
let lastFrameTimeMs = null;
let botMode = false; 
let botTargetX = 0; 
let botTargetY = 0;
let botTargetPlatformIndex = 0;
let botTargetSetTime = 0;
let shield = null;
let shieldActive = false;
let shieldTimer = 0;
let shieldBlinkTimer = 0;
let shieldSpawnTimer = 0;
let particles = [];
window.currentGesture = 'diam';
let botPatrolDirection = 1;

const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const PLAYER_SPEED = 240; 
const JUMP_POWER = 770; 
const GRAVITY_FORCE = 1800; 
const SHIELD_SIZE = 30;
const SHIELD_DURATION = 5000; 
const SHIELD_SPAWN_DURATION = 5000; 
const SHIELD_SPAWN_INTERVAL = 8000; 

const BRAND_COLORS = {
    red: '#EA4335',
    blue: '#4285F4',
    green: '#34A853',
    yellow: '#FBBC05'
};

function init() {
    player = {
        x: canvasWidth / 2 - PLAYER_WIDTH / 2,
        y: canvasHeight - PLAYER_HEIGHT - 5,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        dx: 0,
        dy: 0,
        onGround: true
    };

    projectiles = [];
    platforms = [];
    keys = {};
    particles = [];
    gravity = GRAVITY_FORCE;
    gameTime = 120; 
    difficulty = 1; 
    gameActive = false; 
    
    shield = null;
    shieldActive = false;
    shieldTimer = 0;
    shieldBlinkTimer = 0;
    shieldSpawnTimer = 0;
    
    timerEl.textContent = `Waktu: ${gameTime}s`;
    difficultyEl.textContent = `Level: ${difficulty}`;
    
    platforms.push({
        x: 0,
        y: canvasHeight - 5,
        width: canvasWidth,
        height: 5,
        visible: true
    });
    
    if (gameInterval) clearInterval(gameInterval);
    if (projectileInterval) clearInterval(projectileInterval);
    if (platformInterval) clearInterval(platformInterval);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    gameInterval = null;
    projectileInterval = null;
    platformInterval = null;
    animationFrameId = null;
    lastFrameTimeMs = null;
}

function drawBackground() {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f1f3f4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Subtle dot grid pattern
    ctx.fillStyle = '#e8eaed';
    const gridSize = 40;
    for (let x = gridSize; x < canvasWidth; x += gridSize) {
        for (let y = gridSize; y < canvasHeight; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function createParticle(x, y, color, count = 5) {
    const colorKeys = Object.keys(BRAND_COLORS);
    const brandColorsList = Object.values(BRAND_COLORS);
    for (let i = 0; i < count; i++) {
        let pColor = color;
        // If the specified color is not in the brand colors list, pick a random brand color
        if (!brandColorsList.includes(color)) {
            pColor = BRAND_COLORS[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
        }
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150 - 30, // slightly upward burst
            size: 3 + Math.random() * 4,
            color: pColor,
            alpha: 1,
            life: 0.4 + Math.random() * 0.4
        });
    }
}

function updateAndDrawParticles(deltaSec) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * deltaSec;
        p.y += p.vy * deltaSec;
        p.life -= deltaSec;
        p.alpha = Math.max(0, p.life / 0.8);
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }
}

function drawPlayer() {
    ctx.save();
    
    // Squash and stretch based on vertical velocity
    let stretchY = 0;
    if (!player.onGround) {
        stretchY = -player.dy * 0.00015;
    }
    stretchY = Math.max(-0.15, Math.min(0.15, stretchY));
    const widthScale = 1 - stretchY;
    const heightScale = 1 + stretchY;
    
    // Bobbing when moving on ground
    let bobY = 0;
    if (player.onGround && Math.abs(player.dx) > 0) {
        bobY = Math.sin(Date.now() * 0.015) * 3;
    }
    
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height;
    ctx.translate(cx, cy + bobY);
    ctx.scale(widthScale, heightScale);
    
    // Shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(-player.width / 2 + 2, -5, player.width - 4, 8);
    
    // Body gradient (sleek gray)
    const grad = ctx.createLinearGradient(-player.width/2, -player.height, player.width/2, 0);
    grad.addColorStop(0, '#70757a');
    grad.addColorStop(1, '#4e5154');
    ctx.fillStyle = grad;
    
    ctx.beginPath();
    ctx.roundRect(-player.width / 2, -player.height, player.width, player.height, 8);
    ctx.fill();
    
    // Directional eyes
    ctx.fillStyle = 'white';
    let eyeOffset = 0;
    if (player.dx > 0) eyeOffset = 6;
    else if (player.dx < 0) eyeOffset = -6;
    
    ctx.fillRect(-4 + eyeOffset, -player.height + 12, 6, 6);
    ctx.fillRect(6 + eyeOffset, -player.height + 12, 6, 6);
    
    ctx.fillStyle = '#1a73e8'; // Blue pupils
    ctx.fillRect(-3 + eyeOffset + (player.dx > 0 ? 1 : (player.dx < 0 ? -1 : 0)), -player.height + 13, 3, 3);
    ctx.fillRect(7 + eyeOffset + (player.dx > 0 ? 1 : (player.dx < 0 ? -1 : 0)), -player.height + 13, 3, 3);
    
    ctx.restore();
}

function drawProjectiles() {
    projectiles.forEach(p => {
        ctx.save();
        
        const speed = Math.sqrt(p.dx * p.dx + p.dy * p.dy);
        if (speed > 0) {
            const angle = Math.atan2(p.dy, p.dx);
            ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
            ctx.rotate(angle);
            
            // Motion tail
            const tailGrad = ctx.createLinearGradient(0, 0, -p.width * 1.5, 0);
            tailGrad.addColorStop(0, p.color);
            tailGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tailGrad;
            ctx.beginPath();
            ctx.moveTo(0, -p.height / 2);
            ctx.lineTo(-p.width * 1.5, 0);
            ctx.lineTo(0, p.height / 2);
            ctx.closePath();
            ctx.fill();
            
            // Radial glowing core with rich brand colors
            const radialGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.width / 2);
            radialGrad.addColorStop(0, '#ffffff'); // bright center
            radialGrad.addColorStop(0.2, p.color); // quick fade to brand color
            radialGrad.addColorStop(0.8, p.color); // solid brand color
            radialGrad.addColorStop(1, 'transparent'); // fade out at edge
            
            ctx.fillStyle = radialGrad;
            ctx.beginPath();
            ctx.arc(0, 0, p.width / 2 + 2, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.width / 2, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.restore();
    });
}

function drawPlatforms() {
    platforms.forEach(p => {
        if (p.visible) {
            ctx.save();
            
            // Draw shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.beginPath();
            ctx.roundRect(p.x + 2, p.y + 4, p.width, p.height, 4);
            ctx.fill();
            
            // Main body gradient
            const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
            grad.addColorStop(0, '#e8eaed');
            grad.addColorStop(1, '#bdc1c6');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(p.x, p.y, p.width, p.height, 4);
            ctx.fill();
            
            // Highlight line
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(p.x + 2, p.y + 1, p.width - 4, 2);
            
            ctx.restore();
        }
    });
}

function drawShield() {
    if (shield && !shieldActive) {
        ctx.save();
        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.08;
        const size = SHIELD_SIZE * pulse;
        const cx = shield.x + SHIELD_SIZE / 2;
        const cy = shield.y + SHIELD_SIZE / 2;
        
        ctx.strokeStyle = 'rgba(0, 206, 209, 0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2 + 4, 0, 2 * Math.PI);
        ctx.stroke();
        
        const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, size / 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#00CED1');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 3, cy - 7, 6, 14);
        ctx.fillRect(cx - 7, cy - 3, 14, 6);
        
        ctx.restore();
    }
    
    if (shieldActive) {
        const shouldBlink = shieldBlinkTimer > 0 && shieldBlinkTimer % 200 < 100;
        if (!shouldBlink) {
            ctx.save();
            const cx = player.x + player.width / 2;
            const cy = player.y + player.height / 2;
            const radius = player.width / 2 + 10;
            
            ctx.strokeStyle = '#00CED1';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 6]);
            ctx.lineDashOffset = Date.now() * 0.02;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(0, 206, 209, 0.15)';
            ctx.beginPath();
            ctx.arc(cx, cy, radius - 2, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.restore();
        }
    }
}

function updatePlayer(deltaSec) {
    const previouslyOnGround = player.onGround;

    if (botMode) {
        updateBotMovement();
    } else {
        // Check both keyboard input and hand recognition gestures
        const moveLeft = keys['a'] || keys['ArrowLeft'] || (window.currentGesture === 'kiri');
        const moveRight = keys['d'] || keys['ArrowRight'] || (window.currentGesture === 'kanan');
        const doJump = keys['w'] || keys['ArrowUp'] || (window.currentGesture === 'lompat');

        if (moveLeft) {
            player.dx = -PLAYER_SPEED;
        } else if (moveRight) {
            player.dx = PLAYER_SPEED;
        } else {
            player.dx = 0;
        }

        if (doJump && player.onGround) {
            player.dy = -JUMP_POWER;
            player.onGround = false;
            if (jumpSfx) {
                try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
            }
        }
        
        // Optional fast drop
        if (keys['s'] || keys['ArrowDown']) {
             player.dy += 1400 * deltaSec;
        }
    }

    // Integrate physics using delta time
    player.dy += gravity * deltaSec;
    player.y += player.dy * deltaSec;
    player.x += player.dx * deltaSec;
    
    player.onGround = false;

    platforms.forEach((platform, index) => {
         if (platform.visible &&
             player.x < platform.x + platform.width &&
             player.x + player.width > platform.x) {
             
             const playerBottom = player.y + player.height;
             const prevPlayerBottom = playerBottom - player.dy * deltaSec;
             
             // If it's the ground (index 0), use a larger tolerance to prevent falling through.
             // Otherwise, use 12 pixels.
             const tolerance = (index === 0) ? Math.max(30, player.dy * deltaSec + 5) : 12;
             
             if (player.dy >= 0 && prevPlayerBottom <= platform.y + tolerance && playerBottom >= platform.y) {
                 player.y = platform.y - player.height;
                 player.dy = 0;
                 player.onGround = true;
             }
         }
    });

    // Particle triggers for landing and jump
    if (!previouslyOnGround && player.onGround) {
        createParticle(player.x + player.width / 2, player.y + player.height, '#dee2e6', 8);
    }
    if (previouslyOnGround && !player.onGround && player.dy < 0) {
        createParticle(player.x + player.width / 2, player.y + player.height, '#dee2e6', 8);
    }

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvasWidth) player.x = canvasWidth - player.width;
    if (player.y < 0) {
        player.y = 0;
        player.dy = 0;
    }
    if (player.y + player.height > canvasHeight) {
        endGame(false, 500); 
    }
    
    // Check shield collision
    if (shield && !shieldActive) {
        if (
            player.x < shield.x + SHIELD_SIZE &&
            player.x + player.width > shield.x &&
            player.y < shield.y + SHIELD_SIZE &&
            player.y + player.height > shield.y
        ) {
            // Player collected shield
            shieldActive = true;
            shieldTimer = SHIELD_DURATION;
            shieldBlinkTimer = 0;
            shield = null; // Remove shield from arena
            
            // Spawn beautiful collect particles
            createParticle(player.x + player.width / 2, player.y + player.height / 2, '#00CED1', 20);

            // Play shield collect sound effect
            if (shieldSfx) {
                try { shieldSfx.currentTime = 0; shieldSfx.volume = 0.5; shieldSfx.play(); } catch (e) {}
            }
        }
    }
}

function updateBotMovement() {
    let nearestDangerousProjectile = null;
    let minDistance = Infinity;
    
    // Check if there's a shield nearby that bot can collect
    if (shield && !shieldActive) {
        const shieldDistance = Math.sqrt(
            Math.pow(player.x + player.width/2 - (shield.x + SHIELD_SIZE/2), 2) +
            Math.pow(player.y + player.height/2 - (shield.y + SHIELD_SIZE/2), 2)
        );
        
        // If shield is close enough, prioritize getting it (increased detection to 400px)
        if (shieldDistance < 400) {
            const shieldCenterX = shield.x + SHIELD_SIZE/2;
            const playerCenterX = player.x + player.width/2;
            
            // Move towards shield
            if (Math.abs(playerCenterX - shieldCenterX) > 10) {
                player.dx = playerCenterX < shieldCenterX ? PLAYER_SPEED : -PLAYER_SPEED;
            } else {
                // Slight jitter to stay active
                player.dx = (Math.random() < 0.5 ? 1 : -1) * 30;
            }
            
            // Jump if shield is above player
            if (shield.y < player.y - 20 && player.onGround) {
                player.dy = -JUMP_POWER;
                player.onGround = false;
                if (jumpSfx) {
                    try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
                }
            }
            return; // Bot is focused on getting shield
        }
    }
    
    projectiles.forEach(projectile => {
        const distance = Math.sqrt(
            Math.pow(player.x + player.width/2 - (projectile.x + projectile.width/2), 2) +
            Math.pow(player.y + player.height/2 - (projectile.y + projectile.height/2), 2)
        );
        
        // Predict further into future (0.35s) using velocities in px/s for early dodging
        const predictionHorizonSec = 0.35;
        const predictedX = projectile.x + projectile.dx * predictionHorizonSec;
        const predictedY = projectile.y + projectile.dy * predictionHorizonSec;
        
        const predictedDistance = Math.sqrt(
            Math.pow(player.x + player.width/2 - predictedX, 2) +
            Math.pow(player.y + player.height/2 - predictedY, 2)
        );
        
        // Larger detection radius (180px) for agile dodging
        if (predictedDistance < 180 && predictedDistance < minDistance) {
            nearestDangerousProjectile = projectile;
            minDistance = predictedDistance;
        }
    });
    
    if (nearestDangerousProjectile) {
        const playerCenterX = player.x + player.width/2;
        const playerCenterY = player.y + player.height/2;
        const projCenterX = nearestDangerousProjectile.x + nearestDangerousProjectile.width/2;
        const projCenterY = nearestDangerousProjectile.y + nearestDangerousProjectile.height/2;
        
        let escapeX = playerCenterX - projCenterX;
        
        // Run horizontally away from the projectile
        if (escapeX !== 0) {
            player.dx = escapeX > 0 ? PLAYER_SPEED : -PLAYER_SPEED;
        } else {
            player.dx = Math.random() < 0.5 ? PLAYER_SPEED : -PLAYER_SPEED;
        }
        
        // Jump to dodge if projectile is coming close horizontally and vertically (ninja dodge)
        if (player.onGround && 
            Math.abs(playerCenterX - projCenterX) < 160 && 
            Math.abs(playerCenterY - projCenterY) < 80) {
            player.dy = -JUMP_POWER;
            player.onGround = false;
            if (jumpSfx) {
                try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
            }
        }

        // If near a wall and trying to move into it, jump to escape!
        if (player.onGround && (
            (player.x <= 15 && player.dx < 0) || 
            (player.x >= canvasWidth - player.width - 15 && player.dx > 0)
        )) {
            player.dy = -JUMP_POWER;
            player.onGround = false;
            player.dx = -player.dx; // Reverse direction
            if (jumpSfx) {
                try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
            }
        }
    } else {
        // Find which platform player is currently standing on
        let currentPlatformIdx = 0; // default to ground (index 0)
        platforms.forEach((p, idx) => {
            if (p.visible && 
                Math.abs(player.y + player.height - p.y) < 6 && 
                player.x + player.width >= p.x && 
                player.x <= p.x + p.width) {
                currentPlatformIdx = idx;
            }
        });

        // Ensure target index is valid
        if (botTargetPlatformIndex >= platforms.length) {
            botTargetPlatformIndex = 0;
            botTargetSetTime = 0; // force re-selection
        }

        const now = Date.now();
        const reachedTarget = currentPlatformIdx === botTargetPlatformIndex && Math.abs(player.x + player.width/2 - botTargetX) < 20;
        const targetTimedOut = now - botTargetSetTime > 3000;

        if (reachedTarget || targetTimedOut || botTargetSetTime === 0) {
            // Select a new target platform! Favor active platforms if available
            if (platforms.length > 1) {
                botTargetPlatformIndex = Math.floor(Math.random() * platforms.length);
            } else {
                botTargetPlatformIndex = 0;
            }
            const targetPlatform = platforms[botTargetPlatformIndex];
            const margin = Math.min(20, targetPlatform.width / 4);
            botTargetX = targetPlatform.x + margin + Math.random() * (targetPlatform.width - 2 * margin);
            botTargetSetTime = now;
        }

        // Navigation to botTargetPlatformIndex and botTargetX
        if (currentPlatformIdx === botTargetPlatformIndex) {
            // Case 1: Same platform, just walk to target
            player.dx = (player.x + player.width/2 < botTargetX) ? PLAYER_SPEED : -PLAYER_SPEED;

            // Jump occasionally while running on the platform to look highly active and acrobatic
            if (player.onGround && Math.random() < 0.02) {
                player.dy = -JUMP_POWER * 0.75; // a nice medium hop
                player.onGround = false;
                if (jumpSfx) {
                    try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.5; jumpSfx.play(); } catch (e) {}
                }
            }
        } else if (platforms[botTargetPlatformIndex].y < platforms[currentPlatformIdx].y) {
            // Case 2: Target is HIGHER than player
            if (currentPlatformIdx === 0) {
                // Player is on ground, target is platforms[1] or platforms[2]. Climb to platforms[1] first.
                if (platforms.length > 1) {
                    const nextPlatform = platforms[1];
                    const targetClimbX = nextPlatform.x + nextPlatform.width / 2;
                    player.dx = (player.x + player.width/2 < targetClimbX) ? PLAYER_SPEED : -PLAYER_SPEED;

                    // Jump when we are horizontally aligned under platforms[1]
                    if (player.x + player.width > nextPlatform.x + 10 && 
                        player.x < nextPlatform.x + nextPlatform.width - 10 && 
                        player.onGround) {
                        player.dy = -JUMP_POWER;
                        player.onGround = false;
                        if (jumpSfx) {
                            try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
                        }
                    }
                } else {
                    // Fallback: walk to target
                    player.dx = (player.x + player.width/2 < botTargetX) ? PLAYER_SPEED : -PLAYER_SPEED;
                }
            } else if (currentPlatformIdx === 1 && botTargetPlatformIndex === 2 && platforms.length > 2) {
                // Player is on platforms[1], target is platforms[2] (higher platform). Jump from 1 to 2.
                const lowerP = platforms[1];
                const higherP = platforms[2];
                
                // Determine if higher platform is to the left or right of lower platform
                const higherP_centerX = higherP.x + higherP.width/2;
                const lowerP_centerX = lowerP.x + lowerP.width/2;
                
                if (higherP_centerX > lowerP_centerX) {
                    // Higher platform is to the right. Walk to right edge of lower platform and jump.
                    const jumpFromX = lowerP.x + lowerP.width - 20;
                    player.dx = PLAYER_SPEED;
                    if (player.x + player.width/2 >= jumpFromX && player.onGround) {
                        player.dy = -JUMP_POWER;
                        player.onGround = false;
                        if (jumpSfx) {
                            try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
                        }
                    }
                } else {
                    // Higher platform is to the left. Walk to left edge of lower platform and jump.
                    const jumpFromX = lowerP.x + 20;
                    player.dx = -PLAYER_SPEED;
                    if (player.x + player.width/2 <= jumpFromX && player.onGround) {
                        player.dy = -JUMP_POWER;
                        player.onGround = false;
                        if (jumpSfx) {
                            try { jumpSfx.currentTime = 0; jumpSfx.volume = 0.7; jumpSfx.play(); } catch (e) {}
                        }
                    }
                }
            } else {
                // Other cases. Just walk towards the target X
                player.dx = (player.x + player.width/2 < botTargetX) ? PLAYER_SPEED : -PLAYER_SPEED;
            }
        } else {
            // Case 3: Target is LOWER than player
            // Simply walk towards botTargetX. When walking off the platform edges, the player will fall.
            player.dx = (player.x + player.width/2 < botTargetX) ? PLAYER_SPEED : -PLAYER_SPEED;
        }
    }
    
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvasWidth) player.x = canvasWidth - player.width;
}

function updateProjectiles(deltaSec) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx * deltaSec;
        p.y += p.dy * deltaSec;

        if (p.x < -p.width || p.x > canvasWidth || p.y < -p.height || p.y > canvasHeight) {
            projectiles.splice(i, 1);
            continue;
        }

        if (
            player.x < p.x + p.width &&
            player.x + player.width > p.x &&
            player.y < p.y + p.height &&
            player.y + player.height > p.y
        ) {
            if (shieldActive) {
                // Shield protects player from projectile
                shieldActive = false;
                shieldTimer = 0;
                shieldBlinkTimer = 0;
                
                // Particle explosion when projectile hit shield
                createParticle(p.x + p.width / 2, p.y + p.height / 2, p.color, 12);
                createParticle(player.x + player.width / 2, player.y + player.height / 2, '#00CED1', 12);

                // Remove the projectile
                projectiles.splice(i, 1);
                
                // Play shield hit sound effect
                if (shieldHitSfx) {
                    try { shieldHitSfx.currentTime = 0; shieldHitSfx.volume = 0.4; shieldHitSfx.play(); } catch (e) {}
                }
                continue;
            } else {
                // Player hit by projectile without shield
                if (gotHitSfx) {
                    try { gotHitSfx.currentTime = 0; gotHitSfx.volume = 0.8; gotHitSfx.play(); } catch (e) {}
                }
                endGame(false, 400);
                return; 
            }
        }
    }
}

function spawnProjectile() {
    if (!gameActive) return;
    
    if (projectiles.length >= 20) return;
    
    const size = 15 + Math.random() * 15;
    const speed = 160 + Math.random() * (60 * difficulty); // px/s
    const colorKeys = Object.keys(BRAND_COLORS);
    const color = BRAND_COLORS[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
    
    let x, y, dx, dy;
    let side;
    
    // Only allow top (0), right (1), and left (3). No bottom (2).
    const sides = [0, 1, 3];
    side = sides[Math.floor(Math.random() * sides.length)];

    switch(side) {
        case 0: 
            x = Math.random() * (canvasWidth - size);
            y = -size;
            dx = (Math.random() - 0.5) * 120;
            dy = speed;
            break;
        case 1: 
            x = canvasWidth;
            y = Math.random() * (canvasHeight - size);
            dx = -speed;
            dy = (Math.random() - 0.5) * 120;
            break;
        case 2: 
            x = Math.random() * (canvasWidth - size);
            y = canvasHeight;
            dx = (Math.random() - 0.5) * 120;
            dy = -speed;
            break;
        case 3: 
            x = -size;
            y = Math.random() * (canvasHeight - size);
            dx = speed;
            dy = (Math.random() - 0.5) * 120;
            break;
    }

    projectiles.push({ x, y, width: size, height: size, dx, dy, color });
}

function managePlatforms() {
    if (!gameActive) return;
    
    if (platforms.length > 1) {
        platforms.splice(1, platforms.length - 1);
    }

    const pWidthLower = 120 + Math.random() * 40; // 120 to 160
    const pWidthHigher = 120 + Math.random() * 40; // 120 to 160
    const pHeight = 15;
    
    // Lower platform y (very reachable from the ground)
    const lowerY = 460 + Math.random() * 25; // 460 to 485
    
    // Lower platform x (somewhat centered)
    let lowerX = 200 + Math.random() * 240; // 200 to 440
    
    // Higher platform y (comfortable vertical jump height of 120-135px above the lower platform)
    const higherY = lowerY - (120 + Math.random() * 15);
    
    // Higher platform x (placed either left or right of the lower platform with a manageable horizontal gap of 60-110px)
    const gap = 60 + Math.random() * 50;
    const goLeft = Math.random() < 0.5;
    let higherX;
    
    if (goLeft) {
        higherX = lowerX - pWidthHigher - gap;
        if (higherX < 40) {
            higherX = lowerX + pWidthLower + gap;
        }
    } else {
        higherX = lowerX + pWidthLower + gap;
        if (higherX + pWidthHigher > canvasWidth - 40) {
            higherX = lowerX - pWidthHigher - gap;
        }
    }
    
    // Keep within safe margins of screen width
    if (lowerX < 40) lowerX = 40;
    if (lowerX + pWidthLower > canvasWidth - 40) lowerX = canvasWidth - 40 - pWidthLower;
    
    if (higherX < 40) higherX = 40;
    if (higherX + pWidthHigher > canvasWidth - 40) higherX = canvasWidth - 40 - pWidthHigher;
    
    platforms.push({ x: lowerX, y: lowerY, width: pWidthLower, height: pHeight, visible: true });
    platforms.push({ x: higherX, y: higherY, width: pWidthHigher, height: pHeight, visible: true });
}

function spawnShield() {
    if (!gameActive || shield || shieldActive) return;
    
    // Random position for shield - closer to ground level and reachable by player
    const x = 50 + Math.random() * (canvasWidth - 100 - SHIELD_SIZE);
    const y = canvasHeight - 150 - Math.random() * 100; // Between 150-250 pixels from ground
    
    shield = { x, y };
    shieldSpawnTimer = SHIELD_SPAWN_DURATION;
}

function updateShield(deltaMs) {
    if (!gameActive) return;
    
    // Update shield spawn timer
    if (shield) {
        shieldSpawnTimer -= deltaMs;
        if (shieldSpawnTimer <= 0) {
            shield = null; // Shield disappears from arena
        }
    }
    
    // Update active shield timer
    if (shieldActive) {
        shieldTimer -= deltaMs;
        
        // Start blinking at 1 second (1000ms remaining)
        if (shieldTimer <= 1000 && shieldTimer > 0) {
            shieldBlinkTimer += deltaMs;
        }
        
        if (shieldTimer <= 0) {
            shieldActive = false;
            shieldBlinkTimer = 0;
        }
    }
    
    // Spawn new shield if none exists and enough time has passed
    if (!shield && !shieldActive) {
        let spawnChance = 0.001; // Default low chance each frame
        
        // Increase shield spawn rate for levels 3 and 4
        if (difficulty >= 3) {
            spawnChance = 0.003; // 3x more frequent
        }
        
        if (Math.random() < spawnChance) {
            spawnShield();
        }
    }
}

function updateDifficulty() {
    if (!gameActive || gameTime <= 0) return;
    
    const elapsedTime = 120 - gameTime;
    let newDifficulty = 1;
    
    if (elapsedTime >= 90) {
        newDifficulty = 4; 
    } else if (elapsedTime >= 60) {
        newDifficulty = 3; 
    } else if (elapsedTime >= 30) {
        newDifficulty = 2; 
    }
    
    if (newDifficulty !== difficulty) {
        difficulty = newDifficulty;
        difficultyEl.textContent = `Level: ${difficulty}`;
        
        if (gameActive && projectileInterval) {
            clearInterval(projectileInterval);
            projectileInterval = setInterval(spawnProjectile, 2000 / difficulty);
        }
    }
}

function gameLoop(timestamp) {
    if (!gameActive) return;

    if (lastFrameTimeMs === null) lastFrameTimeMs = timestamp;
    let deltaMs = timestamp - lastFrameTimeMs;
    if (deltaMs > 100) deltaMs = 100; // clamp to avoid huge steps
    const deltaSec = deltaMs / 1000;
    lastFrameTimeMs = timestamp;

    drawBackground();
    drawPlatforms();
    drawPlayer();
    drawProjectiles();
    drawShield();
    
    updateAndDrawParticles(deltaSec);

    updatePlayer(deltaSec);
    updateProjectiles(deltaSec);
    updateShield(deltaMs);

    if (gameActive) {
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function startBgMusic() {
     if (!bgMusic) return;
     try {
         bgMusic.currentTime = 0;
         bgMusic.volume = 0.4;
         bgMusic.play();
     } catch (e) { /* ignored */ }
}

function stopBgMusic() {
     if (!bgMusic) return;
     try {
         bgMusic.pause();
         bgMusic.currentTime = 0;
     } catch (e) { /* ignored */ }
}

function playLose() {
     if (!loseSfx) return;
     try {
         loseSfx.currentTime = 0;
         loseSfx.volume = 0.8;
         loseSfx.play();
     } catch (e) { /* ignored */ }
}

function playClick() {
     if (!clickSfx) return;
     try {
         clickSfx.currentTime = 0;
         clickSfx.volume = 1.0;
         clickSfx.play();
     } catch (e) { /* ignored */ }
}

function handleStartButtonClick() {
    if (loseSfx) {
        try { 
            loseSfx.pause(); 
            loseSfx.currentTime = 0; 
        } catch (e) {}
    }
    if (winSfx) {
        try { 
            winSfx.pause(); 
            winSfx.currentTime = 0; 
        } catch (e) {}
    }
    playClick();
    startGame();
}

function startGame() {
    if (gameInterval) clearInterval(gameInterval);
    if (projectileInterval) clearInterval(projectileInterval);
    if (platformInterval) clearInterval(platformInterval);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    if (loseSfx) {
        try { 
            loseSfx.pause(); 
            loseSfx.currentTime = 0; 
        } catch (e) {}
    }
    if (winSfx) {
        try { 
            winSfx.pause(); 
            winSfx.currentTime = 0; 
        } catch (e) {}
    }
    
    init();
    gameActive = true;
    messageOverlay.style.display = 'none';
    
    difficultyEl.textContent = 'Level: 1';
    
    gameInterval = setInterval(() => {
        gameTime--;
        timerEl.textContent = `Waktu: ${gameTime}s`;
        updateDifficulty();
        if (gameTime <= 0) {
            endGame(true); 
        }
    }, 1000);

    projectileInterval = setInterval(spawnProjectile, 2000);
    platformInterval = setInterval(managePlatforms, 5000); 
    shieldSpawnTimer = SHIELD_SPAWN_INTERVAL; 

    startBgMusic();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function toggleBotMode() {
    botMode = !botMode;
    if (botMode) {
        console.log("🤖 Bot Mode AKTIF - Game akan berjalan otomatis!");
        botIndicator.style.display = 'block';
        if (!gameActive) {
            handleStartButtonClick();
        }
    } else {
        console.log("👤 Manual Mode - Kontrol kembali ke tangan Anda");
        botIndicator.style.display = 'none';
    }
}

function endGame(isWin, delay = 0) {
    if (!gameActive) return; 

    gameActive = false;

    if (delay > 0) {
        setTimeout(() => {
            showGameOverScreen(isWin);
        }, delay);
        return;
    }

    showGameOverScreen(isWin);
}

function showGameOverScreen(isWin) {
    clearInterval(gameInterval);
    clearInterval(projectileInterval);
    clearInterval(platformInterval);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameActive = false;
    
    if (botMode) {
        botMode = false;
        botIndicator.style.display = 'none';
        console.log("🔄 Bot Mode dinonaktifkan - Game selesai");
    }

    gameInterval = null;
    projectileInterval = null;
    platformInterval = null;
    animationFrameId = null;
    
    stopBgMusic();

    messageOverlay.style.display = 'flex';
    const messageBox = messageOverlay.querySelector('.message-box');
    const h1 = messageOverlay.querySelector('h1');
    const p = messageOverlay.querySelector('p');
    const button = messageOverlay.querySelector('button');

    if (isWin) {
        h1.textContent = "Kamu Menang!";
        p.textContent = "Selamat! Kamu berhasil bertahan selama 2 menit.";
        messageBox.style.backgroundColor = '#34A853'; 
        if (winSfx) {
            try { 
                winSfx.currentTime = 0; 
                winSfx.volume = 0.8; 
                winSfx.play(); 
            } catch (e) {}
        }
    } else {
        h1.textContent = "Game Over!";
        p.textContent = "Jangan menyerah, coba lagi!";
        messageBox.style.backgroundColor = '#EA4335'; 
        if (loseSfx) {
            try {
                loseSfx.currentTime = 0;
                loseSfx.volume = 0.8;
                loseSfx.play();
            } catch (e) {}
        }
    }
    button.textContent = "Main Lagi";
    button.onclick = handleStartButtonClick;
}

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key.toLowerCase() === 'm') {
        toggleBotMode();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

startButton.addEventListener('click', handleStartButtonClick);

init();
