import "./style.css";
import { gsap } from "gsap";
import {
  Pause,
  Play,
  Presentation,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Video,
} from "lucide";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type GateKind = "NOT" | "AND" | "OR";
type Mode = "video" | "interactive";
type Inputs = [number, number?];
type IconNode = [string, Record<string, string>][];

type GateState = {
  kind: GateKind;
  inputs: Inputs;
  title: string;
  caption: string;
  duration: number;
};

type LessonInfo = {
  formula: string;
  text: string;
  memory: string;
};

type SignalParticle = {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  offset: number;
  speed: number;
};

const gates: Record<
  GateKind,
  {
    description: string;
    inputs: string[];
    rows: number[][];
    evaluate: (a: number, b?: number) => number;
  }
> = {
  NOT: {
    description: "Инвертор меняет значение входного сигнала на противоположное.",
    inputs: ["A"],
    rows: [
      [0, 1],
      [1, 0],
    ],
    evaluate: (a) => Number(!a),
  },
  AND: {
    description: "Логический элемент формирует единицу только при двух активных входах.",
    inputs: ["A", "B"],
    rows: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
    evaluate: (a, b = 0) => Number(Boolean(a && b)),
  },
  OR: {
    description: "Логический элемент формирует единицу, если активен хотя бы один вход.",
    inputs: ["A", "B"],
    rows: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    evaluate: (a, b = 0) => Number(Boolean(a || b)),
  },
};

const gateNames: Record<GateKind, string> = {
  NOT: "НЕ",
  AND: "И",
  OR: "ИЛИ",
};

const lessons: Record<GateKind, LessonInfo> = {
  NOT: {
    formula: "Y = ¬A",
    text: "Инвертор делает противоположное значение: если на входе 0, на выходе будет 1; если на входе 1, выход станет 0.",
    memory: "Запомни: элемент НЕ всегда переворачивает сигнал.",
  },
  AND: {
    formula: "Y = A ∧ B",
    text: "Элемент И реализуется внутри микросхемы 7408: входы A и B приходят на отдельные пины, а выход Y становится единицей только при двух единицах на входах.",
    memory: "Запомни: элемент И дает 1 только при A = 1 и B = 1.",
  },
  OR: {
    formula: "Y = A ∨ B",
    text: "Элемент ИЛИ реализуется внутри микросхемы 7432: входы A и B подаются отдельно, а выход Y становится единицей, если активен хотя бы один вход.",
    memory: "Запомни: элемент ИЛИ дает 1, если хотя бы один вход равен 1.",
  },
};

const script: GateState[] = [
  {
    kind: "NOT",
    inputs: [0],
    title: "НЕ: вход A = 0",
    caption: "Элемент НЕ: при нуле на входе инвертор формирует единицу на выходе.",
    duration: 5600,
  },
  {
    kind: "NOT",
    inputs: [1],
    title: "НЕ: вход A = 1",
    caption: "Элемент НЕ: активный вход переключает схему, и выходной сигнал становится нулевым.",
    duration: 5600,
  },
  {
    kind: "AND",
    inputs: [0, 0],
    title: "И: оба входа 0",
    caption: "Элемент И: на оба входных пина микросхемы 7408 подан ноль, поэтому выход Y остается нулевым.",
    duration: 5000,
  },
  {
    kind: "AND",
    inputs: [1, 0],
    title: "И: один активный вход",
    caption: "Элемент И: на микросхему 7408 поступает A=1 и B=0, внутри микросхемы выход Y остается равным нулю.",
    duration: 5200,
  },
  {
    kind: "AND",
    inputs: [1, 1],
    title: "И: два активных входа",
    caption: "Элемент И: оба входа микросхемы 7408 равны единице, поэтому логический элемент формирует Y=1.",
    duration: 6200,
  },
  {
    kind: "OR",
    inputs: [0, 0],
    title: "ИЛИ: оба входа 0",
    caption: "Элемент ИЛИ: на оба входа микросхемы 7432 подан ноль, поэтому выход Y остается неактивным.",
    duration: 5000,
  },
  {
    kind: "OR",
    inputs: [0, 1],
    title: "ИЛИ: один активный вход",
    caption: "Элемент ИЛИ: на один вход микросхемы 7432 подана единица, поэтому внутри микросхемы формируется Y=1.",
    duration: 5600,
  },
  {
    kind: "OR",
    inputs: [1, 1],
    title: "ИЛИ: два активных входа",
    caption: "Элемент ИЛИ: оба входа микросхемы 7432 активны, выход сохраняет значение логической единицы.",
    duration: 5600,
  },
  {
    kind: "AND",
    inputs: [1, 1],
    title: "Итог",
    caption: "Комбинируя простейшие логические схемы, строят более сложные цифровые устройства.",
    duration: 6200,
  },
];

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Canvas element was not found");

const gateTitle = document.querySelector<HTMLHeadingElement>("#gate-title")!;
const gateDescription = document.querySelector<HTMLParagraphElement>("#gate-description")!;
const formulaText = document.querySelector<HTMLElement>("#formula-text")!;
const lessonText = document.querySelector<HTMLParagraphElement>("#lesson-text")!;
const signalSteps = document.querySelector<HTMLDivElement>("#signal-steps")!;
const memoryNote = document.querySelector<HTMLParagraphElement>("#memory-note")!;
const inputPanel = document.querySelector<HTMLDivElement>("#input-panel")!;
const truthHead = document.querySelector<HTMLTableSectionElement>("#truth-head")!;
const truthBody = document.querySelector<HTMLTableSectionElement>("#truth-body")!;
const stepCaption = document.querySelector<HTMLParagraphElement>("#step-caption")!;
const progress = document.querySelector<HTMLDivElement>("#timeline-progress")!;
const outputBadge = document.querySelector<HTMLDivElement>("#output-badge")!;
const gateTabs = document.querySelector<HTMLDivElement>("#gate-tabs")!;
const modeSwitch = document.querySelector<HTMLDivElement>("#mode-switch")!;
const chapterList = document.querySelector<HTMLDivElement>("#chapter-list")!;
const sceneCounter = document.querySelector<HTMLSpanElement>("#scene-counter")!;
const prevButton = document.querySelector<HTMLButtonElement>("#prev-step")!;
const playButton = document.querySelector<HTMLButtonElement>("#play-toggle")!;
const nextButton = document.querySelector<HTMLButtonElement>("#next-step")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart-video")!;
const presentationButton = document.querySelector<HTMLButtonElement>("#presentation-toggle")!;
const quizQuestion = document.querySelector<HTMLParagraphElement>("#quiz-question")!;
const quizStatus = document.querySelector<HTMLSpanElement>("#quiz-status")!;
const quizActions = document.querySelector<HTMLDivElement>(".quiz-actions")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.Fog(0x071018, 18, 44);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(-1.35, 7.95, 12.9);
const cameraTarget = new THREE.Vector3(0, 0.65, 0);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.74, 0.62, 0.28);
composer.addPass(bloomPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 8.8;
controls.maxDistance = 18;
controls.minPolarAngle = 0.42;
controls.maxPolarAngle = 1.18;
controls.autoRotateSpeed = 0.42;
controls.target.copy(cameraTarget);

function applyResponsiveViewport() {
  const rect = canvas!.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect.height || window.innerHeight));
  const isCompact = window.innerWidth <= 760;
  const isShort = window.innerHeight <= 620;
  const pixelRatio = Math.min(window.devicePixelRatio, isCompact ? 1.55 : 2);

  camera.aspect = width / height;
  camera.fov = isCompact ? 52 : 45;
  camera.updateProjectionMatrix();

  controls.minDistance = isCompact || isShort ? 10.2 : 8.8;
  controls.maxDistance = isCompact || isShort ? 20 : 18;

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  bloomPass.setSize(width, height);
}

scene.add(new THREE.AmbientLight(0xa8c7e7, 0.42));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
keyLight.position.set(4.7, 9.3, 6.7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 32;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 9;
keyLight.shadow.camera.bottom = -9;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x6bc8ff, 1.15);
rimLight.position.set(-6.5, 5.2, -7.5);
scene.add(rimLight);

const cyanLight = new THREE.PointLight(0x74e1d1, 5.3, 19);
cyanLight.position.set(-4.8, 3.5, 4);
scene.add(cyanLight);

const amberLight = new THREE.PointLight(0xffce5c, 4.1, 17);
amberLight.position.set(5.8, 3.35, -2);
scene.add(amberLight);

const magentaAccent = new THREE.PointLight(0xff6bba, 1.2, 13);
magentaAccent.position.set(1.5, 3.1, -5.6);
scene.add(magentaAccent);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(38, 24),
  new THREE.MeshStandardMaterial({
    color: 0x09131b,
    roughness: 0.84,
    metalness: 0.08,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.12;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(38, 38, 0x31536a, 0x102630);
grid.position.y = -0.105;
scene.add(grid);

const materials = {
  board: new THREE.MeshPhysicalMaterial({
    color: 0x10333b,
    roughness: 0.58,
    metalness: 0.16,
    clearcoat: 0.42,
    clearcoatRoughness: 0.38,
  }),
  boardEdge: new THREE.MeshStandardMaterial({ color: 0x06161d, roughness: 0.68, metalness: 0.26 }),
  copperOff: new THREE.MeshStandardMaterial({ color: 0x5c6671, roughness: 0.5, metalness: 0.58 }),
  ground: new THREE.MeshStandardMaterial({ color: 0x7f94a6, roughness: 0.46, metalness: 0.72 }),
  copperOn: new THREE.MeshStandardMaterial({
    color: 0xffc952,
    roughness: 0.2,
    metalness: 0.88,
    emissive: 0xff9f1c,
    emissiveIntensity: 1.18,
  }),
  wireGlow: new THREE.MeshBasicMaterial({
    color: 0xffd86c,
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
  }),
  gateBody: new THREE.MeshStandardMaterial({ color: 0xd7e4ef, roughness: 0.28, metalness: 0.22 }),
  gateActive: new THREE.MeshStandardMaterial({
    color: 0x74e1d1,
    roughness: 0.28,
    metalness: 0.35,
    emissive: 0x1d756e,
    emissiveIntensity: 1.2,
  }),
  gateGlass: new THREE.MeshPhysicalMaterial({
    color: 0x74e1d1,
    roughness: 0.08,
    metalness: 0.08,
    transmission: 0.35,
    transparent: true,
    opacity: 0.24,
  }),
  chipCover: new THREE.MeshPhysicalMaterial({
    color: 0x193041,
    roughness: 0.18,
    metalness: 0.12,
    transmission: 0.52,
    transparent: true,
    opacity: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.16,
  }),
  red: new THREE.MeshStandardMaterial({ color: 0xff6b7a, roughness: 0.35, metalness: 0.24, emissive: 0x8a1320, emissiveIntensity: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x101923, roughness: 0.74, metalness: 0.2 }),
  chip: new THREE.MeshStandardMaterial({ color: 0x0b1118, roughness: 0.55, metalness: 0.28 }),
  pin: new THREE.MeshStandardMaterial({ color: 0xc9d4df, roughness: 0.28, metalness: 0.78 }),
  particle: new THREE.MeshBasicMaterial({ color: 0x8ff7ee }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd8a63a, roughness: 0.32, metalness: 0.86, emissive: 0x392200, emissiveIntensity: 0.08 }),
  pad: new THREE.MeshStandardMaterial({ color: 0xc79d4d, roughness: 0.24, metalness: 0.9 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xf1dfb0, roughness: 0.42, metalness: 0.08 }),
  capacitor: new THREE.MeshStandardMaterial({ color: 0x1a6e7a, roughness: 0.36, metalness: 0.22 }),
};

const board = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.36, 7.25), materials.board);
board.position.y = 0.05;
board.castShadow = true;
board.receiveShadow = true;
scene.add(board);

const staticRoot = new THREE.Group();
const visualRoot = new THREE.Group();
scene.add(staticRoot, visualRoot);

const signalParticles: SignalParticle[] = [];
const activeConductors: THREE.Mesh[] = [];
const gateParts: THREE.Object3D[] = [];
const interactiveInputs: Record<GateKind, Inputs> = {
  NOT: [0],
  AND: [0, 0],
  OR: [0, 0],
};

let currentOutput = 0;
let currentKind: GateKind = "NOT";
let currentInputs: Inputs = [0];
let currentMode: Mode = "video";
let dotPhase = 0;
let stepIndex = 0;
let isPlaying = true;
let stepTimer = 0;
let progressTween: gsap.core.Tween | null = null;
let sceneTransition: gsap.core.Timeline | null = null;
let firstSceneRender = true;
let isPresentationMode = false;

function iconSvg(icon: unknown) {
  const nodes = icon as IconNode;
  const content = nodes
    .map(([tag, attrs]) => {
      const attrText = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag} ${attrText}></${tag}>`;
    })
    .join("");

  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

function setIcon(button: HTMLButtonElement, icon: unknown) {
  button.innerHTML = iconSvg(icon);
}

function normalizeInputs(kind: GateKind, inputs: Inputs): Inputs {
  return kind === "NOT" ? [inputs[0]] : [inputs[0], inputs[1] ?? 0];
}

function createBox(size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCylinder(radius: number, height: number, position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function setFittedFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  startSize: number,
  maxWidth: number,
) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Segoe UI, Arial`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 20);
}

function addLabel(text: string, x: number, z: number, color = "#f6f8fb", y = 1.62, scale = 2.25) {
  const canvasLabel = document.createElement("canvas");
  canvasLabel.width = 512;
  canvasLabel.height = 180;
  const ctx = canvasLabel.getContext("2d")!;
  ctx.clearRect(0, 0, canvasLabel.width, canvasLabel.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setFittedFont(ctx, text, 800, 76, canvasLabel.width * 0.88);
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.62)";
  ctx.shadowBlur = 18;
  ctx.fillText(text, canvasLabel.width / 2, canvasLabel.height / 2);

  const texture = new THREE.CanvasTexture(canvasLabel);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale * 0.36, 1);
  visualRoot.add(sprite);
}

function addBoardLabel(text: string, x: number, z: number, color = "#9fb4c8", y = 0.36, scale = 1.05) {
  const canvasLabel = document.createElement("canvas");
  canvasLabel.width = 512;
  canvasLabel.height = 128;
  const ctx = canvasLabel.getContext("2d")!;
  ctx.clearRect(0, 0, canvasLabel.width, canvasLabel.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setFittedFont(ctx, text, 800, 46, canvasLabel.width * 0.9);
  ctx.fillStyle = color;
  ctx.fillText(text, canvasLabel.width / 2, canvasLabel.height / 2);

  const texture = new THREE.CanvasTexture(canvasLabel);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.76, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale * 0.25, 1);
  staticRoot.add(sprite);
}

function createScrew(x: number, z: number) {
  const screw = createCylinder(0.18, 0.065, [x, 0.31, z], materials.pin);
  const slot = createBox([0.25, 0.016, 0.035], [x, 0.35, z], materials.dark);
  slot.rotation.y = (x + z) * 0.22;
  staticRoot.add(screw, slot);
}

function createContactPad(x: number, z: number, active = false) {
  const pad = createCylinder(0.09, 0.026, [x, 0.325, z], active ? materials.copperOn : materials.pad);
  staticRoot.add(pad);
  return pad;
}

function createPCBTrace(points: [number, number, number][], active = false, radius = 0.024) {
  return addStaticTube(points, radius, active ? materials.copperOn : materials.gold);
}

function createResistor(x: number, z: number, rotation = 0) {
  const body = createCylinder(0.085, 0.72, [x, 0.46, z], materials.ceramic);
  body.rotation.z = Math.PI / 2;
  body.rotation.y = rotation;
  staticRoot.add(body);

  for (let i = -1; i <= 1; i++) {
    const band = createCylinder(0.088, 0.028, [x + i * 0.15, 0.46, z], i === 0 ? materials.red : materials.copperOn);
    band.rotation.z = Math.PI / 2;
    band.rotation.y = rotation;
    staticRoot.add(band);
  }
}

function createCapacitor(x: number, z: number, tall = false) {
  const height = tall ? 0.64 : 0.42;
  const capacitor = createCylinder(tall ? 0.13 : 0.105, height, [x, 0.42 + height / 2, z], materials.capacitor);
  staticRoot.add(capacitor);
  const top = createCylinder(tall ? 0.132 : 0.107, 0.025, [x, 0.435 + height, z], materials.pin);
  staticRoot.add(top);
}

function addStaticTube(points: [number, number, number][], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 14, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  staticRoot.add(mesh);
  return mesh;
}

function addWire(points: [number, number, number][], active: boolean, radius = 0.07) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, radius, 18, false), active ? materials.copperOn : materials.copperOff);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  visualRoot.add(mesh);

  if (active) {
    const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, radius * 2.15, 18, false), materials.wireGlow);
    visualRoot.add(glow);
    activeConductors.push(mesh, glow);
    addSignalParticles(curve, 4);
  }

  return mesh;
}

function addGroundWire(points: [number, number, number][], radius = 0.034) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 34, radius, 14, false), materials.ground);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  visualRoot.add(mesh);
  return mesh;
}

function addCircuitNode(x: number, z: number, active = false, y = 0.53) {
  const node = createCylinder(0.105, 0.045, [x, y, z], active ? materials.copperOn : materials.ground);
  node.rotation.x = Math.PI / 2;
  visualRoot.add(node);
  return node;
}

function addSignalParticles(curve: THREE.CatmullRomCurve3, count: number) {
  for (let i = 0; i < count; i++) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), materials.particle);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x74e1d1, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    const particle = new THREE.Group();
    particle.add(halo, core);
    visualRoot.add(particle);
    signalParticles.push({
      mesh: particle as unknown as THREE.Mesh,
      curve,
      offset: i / count,
      speed: 0.08 + i * 0.008,
    });
  }
}

function clearVisual() {
  while (visualRoot.children.length > 0) {
    const child = visualRoot.children.pop()!;
    child.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }
  signalParticles.length = 0;
  activeConductors.length = 0;
  gateParts.length = 0;
}

function createGateGeometry(kind: GateKind) {
  const shape = new THREE.Shape();
  if (kind === "NOT") {
    shape.moveTo(-0.82, -0.62);
    shape.lineTo(-0.82, 0.62);
    shape.lineTo(0.68, 0);
    shape.lineTo(-0.82, -0.62);
  } else if (kind === "AND") {
    shape.moveTo(-0.88, -0.66);
    shape.lineTo(-0.05, -0.66);
    shape.quadraticCurveTo(0.9, -0.66, 0.9, 0);
    shape.quadraticCurveTo(0.9, 0.66, -0.05, 0.66);
    shape.lineTo(-0.88, 0.66);
    shape.lineTo(-0.88, -0.66);
  } else {
    shape.moveTo(-0.98, -0.72);
    shape.quadraticCurveTo(-0.48, 0, -0.98, 0.72);
    shape.quadraticCurveTo(0.08, 0.64, 0.96, 0);
    shape.quadraticCurveTo(0.08, -0.64, -0.98, -0.72);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.045,
    bevelThickness: 0.055,
  });
  geometry.center();
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function addPin(x: number, z: number, length: number, active: boolean) {
  const pin = createCylinder(0.055, length, [x, 0.58, z], active ? materials.copperOn : materials.pin);
  pin.rotation.z = Math.PI / 2;
  visualRoot.add(pin);
  return pin;
}

function addIcSocket(x: number, z: number, active: boolean) {
  const base = createBox([2.34, 0.12, 1.62], [x, 0.35, z], materials.chip);
  visualRoot.add(base);
  gateParts.push(base);

  const leftRail = createBox([0.1, 0.34, 1.72], [x - 1.08, 0.53, z], materials.chip);
  const rightRail = createBox([0.1, 0.34, 1.72], [x + 1.08, 0.53, z], materials.chip);
  visualRoot.add(leftRail, rightRail);
  gateParts.push(leftRail, rightRail);

  const die = createBox([1.08, 0.055, 0.72], [x, 0.61, z], active ? materials.gateActive : materials.gateBody);
  visualRoot.add(die);
  gateParts.push(die);

  const cover = createBox([1.7, 0.08, 1.18], [x, 0.77, z], materials.chipCover);
  visualRoot.add(cover);
  gateParts.push(cover);

  const notch = createCylinder(0.15, 0.04, [x - 0.86, 0.6, z], materials.dark);
  notch.rotation.x = Math.PI / 2;
  visualRoot.add(notch);

  for (let i = 0; i < 5; i++) {
    const dz = -0.62 + i * 0.31;
    const left = createBox([0.34, 0.055, 0.07], [x - 1.28, 0.47, z + dz], active ? materials.copperOn : materials.pin);
    const right = createBox([0.34, 0.055, 0.07], [x + 1.28, 0.47, z + dz], active ? materials.copperOn : materials.pin);
    visualRoot.add(left, right);
  }
}

function addLogicModule(kind: GateKind, x: number, z: number, outputActive: boolean, inputStates: Inputs = [0, 0]) {
  const anyInputActive = Boolean(inputStates[0] || inputStates[1]);
  addIcSocket(x, z, outputActive || anyInputActive);
  const mesh = new THREE.Mesh(createGateGeometry(kind), outputActive ? materials.gateActive : materials.gateBody);
  mesh.position.set(x, 0.84, z);
  mesh.scale.set(1.22, 1.22, 1.22);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  visualRoot.add(mesh);
  gateParts.push(mesh);

  const glass = new THREE.Mesh(createGateGeometry(kind), materials.gateGlass);
  glass.position.copy(mesh.position);
  glass.position.y += 0.045;
  glass.scale.set(1.36, 1.36, 1.36);
  visualRoot.add(glass);
  gateParts.push(glass);

  const outputPin = addPin(x + 1.38, z, 0.82, outputActive);
  outputPin.position.x = x + 1.52;

  if (kind === "NOT") {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), outputActive ? materials.gateActive : materials.gateBody);
    bubble.position.set(x + 0.92, 0.86, z);
    bubble.castShadow = true;
    visualRoot.add(bubble);
    addPin(x - 1.42, z, 0.74, Boolean(inputStates[0]));
  } else {
    addPin(x - 1.42, z - 0.46, 0.72, Boolean(inputStates[0]));
    addPin(x - 1.42, z + 0.46, 0.72, Boolean(inputStates[1]));
  }

  const chipName: Record<GateKind, string> = {
    NOT: "7404: НЕ",
    AND: "7408: И",
    OR: "7432: ИЛИ",
  };
  addLabel(gateNames[kind], x, z - 1.24, outputActive ? "#74e1d1" : "#f6f8fb", 1.75, 1.9);
  addLabel(chipName[kind], x, z + 1.18, outputActive || anyInputActive ? "#ffce5c" : "#9fb4c8", 1.48, 1.5);
  addLabel("ЛОГИКА ВНУТРИ", x, z, outputActive ? "#74e1d1" : "#9fb4c8", 1.18, 1.25);
}

function addPowerSource(showZeroReference = false) {
  const body = createCylinder(0.48, 1.02, [-5.2, 0.62, 0], materials.dark);
  body.rotation.z = Math.PI / 2;
  visualRoot.add(body);

  const capPlus = createCylinder(0.22, 0.18, [-4.58, 0.62, 0], materials.copperOn);
  capPlus.rotation.z = Math.PI / 2;
  const capMinus = createCylinder(0.2, 0.14, [-5.82, 0.62, 0], materials.pin);
  capMinus.rotation.z = Math.PI / 2;
  visualRoot.add(capPlus, capMinus);

  const plus = createBox([0.48, 0.08, 0.08], [-5.12, 1.08, -0.2], materials.red);
  const plus2 = createBox([0.08, 0.08, 0.48], [-5.12, 1.08, -0.2], materials.red);
  visualRoot.add(plus, plus2);

  addLabel("+5 В", -5.04, -1.02, "#ffce5c", 1.35, 1.35);
  if (showZeroReference) {
    addLabel("0 В", -5.94, 0.92, "#b8c3cf", 1.2, 1.1);
  }
}

function addInputSource(label: string, x: number, z: number, active: boolean) {
  const base = createBox([1.06, 0.12, 0.64], [x, 0.35, z], materials.chip);
  visualRoot.add(base);

  const leftTerminal = createCylinder(0.12, 0.13, [x - 0.56, 0.5, z], materials.pin);
  const rightTerminal = createCylinder(0.12, 0.13, [x + 0.56, 0.5, z], active ? materials.copperOn : materials.pin);
  leftTerminal.rotation.x = Math.PI / 2;
  rightTerminal.rotation.x = Math.PI / 2;
  visualRoot.add(leftTerminal, rightTerminal);

  const bridge = createBox([0.78, 0.055, 0.13], [x, 0.52, z], active ? materials.copperOn : materials.copperOff);
  visualRoot.add(bridge);
  gateParts.push(bridge);

  const statusMaterial = active
    ? new THREE.MeshBasicMaterial({ color: 0xffce5c })
    : new THREE.MeshStandardMaterial({ color: 0x394754, roughness: 0.6, metalness: 0.18 });
  const status = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14), statusMaterial);
  status.position.set(x, 0.72, z + 0.34);
  visualRoot.add(status);

  addLabel(`${label}=${active ? 1 : 0}`, x, z + 0.82, active ? "#ffce5c" : "#9fb4c8", 1.55, 1.55);
  addLabel(`ВХОД ${label}`, x, z - 0.76, active ? "#74e1d1" : "#9fb4c8", 1.16, 1.05);
}

function addLed(output: number) {
  const socket = createCylinder(0.5, 0.22, [5.12, 0.38, 0], materials.dark);
  socket.rotation.x = Math.PI / 2;
  visualRoot.add(socket);

  const ledMaterial = new THREE.MeshPhysicalMaterial({
    color: output ? 0x74e1d1 : 0x394754,
    emissive: output ? 0x39c8bc : 0x000000,
    emissiveIntensity: output ? 1.8 : 0,
    roughness: 0.12,
    metalness: 0.02,
    transmission: 0.35,
    transparent: true,
    opacity: output ? 0.96 : 0.58,
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.42, 36, 20), ledMaterial);
  led.position.set(5.12, 0.92, 0);
  led.castShadow = true;
  visualRoot.add(led);
  gateParts.push(led);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 1.5, 36, 1, true),
    new THREE.MeshBasicMaterial({
      color: output ? 0x74e1d1 : 0x394754,
      transparent: true,
      opacity: output ? 0.16 : 0.035,
      depthWrite: false,
    }),
  );
  cone.position.set(5.12, 1.74, 0);
  cone.rotation.x = Math.PI;
  visualRoot.add(cone);

  if (output) {
    const glow = new THREE.PointLight(0x74e1d1, 4.8, 9);
    glow.position.set(5.12, 1.12, 0);
    visualRoot.add(glow);
  }
  addLabel(`Y=${output}`, 5.12, 1.05, output ? "#74e1d1" : "#9fb4c8", 1.62, 1.55);
}

function addPowerFeed(inputZs: number[]) {
  const junctionX = -4.32;
  addCircuitNode(junctionX, 0, true);
  addWire([[-4.58, 0.52, 0], [junctionX, 0.52, 0]], true, 0.04);

  inputZs.forEach((z) => {
    addCircuitNode(junctionX, z, true);
    addWire([[junctionX, 0.52, 0], [junctionX, 0.52, z], [-3.84, 0.52, z]], true, 0.04);
  });
}

function addCommonReturn(inputZs: number[], chipX: number) {
  const busZ = 2.94;
  const inputBusX = -3.28;
  addCircuitNode(-5.82, 0, false, 0.5);
  addGroundWire([[-5.82, 0.48, 0], [-5.82, 0.48, busZ], [5.34, 0.48, busZ], [5.34, 0.48, 0.32]]);

  inputZs.forEach((z) => {
    addCircuitNode(inputBusX, z + 0.34, false, 0.5);
    addGroundWire([[inputBusX, 0.48, z + 0.34], [inputBusX, 0.48, busZ]]);
  });

  addCircuitNode(chipX + 0.2, 0.82, false, 0.5);
  addGroundWire([[chipX + 0.2, 0.48, 0.82], [chipX + 0.2, 0.48, busZ]]);
  addCircuitNode(5.12, 0.38, false, 0.5);
  addGroundWire([[5.12, 0.48, 0.38], [5.34, 0.48, 0.38]]);
  addLabel("ОБЩИЙ ПРОВОД 0 В", 0.25, 2.92, "#b8c3cf", 0.92, 1.45);
}

function buildBoardDetails() {
  const edge = createBox([13.58, 0.08, 7.43], [0, -0.18, 0], materials.boardEdge);
  staticRoot.add(edge);

  [
    [-6.22, -3.28],
    [6.22, -3.28],
    [-6.22, 3.28],
    [6.22, 3.28],
  ].forEach(([x, z]) => createScrew(x, z));

  for (let x = -5.8; x <= 5.8; x += 0.58) {
    for (let z = -2.75; z <= 2.75; z += 0.58) {
      const hole = createCylinder(0.038, 0.018, [x, 0.255, z], materials.dark);
      hole.rotation.x = Math.PI / 2;
      staticRoot.add(hole);
    }
  }

  for (let i = 0; i < 9; i++) createContactPad(-5.65 + i * 0.32, -2.28);
  for (let i = 0; i < 8; i++) createContactPad(3.25 + i * 0.34, 2.18);
  for (let i = 0; i < 6; i++) createContactPad(-0.82 + i * 0.34, 3.05);

  createPCBTrace([[-5.65, 0.31, -2.28], [-2.65, 0.31, -2.28]], false, 0.018);
  createPCBTrace([[3.25, 0.31, 2.18], [5.63, 0.31, 2.18]], false, 0.018);
  createPCBTrace([[-0.82, 0.31, 3.05], [0.88, 0.31, 3.05]], false, 0.018);
  createPCBTrace([[-4.45, 0.32, -2.35], [-3.0, 0.32, -2.35]], false, 0.018);
  createPCBTrace([[3.0, 0.32, 2.55], [4.85, 0.32, 2.55]], false, 0.018);

  for (let i = 0; i < 4; i++) createCapacitor(-4.25 + i * 0.46, -2.35, i % 2 === 0);
  for (let i = 0; i < 4; i++) createResistor(3.2 + i * 0.48, 2.55);

  addBoardLabel("УЧЕБНАЯ ПЛАТА", 0, -3.18, "#74e1d1", 0.42, 2.2);
  addBoardLabel("ПИТАНИЕ +5 В", -5.22, 0.88, "#ffce5c", 0.46, 1.18);
  addBoardLabel("ШИНА ВХОДОВ A / B", -2.15, 2.58, "#9fb4c8", 0.42, 1.55);
  addBoardLabel("ВЫХОД Y", 5.25, 1.82, "#74e1d1", 0.42, 1.05);
  addBoardLabel("МИКРОСХЕМЫ: НЕ, И, ИЛИ", 1.35, 3.18, "#b8c3cf", 0.42, 1.95);
}

function buildNot(a: number) {
  currentOutput = gates.NOT.evaluate(a);
  addPowerSource(true);
  addPowerFeed([-1.1]);
  addInputSource("A", -3.2, -1.1, Boolean(a));
  addWire([[-2.64, 0.52, -1.1], [-1.22, 0.52, -1.1], [-0.5, 0.52, 0]], Boolean(a));
  addLogicModule("NOT", 0.92, 0, Boolean(currentOutput), [a]);
  addWire([[2.44, 0.52, 0], [3.25, 0.52, 0], [4.7, 0.52, 0]], Boolean(currentOutput));
  addLed(currentOutput);
  addCommonReturn([-1.1], 0.92);
}

function buildAnd(a: number, b: number) {
  currentOutput = gates.AND.evaluate(a, b);
  addPowerSource();
  addPowerFeed([-1.35, 1.35]);
  addInputSource("A", -3.28, -1.35, Boolean(a));
  addInputSource("B", -3.28, 1.35, Boolean(b));
  addWire([[-2.72, 0.52, -1.35], [-1.1, 0.52, -1.35], [-0.37, 0.52, -0.46]], Boolean(a));
  addWire([[-2.72, 0.52, 1.35], [-1.1, 0.52, 1.35], [-0.37, 0.52, 0.46]], Boolean(b));
  addLogicModule("AND", 1.05, 0, Boolean(currentOutput), [a, b]);
  addWire([[2.57, 0.52, 0], [3.35, 0.52, 0], [4.7, 0.52, 0]], Boolean(currentOutput));
  addLed(currentOutput);
}

function buildOr(a: number, b: number) {
  currentOutput = gates.OR.evaluate(a, b);
  addPowerSource();
  addPowerFeed([-1.35, 1.35]);
  addInputSource("A", -3.28, -1.35, Boolean(a));
  addInputSource("B", -3.28, 1.35, Boolean(b));
  addWire([[-2.72, 0.52, -1.35], [-1.1, 0.52, -1.35], [-0.37, 0.52, -0.46]], Boolean(a));
  addWire([[-2.72, 0.52, 1.35], [-1.1, 0.52, 1.35], [-0.37, 0.52, 0.46]], Boolean(b));
  addLogicModule("OR", 1.05, 0, Boolean(currentOutput), [a, b]);
  addWire([[2.57, 0.52, 0], [3.35, 0.52, 0], [4.7, 0.52, 0]], Boolean(currentOutput));
  addLed(currentOutput);
}

function getStateSteps(kind: GateKind, inputs: Inputs, output: number) {
  const a = inputs[0];
  const b = inputs[1] ?? 0;

  if (kind === "NOT") {
    return [
      `На вход A подан сигнал ${a}.`,
      a
        ? "Сигнал A поступает на вход микросхемы 7404, а инверсия выполняется внутри логического блока."
        : "На вход микросхемы 7404 приходит нулевой уровень, внутри микросхемы он преобразуется в единицу на выходе.",
      `Итог: Y = ${output}. Это подсвечено в таблице истинности.`,
    ];
  }

  if (kind === "AND") {
    return [
      `На входах сейчас A = ${a}, B = ${b}.`,
      a && b
        ? "Оба входных сигнала поступают на пины микросхемы 7408; внутри микросхемы формируется Y = 1."
        : "Один из входных уровней равен нулю, поэтому микросхема 7408 оставляет выход Y в нулевом состоянии.",
      `Итог: Y = ${output}. Для элемента И единица появляется только внутри логического элемента при A = 1 и B = 1.`,
    ];
  }

  return [
    `На входах сейчас A = ${a}, B = ${b}.`,
    a || b
      ? "Хотя бы один входной сигнал поступает на микросхему 7432, и уже внутри микросхемы формируется активный выход."
      : "На оба входных пина микросхемы 7432 приходит ноль, поэтому выход Y остается неактивным.",
    `Итог: Y = ${output}. Для элемента ИЛИ достаточно одной единицы на входе логического элемента.`,
  ];
}

function renderLesson(kind: GateKind, inputs: Inputs, output: number) {
  const lesson = lessons[kind];
  formulaText.textContent = lesson.formula;
  lessonText.textContent = lesson.text;
  memoryNote.textContent = lesson.memory;
  signalSteps.innerHTML = getStateSteps(kind, inputs, output)
    .map((step, index) => `
      <div class="signal-step">
        <span>${index + 1}</span>
        <p>${step}</p>
      </div>
    `)
    .join("");
}

function renderQuiz(kind: GateKind, inputs: Inputs, output: number) {
  const inputText = kind === "NOT"
    ? `A = ${inputs[0]}`
    : `A = ${inputs[0]}, B = ${inputs[1] ?? 0}`;
  quizQuestion.textContent = `Если ${inputText}, каким будет выход ${gateNames[kind]}?`;
  quizQuestion.dataset.correct = String(output);
  quizStatus.textContent = "выбери ответ";
  quizStatus.className = "";
  quizActions.querySelectorAll("button").forEach((button) => {
    button.classList.remove("is-correct", "is-wrong");
  });
}

function renderTruthTable(kind: GateKind, inputs: Inputs) {
  const config = gates[kind];
  const columns = [...config.inputs, "Y"];
  truthHead.innerHTML = `<tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>`;
  truthBody.innerHTML = config.rows
    .map((row) => {
      const isActive =
        config.inputs.length === 1 ? row[0] === inputs[0] : row[0] === inputs[0] && row[1] === inputs[1];
      return `<tr class="${isActive ? "is-active" : ""}">${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
    })
    .join("");
}

function renderInputs(kind: GateKind, inputs: Inputs) {
  inputPanel.innerHTML = gates[kind].inputs
    .map((input, index) => {
      const value = inputs[index] ?? 0;
      const disabled = currentMode === "video" ? "disabled" : "";
      return `
        <button class="input-chip ${value ? "" : "is-off"}" type="button" data-input="${index}" ${disabled}>
          <strong>${input}</strong>
          <span>${value}</span>
        </button>
      `;
    })
    .join("");
}

function renderGateTabs() {
  gateTabs.innerHTML = (Object.keys(gates) as GateKind[])
    .map(
      (kind) => `
      <button class="gate-tab ${kind === currentKind ? "is-active" : ""}" type="button" data-gate="${kind}">
        ${gateNames[kind]}
      </button>
    `,
    )
    .join("");
}

function renderModeSwitch() {
  modeSwitch.innerHTML = `
    <button class="mode-button ${currentMode === "video" ? "is-active" : ""}" type="button" data-mode="video">
      ${iconSvg(Video)}
      <span>Видео</span>
    </button>
    <button class="mode-button ${currentMode === "interactive" ? "is-active" : ""}" type="button" data-mode="interactive">
      ${iconSvg(SlidersHorizontal)}
      <span>Интерактив</span>
    </button>
  `;
}

function renderChapters() {
  chapterList.innerHTML = script
    .map(
      (step, index) => `
      <button class="chapter ${index === stepIndex ? "is-active" : ""}" type="button" data-step="${index}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${step.title}</strong>
      </button>
    `,
    )
    .join("");
  sceneCounter.textContent = `${stepIndex + 1} / ${script.length}`;
}

function renderControls() {
  setIcon(prevButton, SkipBack);
  setIcon(nextButton, SkipForward);
  setIcon(restartButton, RotateCcw);
  setIcon(presentationButton, Presentation);
  setIcon(playButton, isPlaying ? Pause : Play);
  playButton.setAttribute("aria-label", isPlaying ? "Пауза" : "Воспроизвести");
  playButton.classList.toggle("is-paused", !isPlaying);
  presentationButton.classList.toggle("is-active", isPresentationMode);
  presentationButton.setAttribute("aria-pressed", String(isPresentationMode));
  renderModeSwitch();
  renderGateTabs();
  renderChapters();
}

function setPresentationMode(enabled: boolean) {
  isPresentationMode = enabled;
  document.body.classList.toggle("presentation-mode", enabled);
  controls.autoRotate = enabled;
  controls.autoRotateSpeed = enabled ? 0.72 : 0.28;
  bloomPass.strength = enabled ? 0.88 : 0.74;
  bloomPass.radius = enabled ? 0.72 : 0.62;
  if (enabled) {
    gsap.to(camera.position, {
      x: 0.6,
      y: 8.6,
      z: 13.6,
      duration: 1.1,
      ease: "power2.out",
    });
  } else {
    moveCamera(currentKind);
  }
  renderControls();
}

function moveCamera(kind: GateKind) {
  const targetByGate: Record<GateKind, THREE.Vector3> = {
    NOT: new THREE.Vector3(0.6, 0.62, 0),
    AND: new THREE.Vector3(1.05, 0.62, 0),
    OR: new THREE.Vector3(0.6, 0.62, 0),
  };
  const posByGate: Record<GateKind, THREE.Vector3> = {
    NOT: new THREE.Vector3(-0.9, 7.2, 12.0),
    AND: new THREE.Vector3(0.15, 7.8, 12.8),
    OR: new THREE.Vector3(-0.25, 8.35, 13.2),
  };
  gsap.to(camera.position, {
    x: posByGate[kind].x,
    y: posByGate[kind].y,
    z: posByGate[kind].z,
    duration: 1.15,
    ease: "power2.out",
  });
  gsap.to(cameraTarget, {
    x: targetByGate[kind].x,
    y: targetByGate[kind].y,
    z: targetByGate[kind].z,
    duration: 1.15,
    ease: "power2.out",
  });
}

function buildStateContent(state: GateState) {
  currentKind = state.kind;
  currentInputs = normalizeInputs(state.kind, state.inputs);
  gateTitle.textContent = gateNames[state.kind];
  gateDescription.textContent = gates[state.kind].description;
  stepCaption.textContent = state.caption;
  renderInputs(state.kind, currentInputs);
  renderTruthTable(state.kind, currentInputs);

  if (state.kind === "NOT") buildNot(currentInputs[0]);
  if (state.kind === "AND") buildAnd(currentInputs[0], currentInputs[1] ?? 0);
  if (state.kind === "OR") buildOr(currentInputs[0], currentInputs[1] ?? 0);

  outputBadge.textContent = `Y = ${currentOutput}`;
  outputBadge.classList.toggle("is-on", Boolean(currentOutput));
  renderLesson(state.kind, currentInputs, currentOutput);
  renderQuiz(state.kind, currentInputs, currentOutput);
  renderControls();
  moveCamera(state.kind);
}

function animateSceneIn() {
  gsap.fromTo(
    visualRoot.scale,
    { x: 0.78, y: 0.78, z: 0.78 },
    { x: 1, y: 1, z: 1, duration: 0.82, ease: "back.out(1.35)" },
  );
  gsap.fromTo(
    visualRoot.position,
    { y: -0.32 },
    { y: 0, duration: 0.82, ease: "power3.out" },
  );
  gsap.fromTo(
    activeConductors.map((mesh) => mesh.scale),
    { x: 0.22, y: 0.22, z: 0.22 },
    { x: 1, y: 1, z: 1, duration: 0.92, stagger: 0.025, ease: "power3.out" },
  );
  gsap.fromTo(
    gateParts.map((part) => part.scale),
    { x: 0.62, y: 0.62, z: 0.62 },
    { x: 1, y: 1, z: 1, duration: 0.78, stagger: 0.025, ease: "back.out(1.6)" },
  );
}

function showState(state: GateState, animateIn = true) {
  sceneTransition?.kill();

  const rebuild = () => {
    clearVisual();
    buildStateContent(state);
    if (animateIn) animateSceneIn();
    firstSceneRender = false;
  };

  if (!animateIn || firstSceneRender || visualRoot.children.length === 0) {
    rebuild();
    return;
  }

  sceneTransition = gsap.timeline();
  sceneTransition
    .to(visualRoot.scale, {
      x: 0.84,
      y: 0.84,
      z: 0.84,
      duration: 0.34,
      ease: "power2.inOut",
    })
    .to(
      visualRoot.position,
      {
        y: -0.28,
        duration: 0.34,
        ease: "power2.inOut",
      },
      "<",
    )
    .add(() => {
      clearVisual();
      gsap.set(visualRoot.scale, { x: 0.8, y: 0.8, z: 0.8 });
      gsap.set(visualRoot.position, { y: -0.32 });
      buildStateContent(state);
    })
    .to(visualRoot.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.78,
      ease: "back.out(1.35)",
    })
    .to(
      visualRoot.position,
      {
        y: 0,
        duration: 0.78,
        ease: "power3.out",
      },
      "<",
    )
    .fromTo(
      activeConductors.map((mesh) => mesh.scale),
      { x: 0.25, y: 0.25, z: 0.25 },
      { x: 1, y: 1, z: 1, duration: 0.86, stagger: 0.025, ease: "power3.out" },
      "-=0.62",
    )
    .fromTo(
      gateParts.map((part) => part.scale),
      { x: 0.68, y: 0.68, z: 0.68 },
      { x: 1, y: 1, z: 1, duration: 0.74, stagger: 0.025, ease: "back.out(1.55)" },
      "-=0.74",
    );
}

function clearStepTimer() {
  window.clearTimeout(stepTimer);
  if (progressTween) {
    progressTween.kill();
    progressTween = null;
  }
}

function startProgress(duration: number) {
  gsap.set(progress, { width: "0%" });
  progressTween = gsap.to(progress, { width: "100%", duration: duration / 1000, ease: "none" });
}

function playStep(index: number, shouldAutoAdvance = true) {
  clearStepTimer();
  stepIndex = (index + script.length) % script.length;
  showState(script[stepIndex]);
  startProgress(script[stepIndex].duration);

  if (shouldAutoAdvance && currentMode === "video" && isPlaying) {
    stepTimer = window.setTimeout(() => playStep(stepIndex + 1), script[stepIndex].duration);
  }
}

function setMode(mode: Mode) {
  currentMode = mode;
  if (mode === "video") {
    isPlaying = true;
    playStep(stepIndex);
    return;
  }

  isPlaying = false;
  clearStepTimer();
  gsap.set(progress, { width: "100%" });
  const inputs = interactiveInputs[currentKind];
  showState({
    kind: currentKind,
    inputs,
    title: `${currentKind}: интерактив`,
    caption: "Интерактивный режим: переключайте входные сигналы и наблюдайте изменение выхода Y.",
    duration: 0,
  });
}

function toggleInput(index: number) {
  const inputs = normalizeInputs(currentKind, interactiveInputs[currentKind]);
  inputs[index] = inputs[index] ? 0 : 1;
  interactiveInputs[currentKind] = inputs;
  showState({
    kind: currentKind,
    inputs,
    title: `${currentKind}: интерактив`,
    caption: "Интерактивный режим: входы меняют состояние схемы, таблицы истинности и светодиода.",
    duration: 0,
  });
}

inputPanel.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-input]");
  if (!button || currentMode !== "interactive") return;
  toggleInput(Number(button.dataset.input));
});

function handleQuizChoice(event: Event) {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-answer]");
  if (!button) return;
  event.preventDefault();

  const answer = button.dataset.answer;
  const correct = quizQuestion.dataset.correct;
  const isCorrect = answer === correct;

  quizActions.querySelectorAll("button").forEach((item) => {
    item.classList.remove("is-correct", "is-wrong");
    if (item.getAttribute("data-answer") === correct) item.classList.add("is-correct");
  });
  if (!isCorrect) button.classList.add("is-wrong");

  quizStatus.textContent = isCorrect ? "верно" : "проверь таблицу";
  quizStatus.className = isCorrect ? "is-good" : "is-bad";
}

quizActions.addEventListener("pointerdown", handleQuizChoice);
quizActions.addEventListener("click", handleQuizChoice);

gateTabs.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-gate]");
  if (!button) return;
  currentKind = button.dataset.gate as GateKind;
  setMode("interactive");
});

modeSwitch.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mode]");
  if (!button) return;
  setMode(button.dataset.mode as Mode);
});

chapterList.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-step]");
  if (!button) return;
  currentMode = "video";
  isPlaying = true;
  playStep(Number(button.dataset.step));
});

prevButton.addEventListener("click", () => {
  currentMode = "video";
  isPlaying = true;
  playStep(stepIndex - 1);
});

nextButton.addEventListener("click", () => {
  currentMode = "video";
  isPlaying = true;
  playStep(stepIndex + 1);
});

restartButton.addEventListener("click", () => {
  currentMode = "video";
  isPlaying = true;
  playStep(0);
});

presentationButton.addEventListener("click", () => {
  setPresentationMode(!isPresentationMode);
});

playButton.addEventListener("click", () => {
  if (currentMode !== "video") {
    setMode("video");
    return;
  }

  isPlaying = !isPlaying;
  if (isPlaying) {
    playStep(stepIndex);
  } else {
    clearStepTimer();
    progressTween?.pause();
    renderControls();
  }
});

function animate() {
  requestAnimationFrame(animate);
  dotPhase += 0.012;
  visualRoot.rotation.y = Math.sin(dotPhase * 0.42) * (isPresentationMode ? 0.072 : 0.05);

  signalParticles.forEach((particle, index) => {
    const t = (dotPhase * particle.speed + particle.offset) % 1;
    const point = particle.curve.getPointAt(t);
    particle.mesh.position.copy(point);
    particle.mesh.position.y += Math.sin(dotPhase * 10 + index * 1.7) * 0.045;
    particle.mesh.scale.setScalar(1 + Math.sin(dotPhase * 8 + index) * 0.16);
  });

  activeConductors.forEach((mesh, index) => {
    const pulse = 1 + Math.sin(dotPhase * 8 + index) * 0.08;
    mesh.scale.set(pulse, pulse, pulse);
  });

  gateParts.forEach((object, index) => {
    object.position.y += Math.sin(dotPhase * 4.4 + index) * 0.0009;
    object.rotation.y += Math.sin(dotPhase * 2.4 + index) * 0.00035;
  });

  controls.target.set(cameraTarget.x, cameraTarget.y + Math.sin(dotPhase * 0.66) * 0.055, cameraTarget.z);
  controls.update();
  composer.render();
}

window.addEventListener("resize", () => {
  applyResponsiveViewport();
});

buildBoardDetails();
applyResponsiveViewport();
renderControls();
playStep(0);
animate();
