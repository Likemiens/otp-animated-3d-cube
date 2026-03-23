import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GodRays } from '@paper-design/shaders-react';

// ============================================================
// НАСТРАИВАЕМЫЕ ПАРАМЕТРЫ
// ============================================================
const CONFIG = {
  // Цвета граней куба: +X (правая), -X (левая), +Y (верх), -Y (низ), +Z (перед), -Z (зад)
  faceColors: {
    right: '#9c59b6', // фиолетовый
    left: '#f1c40f', // жёлтый
    top: '#ef6c00', // оранжевый
    bottom: '#e74c3c', // красный
    front: '#9bcc3a', // зелёный
    back: '#3498db', // синий
  },
  innerColor: '#1a1a2e',  // цвет внутренних (невидимых) граней и ядра
  cubeSize: 1,
  gap: 0.08,
  idleSpeedX: 0.0004,  // ещё медленнее для idle-motion
  idleSpeedY: 0.0006, // ещё медленнее
  turnDuration: 1200, // долгое премиальное вращение (1.2 сек)
  turnAngle: Math.PI / 2,
  cameraPosition: [6, 5, 7],
  bgColor: '#adc5ea', // фон как на референсе
  storageKey: 'cube-progress-state-v4',
};

// ============================================================
// СЦЕНА, КАМЕРА, РЕНДЕРЕР
// ============================================================
const scene = new THREE.Scene();
// Прозрачный фон, чтобы был виден CSS градиент из style.css
// scene.background = new THREE.Color(CONFIG.bgColor);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(...CONFIG.cameraPosition);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// ============================================================
// СВЕТ
// ============================================================
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(8, 12, 10);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4);
fillLight.position.set(-6, 4, -8);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
rimLight.position.set(0, -4, -10);
scene.add(rimLight);

// ============================================================
// ORBITCONTROLS
// ============================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 14;
// Без ограничений по углам — свободное вращение на 360°
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;

// ============================================================
// МАТЕРИАЛЫ
// ============================================================

// Одна картинка (OTP логотип) — размещается на 1 случайном тайле на каждой грани
const FACE_NAMES = ['right', 'left', 'top', 'bottom', 'front', 'back'];

// Для каждой грани детерминированно выбираем одну случайную позицию из 9 тайлов
function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Все 9 возможных 2D-позиций тайлов на грани
const ALL_TILE_POSITIONS = [];
for (let a = -1; a <= 1; a++) {
  for (let b = -1; b <= 1; b++) {
    ALL_TILE_POSITIONS.push(a + ',' + b);
  }
}

// Выбираем по 1 случайной позиции на каждую грань (seed = index грани)
const FACE_LOGO_POSITION = {};
FACE_NAMES.forEach((face, idx) => {
  const rand = seededRand((idx + 1) * 7777);
  const tileIdx = Math.floor(rand * 9);
  FACE_LOGO_POSITION[face] = ALL_TILE_POSITIONS[tileIdx];
});

// Определяем, нужно ли рисовать лого на этом тайле
function getFaceIcon(faceName, x, y, z) {
  let a, b;
  switch (faceName) {
    case 'right': a = z; b = y; break;
    case 'left': a = -z; b = y; break;
    case 'top': a = x; b = -z; break;
    case 'bottom': a = x; b = z; break;
    case 'front': a = x; b = y; break;
    case 'back': a = -x; b = y; break;
  }
  return (a + ',' + b) === FACE_LOGO_POSITION[faceName] ? 'otp_logo' : 'none';
}

// ============================================================
// ЗАГРУЗКА ЛОГОТИПА (одна картинка)
// ============================================================
const ICON_IMAGES = {};
let iconsLoaded = false;

function loadAllIcons() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { ICON_IMAGES['otp_logo'] = img; iconsLoaded = true; resolve(); };
    img.onerror = () => { console.warn('Не удалось загрузить логотип'); iconsLoaded = true; resolve(); };
    img.src = 'icons/otp_logo.png';
  });
}

// ============================================================
// СОЗДАНИЕ МАТЕРИАЛОВ
// ============================================================
const materialCache = {};

function getMaterial(hex, iconType) {
  const key = hex + '_' + iconType;
  const rgh = 0.4;
  const mtl = 0.1;

  if (materialCache[key]) {
    return materialCache[key];
  }

  if (hex === CONFIG.innerColor) {
    const matBase = new THREE.MeshStandardMaterial({ color: hex, roughness: rgh, metalness: mtl });
    matBase.userData = { hex: hex, icon: 'none' };
    materialCache[key] = matBase;
    return matBase;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = hex;
  const padding = 20;
  const size = 256 - padding * 2;
  const r = 32;

  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(padding, padding, size, size, r);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(padding + r, padding);
    ctx.lineTo(padding + size - r, padding);
    ctx.quadraticCurveTo(padding + size, padding, padding + size, padding + r);
    ctx.lineTo(padding + size, padding + size - r);
    ctx.quadraticCurveTo(padding + size, padding + size, padding + size - r, padding + size);
    ctx.lineTo(padding + r, padding + size);
    ctx.quadraticCurveTo(padding, padding + size, padding, padding + size - r);
    ctx.lineTo(padding, padding + r);
    ctx.quadraticCurveTo(padding, padding, padding + r, padding);
    ctx.fill();
  }

  // Рисуем логотип OTP на тайле
  if (iconType !== 'none' && iconType && ICON_IMAGES[iconType]) {
    const iconPad = 50; // Отступ логотипа от краёв тайла
    const iconSize = 256 - iconPad * 2;
    ctx.drawImage(ICON_IMAGES[iconType], iconPad, iconPad, iconSize, iconSize);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const matBase = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: map,
    roughness: rgh,
    metalness: mtl
  });
  matBase.userData = { hex: hex, icon: iconType };
  materialCache[key] = matBase;
  return matBase;
}

// BoxGeometry порядок граней: +X, -X, +Y, -Y, +Z, -Z
function makeCubieMaterials(x, y, z) {
  const fc = CONFIG.faceColors;
  const inner = CONFIG.innerColor;
  return [
    getMaterial(x === 1 ? fc.right : inner, x === 1 ? getFaceIcon('right', x, y, z) : 'none'),
    getMaterial(x === -1 ? fc.left : inner, x === -1 ? getFaceIcon('left', x, y, z) : 'none'),
    getMaterial(y === 1 ? fc.top : inner, y === 1 ? getFaceIcon('top', x, y, z) : 'none'),
    getMaterial(y === -1 ? fc.bottom : inner, y === -1 ? getFaceIcon('bottom', x, y, z) : 'none'),
    getMaterial(z === 1 ? fc.front : inner, z === 1 ? getFaceIcon('front', x, y, z) : 'none'),
    getMaterial(z === -1 ? fc.back : inner, z === -1 ? getFaceIcon('back', x, y, z) : 'none'),
  ];
}

// ============================================================
// СБОРКА КУБА
// ============================================================
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const cubies = []; // все 27 кубиков
const step = CONFIG.cubeSize + CONFIG.gap;

// Статичное ядро удалено, чтобы не просвечивало при вращении граней

function buildCube() {
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Сегменты делаем крупнее, чтобы зазоры были минимальны и не было просветов
        const geo = new RoundedBoxGeometry(
          CONFIG.cubeSize * 1.04,
          CONFIG.cubeSize * 1.04,
          CONFIG.cubeSize * 1.04,
          4, 0.08
        );
        const materials = makeCubieMaterials(x, y, z);
        const cubie = new THREE.Mesh(geo, materials);
        cubie.position.set(x * step, y * step, z * step);
        // Храним логическую позицию для сериализации
        cubie.userData.gridPos = { x, y, z };
        cubeGroup.add(cubie);
        cubies.push(cubie);
      }
    }
  }
}

// Сначала грузим иконки, потом строим куб
loadAllIcons().then(() => {
  buildCube();
});

// ============================================================
// УПРАВЛЕНИЕ СОСТОЯНИЯМИ КУБА
// ============================================================

let currentState = 7;
let autoTurnTimeout;
let loopPhase = 'idle';
let currentMoves = [];
let finalAnimationActive = false;
let finalAnimationStart = 0;
function setCubeState(state) {
  currentState = state;
  isAnimating = false;
  clearTimeout(autoTurnTimeout);
  currentMoves = [];
  loopPhase = 'idle';
  finalAnimationActive = false;

  // Восстанавливаем видимость и масштаб, если передумали смотреть финал
  cubeGroup.scale.set(1, 1, 1);
  renderer.domElement.style.transition = 'opacity 0.5s ease';
  renderer.domElement.style.opacity = '1';

  const sDiv = document.getElementById('god-rays-shader');
  if (sDiv) sDiv.style.opacity = '0';
  const tDiv = document.getElementById('final-text');
  if (tDiv) tDiv.style.opacity = '0';

  // 1. Возвращаем куб в исходное (полностью собранное) состояние
  let i = 0;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const c = cubies[i];
        if (!c.parent) cubeGroup.add(c);
        c.position.set(x * step, y * step, z * step);
        c.quaternion.identity();
        c.material = makeCubieMaterials(x, y, z);
        i++;
      }
    }
  }

  // 2. Если состояние < 6, симулируем перемешивание нужного количества граней
  if (state < 6) {
    const faceNames = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    // state 1 = 0 собранных граней, state 5 = 4 собранных
    const solvedCount = state - 1;
    const unsolvedFaceNames = faceNames.slice(solvedCount);

    const faceIdxMap = { right: 0, left: 1, top: 2, bottom: 3, front: 4, back: 5 };
    // Функция для детерминированного генератора (псевдослучайные числа)
    function seededRandom(seed) {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    }

    // Собираем пул тайлов {hex, icon} — ровно 9 на грань (1 с логотипом, 8 без)
    const tilesPool = [];
    unsolvedFaceNames.forEach(f => {
      const hex = CONFIG.faceColors[f];
      for (let i = 0; i < 1; i++) tilesPool.push({ hex, icon: 'otp_logo' });
      for (let i = 0; i < 8; i++) tilesPool.push({ hex, icon: 'none' });
    });

    // Детерминированно перемешиваем пул тайлов
    let shuffleSeed = state * 12345;
    for (let i = tilesPool.length - 1; i > 0; i--) {
      const hash = seededRandom(shuffleSeed++);
      const j = Math.floor(hash * (i + 1));
      [tilesPool[i], tilesPool[j]] = [tilesPool[j], tilesPool[i]];
    }

    let tileIndex = 0;

    unsolvedFaceNames.forEach(fName => {
      const fIdx = faceIdxMap[fName];
      cubies.forEach(c => {
        const isExterior =
          (fName === 'right' && c.userData.gridPos.x === 1) ||
          (fName === 'left' && c.userData.gridPos.x === -1) ||
          (fName === 'top' && c.userData.gridPos.y === 1) ||
          (fName === 'bottom' && c.userData.gridPos.y === -1) ||
          (fName === 'front' && c.userData.gridPos.z === 1) ||
          (fName === 'back' && c.userData.gridPos.z === -1);

        if (isExterior) {
          const tile = tilesPool[tileIndex++];
          c.material[fIdx] = getMaterial(tile.hex, tile.icon);
        }
      });
    });
  }

  // 7 ЭТАП: Финальная анимация (God Rays, ускорение, увеличение, исчезновение)
  if (state === 7) {
    let shaderDiv = document.getElementById('god-rays-shader');
    if (!shaderDiv) {
      shaderDiv = document.createElement('div');
      shaderDiv.id = 'god-rays-shader';
      // Стили подготавливают контейнер "на весь фон" позади куба
      shaderDiv.style.position = 'fixed';
      shaderDiv.style.top = '0';
      shaderDiv.style.left = '0';
      shaderDiv.style.width = '100vw';
      shaderDiv.style.height = '100vh';
      shaderDiv.style.zIndex = '-1';
      shaderDiv.style.background = '#ffffff';
      shaderDiv.style.transition = 'opacity 1.5s ease';
      document.body.appendChild(shaderDiv);

      // Монтируем React-компонент шейдера непосредственно в DOM Vanilla JS
      const root = createRoot(shaderDiv);
      root.render(
        React.createElement(GodRays, {
          width: window.innerWidth,
          height: window.innerHeight,
          colors: ["#9a6fc8", "#ef6915", "#ffffff", "#ef6915"],
          colorBack: "#ffffff",
          colorBloom: "#9a6fc8",
          bloom: 0.4,
          intensity: 0.9,
          density: 0.2,
          spotty: 0.6,
          midSize: 0.2,
          midIntensity: 0.4,
          speed: 4.00,
          offsetY: -0.55
        })
      );
    }
    shaderDiv.style.opacity = '1';

    let textDiv = document.getElementById('final-text');
    if (!textDiv) {
      textDiv = document.createElement('div');
      textDiv.id = 'final-text';
      textDiv.style.position = 'fixed';
      textDiv.style.top = '50%';
      textDiv.style.left = '50%';
      textDiv.style.transform = 'translate(-50%, -50%)';
      textDiv.style.color = '#1a1a2e';
      textDiv.style.fontSize = '80px';
      textDiv.style.fontWeight = 'bold';
      textDiv.style.letterSpacing = '0.05em';
      textDiv.style.opacity = '0';
      textDiv.style.transition = 'opacity 1.5s ease';
      textDiv.style.zIndex = '10';
      textDiv.innerText = 'Ты заполнил куб!';
      document.body.appendChild(textDiv);
    } else {
      textDiv.style.opacity = '0';
    }

    // Отключаем CSS-транзиции для канваса, чтобы JS мог плавно увести его в 0 покадрово
    renderer.domElement.style.transition = 'none';
    renderer.domElement.style.pointerEvents = 'none';

    finalAnimationActive = true;
    finalAnimationStart = performance.now();
    return; // Не запускаем стандартный AutoAction
  }

  // Для остальных стейтов (1-7) возвращаем нормальное взаимодействие
  renderer.domElement.style.pointerEvents = 'auto';

  scheduleAutoAction();
}

window.setCubeState = setCubeState;

// ============================================================
// ПОВОРОТ ГРАНИ
// ============================================================
let isAnimating = false;

function getCubiesForFace(face) {
  const eps = 0.01;
  return cubies.filter(c => {
    const pos = c.position;
    switch (face) {
      case 'right': return pos.x > step - eps;
      case 'left': return pos.x < -step + eps;
      case 'top': return pos.y > step - eps;
      case 'bottom': return pos.y < -step + eps;
      case 'front': return pos.z > step - eps;
      case 'back': return pos.z < -step + eps;
    }
  });
}

function getAxisForFace(face) {
  switch (face) {
    case 'right': return new THREE.Vector3(1, 0, 0);
    case 'left': return new THREE.Vector3(-1, 0, 0);
    case 'top': return new THREE.Vector3(0, 1, 0);
    case 'bottom': return new THREE.Vector3(0, -1, 0);
    case 'front': return new THREE.Vector3(0, 0, 1);
    case 'back': return new THREE.Vector3(0, 0, -1);
  }
}

function scheduleAutoAction() {
  clearTimeout(autoTurnTimeout);
  if (currentState === 6) return; // Собранный куб просто крутится без переворотов

  let pause = 1500 + Math.random() * 1000;

  autoTurnTimeout = setTimeout(() => {
    if (currentState === 1) {
      // Вечно-разобранный: просто случайные повороты в цикле
      const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
      const f = faces[Math.floor(Math.random() * faces.length)];
      const dir = Math.random() > 0.5 ? 1 : -1;
      rotateFace(f, dir, scheduleAutoAction);
      return;
    }

    // Состояния 2-5: цикл "разобрать-собрать"
    if (loopPhase === 'idle') {
      const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
      const f = faces[Math.floor(Math.random() * faces.length)];
      const dir = Math.random() > 0.5 ? 1 : -1;
      currentMoves.push({ face: f, dir: dir });
      loopPhase = 'move1';
      rotateFace(f, dir, scheduleAutoAction);
    }
    else if (loopPhase === 'move1') {
      const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
      const f = faces[Math.floor(Math.random() * faces.length)];
      const dir = Math.random() > 0.5 ? 1 : -1;
      currentMoves.push({ face: f, dir: dir });
      loopPhase = 'move2';
      rotateFace(f, dir, () => {
        setTimeout(scheduleAutoAction, 800); // пауза перед обратной сборкой
      });
    }
    else if (loopPhase === 'move2') {
      const m = currentMoves.pop();
      loopPhase = 'undo2';
      rotateFace(m.face, -m.dir, scheduleAutoAction);
    }
    else if (loopPhase === 'undo2') {
      const m = currentMoves.pop();
      loopPhase = 'idle';
      rotateFace(m.face, -m.dir, () => {
        setTimeout(scheduleAutoAction, 3000); // долгая пауза, когда он собран
      });
    }
  }, pause);
}

function rotateFace(face, dir = 1, onComplete = null) {
  if (isAnimating) return;
  isAnimating = true;
  setButtonsDisabled(true);

  const faceCubies = getCubiesForFace(face);
  const axis = getAxisForFace(face);

  const pivot = new THREE.Group();
  cubeGroup.add(pivot);

  faceCubies.forEach(c => {
    cubeGroup.remove(c);
    pivot.add(c);
  });

  const startQ = pivot.quaternion.clone();
  const endQ = new THREE.Quaternion().setFromAxisAngle(axis, CONFIG.turnAngle * dir).multiply(startQ);
  const startTime = performance.now();

  function animateTurn() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / CONFIG.turnDuration, 1);

    const s = 0.9;
    let ease = t;
    if (t < 0.5) {
      ease = 0.5 * (2 * t) * (2 * t) * ((s + 1) * 2 * t - s);
    } else {
      const u = t * 2 - 2;
      ease = 0.5 * (u * u * ((s + 1) * u + s) + 2);
    }

    pivot.quaternion.slerpQuaternions(startQ, endQ, ease);

    if (t < 1) {
      requestAnimationFrame(animateTurn);
    } else {
      pivot.quaternion.copy(endQ);
      pivot.updateMatrixWorld(true);

      faceCubies.forEach(c => {
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        c.getWorldPosition(worldPos);
        c.getWorldQuaternion(worldQuat);

        pivot.remove(c);
        cubeGroup.add(c);

        cubeGroup.worldToLocal(worldPos);
        c.position.copy(worldPos);
        c.quaternion.copy(
          cubeGroup.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQuat)
        );

        c.position.x = Math.round(c.position.x / step) * step;
        c.position.y = Math.round(c.position.y / step) * step;
        c.position.z = Math.round(c.position.z / step) * step;
      });

      cubeGroup.remove(pivot);
      isAnimating = false;
      setButtonsDisabled(false);

      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(animateTurn);
}

// Инициализация при запуске (полностью разобраный куб по умолчанию как первый стейт)
setTimeout(() => setCubeState(1), 500);

// ============================================================
// TOAST И КНОПКИ
// ============================================================
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 1500);
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll('#ui-overlay button').forEach(b => b.disabled = disabled);
}

document.querySelectorAll('[data-state]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const s = parseInt(e.target.dataset.state);
    if (window.setCubeState) window.setCubeState(s);
  });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// АНИМАЦИОННЫЙ ЦИКЛ
// ============================================================
let baseRotX = 0;
let baseRotY = 0;

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now() * 0.001;

  let spdX = CONFIG.idleSpeedX;
  let spdY = CONFIG.idleSpeedY;

  if (finalAnimationActive) {
    const elapsed = (performance.now() - finalAnimationStart) / 1000;

    // 1. Плавный разгон вращения куба (0 - 3 секунды) и удержание скорости
    const accel = elapsed < 3.0 ? 1 + Math.pow(elapsed / 3.0, 4) * 60 : 1 + Math.pow(3.0 / 3.0, 4) * 60;
    spdX *= accel;
    spdY *= accel;

    // 2. Куб крутится на максимуме 3-4 секунды (с 3.0 до 6.5 сек), затем увеличение и растворение (с 6.5 до 9.0 сек)
    if (elapsed > 6.5 && elapsed <= 9.0) {
      const sProgress = (elapsed - 6.5) / 2.5; // от 0 до 1
      const scaleVal = 1 + Math.pow(sProgress, 3) * 20; // Масштаб стремительно растет еще больше
      cubeGroup.scale.set(scaleVal, scaleVal, scaleVal);

      // Плавно растворяем WebGL канвас, оголяя шейдер снизу
      renderer.domElement.style.opacity = Math.max(1 - Math.pow(sProgress, 2) * 1.5, 0).toFixed(3);
    } else if (elapsed > 9.0) {
      // Полностью скрываем куб и рендеринг после увеличения
      renderer.domElement.style.opacity = '0';
      cubeGroup.visible = false;
    } else {
      // Куб нормально рендерится во время разгона и кручения (до 6.5 сек)
      cubeGroup.visible = true;
    }

    // 3. Появление текста только после начала растворения куба (~8.0 секунд)
    if (elapsed > 8.0) {
      const tDiv = document.getElementById('final-text');
      if (tDiv && tDiv.style.opacity === '0') {
        tDiv.style.opacity = '1';
      }
    }
  } else {
    cubeGroup.visible = true;
  }

  // Накапливаем базовое вращение
  baseRotX += spdX;
  baseRotY += spdY;

  // Добавляем эффект невесомости
  cubeGroup.rotation.x = baseRotX + Math.sin(time * 0.3) * 0.1;
  cubeGroup.rotation.y = baseRotY + Math.cos(time * 0.25) * 0.1;
  cubeGroup.rotation.z = Math.sin(time * 0.4) * 0.05;

  // Позицию меняем только если куб не стал гигантским (чтобы не прыгал)
  if (!finalAnimationActive || cubeGroup.scale.x < 3) {
    cubeGroup.position.y = Math.sin(time * 0.6) * 0.15;
    cubeGroup.position.x = Math.cos(time * 0.5) * 0.1;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
