const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. SETUP & RESIZE ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- 2. GAME VARIABLES ---
let gameState = {
    gold: 120,    // Starting Gold
    lives: 10,
    wave: 1,
    gameOver: false
};

const enemies = [];
const towers = [];
const projectiles = []; // Visual lasers

// Game Constants
const ENEMY_SPEED = 0.001;
const TURRET_COST = 50;
const TURRET_RANGE = 0.25; // 25% of screen width
const REWARD_GOLD = 10;    // Gold earned per kill

// The Path
const path = [
    {x: 0, y: 0.5},
    {x: 0.4, y: 0.5},
    {x: 0.4, y: 0.2},
    {x: 0.8, y: 0.2},
    {x: 0.8, y: 0.8},
    {x: 1, y: 0.8}
];

// --- 3. CLASSES ---

class Enemy {
    constructor() {
        this.pathIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.health = 100 + (gameState.wave * 10); // Enemies get stronger every wave
        this.maxHealth = this.health;
        this.active = true;
    }

    update() {
        if (!this.active) return;

        let target = path[this.pathIndex + 1];
        if (!target) {
            this.active = false;
            gameState.lives--;
            return;
        }

        let dx = target.x - this.x;
        let dy = target.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < 0.01) {
            this.pathIndex++;
        } else {
            this.x += (dx / dist) * ENEMY_SPEED;
            this.y += (dy / dist) * ENEMY_SPEED;
        }
    }

    draw() {
        if (!this.active) return;
        let px = this.x * canvas.width;
        let py = this.y * canvas.height;

        // Enemy Body
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(px - 10, py - 10, 20, 20);

        // Health Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(px - 12, py - 20, 24, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(px - 12, py - 20, 24 * (this.health / this.maxHealth), 4);
    }
}

class Turret {
    constructor(x, y) {
        this.x = x; // Percentage (0.0 to 1.0)
        this.y = y;
        this.cooldown = 0;
        this.range = TURRET_RANGE;
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;

        // Find closest enemy
        if (this.cooldown <= 0) {
            for (let e of enemies) {
                if (!e.active) continue;
                
                // Calculate distance to enemy (Pythagoras theorem)
                let dx = e.x - this.x;
                let dy = e.y - this.y;
                let dist = Math.sqrt(dx*dx + dy*dy);

                // If in range, SHOOT!
                if (dist < this.range) {
                    this.shoot(e);
                    break; // Only shoot one at a time
                }
            }
        }
    }

    shoot(enemy) {
        this.cooldown = 40; // Fire rate (frames)
        enemy.health -= 35; // Damage
        
        // Add visual laser beam
        projectiles.push({
            sx: this.x, sy: this.y,
            ex: enemy.x, ey: enemy.y,
            life: 10 // Visible for 10 frames
        });

        // Check Kill
        if (enemy.health <= 0) {
            enemy.active = false;
            gameState.gold += REWARD_GOLD;
        }
    }

    draw() {
        let px = this.x * canvas.width;
        let py = this.y * canvas.height;

        // Draw Turret Base
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.fill();

        // Draw Turret Top (Green)
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Range Circle (Faint)
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.1)';
        ctx.beginPath();
        ctx.arc(px, py, this.range * canvas.width, 0, Math.PI*2);
        ctx.stroke();
    }
}

// --- 4. INPUT HANDLING (BUILDING) ---
canvas.addEventListener('click', (e) => {
    if (gameState.gameOver) return;

    // Get click position in percentage
    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX - rect.left) / canvas.width;
    let cy = (e.clientY - rect.top) / canvas.height;

    // Check cost
    if (gameState.gold >= TURRET_COST) {
        towers.push(new Turret(cx, cy));
        gameState.gold -= TURRET_COST;
    } else {
        // Optional: Flash red or play sound
        alert("Not enough Gold! Need " + TURRET_COST);
    }
});

// --- 5. MAIN LOOP ---
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Map
    ctx.beginPath();
    ctx.lineWidth = 40;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineCap = 'round';
    ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
    for (let p of path) ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    ctx.stroke();

    // Draw Towers
    towers.forEach(t => { t.update(); t.draw(); });

    // Draw Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.update();
        e.draw();
        if (!e.active) enemies.splice(i, 1);
    }

    // Draw Lasers (Projectiles)
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'yellow';
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        ctx.beginPath();
        ctx.moveTo(p.sx * canvas.width, p.sy * canvas.height);
        ctx.lineTo(p.ex * canvas.width, p.ey * canvas.height);
        ctx.stroke();
        
        p.life--;
        if (p.life <= 0) projectiles.splice(i, 1);
    }

    // Update UI
    document.getElementById('displayGold').innerText = gameState.gold;
    document.getElementById('displayLives').innerText = gameState.lives;

    if (gameState.lives <= 0 && !gameState.gameOver) {
        gameState.gameOver = true;
        // This is where we will add the "Watch Ad to Revive" logic later
        alert("GAME OVER! Wave: " + gameState.wave); 
    }

    requestAnimationFrame(drawGame);
}

// Start
drawGame();

// Spawner
setInterval(() => {
    if (!gameState.gameOver) enemies.push(new Enemy());
}, 1500);

// Increase difficulty every 10 seconds
setInterval(() => {
    gameState.wave++;
}, 10000);
