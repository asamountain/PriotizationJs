// 3D impact graph. Floor = Eisenhower plane: X = urgency, Z = importance.
// Height Y = IMPACT (leverage): how much finishing a task unblocks / eases others,
// derived from enabler->enabled relationships; tasks that unblock nothing sit on the floor.
// Node size = priority (importance x urgency). Orange edges = the impact flow.
// Rendered with Three.js (loaded via importmap: "three" + "three/addons/").

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const INK = '#111111';
const BOX = 10; // world box is BOX x BOX x BOX
const TARGET = new THREE.Vector3(BOX / 2, 3, BOX / 2);
// English axis captions keep the editorial serif; task-name labels (often Hangul) use Pretendard
const DISPLAY = 'Georgia,"Times New Roman",Times,serif';
const BODY = '"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

// orientation-independent invisible hit target (icons themselves are CSS2D)
const PICK_GEO = new THREE.SphereGeometry(0.5, 10, 8);

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
// impact axis: goal-proxy weight (_impact, set by the app) if present, else the
// relationship-derived leverage score
function leverage(t) {
  if (t._impact != null) return Math.max(0, num(t._impact));
  return Math.max(0, num(t.leverage_score));
}
function priority(t) { return num(t.importance) * num(t.urgency); } // 0..100
function clamp10(v) { return Math.max(0, Math.min(BOX, v)); }
function kindOf(t) { return t.kind || 'action'; }

// goals ("outcome") and vision ("identity") are parked BEHIND the Eisenhower
// floor on their own bands, not scored on it
const HORIZON_Z = BOX + 3;   // outcome band, just past the grid
const HORIZON_Y = 6.5;
const VISION_Z = BOX + 5;     // identity band, further back and higher
const VISION_Y = 9.4;
const GOLD = '#c9a227';

// deterministic per-task offset so tasks sharing the same (urgency, importance)
// don't stack into one unclickable blob
function jitter(id) {
  const h = (Number(id) * 2654435761) >>> 0;
  return { x: ((h & 255) / 255 - 0.5) * 0.9, z: (((h >> 8) & 255) / 255 - 0.5) * 0.9 };
}

// node colour encodes IMPACT: low (unblocks little) -> grey, mid -> amber, high -> red
const IMPACT_LOW = new THREE.Color('#c2c4c4');
const IMPACT_MID = new THREE.Color('#f5a623');
const IMPACT_HIGH = new THREE.Color('#e5484d');
function impactColor(t01) {
  const t = Math.max(0, Math.min(1, t01));
  const c = t < 0.5
    ? IMPACT_LOW.clone().lerp(IMPACT_MID, t * 2)
    : IMPACT_MID.clone().lerp(IMPACT_HIGH, (t - 0.5) * 2);
  return `#${c.getHexString()}`;
}

// topic -> glyph, matched against the task's category string (ko/en substrings)
const TOPIC_ICONS = [
  [['농사', '농지', '작물', '종자', '텃밭', 'farm', 'garden', 'plant'], 'mdi-sprout'],
  [['iot', '센서', '펌웨어', '하드웨어', '임베디드', 'esp32', 'stm32', 'raspberry', 'device'], 'mdi-chip'],
  [['브랜딩', '마케팅', '콘텐츠', '유튜브', '인스타', 'brand', 'content', 'market', 'sns'], 'mdi-bullhorn-outline'],
  [['교육', '학습', '강의', '수료', 'course', 'study', 'school', 'learn'], 'mdi-school-outline'],
  [['소득', '수입', '경제', '판매', '직거래', 'income', 'revenue', 'sales', 'cash'], 'mdi-cash-multiple'],
  [['건강', '운동', '헬스', '루틴', 'health', 'fitness', 'workout'], 'mdi-run'],
  [['리서치', '조사', '분석', 'research', 'survey', 'analysis'], 'mdi-magnify'],
  [['관계', '사랑', '가족', '협업', 'relationship', 'love', 'family'], 'mdi-heart-outline'],
  [['자기계발', '독서', '스킬', 'self', 'skill', 'read'], 'mdi-book-open-page-variant-outline'],
  [['차량', '자동차', 'car', 'vehicle'], 'mdi-car-outline'],
  [['올리브', '나무', '과수', 'olive', 'tree'], 'mdi-leaf'],
  [['서류', '행정', '신청', '비자', 'admin', 'visa', 'document'], 'mdi-file-document-outline'],
  [['영상', '편집', '촬영', 'video', 'edit', 'film'], 'mdi-movie-open-outline'],
];
const DEFAULT_ICONS = new Set(['', 'mdi-checkbox-blank-circle-outline', 'mdi-circle-outline', 'mdi-circle-small']);

function iconFor(t) {
  const chosen = (t.icon || '').trim();
  if (chosen && !DEFAULT_ICONS.has(chosen)) return chosen; // user set it explicitly
  const hay = `${t.category || ''} ${t.name || ''}`.toLowerCase();
  for (const [keys, icon] of TOPIC_ICONS) {
    if (keys.some((k) => hay.includes(k))) return icon;
  }
  return 'mdi-circle-medium';
}

// floor placement = Eisenhower plane (X urgency, Z importance); height set later
// from impact. Spread tie-heavy scores across the floor: map a value to its percentile rank
// within the current set, then onto 0.5..BOX-0.5. A board where every task is
// rated 8-10 still fans out instead of stacking in one corner. Ties share a spot.
function rankMapper(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return (v) => {
    if (n <= 1) return BOX / 2;
    let below = 0, equal = 0;
    for (const s of sorted) { if (s < v) below++; else if (s === v) equal++; }
    const pct = (below + equal / 2) / n; // 0..1, ties land at their block midpoint
    return 0.5 + pct * (BOX - 1);
  };
}

export class Graph3D {
  constructor() {
    this.el = null;
    this.scene = this.camera = this.renderer = this.labelRenderer = this.controls = null;
    this.nodeGroup = this.edgeGroup = null;
    this.nodeMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoverId = null;
    this.focusId = null;
    this._easeTarget = null;
    this.influenceMode = false;
    this.showRelationships = true;
    this.showSubtasks = true;
    this.rankMode = true; // floor position = percentile rank, not raw 0..10
    this._active = true;
    this._raf = null;
    this._clock = new THREE.Clock();
    this._lastTasks = this._lastRels = null;
    this._onResize = () => this.resize();
    this._onPointerMove = (e) => this._pointerMove(e);
    this._onPointerLeave = () => { this.hoverId = null; this._hideAnno(); };
    // OrbitControls preventDefaults pointerdown, which eats native 'click' -> detect it ourselves
    this._downXY = null;
    this._downT = 0;
    this._onPointerDown = (e) => {
      if (e.button !== 0) return;
      this._downXY = [e.clientX, e.clientY];
      this._downT = performance.now();
    };
    this._onPointerUp = (e) => {
      if (e.button !== 0 || !this._downXY) return;
      const moved = Math.hypot(e.clientX - this._downXY[0], e.clientY - this._downXY[1]);
      const dt = performance.now() - this._downT;
      this._downXY = null;
      if (moved < 6 && dt < 500) this._click(e);
    };
  }

  init() {
    this.el = document.getElementById('taskChart');
    if (!this.el) return;
    if (this.renderer) this.dispose();

    const w = this.el.clientWidth || 800;
    const h = this.el.clientHeight || 600;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
    this.camera.position.set(BOX / 2 + 6, 15, BOX / 2 + 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.el.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    Object.assign(this.labelRenderer.domElement.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
    });
    this.el.appendChild(this.labelRenderer.domElement);

    this._buildAnnotation();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 44;
    this.controls.minPolarAngle = 0.35;            // keep some top-down tilt
    this.controls.maxPolarAngle = Math.PI / 2 - 0.12; // never look edge-on along the ridge
    this.controls.target.copy(TARGET);

    this._buildStage();

    this.nodeGroup = new THREE.Group();
    this.edgeGroup = new THREE.Group();
    this.scene.add(this.nodeGroup, this.edgeGroup);

    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this._onPointerLeave);
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('resize', this._onResize);

    this._active = true;
    this._loop();

    if (this._lastTasks) this.render(this._lastTasks, this._lastRels);
  }

  _buildStage() {
    const grid = new THREE.GridHelper(BOX, BOX, 0xcfcfcf, 0xe4e4e4);
    grid.position.set(BOX / 2, 0, BOX / 2);
    this.scene.add(grid);

    const inkMat = new THREE.LineBasicMaterial({ color: INK });
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(BOX, 0, 0),
        new THREE.Vector3(BOX, 0, BOX), new THREE.Vector3(0, 0, BOX),
      ]),
      inkMat,
    );
    this.scene.add(border);

    const axis = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, BOX, 0)]),
      inkMat,
    );
    this.scene.add(axis);

    this.scene.add(this._caption('URGENCY  →', new THREE.Vector3(BOX / 2, -0.4, BOX + 0.7)));
    this.scene.add(this._caption('IMPORTANCE  →', new THREE.Vector3(-1.4, -0.4, BOX / 2)));
    this.scene.add(this._caption('IMPACT  ↑', new THREE.Vector3(-0.6, BOX + 0.5, 0)));
  }

  _caption(text, pos) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-family:${DISPLAY};font-style:italic;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${INK};white-space:nowrap;`;
    const o = new CSS2DObject(d);
    o.position.copy(pos);
    return o;
  }

  _makeLabel(text, strong) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText =
      `font-family:${BODY};font-size:${strong ? '13px' : '11px'};font-weight:${strong ? '600' : '400'};color:${INK};` +
      'background:rgba(255,255,255,.82);padding:1px 5px;white-space:nowrap;transform:translateY(-16px);';
    return new CSS2DObject(d);
  }

  // hover annotation: ring + drawn leader line + bordered label, animated in
  _buildAnnotation() {
    const el = document.createElement('div');
    el.className = 'g3d-anno';
    el.innerHTML =
      '<svg class="g3d-anno__svg"><line class="g3d-anno__line" x1="0" y1="0" x2="0" y2="0"></line></svg>' +
      '<span class="g3d-anno__ring"></span>' +
      '<span class="g3d-anno__label"></span>';
    this.el.appendChild(el);
    this.anno = {
      root: el,
      line: el.querySelector('.g3d-anno__line'),
      ring: el.querySelector('.g3d-anno__ring'),
      label: el.querySelector('.g3d-anno__label'),
    };
    this._annoObj = null;
  }

  _showAnno(obj) {
    if (!this.anno) return;
    this._annoObj = obj;
    this.anno.label.textContent = obj.userData.task.name || `Task ${obj.userData.id}`;
    // restart the ease-in-out reveal for every new hover target
    this.anno.root.classList.remove('is-on');
    void this.anno.root.offsetWidth; // force reflow
    this._positionAnno();
    this.anno.root.classList.add('is-on');
  }

  _hideAnno() {
    this._annoObj = null;
    if (this.anno) this.anno.root.classList.remove('is-on');
  }

  _positionAnno() {
    if (!this._annoObj || !this.anno) return;
    const r = this.renderer.domElement;
    const w = r.clientWidth, h = r.clientHeight;
    const v = this._annoObj.position.clone().project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * w;
    const sy = (-v.y * 0.5 + 0.5) * h;

    // label anchored up-and-right of the point, clamped to the container
    const lw = this.anno.label.offsetWidth || 190;
    const lh = this.anno.label.offsetHeight || 40;
    const lx = Math.min(Math.max(sx + 96, 8), Math.max(8, w - lw - 8));
    const ly = Math.min(Math.max(sy - 96, 8), Math.max(8, h - lh - 8));

    this.anno.ring.style.left = `${sx}px`;
    this.anno.ring.style.top = `${sy}px`;
    this.anno.label.style.left = `${lx}px`;
    this.anno.label.style.top = `${ly}px`;
    this.anno.line.setAttribute('x1', sx);
    this.anno.line.setAttribute('y1', sy);
    this.anno.line.setAttribute('x2', lx);
    this.anno.line.setAttribute('y2', ly + lh);
  }

  render(tasks, relationships) {
    this._lastTasks = tasks;
    this._lastRels = relationships;
    if (!this.renderer) this.init();
    if (!this.renderer) return;

    for (const m of this.nodeMeshes) {
      if (m.userData.iconObj) { m.userData.iconObj.element.remove(); m.remove(m.userData.iconObj); }
      m.material.dispose();
      this.nodeGroup.remove(m);
    }
    this.nodeMeshes = [];
    while (this.edgeGroup.children.length) {
      const c = this.edgeGroup.children.pop();
      c.geometry.dispose();
      c.material.dispose();
    }

    // done + "Not Sure" tasks drop off the chart entirely (still live in the table)
    const list = (Array.isArray(tasks) ? tasks : []).filter((t) => !t.done && t.status !== 'Not Sure');
    const rels = Array.isArray(relationships) ? relationships : [];
    const kindById = new Map(list.map((t) => [Number(t.id), kindOf(t)]));

    const actions = list.filter((t) => kindOf(t) === 'action');
    const outcomes = list.filter((t) => kindOf(t) === 'outcome');
    const idents = list.filter((t) => kindOf(t) === 'identity');

    // HEIGHT = impact (leverage) for floor tasks, normalized to the box.
    // Tasks that unblock nothing sit on the floor (y = 0); goals/vision get
    // their own bands behind it.
    const maxLev = Math.max(0, ...actions.map(leverage));
    const rankU = this.rankMode ? rankMapper(actions.map((t) => num(t.urgency))) : null;
    const rankI = this.rankMode ? rankMapper(actions.map((t) => num(t.importance))) : null;
    const pos = new Map(actions.map((t) => {
      const j = jitter(t.id);
      const ux = rankU ? rankU(num(t.urgency)) : clamp10(num(t.urgency));
      const iz = rankI ? rankI(num(t.importance)) : clamp10(num(t.importance));
      const p = new THREE.Vector3(clamp10(ux + j.x), 0, clamp10(iz + j.z));
      const lev = leverage(t);
      p.y = maxLev > 0 && lev > 0 ? 0.7 + (lev / maxLev) * 7.3 : 0;
      return [Number(t.id), p];
    }));
    outcomes.forEach((t, i) => {
      const x = outcomes.length < 2 ? BOX / 2 : 1 + (i / (outcomes.length - 1)) * (BOX - 2);
      pos.set(Number(t.id), new THREE.Vector3(x, HORIZON_Y, HORIZON_Z));
    });
    idents.forEach((t, i) => {
      const x = idents.length < 2 ? BOX / 2 : 1.5 + (i / (idents.length - 1)) * (BOX - 3);
      pos.set(Number(t.id), new THREE.Vector3(x, VISION_Y, VISION_Z));
    });

    // horizon rule the outcome nodes rest on
    if (outcomes.length) {
      const hz = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, HORIZON_Y, HORIZON_Z), new THREE.Vector3(BOX, HORIZON_Y, HORIZON_Z),
      ]);
      this.edgeGroup.add(new THREE.LineSegments(hz, new THREE.LineBasicMaterial({
        color: 0xd9c494, transparent: true, opacity: 0.7,
      })));
    }

    // thin vertical stems: floating (impactful) floor tasks drop a line to their spot
    const stem = [];
    for (const t of actions) {
      const p = pos.get(Number(t.id));
      if (p && p.y > 0.05) stem.push(p.x, p.y, p.z, p.x, 0, p.z);
    }
    if (stem.length) {
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(stem, 3));
      this.edgeGroup.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({
        color: 0x9aa0a0, transparent: true, opacity: 0.5,
      })));
    }

    // Each node = a topic glyph (MDI) via CSS2D; an invisible mesh is the click target.
    for (const t of list) {
      const id = Number(t.id);
      const k = kindOf(t);
      const mag = 0.55 + priority(t) / 100 * 0.85; // node size = importance x urgency
      const lev01 = maxLev > 0 ? leverage(t) / maxLev : 0; // impact, 0..1
      const p = pos.get(id);
      if (!p) continue;

      const mesh = new THREE.Mesh(PICK_GEO, new THREE.MeshBasicMaterial({ visible: false }));
      mesh.position.copy(p);
      mesh.scale.setScalar(0.1); // just a carrier for the CSS2D icon; picking is screen-space now

      const el = document.createElement('div');
      el.className = 'g3d-node';
      if (k === 'identity') {
        // vision / stance: a faint serif name floating behind the field, no metrics
        el.classList.add('is-identity');
        el.textContent = t.name || `Task ${id}`;
      } else if (k === 'outcome') {
        // goal: gold ring on the horizon, sized/lit by roll-up progress
        el.classList.add('is-outcome');
        const prog = Math.max(0, Math.min(1, num(t._progress)));
        el.innerHTML = `<i class="mdi ${iconFor(t)}"></i>`;
        el.style.color = GOLD;
        el.style.fontSize = `${Math.round(16 + prog * 16)}px`;
        el.style.opacity = `${0.45 + prog * 0.55}`;
      } else {
        el.innerHTML = `<i class="mdi ${iconFor(t)}"></i>`;
        el.style.color = impactColor(lev01);
        el.style.fontSize = `${Math.round(14 + mag * 12)}px`;
        if (t.status === 'in_progress') el.classList.add('is-doing');
      }
      const iconObj = new CSS2DObject(el);
      mesh.add(iconObj);

      mesh.userData = { task: t, id, base: mag, inProgress: t.status === 'in_progress', iconObj, iconEl: el };
      this.nodeGroup.add(mesh);
      this.nodeMeshes.push(mesh);
    }

    // hand-drawn curved connectors between related tasks (batched into one LineSegments)
    const segs = [];
    const cols = [];
    const seg = (p, q, c) => {
      segs.push(p.x, p.y, p.z, q.x, q.y, q.z);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    const hash01 = (a, b) => {
      const s = Math.sin((a.x + b.z) * 127.1 + (a.z + b.x) * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const curve = (a, b, hex, lift) => {
      const col = new THREE.Color(hex);
      const dir = b.clone().sub(a);
      const len = dir.length() || 1;
      const k = hash01(a, b);
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const ctrl = a.clone().add(b).multiplyScalar(0.5)
        .add(new THREE.Vector3(0, len * lift, 0))
        .addScaledVector(perp, (k - 0.5) * len * 0.28);
      const P = new THREE.QuadraticBezierCurve3(a, ctrl, b).getPoints(20);
      for (let i = 1; i < P.length - 1; i++) {
        const w = (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
        P[i].x += (w - 0.5) * 0.06;
        P[i].z += (w - 0.5) * 0.06;
      }
      for (let i = 0; i < P.length - 1; i++) seg(P[i], P[i + 1], col);
      // chevron at the "enabled" end
      const t = P[P.length - 1].clone().sub(P[P.length - 2]).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x);
      const back = b.clone().addScaledVector(t, -0.34);
      seg(b, back.clone().addScaledVector(nrm, 0.14), col);
      seg(b, back.clone().addScaledVector(nrm, -0.14), col);
    };

    let n = 0;
    if (this.showRelationships) {
      for (const r of rels) {
        if (n >= 220) break;
        const a = pos.get(Number(r.enabler_task_id));
        const b = pos.get(Number(r.enabled_task_id));
        if (!a || !b) continue;
        const toGoal = kindById.get(Number(r.enabled_task_id)) === 'outcome';
        curve(a, b, toGoal ? GOLD : '#e0654b', toGoal ? 0.06 : 0.16);
        n++;
      }
    }
    if (this.showSubtasks) {
      for (const t of list) {
        if (n >= 220) break;
        if (!t.parent_id) continue;
        const a = pos.get(Number(t.parent_id));
        const b = pos.get(Number(t.id));
        if (a && b) { curve(a, b, '#c9c9c9', 0.10); n++; }
      }
    }
    if (segs.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      this.edgeGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.6,
      })));
    }

    this._applyFocus();
  }

  focusOnTask(taskId) {
    this.focusId = taskId == null ? null : Number(taskId);
    this._applyFocus();
    if (this.focusId != null) {
      const m = this.nodeMeshes.find((x) => x.userData.id === this.focusId);
      if (m) this._easeTarget = m.position.clone();
    }
  }

  _applyFocus() {
    const dim = this.focusId != null;
    for (const m of this.nodeMeshes) {
      const el = m.userData.iconEl;
      if (!el) continue;
      const f = dim && m.userData.id === this.focusId;
      el.classList.toggle('is-focus', f);
      el.classList.toggle('is-dim', dim && !f);
    }
  }

  // pick in SCREEN space: the node whose projected icon is closest to the cursor
  // (within a small pixel radius). Matches exactly what the user is pointing at,
  // regardless of camera angle / zoom, and never bulges over neighbours.
  _pick(e) {
    if (!this.renderer || !this.nodeMeshes.length) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const v = new THREE.Vector3();
    let best = null;
    let bestD = 18; // px hit radius (~ icon half-size)
    for (const m of this.nodeMeshes) {
      v.copy(m.position).project(this.camera);
      if (v.z > 1) continue; // behind the camera
      const sx = (v.x * 0.5 + 0.5) * r.width;
      const sy = (-v.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  _pointerMove(e) {
    const obj = this._pick(e);
    const id = obj ? obj.userData.id : null;
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.renderer.domElement.style.cursor = id != null ? 'pointer' : 'default';
    if (obj) this._showAnno(obj);
    else this._hideAnno();
  }

  _click(e) {
    const obj = this._pick(e);
    if (!obj) { window.dispatchEvent(new CustomEvent('node:deselect')); return; }
    const v = obj.position.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('node:select', {
      detail: {
        taskId: obj.userData.id,
        screenX: r.left + (v.x * 0.5 + 0.5) * r.width,
        screenY: r.top + (-v.y * 0.5 + 0.5) * r.height,
        task: obj.userData.task,
      },
    }));
    this.focusOnTask(obj.userData.id);
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!this._active || document.hidden || !this.renderer) return;

    // icon marks are DOM (CSS2D) and always face the viewer; the "doing" pulse
    // is a CSS animation, so nothing per-frame is needed for the nodes.

    if (this._easeTarget) {
      this.controls.target.lerp(this._easeTarget, 0.08);
      if (this.controls.target.distanceTo(this._easeTarget) < 0.02) this._easeTarget = null;
    }

    if (this._annoObj) this._positionAnno();

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.renderer || !this.el) return;
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  setActive(on) { this._active = !!on; }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    window.removeEventListener('resize', this._onResize);
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
      this.renderer.domElement.removeEventListener('pointerleave', this._onPointerLeave);
      this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
      this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    if (this.labelRenderer) this.labelRenderer.domElement.remove();
    if (this.anno) { this.anno.root.remove(); this.anno = null; }
    this._annoObj = null;
    this.scene = this.camera = this.renderer = null;
    this.labelRenderer = this.controls = null;
    this.nodeMeshes = [];
  }
}
