const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- CONFIGURATION ---
// ADSGRAM INIT
let AdController;
try { AdController = window.Adsgram.init({ blockId: "21141" }); } catch (e) {}

// HARDCORE BALANCING
// Gunner dmg 25->12. Sniper cooldown 90->120.
const TOWERS = {
    GUNNER:  { cost: 50,  range: 0.22, damage: 12, rate: 25, color: '#4CAF50', type: 'single' },
    SNIPER:  { cost: 120, range: 0.55, damage: 90, rate: 120, color: '#2196F3', type: 'single' },
    BLASTER: { cost: 200, range: 0.20, damage: 35, rate: 55, color: '#FF9800', type: 'splash' }
};

const ENEMIES = {
    SOLDIER: { speed: 0.0018, hp: 50,  color: '#ff3333', reward: 8 },
    SCOUT:   { speed: 0.0035, hp: 25,  color: '#FFFF00', reward: 12 }, 
    TANK:    { speed: 0.0007, hp: 400, color: '#8B0000', reward: 40 }
};

// --- GAME STATE ---
let gameState = {
    gold: 90, // REDUCED STARTING GOLD (Was 150)
    lives: 10,
    wave: 1,
    gameOver: false,
    selectedTowerType: 'GUNNER', 
    enemiesLeftInWave: 0,
    waveActive: false,
    selectedTowerRef: null // Which tower is being upgraded?
};

const enemies = [];
const towers = [];
const projectiles = [];
const particles = []; 

const path = [
    {x: 0, y: 0.5}, {x: 0.2, y: 0.5}, {x: 0.2, y: 0.2},
    {x: 0.5, y: 0.2}, {x: 0.5, y: 0.8}, {x: 0.8, y: 0.8},
    {x: 0.8, y: 0.5}, {x: 1, y: 0.5}
];

// --- CLASSES ---
class Turret {
    constructor(x, y, typeKey) {
        this.x = x; this.y = y;
        this.typeKey = typeKey; // Keep track of original type
        this.stats = {...TOWERS[typeKey]}; // Clone stats so we can upgrade them
        this.cooldown = 0;
        this.level = 1;
    }

    upgrade() {
        this.level++;
        this.stats.damage *= 1.5; // +50% Damage
        this.stats.rate *= 0.8;   // +20% Speed
        this.stats.range *= 1.1;  // +10% Range
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;
        if (this.cooldown <= 0) {
            for (let e of enemies) {
                let dist = Math.hypot(e.x - this.x, e.y - this.y);
                if (dist < this.stats.range) {
                    this.shoot(e);
                    break; 
                }
            }
        }
    }

    shoot(target) {
        this.cooldown = this.stats.rate;
        // Projectile Color depends on Level (White = Upgraded)
        let pColor = this.level > 1 ? '#FFFFFF' : this.stats.color;
        
        projectiles.push({sx: this.x, sy: this.y, ex: target.x, ey: target.y, life: 10, color: pColor});
        
        if (this.stats.type === 'splash') {
            enemies.forEach(e => {
                if (Math.hypot(e.x - target.x, e.y - target.y) < 0.1) hitEnemy(e, this.stats.damage);
            });
            createExplosion(target.x, target.y, '#FF9800');
        } else {
            hitEnemy(target, this.stats.damage);
        }
    }

    draw() {
        let px = this.x * canvas.width, py = this.y * canvas.height;
        // Base Ring (Gold if upgraded)
        ctx.strokeStyle = this.level > 1 ? '#FFD700' : '#444';
        ctx.lineWidth = this.level > 1 ? 4 : 0;
        ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        
        // Turret Top
        ctx.fillStyle = this.stats.color; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI*2); ctx.fill();
        
        // Level Indicator
        if(this.level > 1) {
            ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.fillText("⭐", px-5, py-10);
        }
    }
}

function hitEnemy(e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0 && e.active) {
        e.active = false;
        gameState.gold += e.reward;
        gameState.enemiesLeftInWave--;
        createExplosion(e.x, e.y, e.color);
        
        if (gameState.enemiesLeftInWave <= 0 && enemies.filter(en => en.active).length === 0) {
            gameState.waveActive = false;
            setTimeout(() => { gameState.wave++; startWave(); }, 3000);
        }
    }
}

function createExplosion(x, y, color) {
    for(let i=0; i<6; i++) {
        particles.push({x:x, y:y, vx:(Math.random()-0.5)*0.015, vy:(Math.random()-0.5)*0.015, life:25, color:color});
    }
}

// --- WAVE SYSTEM ---
function startWave() {
    if (gameState.waveActive) return;
    gameState.waveActive = true;
    
    // HARDCORE SCALING: +20 HP per wave (Was +5)
    let hpMultiplier = gameState.wave * 20; 
    let waveConfig = [];

    // Wave Design
    if (gameState.wave === 1) waveConfig = Array(6).fill('SOLDIER');
    else if (gameState.wave === 2) waveConfig = Array(12).fill('SOLDIER');
    else if (gameState.wave === 3) waveConfig = Array(20).fill('SCOUT'); // RUSH!
    else if (gameState.wave % 5 === 0) waveConfig = Array(3).fill('TANK'); // BOSS
    else {
        // Random Mix
        for(let i=0; i<gameState.wave * 4; i++) {
            let r = Math.random();
            waveConfig.push(r > 0.8 ? 'TANK' : (r > 0.5 ? 'SCOUT' : 'SOLDIER'));
        }
    }

    gameState.enemiesLeftInWave = waveConfig.length;
    let spawnIndex = 0;

    const spawner = setInterval(() => {
        if (gameState.gameOver || spawnIndex >= waveConfig.length) { clearInterval(spawner); return; }
        let type = ENEMIES[waveConfig[spawnIndex]];
        enemies.push({
            pathIndex: 0, x: path[0].x, y: path[0].y,
            hp: type.hp + hpMultiplier, maxHp: type.hp + hpMultiplier,
            speed: type.speed, color: type.color, reward: type.reward, active: true
        });
        spawnIndex++;
    }, 900); // Faster spawning (0.9s)
}

// --- INPUT & UPGRADE UI ---
window.selectTower = function(type) {
    gameState.selectedTowerType = type;
    closeUpgradeMenu();
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.btn-' + type.toLowerCase()).classList.add('selected');
};

function closeUpgradeMenu() {
    document.getElementById('upgrade-menu').style.display = 'none';
    gameState.selectedTowerRef = null;
}

// CLICK HANDLER (Build OR Select)
canvas.addEventListener('click', (e) => {
    if (gameState.gameOver) return;
    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX - rect.left) / canvas.width;
    let cy = (e.clientY - rect.top) / canvas.height;

    // 1. CHECK IF CLICKED EXISTING TOWER
    for(let t of towers) {
        let dist = Math.hypot(t.x - cx, t.y - cy);
        if(dist < 0.05) { // Clicked a tower!
            openUpgradeMenu(t, e.clientX, e.clientY);
            return;
        }
    }

    // 2. BUILD NEW TOWER
    closeUpgradeMenu();
    let typeData = TOWERS[gameState.selectedTowerType];
    // Check if near path (Prevent blocking - visual only for now)
    if (gameState.gold >= typeData.cost) {
        towers.push(new Turret(cx, cy, gameState.selectedTowerType));
        gameState.gold -= typeData.cost;
    } else {
        document.getElementById('displayGold').style.color = 'red';
        setTimeout(()=> document.getElementById('displayGold').style.color = '#ffd700', 300);
    }
});

function openUpgradeMenu(tower, screenX, screenY) {
    gameState.selectedTowerRef = tower;
    let menu = document.getElementById('upgrade-menu');
    let upgradeCost = Math.floor(TOWERS[tower.typeKey].cost * 1.5);
    let sellPrice = Math.floor(TOWERS[tower.typeKey].cost * 0.5);

    document.getElementById('u-stats').innerText = `LVL ${tower.level} -> ${tower.level+1}`;
    document.getElementById('btn-upgrade').innerText = `UPGRADE ($${upgradeCost})`;
    document.getElementById('btn-sell').innerText = `SELL ($${sellPrice})`;

    // Position menu near click
    menu.style.left = Math.min(screenX, window.innerWidth - 150) + "px";
    menu.style.top = Math.min(screenY, window.innerHeight - 150) + "px";
    menu.style.display = 'block';

    // Button Logic
    document.getElementById('btn-upgrade').onclick = () => {
        if(gameState.gold >= upgradeCost) {
            gameState.gold -= upgradeCost;
            tower.upgrade();
            closeUpgradeMenu();
        } else alert("Not enough Gold!");
    };

    document.getElementById('btn-sell').onclick = () => {
        gameState.gold += sellPrice;
        towers.splice(towers.indexOf(tower), 1); // Remove tower
        closeUpgradeMenu();
    };
}

// --- LOOP & RENDER ---
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

function draw() {
    if (gameState.gameOver) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Map
    ctx.lineWidth = 40; ctx.strokeStyle = '#222'; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(path[0].x*canvas.width, path[0].y*canvas.height);
    for(let p of path) ctx.lineTo(p.x*canvas.width, p.y*canvas.height);
    ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#444'; ctx.stroke();

    // Objects
    towers.forEach(t => { t.update(); t.draw(); });
    
    for (let i = enemies.length-1; i>=0; i--) {
        let e = enemies[i];
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
        if(e.active) {
            let px = e.x*canvas.width, py = e.y*canvas.height;
            ctx.fillStyle = e.color; ctx.fillRect(px-10, py-10, 20, 20);
            ctx.fillStyle = 'red'; ctx.fillRect(px-10, py-15, 20, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(px-10, py-15, 20*(e.hp/e.maxHp), 3);
        } else enemies.splice(i, 1);
    }

    // Particles & Projectiles
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i]; p.x+=p.vx; p.y+=p.vy; p.life--;
        ctx.fillStyle = p.color; ctx.fillRect(p.x*canvas.width, p.y*canvas.height, 3, 3);
        if(p.life<=0) particles.splice(i,1);
    }
    for(let i=projectiles.length-1; i>=0; i--) {
        let p = projectiles[i];
        ctx.strokeStyle = p.color; ctx.lineWidth = 2; 
        ctx.beginPath(); ctx.moveTo(p.sx*canvas.width, p.sy*canvas.height);
        ctx.lineTo(p.ex*canvas.width, p.ey*canvas.height);
        ctx.stroke();
        p.life--; if(p.life<=0) projectiles.splice(i,1);
    }

    // UI
    document.getElementById('displayGold').innerText = Math.floor(gameState.gold);
    document.getElementById('displayLives').innerText = gameState.lives;
    document.getElementById('displayWave').innerText = gameState.wave;

    requestAnimationFrame(draw);
}
startWave();
draw();

// --- GAME OVER ---
function endGame() {
    gameState.gameOver = true;
    document.getElementById('finalWave').innerText = gameState.wave;
    document.getElementById('gameOverModal').classList.remove('hidden');
}
window.watchAdToRevive = function() {
    if (AdController) {
        AdController.show().then(() => reviveSuccess()).catch((e) => {
            if (confirm("🚧 DEV MODE: Ad failed. Simulate success?")) reviveSuccess();
        });
    } else alert("Ad SDK missing.");
};
function reviveSuccess() {
    gameState.lives = 5; gameState.gold += 200; 
    gameState.gameOver = false; document.getElementById('gameOverModal').classList.add('hidden'); draw();
}
