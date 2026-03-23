# OTP 3D Cube

Интерактивный 3D-кубик Рубика с 7 публичными состояниями, idle-анимацией и финальной кинематографической сценой с полноэкранным видеофоном.

## Стек

- **Three.js** (0.160) — рендеринг, `RoundedBoxGeometry`, `OrbitControls`
- **HTML5 Video** — полноэкранный видеофон для финальной сцены
- Без сборщика: модули загружаются через `<script type="importmap">` + esm.sh

## Структура

```
├── index.html
├── main.js   
├── style.css 
└── icons/    
    ├── otp_logo.svg
    ├── otp_logo_white.svg
```

## Архитектура куба

Куб состоит из **27 кубиков** (`cubies`), объединённых в `THREE.Group` (`cubeGroup`). Каждый кубик — `THREE.Mesh` с 6 материалами (по одному на грань). Материалы создаются через `getMaterial(hex, iconType)`, который рисует текстуру на `<canvas>` 256×256:

1. Тёмная подложка `#0a0a0c`
2. Цветная наклейка со скруглёнными углами (`padding: 20px`, `radius: 32px`)
3. Белая SVG-иконка поверх (если назначена)

Материалы кешируются по ключу `hex_iconType`.

## Состояния (1–7)

Переключение: `setCubeState(n)` или кнопки в UI.

| Состояние | Описание |
|-----------|----------|
| 1 | Полностью разобран. Бесконечные случайные повороты граней. |
| 2–5 | `N-1` граней собраны (в порядке: right → left → top → bottom). Остальные перемешаны. Цикл «разобрать 2 хода → собрать обратно». |
| 6 | Полностью собран. Только idle-вращение, грани не крутятся. |
| 7 | Финал: ускорение вращения → удержание → масштабирование + растворение → видеофон + текст. |

### Скрамблинг

Несобранные грани заполняются из детерминированного пула `{hex, icon}` (по 9 тайлов на грань: 5 с иконкой, 4 без). Пул перемешивается через `seededRandom(state * 12345)` — результат стабилен между перезагрузками.

## Настройка

### Цвета граней

```js
// main.js → CONFIG.faceColors
faceColors: {
  right: '#9c59b6',   // +X
  left: '#f1c40f',    // -X
  top: '#ef6c00',     // +Y
  bottom: '#e74c3c',  // -Y
  front: '#9bcc3a',   // +Z
  back: '#3498db',    // -Z
},
```

### Иконки

Привязка грань → иконка:

```js
// main.js → FACE_ICONS
const FACE_ICONS = {
  right: 'smiley',
  left: 'lightbulb',
  top: 'target',
  bottom: 'fire',
  front: 'mountain',
  back: 'rocket'
};
```

SVG-файлы лежат в `icons/`. Требования: `viewBox="0 0 256 256"`, все фигуры `fill="white"`, фон прозрачный. Для вырезов использовать SVG `<mask>`.

Позиции тайлов с иконками (5 из 9 — углы + центр):

```js
const ICON_POSITIONS = new Set(['-1,-1', '1,-1', '0,0', '-1,1', '1,1']);
```

### Освещение

```js
// main.js, строки ~50–66
AmbientLight:      intensity 0.6
DirectionalLight:  intensity 1.2, position (8, 12, 10)  — основной
DirectionalLight:  intensity 0.4, position (-6, 4, -8)  — заполняющий
DirectionalLight:  intensity 0.3, position (0, -4, -10) — контровой
toneMappingExposure: 1.1
```

### Анимация

```js
CONFIG.idleSpeedX    // скорость idle-вращения по X
CONFIG.idleSpeedY    // скорость idle-вращения по Y
CONFIG.turnDuration  // длительность поворота грани (мс)
```

Дополнительно в `animate()`: невесомость (sin/cos по position и rotation), дрифт.

### Видеофон (этап 7)

```js
// main.js → setCubeState, блок state === 7
finalVideo.src = 'assets/otpCoverBg.mp4'
finalVideo.loop = true
finalVideo.muted = true
finalVideo.autoplay = true
finalVideo.style.objectFit = 'cover'
```

Видео хранится в `assets/otpCoverBg.mp4` и включается только в финальном состоянии.

### Тайминги финальной анимации (этап 7)

```
0–3 сек    Разгон вращения (ease-in по степенной кривой)
3–6.5 сек  Удержание на максимальной скорости
6.5–9 сек  Масштабирование + растворение canvas (opacity → 0)
8+ сек     Появление текста
```

Текст задаётся в `textDiv.innerText` (по умолчанию: «Ты заполнил куб!»).

## API

```js
window.setCubeState(n)  // Переключить состояние (1–7)
```

Можно вызывать программно из консоли или внешнего кода при встраивании.
