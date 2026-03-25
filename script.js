const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, WIN
let currentLevelNum = 1;
let scrollX = 0;
let levelLength = 0;

// Input State
let isHolding = false;
let inputJustPressed = false;

// Config
const TILE_SIZE = 40;
const SCROLL_SPEED = 6;
const GRAVITY_CUBE = 0.8;
const JUMP_STRENGTH = -11;
const GRAVITY_SHIP = 0.4;
const SHIP_FLY_POWER = -0.8;
const MAX_FALL_SPEED = 15;

// Player Object
const player = {
    x: 150,
    y: 0,
    w: TILE_SIZE * 0.8,
    h: TILE_SIZE * 0.8,
    vy: 0,
    mode: 'cube', // 'cube' or 'ship'
    grounded: false,
    rotation: 0
};

// Level Data: B=Block, S=Spike, O=Orb, >=Ship Portal, <=Cube Portal, E=End Goal
const levelMaps = {
    1: [ // Easy: Basic jumps
        "                                                                                           E",
        "                                                                                           B",
        "                                                                                           B",
        "                                                                                           B",
        "                                                                                           B",
        "                                    BBBB                                                   B",
        "                                                                                           B",
        "           S      S      S                   S     S       S    S                          B",
        "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
    ],
    2: [ // Medium: Orbs
        "                                                                                                   E",
        "                                                                                                   B",
        "                                                                                                   B",
        "                                                                                    BB             B",
        "                                                      O                 O           BB             B",
        "                     O                 O                                            BB             B",
        "           BB                 BB                                                                   B",
        "                     S                 S      S                S                                   B",
        "BBBBBBBBBBBBBB   BBBBBBBBBBBBBBBB  BBBBBBBBBBBBBBBBBBBB    BBBBBBBBBBBBBBBBBB    BBBBBBBBBBBBBBBBBBB"
    ],
    3: [ // Hard: Ship Mode transition
        "                                                                                                            E",
        "                                      BBBBBBBB      BBBBBBBBBBBB        BBBBBBBBB                           B",
        "                                              BB    BB          BB      BB                                  B",
        "                  >        S                   BB  BB           BB      BB           <     S     S          B",
        "                                                BBBB            BB      BB                                  B",
        "                                      BBBBBBBB      BB          BB      BB                                  B",
        "           BB          BB                                                                                   B",
        "                   S                                                    BB      BB            S             B",
        "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
    ]
};

let objects = [];
let particles = [];

// --- Input Handling ---
window.addEventListener('mousedown', () => triggerInput(true));
window.addEventListener('mouseup', () => triggerInput(false));
window.addEventListener('keydown', (e) => { if (e.code === 'Space') triggerInput(true); });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') triggerInput(false); });
window.addEventListener('touchstart', (e) => { e.preventDefault(); triggerInput(true); }, {passive: false});
window.addEventListener('touchend', (e) => { e.preventDefault(); triggerInput(false); });

function triggerInput(isDown) {
    if (gameState !== 'PLAYING') return;
    isHolding = isDown;
    if (isDown) inputJustPressed = true;
}

// --- UI Handling ---
function showMenu() {
    gameState = 'MENU';
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('level-complete').classList.add('hidden');
}

function startGame(levelNum) {
    currentLevelNum = levelNum;
    restartLevel();
}

function restartLevel() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('level-complete').classList.add('hidden');
    
    // Reset Player
    player.y = 200;
    player.vy = 0;
    player.mode = 'cube';
    player.rotation = 0;
    scrollX = 0;
    isHolding = false;
    particles = [];
    
    // Parse Level
    objects = [];
    const map = levelMaps[currentLevelNum];
    levelLength = map[0].length * TILE_SIZE;
    
    for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
            const char = map[r][c];
            if (char !== ' ') {
                objects.push({
                    type: char,
                    x: c * TILE_SIZE,
                    y: r * TILE_SIZE,
                    w: TILE_SIZE,
                    h: TILE_SIZE,
                    active: true // For orbs
                });
            }
        }
    }
    
    gameState = 'PLAYING';
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'GAMEOVER';
    const percent = Math.min(100, Math.floor(((scrollX + player.x) / levelLength) * 100));
    document.getElementById('progress-text').innerText = `Progress: ${percent}%`;
    document.getElementById('game-over').classList.remove('hidden');
    createDeathParticles();
}

function win() {
    gameState = 'WIN';
    document.getElementById('level-complete').classList.remove('hidden');
}

// --- Game Logic ---
function update() {
    if (gameState !== 'PLAYING') return;

    // Movement & Scrolling
    scrollX += SCROLL_SPEED;
    
    // Physics
    let prevY = player.y;
    
    if (player.mode === 'cube') {
        player.vy += GRAVITY_CUBE;
        // Jump
        if (inputJustPressed) {
            // Check Orb usage first
            let usedOrb = false;
            for (let obj of objects) {
                if (obj.type === 'O' && obj.active) {
                    const dx = (player.x + player.w/2) - (obj.x - scrollX + obj.w/2);
                    const dy = (player.y + player.h/2) - (obj.y + obj.h/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < TILE_SIZE * 1.5) {
                        player.vy = JUMP_STRENGTH * 1.1;
                        obj.active = false; // Consume orb
                        usedOrb = true;
                        break;
                    }
                }
            }
            if (!usedOrb && player.grounded) {
                player.vy = JUMP_STRENGTH;
            }
        }
        
        // Rotation for visual flair
        if (!player.grounded) player.rotation += 5;
        else if (player.rotation % 90 !== 0) player.rotation = Math.round(player.rotation / 90) * 90;

    } else if (player.mode === 'ship') {
        player.vy += GRAVITY_SHIP;
        if (isHolding) {
            player.vy += SHIP_FLY_POWER;
        }
        // Smooth rotation based on velocity
        player.rotation = player.vy * 2; 
    }

    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;
    player.y += player.vy;
    player.grounded = false;

    // Boundaries
    if (player.y > canvas.height || player.y < -50) gameOver();

    // Collision Detection
    const px = player.x;
    const py = player.y;
    const pw = player.w;
    const ph = player.h;

    for (let obj of objects) {
        const ox = obj.x - scrollX; // Object's position on screen
        const oy = obj.y;

        // Ignore if offscreen
        if (ox > canvas.width || ox + obj.w < 0) continue;

        // AABB Collision Check
        if (px < ox + obj.w && px + pw > ox && py < oy + obj.h && py + ph > oy) {
            
            if (obj.type === 'B') {
                // Determine if it was a top collision or side collision
                if (prevY + ph <= oy + 5 && player.vy >= 0) { // Landed on top
                    player.y = oy - ph;
                    player.vy = 0;
                    player.grounded = true;
                } else {
                    // Hit side or bottom = death
                    gameOver();
                }
            } 
            else if (obj.type === 'S') {
                // Shrink hitbox slightly for spikes to be forgiving
                const hitboxShrink = 10;
                if (px + hitboxShrink < ox + obj.w - hitboxShrink && px + pw - hitboxShrink > ox + hitboxShrink && 
                    py + ph > oy + hitboxShrink) {
                    gameOver();
                }
            }
            else if (obj.type === '>') {
                player.mode = 'ship';
            }
            else if (obj.type === '<') {
                player.mode = 'cube';
            }
            else if (obj.type === 'E') {
                win();
            }
        }
    }

    inputJustPressed = false; // Reset input flag
    
    // Update Particles
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);
}

function createDeathParticles() {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: player.x + player.w/2,
            y: player.y + player.h/2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30 + Math.random() * 20,
            color: '#00ffcc'
        });
    }
}

// --- Rendering ---
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState !== 'PLAYING' && gameState !== 'GAMEOVER') return;

    // Draw Objects
    for (let obj of objects) {
        const ox = obj.x - scrollX;
        
        // Culling (don't draw if off screen)
        if (ox > canvas.width || ox + obj.w < 0) continue;

        if (obj.type === 'B') {
            ctx.fillStyle = '#111';
            ctx.fillRect(ox, obj.y, obj.w, obj.h);
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.strokeRect(ox, obj.y, obj.w, obj.h);
        } else if (obj.type === 'S') {
            ctx.fillStyle = '#ff4c4c';
            ctx.beginPath();
            ctx.moveTo(ox + obj.w / 2, obj.y); // Top point
            ctx.lineTo(ox + obj.w, obj.y + obj.h); // Bottom right
            ctx.lineTo(ox, obj.y + obj.h); // Bottom left
            ctx.fill();
        } else if (obj.type === 'O') {
            ctx.fillStyle = obj.active ? '#ffff00' : '#555';
            ctx.beginPath();
            ctx.arc(ox + obj.w/2, obj.y + obj.h/2, 12, 0, Math.PI * 2);
            ctx.fill();
            if (obj.active) {
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(ox + obj.w/2, obj.y + obj.h/2, 18, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (obj.type === '>' || obj.type === '<') {
            ctx.fillStyle = obj.type === '>' ? '#ff00ff' : '#00ffff';
            ctx.fillRect(ox + 10, obj.y - 40, 20, 120);
        } else if (obj.type === 'E') {
            ctx.fillStyle = '#4cff4c';
            ctx.fillRect(ox, 0, obj.w, canvas.height);
        }
    }

    // Draw Player (Only if playing)
    if (gameState === 'PLAYING') {
        ctx.save();
        ctx.translate(player.x + player.w/2, player.y + player.h/2);
        ctx.rotate(player.rotation * Math.PI / 180);
        
        if (player.mode === 'cube') {
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(-player.w/2, -player.h/2, player.w, player.h);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-player.w/2, -player.h/2, player.w, player.h);
        } else if (player.mode === 'ship') {
            // Draw a crude ship shape
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.moveTo(player.w/2, 0);
            ctx.lineTo(-player.w/2, player.h/2);
            ctx.lineTo(-player.w/4, 0);
            ctx.lineTo(-player.w/2, -player.h/2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Draw Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 50;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    update();
    draw();
    if (gameState === 'PLAYING' || particles.length > 0) {
        requestAnimationFrame(gameLoop);
    }
}
