const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. CONFIGURATION ---
let AdController;
try { AdController = window.Adsgram.init({ blockId: "21141" }); } catch (e) {}

const BASE_COSTS = { GUNNER: 50, SNIPER: 120, BLASTER: 200 };
const TOWERS = {
    GUNNER:  { range: 0.22, damage: 15, rate: 25, color: '#4CAF50', type: 'single', maxAmmo: 25 },
    SNIPER:  { range: 0.60, damage: 100, rate: 120, color: '#2196F3', type: 'single', maxAmmo: 10 },
    BLASTER: { range: 0.20, damage: 40, rate: 60, color: '#FF9800', type: 'splash', maxAmmo: 15 }
};

const ENEMIES = {
    SOLDIER:  { speed: 0.0018, hp: 50,  reward: 8,  type: 'normal' },
    SCOUT:    { speed: 0.0035, hp: 30,  reward: 12, type: 'dodge' }, 
    TANK:     { speed: 0.0007, hp: 450, reward: 40, type: 'armor' }, 
    HEALER:   { speed: 0.0015, hp: 100, reward: 20, type: 'heal' },  
    SPLITTER: { speed: 0.0012, hp: 150, reward: 25, type: 'split' }  
};

// --- 2. GAME STATE ---
let gameState = {
    gold: 100,
    lives: 10,
    wave: 1,
    gameOver: false,
    selectedTowerType: 'GUNNER',
    enemiesLeftInWave: 0,
    waveActive: false,
    constructionCount: 0,
    time: 0 // Global timer for animations
};

const enemies = [];
const towers = [];
const projectiles = [];
const particles = [];
const acidPuddles = [];
let currentSpawner = null;

const path = [
    {x: 0, y: 0.5}, {x: 0.2, y: 0.5}, {x: 0.2, y: 0.2},
    {x: 0.5, y: 0.2}, {x: 0.5, y: 0.8}, {x: 0.8, y: 0.8},
    {x: 0.8, y: 0.5}, {x: 1, y: 0.5}
];

// --- 3. CLASSES ---
class Turret {
    constructor(x, y, typeKey) {
        this.x = x; this.y = y;
        this.typeKey = typeKey;
        this.stats = {...TOWERS[typeKey]};
        this.cooldown = 0;
        this.level = 1;
        this.ammo = this.stats.maxAmmo;
        this.stunned = 0;
        this.angle = 0; // Rotation
        this.recoil = 0; // Animation kickback
    }
    reload() { this.ammo = this.stats.maxAmmo; }
    upgrade() {
        if(this.level >= 4) return;
        this.level++;
        this.stats.damage *= 1.4;
        this.stats.rate *= 0.85;
        this.stats.maxAmmo += 5;
        this.ammo = this.stats.maxAmmo;
    }
    update() {
        if (this.stunned > 0) { this.stunned--; return; }
        if (this.recoil > 0) this.recoil -= 0.5; // Recover from recoil
        
        if (this.ammo <= 0) return;
        if (this.cooldown > 0) this.cooldown--;

        // Find Target & Rotate
        let target = null;
        let minDist = Infinity;
        for (let e of enemies) {
            let dist = Math.hypot(e.x - this.x, e.y - this.y);
            if (dist < this.stats.range && dist < minDist) {
                target = e;
                minDist = dist;
            }
        }

        if (target) {
            // Calculate Angle
            let dy = target.y - this.y;
            let dx = target.x - this.x;
            this.angle = Math.atan2(dy, dx);

            if (this.cooldown <= 0) this.shoot(target);
        }
    }
    shoot(target) {
        this.ammo--;
        this.cooldown = this.stats.rate;
        this.recoil = 5; // Kickback animation
        
        let pColor = this.level > 1 ? '#FFFFFF' : this.stats.color;
        // Projectile spawns from tip of gun
        let spawnX = this.x + Math.cos(this.angle) * 0.04;
        let spawnY = this.y + Math.sin(this.angle) * 0.04;

        projectiles.push({sx: spawnX, sy: spawnY, ex: target.x, ey: target.y, life: 10, color: pColor});
        
        if (this.stats.type === 'splash') {
            createExplosion(target.x, target.y, '#FF9800');
            enemies.forEach(e => {
                if (Math.hypot(e.x - target.x, e.y - target.y) < 0.1) hitEnemy(e, this.stats.damage, 'BLASTER');
            });
            towers.forEach(t => {
                if (t !== this && Math.hypot(t.x - target.x, t.y - target.y) < 0.08) t.stunned = 60;
            });
        } else {
            hitEnemy(target, this.stats.damage, this.typeKey);
        }
    }
    draw() {
        let px = this.x * canvas.width;
        let py = this.y * canvas.height;

        ctx.save();
        ctx.translate(px, py);
        
        // Base
        ctx.fillStyle = this.stunned > 0 ? '#555' : '#333';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = this.level > 1 ? '#FFD700' : '#555';
        ctx.lineWidth = 2; ctx.stroke();

        // Rotate Turret
        ctx.rotate(this.angle);
        
        // Draw Gun based on Type
        let recoilOffset = -this.recoil;
        ctx.fillStyle = this.stats.color;
        
        if(this.typeKey === 'GUNNER') {
            // Twin barrels
            ctx.fillRect(0 + recoilOffset, -4, 20, 3);
            ctx.fillRect(0 + recoilOffset, 1, 20, 3);
            ctx.fillRect(-5, -6, 12, 12); // Turret body
        } else if (this.typeKey === 'SNIPER') {
            // Long barrel
            ctx.fillRect(0 + recoilOffset, -2, 35, 4); 
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill(); // Scope base
        } else if (this.typeKey === 'BLASTER') {
            // Fat cannon
            ctx.beginPath();
            ctx.moveTo(0 + recoilOffset, -6);
            ctx.lineTo(25 + recoilOffset, -10);
            ctx.lineTo(25 + recoilOffset, 10);
            ctx.lineTo(0 + recoilOffset, 6);
            ctx.fill();
        }

        ctx.restore();

        // Ammo Bar & Stars
        if(this.level > 1) { ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.fillText("⭐", px-5, py-10); }
        ctx.fillStyle = 'black'; ctx.fillRect(px-12, py+18, 24, 4);
        ctx.fillStyle = this.ammo <= 0 ? 'red' : 'cyan';
        ctx.fillRect(px-12, py+18, 24 * (this.ammo/this.stats.maxAmmo), 4);
        if(this.ammo <= 0) { ctx.fillStyle = 'red'; ctx.font = 'bold 12px Arial'; ctx.fillText("RELOAD", px-20, py-25); }
    }
}

// --- 4. SPRITE DRAWING FUNCTIONS ---
function drawEnemySprite(ctx, e, px, py) {
    ctx.save();
    ctx.translate(px, py);
    
    // Animation bob
    let bob = Math.sin(gameState.time * 0.2 + e.pathIndex) * 2;
    
    // Orient sprite to direction
    let next = path[e.pathIndex+1] || path[path.length-1];
    let prev = path[e.pathIndex] || path[0];
    let angle = Math.atan2(next.y - prev.y, next.x - prev.x);
    ctx.rotate(angle);

    if (e.type === 'normal') { // SOLDIER
        ctx.fillStyle = '#ff3333';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill(); // Helmet
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(-4, -8, 8, 16); // Body vest
        ctx.fillStyle = '#222';
        ctx.fillRect(2, 2 + bob/2, 10, 2); // Gun
    } 
    else if (e.type === 'dodge') { // SCOUT (Hover Drone)
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill(); // Eye
    }
    else if (e.type === 'armor') { // TANK
        ctx.fillStyle = '#444'; // Treads
        ctx.fillRect(-12, -14, 24, 6);
        ctx.fillRect(-12, 8, 24, 6);
        ctx.fillStyle = '#8B0000'; // Body
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#550000'; // Turret
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(0, -2, 18, 4); // Barrel
    }
    else if (e.type === 'heal') { // HEALER (Truck)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = '#FFF'; // Cross
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
    }
    else if (e.type === 'split') { // SPLITTER (Bio Blob)
        ctx.fillStyle = '#FF00FF';
        let pulse = Math.sin(gameState.time * 0.5) * 2;
        ctx.beginPath(); ctx.arc(0, 0, 10 + pulse, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a004a';
        ctx.beginPath(); ctx.arc(3, -3, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-2, 2, 2, 0, Math.PI*2); ctx.fill();
    }
    
    ctx.restore();

    // Health Bar (Floating above)
    ctx.fillStyle = 'red'; ctx.fillRect(px-10, py-20, 20, 3);
    ctx.fillStyle = '#0f0'; ctx.fillRect(px-10, py-20, 20*(e.hp/e.maxHp), 3);
}

// --- 5. LOGIC & WAVES ---
function hitEnemy(e, dmg, sourceTower) {
    if (e.type === 'armor' && sourceTower === 'GUNNER') { showText(e.x, e.y, "NO DMG", "#888"); return; }
    if (e.type === 'dodge' && sourceTower === 'SNIPER') { if (Math.random() > 0.5) { showText(e.x, e.y, "MISS", "#ff0"); return; } }
    e.hp -= dmg;
    if (e.hp <= 0 && e.active) killEnemy(e);
}

function killEnemy(e) {
    e.active = false;
    gameState.gold += e.reward;
    updatePrices();
    createExplosion(e.x, e.y, ENEMIES[Object.keys(ENEMIES).find(key => ENEMIES[key].type === e.type)].color);
    
    if (e.type === 'split') {
        for(let i=0; i<3; i++) {
            let scout = {...ENEMIES.SCOUT}; 
            enemies.push({
                pathIndex: e.pathIndex, x: e.x + (Math.random()*0.02), y: e.y + (Math.random()*0.02),
                hp: scout.hp, maxHp: scout.hp, speed: scout.speed, reward: 5, active: true, type: 'dodge'
            });
            gameState.enemiesLeftInWave++;
        }
    }
    if (e.type === 'armor') acidPuddles.push({x: e.x, y: e.y, life: 300});
    removeEnemyFromWave();
}

function removeEnemyFromWave() {
    gameState.enemiesLeftInWave--;
    if (gameState.enemiesLeftInWave <= 0 && enemies.filter(en => en.active).length === 0) {
        gameState.waveActive = false;
        setTimeout(() => { gameState.wave++; startWave(); }, 2000);
    }
}

function startWave() {
    if (currentSpawner) clearInterval(currentSpawner);
    if (gameState.waveActive) return;
    
    gameState.waveActive = true;
    let hpMult = gameState.wave * 15; 
    let waveConfig = [];

    // --- WAVE SETUP ---
    if (gameState.wave === 1) waveConfig = Array(5).fill('SOLDIER');
    else if (gameState.wave === 2) waveConfig = ['SOLDIER', 'HEALER', 'SOLDIER'];
    else if (gameState.wave === 3) waveConfig = Array(15).fill('SCOUT');
    else if (gameState.wave === 4) waveConfig = ['TANK', 'HEALER', 'SOLDIER'];
    else {
        for(let i=0; i<gameState.wave * 3; i++) {
            let r = Math.random();
            if(r > 0.9) waveConfig.push('SPLITTER');
            else if(r > 0.75) waveConfig.push('TANK');
            else if(r > 0.6) waveConfig.push('HEALER');
            else waveConfig.push(r > 0.3 ? 'SCOUT' : 'SOLDIER');
        }
    }

    gameState.enemiesLeftInWave = waveConfig.length;
    let spawnIndex = 0;
    
    currentSpawner = setInterval(() => {
        if (gameState.gameOver || spawnIndex >= waveConfig.length) { clearInterval(currentSpawner); return; }
        
        let typeKey = waveConfig[spawnIndex];
        let type = ENEMIES[typeKey];
        
        if (type) {
            enemies.push({
                pathIndex: 0, x: path[0].x, y: path[0].y,
                hp: type.hp + hpMult, maxHp: type.hp + hpMult,
                speed: type.speed, reward: type.reward, active: true, type: type.type
            });
        }
        spawnIndex++;
    }, 1000);
}

// --- 6. UI & INPUT ---
window.selectTower = function(type) {
    gameState.selectedTowerType = type;
    document.getElementById('upgrade-menu').style.display = 'none';
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.btn-' + type.toLowerCase()).classList.add('selected');
};

function updatePrices() {
    let tax = gameState.constructionCount * 10;
    document.getElementById('cost-gunner').innerText = "$" + (BASE_COSTS.GUNNER + tax);
    document.getElementById('cost-sniper').innerText = "$" + (BASE_COSTS.SNIPER + tax);
    document.getElementById('cost-blaster').innerText = "$" + (BASE_COSTS.BLASTER + tax);
    document.getElementById('displayGold').innerText = Math.floor(gameState.gold);
}

canvas.addEventListener('click', (e) => {
    if (gameState.gameOver) return;
    let rect = canvas.getBoundingClientRect();
    let cx = (e.clientX - rect.left) / canvas.width;
    let cy = (e.clientY - rect.top) / canvas.height;

    for(let t of towers) {
        if (Math.hypot(t.x - cx, t.y - cy) < 0.05) {
            if (t.ammo <= 0) t.reload();
            else openUpgradeMenu(t, e.clientX, e.clientY);
            return;
        }
    }

    document.getElementById('upgrade-menu').style.display = 'none';
    let tax = gameState.constructionCount * 10;
    let baseCost = BASE_COSTS[gameState.selectedTowerType];
    let finalCost = baseCost + tax;
    for(let p of acidPuddles) { if(Math.hypot(p.x - cx, p.y - cy) < 0.1) { finalCost *= 2; showText(cx, cy, "ACID! 2x COST", "#0f0"); break; } }

    if (gameState.gold >= finalCost) {
        towers.push(new Turret(cx, cy, gameState.selectedTowerType));
        gameState.gold -= finalCost;
        gameState.constructionCount++;
        updatePrices();
    } else {
        document.getElementById('displayGold').style.color = 'red';
        setTimeout(()=> document.getElementById('displayGold').style.color = '#ffd700', 300);
    }
});

// --- 7. RENDER LOOP ---
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

function draw() {
    if (gameState.gameOver) return;
    gameState.time++;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Map
    ctx.lineCap = 'round'; 
    ctx.lineWidth = 44; ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(path[0].x*canvas.width, path[0].y*canvas.height);
    for(let p of path) ctx.lineTo(p.x*canvas.width, p.y*canvas.height);
    ctx.stroke();
    
    ctx.lineWidth = 36; ctx.strokeStyle = '#2196F3';
    ctx.stroke();

    // Acid
    for(let i=acidPuddles.length-1; i>=0; i--) {
        let p = acidPuddles[i];
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)'; ctx.beginPath(); ctx.arc(p.x*canvas.width, p.y*canvas.height, 25, 0, Math.PI*2); ctx.fill();
        p.life--; if(p.life<=0) acidPuddles.splice(i,1);
    }

    // Towers & Enemies
    towers.forEach(t => { t.update(); t.draw(); });

    for (let i = enemies.length-1; i>=0; i--) {
        let e = enemies[i];
        // Healer Aura
        if(e.type === 'heal' && e.active) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(e.x*canvas.width, e.y*canvas.height, 40, 0, Math.PI*2); ctx.stroke();
            enemies.forEach(friend => { if(friend !== e && friend.active && Math.hypot(friend.x-e.x, friend.y-e.y)<0.15) friend.hp = Math.min(friend.hp+0.5, friend.maxHp); });
        }
        
        let speed = e.speed;
        for(let p of acidPuddles) { if(Math.hypot(p.x-e.x, p.y-e.y)<0.1) speed *= 1.5; }

        let target = path[e.pathIndex + 1];
        if (!target) {
            e.active = false; gameState.lives--;
            removeEnemyFromWave(); 
            if (gameState.lives <= 0) endGame();
        } else {
            let dx = target.x - e.x, dy = target.y - e.y;
            let dist = Math.hypot(dx, dy);
            if (dist < 0.01) e.pathIndex++; else { e.x += (dx/dist)*speed; e.y += (dy/dist)*speed; }
        }
        
        if(e.active) {
            drawEnemySprite(ctx, e, e.x*canvas.width, e.y*canvas.height);
        } else enemies.splice(i, 1);
    }

    // Projectiles
    for(let i=projectiles.length-1; i>=0; i--) {
        let p = projectiles[i];
        ctx.strokeStyle = p.color; ctx.lineWidth = 3; 
        ctx.beginPath(); ctx.moveTo(p.sx*canvas.width, p.sy*canvas.height);
        ctx.lineTo(p.ex*canvas.width, p.ey*canvas.height);
        ctx.stroke();
        p.life--; if(p.life<=0) projectiles.splice(i,1);
    }
    // Particles
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        if(p.text) { ctx.fillStyle = p.color; ctx.font = "bold 14px Arial"; ctx.fillText(p.text, p.x*canvas.width, p.y*canvas.height); p.y -= 0.001; }
        else { p.x+=p.vx; p.y+=p.vy; ctx.fillStyle = p.color; ctx.fillRect(p.x*canvas.width, p.y*canvas.height, 4, 4); }
        p.life--; if(p.life<=0) particles.splice(i,1);
    }

    document.getElementById('displayLives').innerText = gameState.lives;
    document.getElementById('displayWave').innerText = "WAVE " + gameState.wave;
    document.getElementById('finalWave').innerText = "WAVE " + gameState.wave;
    requestAnimationFrame(draw);
}

startWave();
draw();
updatePrices();

// --- HELPERS ---
function createExplosion(x, y, color) { for(let i=0; i<8; i++) particles.push({x:x, y:y, vx:(Math.random()-0.5)*0.02, vy:(Math.random()-0.5)*0.02, life:20, color:color}); }
function showText(x, y, text, color) { particles.push({x:x, y:y, text:text, color:color, life:30}); }
function openUpgradeMenu(tower, sx, sy) {
    gameState.selectedTowerRef = tower;
    let menu = document.getElementById('upgrade-menu');
    menu.style.display = 'block'; menu.style.left = Math.min(sx, window.innerWidth-150)+"px"; menu.style.top = Math.min(sy, window.innerHeight-150)+"px";
    let cost = Math.floor(BASE_COSTS[tower.typeKey] * Math.pow(1.5, tower.level));
    document.getElementById('u-stats').innerText = `LVL ${tower.level} -> ${tower.level+1}`;
    document.getElementById('btn-upgrade').innerText = tower.level>=4 ? "MAX LEVEL" : `UPGRADE ($${cost})`;
    document.getElementById('btn-sell').innerText = `SELL ($${Math.floor(cost*0.4)})`;
    document.getElementById('btn-upgrade').onclick = () => {
        if(tower.level<4 && gameState.gold>=cost) { gameState.gold-=cost; tower.upgrade(); updatePrices(); menu.style.display = 'none'; }
    };
    document.getElementById('btn-sell').onclick = () => {
        gameState.gold+=Math.floor(cost*0.4); towers.splice(towers.indexOf(tower),1); gameState.constructionCount--; updatePrices(); menu.style.display = 'none';
    };
}
function endGame() {
    gameState.gameOver = true; 
    if (currentSpawner) clearInterval(currentSpawner);
    document.getElementById('gameOverModal').classList.remove('hidden');
}
window.watchAdToRevive = function() {
    if (AdController) AdController.show().then(() => reviveSuccess()).catch(() => { if(confirm("Simulate Success?")) reviveSuccess(); });
    else alert("SDK Missing");
};
function reviveSuccess() {
    gameState.lives=10; gameState.gold+=300; gameState.gameOver=false;
    if (currentSpawner) clearInterval(currentSpawner);
    enemies.length = 0; projectiles.length = 0;
    gameState.waveActive = false; gameState.enemiesLeftInWave = 0;
    document.getElementById('gameOverModal').classList.add('hidden');
    startWave(); draw(); 
}
