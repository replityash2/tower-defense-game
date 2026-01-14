const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. CONFIGURATION ---
let AdController;
try {
    AdController = window.Adsgram.init({ blockId: "21141" });
} catch (e) {
    console.error("AdBlock active or Network Error:", e);
}

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
    selectedTowerRef: null,
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

// ============================================================================
// ASSET DRAWING FUNCTIONS (Integrated from assets.js)
// ============================================================================

// --- TOWERS ---
function drawGunnerTower(ctx, x, y, rotation, scale, level = 1, recoil = 0) {
  ctx.save();
  ctx.translate(x, y);
  const baseSize = 25 * scale;
  ctx.fillStyle = '#0a3a0a'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 10 * scale;
  ctx.beginPath(); ctx.moveTo(-baseSize, baseSize); ctx.lineTo(-baseSize * 0.7, 0); ctx.lineTo(baseSize * 0.7, 0); ctx.lineTo(baseSize, baseSize); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  for (let i = 1; i <= level; i++) { const y = baseSize * (0.3 + i * 0.15); ctx.beginPath(); ctx.moveTo(-baseSize * 0.8, y); ctx.lineTo(baseSize * 0.8, y); ctx.stroke(); }
  ctx.rotate(rotation);
  const recoilOffset = recoil * 8 * scale;
  const bodyWidth = 18 * scale; const bodyHeight = 15 * scale;
  ctx.fillStyle = '#0d4d0d'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 8 * scale;
  ctx.fillRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight); ctx.strokeRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight);
  ctx.shadowBlur = 0;
  for (let i = 0; i < level; i++) { const vx = -bodyWidth/2 + 5 * scale + i * 6 * scale; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1 * scale; ctx.beginPath(); ctx.moveTo(vx, -bodyHeight/2 + 3 * scale); ctx.lineTo(vx, bodyHeight/2 - 3 * scale); ctx.stroke(); }
  const barrelLength = (20 + level * 8) * scale; const barrelWidth = (3 + level * 0.5) * scale; const barrelSpacing = 6 * scale;
  ctx.fillStyle = '#1a5c1a';
  ctx.fillRect(bodyWidth/2 - recoilOffset, -barrelSpacing - barrelWidth, barrelLength, barrelWidth);
  ctx.fillRect(bodyWidth/2 - recoilOffset, barrelSpacing, barrelLength, barrelWidth);
  if (recoil > 0.5) {
    const glowGrad = ctx.createRadialGradient(bodyWidth/2 + barrelLength - recoilOffset, 0, 0, bodyWidth/2 + barrelLength - recoilOffset, 0, 15 * scale);
    glowGrad.addColorStop(0, 'rgba(255, 255, 100, 0.9)'); glowGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
    ctx.fillStyle = glowGrad; ctx.fillRect(bodyWidth/2 + barrelLength - recoilOffset - 5 * scale, -barrelSpacing * 2, 10 * scale, barrelSpacing * 4);
  }
  ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(bodyWidth/2 - recoilOffset, -barrelSpacing - barrelWidth, barrelLength, barrelWidth);
  ctx.strokeRect(bodyWidth/2 - recoilOffset, barrelSpacing, barrelLength, barrelWidth);
  ctx.restore();
}

function drawSniperTower(ctx, x, y, rotation, scale, level = 1, recoil = 0) {
  ctx.save();
  ctx.translate(x, y);
  const baseSize = 22 * scale;
  ctx.fillStyle = '#0a0a3a'; ctx.strokeStyle = '#00ddff'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#00ddff'; ctx.shadowBlur = 12 * scale;
  ctx.beginPath(); ctx.moveTo(0, -baseSize); ctx.lineTo(-baseSize * 0.6, baseSize); ctx.lineTo(baseSize * 0.6, baseSize); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.rotate(rotation);
  const recoilOffset = recoil * 12 * scale;
  const bodyWidth = 12 * scale; const bodyHeight = 20 * scale;
  ctx.fillStyle = '#0d0d4d'; ctx.strokeStyle = '#00ddff'; ctx.lineWidth = 2 * scale; ctx.shadowBlur = 8 * scale;
  ctx.fillRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight); ctx.strokeRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight);
  const scopeSize = (8 + level * 2) * scale;
  ctx.fillStyle = '#1a5c8c'; ctx.beginPath(); ctx.arc(0, -bodyHeight/2 - scopeSize/2, scopeSize/2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const flareGrad = ctx.createRadialGradient(0, -bodyHeight/2 - scopeSize/2, 0, 0, -bodyHeight/2 - scopeSize/2, scopeSize);
  flareGrad.addColorStop(0, 'rgba(0, 221, 255, 0.8)'); flareGrad.addColorStop(1, 'rgba(0, 221, 255, 0)');
  ctx.fillStyle = flareGrad; ctx.beginPath(); ctx.arc(0, -bodyHeight/2 - scopeSize/2, scopeSize, 0, Math.PI * 2); ctx.fill();
  const barrelLength = (35 + level * 12) * scale; const barrelWidth = 3 * scale;
  ctx.shadowBlur = level * 3 * scale; ctx.fillStyle = '#1a4d6d'; ctx.fillRect(bodyWidth/2 - recoilOffset, -barrelWidth/2, barrelLength, barrelWidth);
  ctx.strokeStyle = '#00ddff'; ctx.lineWidth = 1 * scale;
  for (let i = 0; i < 3 + level; i++) { const sx = bodyWidth/2 + (barrelLength / (3+level)) * i - recoilOffset; ctx.beginPath(); ctx.moveTo(sx, -barrelWidth/2 - 2 * scale); ctx.lineTo(sx, barrelWidth/2 + 2 * scale); ctx.stroke(); }
  ctx.restore();
}

function drawBlasterTower(ctx, x, y, rotation, scale, level = 1, recoil = 0) {
  ctx.save();
  ctx.translate(x, y);
  const baseSize = 30 * scale;
  ctx.fillStyle = '#3a0a0a'; ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 2.5 * scale; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 15 * scale;
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const angle = (Math.PI / 3) * i; const px = Math.cos(angle) * baseSize; const py = Math.sin(angle) * baseSize; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.rotate(rotation);
  const recoilOffset = recoil * 15 * scale;
  const bodyWidth = 25 * scale; const bodyHeight = 18 * scale;
  ctx.fillStyle = '#4d0d0d'; ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10 * scale;
  ctx.fillRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight); ctx.strokeRect(-bodyWidth/2, -bodyHeight/2, bodyWidth, bodyHeight);
  const mawSize = (20 + level * 8) * scale; const mawX = bodyWidth/2 - recoilOffset;
  ctx.shadowBlur = 15 * scale; ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 3 * scale;
  ctx.beginPath(); ctx.arc(mawX + mawSize/2, 0, mawSize/2, Math.PI * 0.7, Math.PI * 1.3); ctx.lineTo(mawX, 0); ctx.closePath(); ctx.stroke();
  const energyGrad = ctx.createRadialGradient(mawX + mawSize/3, 0, 0, mawX + mawSize/3, 0, mawSize);
  energyGrad.addColorStop(0, 'rgba(255, 150, 0, 0.9)'); energyGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = energyGrad; ctx.beginPath(); ctx.arc(mawX + mawSize/2, 0, mawSize/2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- ENEMIES ---
function drawSoldierEnemy(ctx, x, y, rotation, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  const wobble = Math.sin(tick * 0.15) * 2 * scale; ctx.translate(0, wobble);
  const size = 12 * scale;
  ctx.fillStyle = '#4d0000'; ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8 * scale;
  ctx.fillRect(-size/2, -size, size, size * 1.5); ctx.strokeRect(-size/2, -size, size, size * 1.5);
  ctx.fillStyle = '#660000'; ctx.fillRect(-size/3, -size * 1.3, size * 0.66, size * 0.4);
  ctx.fillStyle = '#ff0000'; ctx.fillRect(-size/4, -size * 1.15, size/2, size * 0.15);
  const legOffset = Math.sin(tick * 0.15) * size * 0.3; ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3 * scale;
  ctx.beginPath(); ctx.moveTo(-size/4, size * 0.5); ctx.lineTo(-size/4 + legOffset, size * 1.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size/4, size * 0.5); ctx.lineTo(size/4 - legOffset, size * 1.2); ctx.stroke();
  ctx.restore();
}

function drawScoutEnemy(ctx, x, y, rotation, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  const drift = Math.sin(tick * 0.1) * 3 * scale; ctx.translate(0, drift);
  const size = 15 * scale;
  ctx.fillStyle = '#4d4d00'; ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 10 * scale;
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.5, -size * 0.4); ctx.lineTo(-size * 0.5, size * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#666600'; ctx.beginPath(); ctx.moveTo(size * 0.5, 0); ctx.lineTo(0, -size * 0.2); ctx.lineTo(0, size * 0.2); ctx.closePath(); ctx.fill();
  const exhaustGrad = ctx.createLinearGradient(-size * 0.5, 0, -size * 1.2, 0);
  exhaustGrad.addColorStop(0, 'rgba(255, 255, 0, 0.7)'); exhaustGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
  ctx.fillStyle = exhaustGrad; ctx.fillRect(-size * 1.2, -size * 0.15, size * 0.7, size * 0.3);
  ctx.restore();
}

function drawTankEnemy(ctx, x, y, rotation, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  const size = 20 * scale;
  const treadOffset = (tick * 2) % (8 * scale); ctx.fillStyle = '#330000'; ctx.strokeStyle = '#aa0000'; ctx.lineWidth = 2 * scale;
  ctx.fillRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.2); ctx.strokeRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.2);
  ctx.fillRect(-size * 0.6, size * 0.1, size * 1.2, size * 0.2); ctx.strokeRect(-size * 0.6, size * 0.1, size * 1.2, size * 0.2);
  ctx.fillStyle = '#660000'; ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2.5 * scale; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12 * scale;
  ctx.fillRect(-size * 0.5, -size * 0.6, size, size * 0.8); ctx.strokeRect(-size * 0.5, -size * 0.6, size, size * 0.8);
  ctx.fillStyle = '#4d0000'; ctx.fillRect(-size * 0.3, -size * 0.8, size * 0.6, size * 0.4); ctx.strokeRect(-size * 0.3, -size * 0.8, size * 0.6, size * 0.4);
  ctx.fillStyle = '#330000'; ctx.fillRect(size * 0.3, -size * 0.65, size * 0.6, size * 0.15); ctx.strokeRect(size * 0.3, -size * 0.65, size * 0.6, size * 0.15);
  ctx.restore();
}

function drawHealerEnemy(ctx, x, y, rotation, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  const wobble = Math.sin(tick * 0.1) * 1.5 * scale; ctx.translate(0, wobble);
  const size = 14 * scale;
  const pulseSize = size * (1.5 + Math.sin(tick * 0.2) * 0.3);
  const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseSize);
  auraGrad.addColorStop(0, 'rgba(0, 255, 100, 0.3)'); auraGrad.addColorStop(1, 'rgba(0, 255, 100, 0)');
  ctx.fillStyle = auraGrad; ctx.beginPath(); ctx.arc(0, 0, pulseSize, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#004d00'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 10 * scale;
  ctx.beginPath(); ctx.moveTo(-size * 0.5, -size * 0.3); ctx.lineTo(size * 0.5, -size * 0.3); ctx.arcTo(size * 0.7, -size * 0.3, size * 0.7, 0, size * 0.3);
  ctx.lineTo(size * 0.7, size * 0.3); ctx.arcTo(size * 0.7, size * 0.5, size * 0.5, size * 0.5, size * 0.3); ctx.lineTo(-size * 0.5, size * 0.5);
  ctx.arcTo(-size * 0.7, size * 0.5, -size * 0.7, size * 0.3, size * 0.3); ctx.lineTo(-size * 0.7, -size * 0.3);
  ctx.arcTo(-size * 0.7, -size * 0.5, -size * 0.5, -size * 0.5, size * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00ff00'; ctx.shadowBlur = 15 * scale; ctx.fillRect(-size * 0.4, -size * 0.1, size * 0.8, size * 0.2); ctx.fillRect(-size * 0.1, -size * 0.4, size * 0.2, size * 0.8);
  ctx.restore();
}

function drawSplitterEnemy(ctx, x, y, rotation, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y);
  const pulse = 1 + Math.sin(tick * 0.3) * 0.2; ctx.scale(pulse, pulse);
  const size = 12 * scale;
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  coreGrad.addColorStop(0, '#ff00ff'); coreGrad.addColorStop(1, '#4400ff');
  ctx.fillStyle = coreGrad; ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 15 * scale;
  ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2 * scale; ctx.shadowBlur = 10 * scale;
  const plates = 6; for (let i = 0; i < plates; i++) { const angle = (Math.PI * 2 / plates) * i + tick * 0.05; const dist = size * (0.7 + Math.sin(tick * 0.2 + i) * 0.3); ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, -dist); ctx.lineTo(size * 0.3, -dist * 1.2); ctx.lineTo(size * 0.3, -dist * 0.8); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}

// --- PROJECTILES & VFX ---
function drawGunnerShot(ctx, x, y, rotation, scale) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  const length = 8 * scale; const width = 2 * scale;
  const trailGrad = ctx.createLinearGradient(-length, 0, length, 0);
  trailGrad.addColorStop(0, 'rgba(0, 255, 0, 0)'); trailGrad.addColorStop(1, 'rgba(0, 255, 0, 1)');
  ctx.fillStyle = trailGrad; ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 8 * scale;
  ctx.fillRect(-length, -width, length * 2, width * 2); ctx.fillStyle = '#00ff00'; ctx.fillRect(0, -width/2, length, width);
  ctx.restore();
}

function drawSniperBeam(ctx, x1, y1, x2, y2, scale, fade = 0) {
  const alpha = 1 - fade; if (alpha <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(0, 221, 255, ${alpha * 0.3})`; ctx.lineWidth = 8 * scale; ctx.shadowColor = '#00ddff'; ctx.shadowBlur = 20 * scale;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineWidth = 1.5 * scale; ctx.shadowBlur = 5 * scale;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

function drawBlasterShot(ctx, x, y, rotation, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y);
  const size = 10 * scale;
  const coreGrad = ctx.createRadialGradient(Math.cos(tick * 0.1) * size * 0.2, Math.sin(tick * 0.1) * size * 0.2, 0, 0, 0, size);
  coreGrad.addColorStop(0, '#ffff00'); coreGrad.addColorStop(0.7, '#ff4400');
  ctx.fillStyle = coreGrad; ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 15 * scale;
  ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawAcidPuddle(ctx, x, y, radius, scale, tick = 0) {
  ctx.save(); ctx.translate(x, y);
  const puddleGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  puddleGrad.addColorStop(0, 'rgba(0, 255, 100, 0.6)'); puddleGrad.addColorStop(1, 'rgba(0, 150, 50, 0)');
  ctx.fillStyle = puddleGrad; ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 15 * scale;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  // Bubbles
  ctx.fillStyle = 'rgba(200, 255, 200, 0.4)'; ctx.strokeStyle = 'rgba(0, 255, 100, 0.6)'; ctx.lineWidth = 1 * scale;
  for (let i = 0; i < 8; i++) {
    const bubblePhase = (tick * 0.05 + i * 0.3) % (Math.PI * 2);
    const bubbleSize = (3 + Math.sin(bubblePhase) * 2) * scale;
    const angle = (Math.PI * 2 / 8) * i;
    const dist = radius * 0.6 * (0.5 + Math.sin(bubblePhase) * 0.3);
    if (Math.sin(bubblePhase) > -0.5) { ctx.beginPath(); ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, bubbleSize, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}

function drawRoadSegment(ctx, x, y, width, height, scale, rotation = 0, tick = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  const roadGrad = ctx.createLinearGradient(0, -height/2, 0, height/2);
  roadGrad.addColorStop(0, '#1a1a2e'); roadGrad.addColorStop(0.5, '#0f0f1e'); roadGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = roadGrad; ctx.fillRect(-width/2, -height/2, width, height);
  ctx.strokeStyle = '#00ddff'; ctx.lineWidth = 3 * scale; ctx.shadowColor = '#00ddff'; ctx.shadowBlur = 15 * scale;
  ctx.beginPath(); ctx.moveTo(-width/2, -height/2); ctx.lineTo(-width/2, height/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(width/2, -height/2); ctx.lineTo(width/2, height/2); ctx.stroke();
  ctx.strokeStyle = '#666699'; ctx.lineWidth = 2 * scale; ctx.setLineDash([10 * scale, 10 * scale]);
  ctx.beginPath(); ctx.moveTo(0, -height/2); ctx.lineTo(0, height/2); ctx.stroke(); ctx.setLineDash([]);
  const chevronSpacing = 40 * scale; const chevronOffset = (tick * 2) % chevronSpacing;
  ctx.strokeStyle = 'rgba(0, 221, 255, 0.4)'; ctx.lineWidth = 2 * scale;
  for (let cy = -height/2 - chevronOffset; cy < height/2; cy += chevronSpacing) {
    const chevSize = 8 * scale; ctx.beginPath(); ctx.moveTo(-chevSize, cy); ctx.lineTo(0, cy + chevSize); ctx.lineTo(chevSize, cy); ctx.stroke();
  }
  ctx.restore();
}

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
        this.angle = 0; 
        this.recoil = 0; 
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
        if (this.recoil > 0) this.recoil -= 0.1;
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
            let dy = target.y - this.y;
            let dx = target.x - this.x;
            this.angle = Math.atan2(dy, dx);
            if (this.cooldown <= 0) this.shoot(target);
        }
    }
    shoot(target) {
        this.ammo--;
        this.cooldown = this.stats.rate;
        this.recoil = 1; // Animation kickback
        
        let pColor = this.level > 1 ? '#FFFFFF' : this.stats.color;
        
        if (this.typeKey === 'SNIPER') {
             // Instant beam
             projectiles.push({
                 type: 'BEAM', 
                 x1: this.x, y1: this.y, 
                 x2: target.x, y2: target.y, 
                 life: 15
             });
        } else {
             // Moving projectile
             let spawnX = this.x + Math.cos(this.angle) * 0.04;
             let spawnY = this.y + Math.sin(this.angle) * 0.04;
             projectiles.push({
                 type: this.typeKey === 'BLASTER' ? 'PLASMA' : 'BULLET',
                 sx: spawnX, sy: spawnY, 
                 ex: target.x, ey: target.y, 
                 life: 20, 
                 color: pColor,
                 rotation: this.angle
             });
        }
        
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
        let scale = canvas.width / 800; // Responsive scale

        if (this.typeKey === 'GUNNER') drawGunnerTower(ctx, px, py, this.angle, scale, this.level, this.recoil);
        else if (this.typeKey === 'SNIPER') drawSniperTower(ctx, px, py, this.angle, scale, this.level, this.recoil);
        else if (this.typeKey === 'BLASTER') drawBlasterTower(ctx, px, py, this.angle, scale, this.level, this.recoil);

        // Ammo Bar UI (Overlay)
        if(this.level > 1) { ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.fillText("⭐", px-5, py-10); }
        ctx.fillStyle = 'black'; ctx.fillRect(px-12, py+25, 24, 4);
        ctx.fillStyle = this.ammo <= 0 ? 'red' : 'cyan';
        ctx.fillRect(px-12, py+25, 24 * (this.ammo/this.stats.maxAmmo), 4);
        if(this.ammo <= 0) { ctx.fillStyle = 'red'; ctx.font = 'bold 12px Arial'; ctx.fillText("RELOAD", px-20, py-30); }
    }
}

// --- 4. LOGIC ---
function hitEnemy(e, dmg, sourceTower) {
    if (e.type === 'armor' && sourceTower === 'GUNNER') { showText(e.x, e.y, "0", "#888"); return; }
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

// --- 5. UI & INPUT ---
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

// --- 6. RENDER LOOP ---
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

function draw() {
    if (gameState.gameOver) return;
    gameState.time++;
    ctx.fillStyle = '#111'; // Map Background
    ctx.fillRect(0,0,canvas.width,canvas.height);
    
    let scale = canvas.width / 800; 

    // DRAW ROAD SEGMENTS
    for (let i = 0; i < path.length - 1; i++) {
        let p1 = path[i];
        let p2 = path[i+1];
        let dx = (p2.x - p1.x) * canvas.width;
        let dy = (p2.y - p1.y) * canvas.height;
        let length = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx);
        let cx = (p1.x * canvas.width + dx/2);
        let cy = (p1.y * canvas.height + dy/2);
        
        // Use the new Road Segment Drawer
        drawRoadSegment(ctx, cx, cy, 50 * scale, length + 2, scale, angle + Math.PI/2, gameState.time);
    }

    // Acid
    for(let i=acidPuddles.length-1; i>=0; i--) {
        let p = acidPuddles[i];
        drawAcidPuddle(ctx, p.x*canvas.width, p.y*canvas.height, 30*scale, scale, gameState.time);
        p.life--; if(p.life<=0) acidPuddles.splice(i,1);
    }

    // Towers
    towers.forEach(t => { t.update(); t.draw(); });

    // Enemies
    for (let i = enemies.length-1; i>=0; i--) {
        let e = enemies[i];
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
            // Calculate movement angle
            let moveAngle = Math.atan2(dy, dx);
            
            if (dist < 0.01) e.pathIndex++; else { e.x += (dx/dist)*speed; e.y += (dy/dist)*speed; }
            
            if(e.active) {
                // DRAW ENEMIES WITH ASSETS
                let px = e.x * canvas.width;
                let py = e.y * canvas.height;
                if (e.type === 'normal') drawSoldierEnemy(ctx, px, py, moveAngle, scale, gameState.time);
                else if (e.type === 'dodge') drawScoutEnemy(ctx, px, py, moveAngle, scale, gameState.time);
                else if (e.type === 'armor') drawTankEnemy(ctx, px, py, moveAngle, scale, gameState.time);
                else if (e.type === 'heal') drawHealerEnemy(ctx, px, py, moveAngle, scale, gameState.time);
                else if (e.type === 'split') drawSplitterEnemy(ctx, px, py, 0, scale, gameState.time);
            } else enemies.splice(i, 1);
        }
    }

    // Projectiles
    for(let i=projectiles.length-1; i>=0; i--) {
        let p = projectiles[i];
        if (p.type === 'BEAM') {
            drawSniperBeam(ctx, p.x1 * canvas.width, p.y1 * canvas.height, p.x2 * canvas.width, p.y2 * canvas.height, scale, (15-p.life)/15);
        } else if (p.type === 'PLASMA') {
             drawBlasterShot(ctx, p.sx * canvas.width, p.sy * canvas.height, p.rotation, scale, gameState.time);
             // Move projectile visual only (logic handled in shoot)
             let dx = p.ex - p.sx; let dy = p.ey - p.sy;
             p.sx += dx * 0.1; p.sy += dy * 0.1; 
        } else {
             drawGunnerShot(ctx, p.sx * canvas.width, p.sy * canvas.height, p.rotation, scale);
             // Move projectile visual
             let dx = p.ex - p.sx; let dy = p.ey - p.sy;
             p.sx += dx * 0.2; p.sy += dy * 0.2; 
        }
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
