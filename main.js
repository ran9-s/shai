import * as THREE from "three";
import * as CANNON from "cannon-es";

// ==================== 场景 ====================
const scene = new THREE.Scene();
scene.background = null;

// ==================== 透视相机 ====================
const groundHalfW = 2.25;  // 地面 X 半长 (总宽 4.5)
const groundHalfH = 4;     // 地面 Z 半长 (总高 8)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.up.set(0, 0, -1);

function adjustCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const fovRad = camera.fov * Math.PI / 180;
  const dVert = groundHalfH / Math.tan(fovRad / 2);
  const dHoriz = groundHalfW / (Math.tan(fovRad / 2) * aspect);
  camera.position.set(0, -1 + Math.max(dVert, dHoriz), 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
adjustCamera();

// 计算地面在屏幕上的像素区域，用于裁剪
function updateViewport() {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  if (w === 0 || h === 0) return;
  const floorY = -1;
  const corners = [
    new THREE.Vector3(-groundHalfW, floorY, -groundHalfH),
    new THREE.Vector3( groundHalfW, floorY, -groundHalfH),
    new THREE.Vector3( groundHalfW, floorY,  groundHalfH),
    new THREE.Vector3(-groundHalfW, floorY,  groundHalfH),
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    c.project(camera);
    const sx = (c.x + 1) / 2 * w;
    const sy = (-c.y + 1) / 2 * h;
    minX = Math.min(minX, sx);
    minY = Math.min(minY, sy);
    maxX = Math.max(maxX, sx);
    maxY = Math.max(maxY, sy);
  }
  renderer.setViewport(Math.floor(minX), Math.floor(minY), Math.ceil(maxX - minX), Math.ceil(maxY - minY));
  renderer.setScissor(Math.floor(minX), Math.floor(minY), Math.ceil(maxX - minX), Math.ceil(maxY - minY));
}

// ==================== 渲染器 ====================
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#canvas"),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x2a2a3a, 1);
const canvas = renderer.domElement;
canvas.style.touchAction = "manipulation";
canvas.style.cursor = "pointer";
canvas.style.webkitTapHighlightColor = "transparent";

// ==================== 灯光 ====================
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(-5, 10, 5);
light.castShadow = true;
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);

const backLight = new THREE.DirectionalLight(0xeef2ff, 0.5);
backLight.position.set(0, -2, -5);
scene.add(backLight);

// ==================== 骰子纹理（博饼风格 — 白底） ====================
function createDiceFace(dots) {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // 整张画布纯白，不留任何透明区域
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // 极淡的渐变让面有轻微立体感（非常接近纯白）
  const bgGrad = ctx.createRadialGradient(size * 0.35, size * 0.3, 0, size * 0.5, size * 0.5, size * 0.6);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(1, "#fcfbf8");
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(size * 0.015, size * 0.015, size * 0.97, size * 0.97, size * 0.06);
  ctx.fill();

  // --- 画点数（凹坑半球形） ---
  // 博饼传统：1点和4点用红色，其余用黑色
  const dotR = size * 0.085 * 1.25;
  const positions = {
    1: [[0.5, 0.5]],
    2: [[0.36, 0.36], [0.64, 0.64]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.34, 0.34], [0.66, 0.34], [0.34, 0.66], [0.66, 0.66]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.33, 0.26], [0.67, 0.26], [0.33, 0.5], [0.67, 0.5], [0.33, 0.74], [0.67, 0.74]],
  };
  const isRed = dots === 1 || dots === 4;

  for (const [px, py] of positions[dots] || []) {
    const cx = px * size;
    const cy = py * size;

    let dark, mid, light, rimHl;
    if (isRed) {
      dark = "#5a0808"; mid = "#9a1515"; light = "#d63030"; rimHl = "rgba(255,180,180,0.5)";
    } else {
      dark = "#000"; mid = "#2a2a2a"; light = "#555"; rimHl = "rgba(255,255,255,0.4)";
    }

    // 1) 半球形凹坑阴影：点右下侧的暗影（模拟凹坑深度）
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();

    // 2) 凹坑内表面：左上暗 → 右下亮
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const concaveGrad = ctx.createLinearGradient(
      cx - dotR, cy - dotR,   // 左上
      cx + dotR, cy + dotR    // 右下
    );
    concaveGrad.addColorStop(0, dark);     // 左上暗
    concaveGrad.addColorStop(0.7, dark);   // 过渡
    concaveGrad.addColorStop(0.85, mid); // 右下亮
    concaveGrad.addColorStop(1, light);    // 右下亮
    ctx.fillStyle = concaveGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();

    // 3) 左上边缘高光（凹坑入口的棱边受光）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = rimHl;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + dotR * 0.15, cy + dotR * 0.1, dotR * 0.95, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  return new THREE.CanvasTexture(canvas);
}

// ==================== 物理世界 ====================
const world = new CANNON.World();
world.gravity.set(0, -8, 0);
world.solver.iterations = 30;
world.allowSleep = true;

// 物理材料 — 来自 threejs-dice 的成熟方案
// 极低摩擦力是关键：骰子不会"粘"在墙/其它骰子上
const diceMat = new CANNON.Material("dice");
const wallMat = new CANNON.Material("wall");
world.addContactMaterial(
  new CANNON.ContactMaterial(diceMat, wallMat, { friction: 0.01, restitution: 0.3 })
);
world.addContactMaterial(
  new CANNON.ContactMaterial(diceMat, diceMat, { friction: 0.01, restitution: 0.3 })
);
world.addContactMaterial(
  new CANNON.ContactMaterial(wallMat, wallMat, { friction: 0.01, restitution: 0.3 })
);

const groundBody = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Plane() });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
groundBody.position.y = -1;
world.addBody(groundBody);

// ==================== 圆角骰子视觉几何 ====================
// 用高分段 BoxGeometry + 顶点球面拉回算法（sub-cube 法），做出真正的圆角
function createRoundedDiceGeometry(size, radius, seg) {
  const geo = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
  const pos = geo.attributes.position;
  const half = size / 2;
  const inner = half - radius;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = Math.sign(x) * Math.min(Math.abs(x), inner);
    const cy = Math.sign(y) * Math.min(Math.abs(y), inner);
    const cz = Math.sign(z) * Math.min(Math.abs(z), inner);
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len > 0) {
      const s = Math.min(radius / len, 1);
      pos.setXYZ(i, cx + dx * s, cy + dy * s, cz + dz * s);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// ==================== ConvexPolyhedron 物理碰撞体 ====================
// threejs-dice 方案: ConvexPolyhedron 替代 Box/复合体
const DICE_ROUND = 0.97; // 物理碰撞体内缩系数
function createDiceShape(half) {
  const s = half * DICE_ROUND;
  const cv = [
    [-1,-1,-1],[ 1,-1,-1],[ 1, 1,-1],[-1, 1,-1],
    [-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1]
  ].map(c => new CANNON.Vec3(c[0]*s, c[1]*s, c[2]*s));
  const faces = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
    [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]
  ];
  return new CANNON.ConvexPolyhedron({ vertices: cv, faces });
}

const diceSize = 0.8;
const half = diceSize / 2;
const NUM_DICE = 5;
const dices = [];
const diceShape = createDiceShape(half);
const diceGeom = createRoundedDiceGeometry(diceSize, 0.2, 16);

for (let i = 0; i < NUM_DICE; i++) {
  const geometry = diceGeom.clone();
  const materials = [1, 2, 3, 4, 5, 6].map((n) =>
    new THREE.MeshPhysicalMaterial({
      map: createDiceFace(n),
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 0.5,
      color: 0xf0f0f0,
    })
  );
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 8,
    material: diceMat,
    shape: diceShape,
    linearDamping: 0.1,
    angularDamping: 0.1,
  });
  body.position.set(
    (i % 2 === 0 ? -1 : 1) * 1.0,
    1 + i * 0.5,
    i < 2 ? -1.0 : i < 4 ? 1.0 : 0
  );
  // 初始旋转，让 2 点面朝上（-X 轴转到 +Y 轴，绕 Z 转 -90°）
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);
  world.addBody(body);
  // 碰撞音效
  body.addEventListener("collide", (e) => {
    const now = performance.now();
    if (body._lastHit && now - body._lastHit < 60) return;
    body._lastHit = now;
    const spd = Math.abs(e.contact.getImpactVelocityAlongNormal());
    playHitSound(spd, e.body.mass > 0);
  });
  dices.push({ mesh, body });
}

// ==================== 四面物理围墙 ====================
// 墙体内壁与地面边缘对齐，刚好围一圈
const wallHalfHeight = 50000;
const wh = 0.25;            // 墙半厚
const gw = groundHalfW;     // 墙内壁对齐地面X边缘
const gh = groundHalfH - 1; // Z轴内缩 1

const wallPositions = [
  { x: 0, z: -(gh + wh), sx: gw + wh, sz: wh },
  { x: 0, z:  gh + wh,   sx: gw + wh, sz: wh },
  { x: -(gw + wh), z: 0, sx: wh, sz: gh + wh },
  { x:  gw + wh,   z: 0, sx: wh, sz: gh + wh },
];
for (const w of wallPositions) {
  const wall = new CANNON.Body({
    mass: 0,
    material: wallMat,
    shape: new CANNON.Box(new CANNON.Vec3(w.sx, wallHalfHeight, w.sz)),
  });
  wall.position.set(w.x, 0, w.z);
  world.addBody(wall);
}

// ==================== 带厚度的地面 5×7.5（围墙嵌在里面） ====================
const floorGeo = new THREE.BoxGeometry(4.5, 0.5, 8);
const floorMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.position.y = -1.25; // 顶面 y = -1
floor.receiveShadow = true;
scene.add(floor);



// ==================== 窗口缩放适配 ====================
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  adjustCamera();
});

// ==================== 点击投掷 ====================
let isRolling = false;

const startPositions = [
  { x: -0.8, z: -1.0 },
  { x:  0.8, z: -1.0 },
  { x: -0.8, z:  1.0 },
  { x:  0.8, z:  1.0 },
  { x:  0,   z:  0 },
];

canvas.addEventListener("pointerup", () => {
  playThrowSound();
  if (Date.now() - pressStart >= 1000) return;
  isRolling = true;
  stableFrames.fill(0);
  if (cheatFace > 0) {
    cheatYAngles = dices.map(() => Math.random() * Math.PI * 2);
  }
  for (let i = 0; i < dices.length; i++) {
    const d = dices[i];
    const pos = startPositions[i];
    d.body.position.set(pos.x, 2 + Math.random(), pos.z);
    d.body.velocity.set(
      (Math.random() - 0.5) * 6,
      3 + Math.random() * 3,
      (Math.random() - 0.5) * 6
    );
    d.body.angularVelocity.set(
      Math.random() * 10 + 15,
      Math.random() * 10 + 15,
      Math.random() * 10 + 15
    );
    d.body.wakeUp();
  }
});

// ==================== 外挂 — 全部相同点数 ====================
let cheatFace = 0; // 0=关, 1-6=指定面
let cheatYAngles = []; // 每个骰子的随机 Y 轴旋转量

// 每个点数朝向 +Y 的旋转
const cheatQuats = {};
for (let i = 1; i <= 6; i++) cheatQuats[i] = new CANNON.Quaternion();
cheatQuats[1].setFromAxisAngle(new CANNON.Vec3(0, 0, 1),  Math.PI / 2);  // +X → +Y
cheatQuats[2].setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);  // -X → +Y
cheatQuats[3].setFromAxisAngle(new CANNON.Vec3(0, 0, 1), 0);             // +Y → +Y
cheatQuats[4].setFromAxisAngle(new CANNON.Vec3(1, 0, 0),  Math.PI);      // -Y → +Y
cheatQuats[5].setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);  // +Z → +Y
cheatQuats[6].setFromAxisAngle(new CANNON.Vec3(1, 0, 0),  Math.PI / 2);  // -Z → +Y

// ==================== 外挂面板（隐蔽风格 — 长按显示/隐藏） ====================
const cheatPanel = document.createElement('div');
cheatPanel.style.cssText = 'position:fixed;bottom:15px;left:50%;transform:translateX(-50%);z-index:100;display:none;gap:2px;align-items:center;font-family:monospace;user-select:none;opacity:0.55;';
cheatPanel.dataset.visible = 'false';

const BTN_STYLE = 'width:22px;height:22px;font-size:10px;cursor:pointer;border:1px solid #555;background:rgba(40,40,50,0.6);color:#666;border-radius:3px;padding:0;';

function syncCheatButtons() {
  cheatBtns.forEach((b, idx) => {
    const active = cheatFace === idx + 1;
    b.style.background = active ? 'rgba(192,57,43,0.7)' : 'rgba(40,40,50,0.6)';
    b.style.color = active ? '#fff' : '#666';
  });
}

const cheatBtns = [];
for (let i = 1; i <= 6; i++) {
  const btn = document.createElement('button');
  btn.textContent = i;
  btn.style.cssText = BTN_STYLE;
  btn.addEventListener('click', () => {
    if (cheatFace === i) {
      // 点击已选中的 → 取消作弊，面板也隐藏
      cheatFace = 0;
      cheatPanel.style.display = 'none';
      cheatPanel.dataset.visible = 'false';
    } else {
      // 选中点数 → 面板立即隐藏，作弊生效
      cheatFace = i;
      cheatPanel.style.display = 'none';
      cheatPanel.dataset.visible = 'false';
    }
  });
  cheatPanel.appendChild(btn);
  cheatBtns.push(btn);
}
document.body.appendChild(cheatPanel);

// 长按检测（统一 document：1s 显示/隐藏）
let pressTimer = null;
let pressStart = 0;

function clearPressTimer() {
  clearInterval(pressTimer);
  pressTimer = null;
}

document.addEventListener('pointerdown', () => {
  pressStart = Date.now();
  clearPressTimer();
  pressTimer = setInterval(() => {
    const elapsed = Date.now() - pressStart;
    if (cheatPanel.dataset.visible === 'false' && elapsed >= 1000) {
      cheatPanel.style.display = 'flex';
      cheatPanel.dataset.visible = 'true';
      syncCheatButtons();  // 同步当前 cheatFace 的高亮
      clearPressTimer();
    } else if (cheatPanel.dataset.visible === 'true' && elapsed >= 1000) {
      cheatPanel.style.display = 'none';
      cheatPanel.dataset.visible = 'false';
      // 隐藏时不重置 cheatFace，作弊功能继续生效
      clearPressTimer();
    }
  }, 100);
});

document.addEventListener('pointerup', clearPressTimer);
document.addEventListener('pointerleave', clearPressTimer);

// ==================== 音效系统（Web Audio API 合成） ====================
// ── 方案选择 ──
//
const _THROW = playThrow_D;
const _HIT   = playHit_D;

// ── 全局 AudioContext（首次交互时懒初始化） ──
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// ── D: 多子音碰撞 ──
// 3 个快速衰减的短 click，模拟骰子在手里碰撞后甩出
function playThrow_D() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime, sr = ctx.sampleRate;
    for (let k = 0; k < 3; k++) {
      const t = now + k * 0.035;
      const dur = 0.04;
      const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 6;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "highpass"; filt.frequency.value = 3000;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.15 - k * 0.04, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filt); filt.connect(gn); gn.connect(ctx.destination);
      src.start(t); src.stop(t + dur);
    }
  } catch (_) {}
}

// ── D: 金属感"叮叮" ──
// 正弦波 + 稍长延音，碰撞效果（选定的方案）
function playHit_D(impactSpeed, isDiceDice) {
  try {
    if (impactSpeed < 0.5) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const vol = Math.min(impactSpeed / 8, 1) * 0.3;
    if (vol < 0.05) return;
    const freq = isDiceDice ? 500 + impactSpeed * 40 : 800 + impactSpeed * 60;
    const dur = Math.min(0.04 + impactSpeed * 0.006, 0.18);
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = freq;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, now); gn.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gn); gn.connect(ctx.destination);
    osc.start(now); osc.stop(now + dur);
  } catch (_) {}
}

// ── 别名 ──
const playThrowSound = _THROW;
const playHitSound   = _HIT;

// ==================== 落地检测（帧计数） ====================
// threejs-dice 方式：连续 N 帧速度低于阈值才算落地
const stableFrames = new Array(NUM_DICE).fill(0);
const STABLE_THRESHOLD = 30; // 需连续 30 帧稳定

// ==================== 渲染循环 ====================
function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 60);

  for (const d of dices) {
    d.mesh.position.copy(d.body.position);
    d.mesh.quaternion.copy(d.body.quaternion);
  }

  // 外挂：半空翻面（所有骰子都在下落时触发）
  if (isRolling && cheatFace > 0 && dices.every(d => d.body.velocity.y < -0.3)) {
    for (let i = 0; i < dices.length; i++) {
      const ySpin = new CANNON.Quaternion();
      ySpin.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), cheatYAngles[i] || 0);
      dices[i].body.quaternion.copy(ySpin.mult(cheatQuats[cheatFace]));
      dices[i].body.angularVelocity.set(0, 0, 0);
    }
  }

  // 帧计数稳定检测 — 每帧骰子速度 < 1 计一次稳定
  if (isRolling) {
    for (let i = 0; i < dices.length; i++) {
      const v = dices[i].body.velocity;
      const av = dices[i].body.angularVelocity;
      if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && Math.abs(v.z) < 1 &&
          Math.abs(av.x) < 1 && Math.abs(av.y) < 1 && Math.abs(av.z) < 1) {
        stableFrames[i]++;
      } else {
        stableFrames[i] = 0;
      }
    }
    if (stableFrames.every(f => f >= STABLE_THRESHOLD)) {
      isRolling = false;
      stableFrames.fill(0);
    }
  }

  camera.lookAt(0, 0, 0);

  // 裁剪到地面区域，外部清黑
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, true);
  updateViewport();
  renderer.setScissorTest(true);

  renderer.render(scene, camera);
}


animate();
