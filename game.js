const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. CONFIGURATION ---
let AdController;
try {
    AdController = window.Adsgram.init({ blockId: "21141" });
} catch (e) { console.log("AdBlock active or network error"); }

// TOWER TYPES
const TOWERS = {
    GUNNER:  { cost: 50,  range: 0.25, damage: 25, rate: 30, color: '#4CAF50', type: 'single' },
    SNIPER:  { cost: 120, range: 0.50, damage: 100, rate: 90, color: '#2196F3', type: 'single' },
    BLASTER: { cost: 200, range: 0.20, damage: 40, rate: 50, color: '#FF9800', type: 'splash' }
};

// ENEMY TYPES
const ENEMIES = {
    SOLDIER: { speed: 0.0015, hp: 60,  color: '#ff3333', reward: 10 },
    SCOUT:   { speed: 0.0030, hp: 30,  color: '#FFFF00', reward: 15 }, // Fast, Weak
    TANK:    { speed: 0.0008, hp: 300, color: '#8B0000', reward: 50 }  // Slow, Strong
};

// --- 2. GAME STATE ---
let gameState = {
    gold: 150,
    lives: 20,
    wave: 1,
    gameOver: false,
    selectedTower: 'GUNNER', // Default selection
    enemiesLeftInWave: 0,
    waveActive: false
};

const enemies = [];
const towers = [];
const projectiles = [];
const particles = []; // Sparks/Explosions

// --- 3. MAP PATH ---
const path = [
    {x: 0, y: 0.5}, {x: 0.2, y: 0.5}, {x: 0.2, y: 0.2},
    {x: 0.5, y: 0.2}, {x: 0.5, y: 0.8}, {x: 0.8, y: 0.8},
    {x: 0.8, y: 0.5}, {x: 1, y: 0.5}
];

// --- 4. WAVE SYSTEM (SCRIPTED LEVELS) ---
function startWave() {
    if (gameState.waveActive) return;
    gameState.waveActive = true;
    
    let waveConfig = [];
    
    // Define Difficulty
    if (gameState.wave === 1) waveConfig = Array(5).fill('SOLDIER');
    else if (gameState.wave === 2) waveConfig = Array(10).fill('SOLDIER');
    else if (gameState.wave === 3) waveConfig = Array(15).fill('SCOUT'); // Rush!
    else if (gameState.wave === 4) waveConfig = ['TANK', 'SOLDIER', 'TANK', 'SOLDIER'];
    else if (gameState.wave % 5 === 0) waveConfig = Array(gameState.wave).fill('TANK'); // Boss level
    else {
        // Random mix for higher levels
        for(let i=0; i<gameState.wave * 3; i++) {
            waveConfig.push(Math.random() > 0.8 ? 'TANK' : (Math.random() > 0.5 ? 'SCOUT' : 'SOLDIER'));
        }
    }

    gameState.enemiesLeftInWave = waveConfig.length;
    let spawnIndex = 0;

    const spawner = setInterval(() => {
        if (gameState.gameOver || spawnIndex >= waveConfig.length) {
            clearInterval(spawner);
            return;
        }
        spawnEnemy(waveConfig[spawnIndex]);
        spawnIndex++;
    }, 1000); // Spawn 1 enemy every second
}

function spawnEnemy(typeKey) {
    let type = ENEMIES[typeKey];
    enemies.push({
        pathIndex: 0,
        x: path[0].x, y: path[0].y,
        hp: type.hp + (gameState.wave * 5), // Slight scaling
        maxHp: type.hp + (gameState.wave * 5),
        speed: type.speed,
        color: type.color,
        reward: type.reward,
        active: true
    });
}

// --- 5. GAME OBJECTS ---
class Turret {
    constructor(x, y, typeKey) {
        this.x = x; this.y = y;
        this.type = TOWERS[typeKey];
        this.cooldown = 0;
    }
    update() {
        if (this.cooldown > 0) this.cooldown--;
        if (this.cooldown <= 0) {
            for (let e of enemies) {
                let dist = Math.hypot(e.x - this.x, e.y - this.y);
                if (dist < this.type.range) {
                    this.shoot(e);
                    break; 
                }
            }
        }
    }
    shoot(target) {
        this.cooldown = this.type.rate;
        // Visual Laser
        projectiles.push({sx: this.x, sy: this.y, ex: target.x, ey: target.y, life: 10, color: this.type.color});
        
        // Damage Logic
        if (this.type.type === 'splash') {
            // Blaster hits everyone near target
            enemies.forEach(e => {
                if (Math.hypot(e.x - target.x, e.y - target.y) < 0.1) {
                    hitEnemy(e, this.type.damage);
                }
            });
            createExplosion(target.x, target.y, '#FF9800');
        } else {
            // Standard Hit
            hitEnemy(target, this.type.damage);
        }
    }
    draw() {
        let px = this.x * canvas.width, py = this.y * canvas.height;
        // Base
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI*2); ctx.fill();
        // Turret Color
        ctx.fillStyle = this.type.color; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI*2); ctx.fill();
    }
}

function hitEnemy(e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0 && e.active) {
        e.active = false;
        gameState.gold += e.reward;
        gameState.enemiesLeftInWave--;
        createExplosion(e.x, e.y, e.color);
        
        // Check Wave End
        if (gameState.enemiesLeftInWave <= 0 && enemies.filter(en => en.active).length === 0) {
            gameState.waveActive = false;
            setTimeout(() => {
                gameState.wave++;
                startWave();
            }, 3000); // 3 sec break between waves
        }
    }
}

function createExplosion(x, y, color) {
    for(let i=0; i<5; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random()-0.5)*0.01, vy: (Math.random()-0.5)*0.01,
            life: 20, color: color
        });
    }
}

// --- 6. INPUT HANDLING ---
// UI Selection
window.selectTower = function(type) {
    gameState.selectedTower = type;
    // Update visual buttons
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.btn-' + type.toLowerCase()).classList.add('selected');
};

// Map Clicking
canvas.addEventListener('click', (e) => {
    if (gameState.gameOver) return;
    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX - rect.left) / canvas.width;
    let cy = (e.clientY - rect.top) / canvas.height;
    
    // Check cost
    let towerData = TOWERS[gameState.selectedTower];
    if (gameState.gold >= towerData.cost) {
        towers.push(new Turret(cx, cy, gameState.selectedTower));
        gameState.gold -= towerData.cost;
    } else {
        document.getElementById('displayGold').style.color = 'red';
        setTimeout(()=> document.getElementById('displayGold').style.color = '#ffd700', 300);
    }
});

// --- 7. MAIN LOOP & RESIZE ---
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

function draw() {
    if (gameState.gameOver) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Draw Map
    ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.strokeStyle = '#222';
    ctx.beginPath(); ctx.moveTo(path[0].x*canvas.width, path[0].y*canvas.height);
    for(let p of path) ctx.lineTo(p.x*canvas.width, p.y*canvas.height);
    ctx.stroke();
    // Path Border
    ctx.lineWidth = 2; ctx.strokeStyle = '#444'; ctx.stroke();

    // Draw Towers
    towers.forEach(t => { t.update(); t.draw(); });

    // Draw Enemies
    for (let i = enemies.length-1; i>=0; i--) {
        let e = enemies[i];
        // Move Logic
        let target = path[e.pathIndex + 1];
        if (!target) {
            e.active = false; gameState.lives--;
            if (gameState.lives <= 0) endGame();
        } else {
            let dx = target.x - e.x, dy = target.y - e.y;
            let dist = Math.hypot(dx, dy);
            if (dist < 0.01) e.pathIndex++;
            else { e.x += (dx/dist)*e.speed; e.y += (dy/dist)*e.speed; }
        }
        
        // Draw Enemy
        if(e.active) {
            let px = e.x*canvas.width, py = e.y*canvas.height;
            ctx.fillStyle = e.color; ctx.fillRect(px-10, py-10, 20, 20);
            // HP Bar
            ctx.fillStyle = 'red'; ctx.fillRect(px-10, py-15, 20, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(px-10, py-15, 20*(e.hp/e.maxHp), 3);
        } else enemies.splice(i, 1);
    }

    // Draw Particles
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        ctx.fillStyle = p.color; ctx.fillRect(p.x*canvas.width, p.y*canvas.height, 4, 4);
        if(p.life <= 0) particles.splice(i,1);
    }

    // Draw Lasers
    for(let i=projectiles.length-1; i>=0; i--) {
        let p = projectiles[i];
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.sx*canvas.width, p.sy*canvas.height);
        ctx.lineTo(p.ex*canvas.width, p.ey*canvas.height);
        ctx.stroke();
        p.life--; if(p.life<=0) projectiles.splice(i,1);
    }

    // UI Updates
    document.getElementById('displayGold').innerText = Math.floor(gameState.gold);
    document.getElementById('displayLives').innerText = gameState.lives;
    document.getElementById('displayWave').innerText = gameState.wave;

    requestAnimationFrame(draw);
}

// Start Game
startWave();
draw();

// --- 8. GAME OVER & ADS (DEV MODE) ---
function endGame() {
    gameState.gameOver = true;
    document.getElementById('finalWave').innerText = gameState.wave;
    document.getElementById('gameOverModal').classList.remove('hidden');
}

window.watchAdToRevive = function() {
    // Attempt Real Ad
    if (AdController) {
        AdController.show().then(() => {
            reviveSuccess();
        }).catch((e) => {
            // DEV MODE BYPASS FOR MODERATION
            if (confirm("🚧 DEV MODE: Ad failed (Moderation?).\nSimulate success?")) {
                reviveSuccess();
            }
        });
    } else {
        alert("Ad SDK missing.");
    }
};

function reviveSuccess() {
    gameState.lives = 10;
    gameState.gold += 250; // Bigger reward
    gameState.gameOver = false;
    document.getElementById('gameOverModal').classList.add('hidden');
    draw();
}
