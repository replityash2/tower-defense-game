const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. ADSGRAM SETUP (FAIL-SAFE MODE) ---
// We try to connect to AdsGram. If it fails (AdBlocker/Network error), we use a dummy mode.
let AdController;
try {
    if (window.Adsgram) {
        AdController = window.Adsgram.init({ blockId: "21141" });
    } else {
        throw new Error("Adsgram SDK not loaded");
    }
} catch (e) {
    console.log("Ads failed to load (AdBlock?):", e);
    // Dummy Controller so game doesn't crash
    AdController = {
        show: () => {
            return new Promise((resolve, reject) => {
                alert("Ads are blocked on this device/network.\n\nSimulating reward...");
                resolve();
            });
        }
    };
}

// --- 2. SETUP & RESIZE ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- 3. GAME VARIABLES ---
let gameState = {
    gold: 120,    
    lives: 10,
    wave: 1,
    gameOver: false
};

const enemies = [];
const towers = [];
const projectiles = []; 

// Game Balance
const ENEMY_SPEED = 0.0015;
const TURRET_COST = 50;
const TURRET_RANGE = 0.25; 
const REWARD_GOLD = 10;   

// The Map Path
const path = [
    {x: 0, y: 0.5},
    {x: 0.4, y: 0.5},
    {x: 0.4, y: 0.2},
    {x: 0.8, y: 0.2},
    {x: 0.8, y: 0.8},
    {x: 1, y: 0.8}
];

// --- 4. CLASSES ---

class Enemy {
    constructor() {
        this.pathIndex = 0;
        this.x = path[0].x;
        this.y = path[0].y;
        this.health = 100 + (gameState.wave * 15); 
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

        // Enemy Body (Red Tank)
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(px - 12, py - 12, 24, 24);

        // Health Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(px - 12, py - 20, 24, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(px - 12, py - 20, 24 * (this.health / this.maxHealth), 4);
    }
}

class Turret {
    constructor(x, y) {
        this.x = x; 
        this.y = y;
        this.cooldown = 0;
        this.range = TURRET_RANGE;
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;

        if (this.cooldown <= 0) {
            for (let e of enemies) {
                if (!e.active) continue;
                
                let dx = e.x - this.x;
                let dy = e.y - this.y;
                let dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < this.range) {
                    this.shoot(e);
                    break; 
                }
            }
        }
    }

    shoot(enemy) {
        this.cooldown = 35; // Fire speed
        enemy.health -= 40; // Damage
        
        // Laser effect
        projectiles.push({
            sx: this.x, sy: this.y,
            ex: enemy.x, ey: enemy.y,
            life: 8 
        });

        if (enemy.health <= 0) {
            enemy.active = false;
            gameState.gold += REWARD_GOLD;
        }
    }

    draw() {
        let px = this.x * canvas.width;
        let py = this.y * canvas.height;

        // Base
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.fill();

        // Top (Green)
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Range (Subtle)
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.1)';
        ctx.beginPath();
        ctx.arc(px, py, this.range * canvas.width, 0, Math.PI*2);
        ctx.stroke();
    }
}

// --- 5. INPUT (BUILDING) ---
canvas.addEventListener('click', (e) => {
    if (gameState.gameOver) return;

    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX - rect.left) / canvas.width;
    let cy = (e.clientY - rect.top) / canvas.height;

    if (gameState.gold >= TURRET_COST) {
        towers.push(new Turret(cx, cy));
        gameState.gold -= TURRET_COST;
    } else {
        // Flash HUD red if no money
        document.getElementById('displayGold').style.color = 'red';
        setTimeout(() => document.getElementById('displayGold').style.color = '#4CAF50', 200);
    }
});

// --- 6. AD REVENUE LOGIC ---
function watchAdToRevive() {
    AdController.show().then((result) => {
        // SUCCESS
        gameState.lives = 5;       
        gameState.gold += 150;     
        gameState.gameOver = false; 
        
        document.getElementById('gameOverModal').classList.add('hidden');
        drawGame();
        
    }).catch((result) => {
        alert("You must watch the full ad to revive!");
    });
}

// --- 7. MAIN LOOP ---
function drawGame() {
    if (gameState.gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Map
    ctx.beginPath();
    ctx.lineWidth = 40;
    ctx.strokeStyle = '#111';
    ctx.lineCap = 'round';
    ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
    for (let p of path) ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    ctx.stroke();

    // Draw Border
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#333';
    ctx.stroke();

    // Draw Objects
    towers.forEach(t => { t.update(); t.draw(); });

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.update();
        e.draw();
        if (!e.active) enemies.splice(i, 1);
    }

    // Draw Lasers
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffff00'; 
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
    document.getElementById('displayGold').innerText = Math.floor(gameState.gold);
    document.getElementById('displayLives').innerText = gameState.lives;
    document.getElementById('displayWave').innerText = "WAVE " + gameState.wave;

    // Check Loss
    if (gameState.lives <= 0) {
        gameState.gameOver = true;
        document.getElementById('finalWave').innerText = gameState.wave;
        document.getElementById('gameOverModal').classList.remove('hidden');
    } else {
        requestAnimationFrame(drawGame);
    }
}

// Start
drawGame();

// Spawner
setInterval(() => {
    if (!gameState.gameOver) enemies.push(new Enemy());
}, 1500);

// Difficulty
setInterval(() => {
    if (!gameState.gameOver) gameState.wave++;
}, 12000);
