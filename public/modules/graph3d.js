// 3D impact graph: nodes = tasks, edges = enabler->enabled ("impacts") and parent->child ("part of").
// Ground plane is X (urgency) by Z (importance); height Y = priority (importance*urgency, or leverage
// when influenceMode is on). Rendered with Three.js (loaded via importmap: "three" + "three/addons/").

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const INK = '#111111';
const URGENT = '#e5484d';
const IMPACT = '#f5a623';
const BOX = 10; // world box is BOX x BOX x BOX
const TARGET = new THREE.Vector3(BOX / 2, 3, BOX / 2);
// English axis captions keep the editorial serif; task-name labels (often Hangul) use Pretendard
const DISPLAY = 'Georgia,"Times New Roman",Times,serif';
const BODY = '"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

// shared flat mark geometries (billboarded toward camera each frame)
const GEO = {
  urgent: new THREE.CircleGeometry(0.16, 28),
  impact: (() => { const g = new THREE.PlaneGeometry(0.3, 0.3); g.rotateZ(Math.PI / 4); return g; })(),
  standard: new THREE.PlaneGeometry(0.26, 0.26),
};

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function leverage(t) { return Math.max(0, num(t.leverage_score)); }
function priorityScaled(t) { return (num(t.importance) * num(t.urgency)) / 10; }

function heightValue(t, influenceMode) {
  const lev = leverage(t);
  const raw = influenceMode ? lev : (lev > 0 ? lev : priorityScaled(t));
  return Math.max(0, Math.min(BOX, raw));
}

// URGENT (important + urgent) / IMPACT (high leverage or important) / STANDARD
function category(t) {
  const imp = num(t.importance), urg = num(t.urgency);
  if (imp >= 5 && urg >= 5) return 'urgent';
  if (leverage(t) >= 5 || imp >= 5) return 'impact';
  return 'standard';
}
function catColor(c) { return c === 'urgent' ? URGENT : c === 'impact' ? IMPACT : INK; }

function coord(t, influenceMode) {
  return new THREE.Vector3(num(t.urgency), heightValue(t, influenceMode), num(t.importance));
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
    this._active = true;
    this._raf = null;
    this._clock = new THREE.Clock();
    this._lastTasks = this._lastRels = null;
    this._onResize = () => this.resize();
    this._onPointerMove = (e) => this._pointerMove(e);
    this._onClick = (e) => this._click(e);
  }

  init() {
    this.el = document.getElementById('taskChart');
    if (!this.el) return;
    if (this.renderer) this.dispose();

    const w = this.el.clientWidth || 800;
    const h = this.el.clientHeight || 600;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.camera.position.set(BOX / 2 + 10, 12, BOX / 2 + 15);

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

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 40;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // stay above the floor
    this.controls.target.copy(TARGET);

    this._buildStage();

    this.nodeGroup = new THREE.Group();
    this.edgeGroup = new THREE.Group();
    this.scene.add(this.nodeGroup, this.edgeGroup);

    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('click', this._onClick);
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
    this.scene.add(this._caption('IMPORTANCE  ↑', new THREE.Vector3(-1, -0.4, BOX / 2)));
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

  render(tasks, relationships) {
    this._lastTasks = tasks;
    this._lastRels = relationships;
    if (!this.renderer) this.init();
    if (!this.renderer) return;

    for (const m of this.nodeMeshes) {
      if (m.userData.label) m.remove(m.userData.label);
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
    const pos = new Map(list.map((t) => [Number(t.id), coord(t, this.influenceMode)]));
    const top = [...list].sort((a, b) => priorityScaled(b) - priorityScaled(a)).slice(0, 3).map((t) => Number(t.id));

    for (const t of list) {
      const id = Number(t.id);
      const cat = category(t);
      const mesh = new THREE.Mesh(GEO[cat], new THREE.MeshBasicMaterial({
        color: catColor(cat),
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      }));
      mesh.position.copy(pos.get(id));
      const mag = 1 + (num(t.importance) * num(t.urgency)) / 100 * 1.4;
      mesh.scale.setScalar(mag);
      mesh.userData = { task: t, id, base: mag, inProgress: t.status === 'in_progress', label: null, permLabel: false };

      if (t.status === 'in_progress' || top.includes(id)) {
        const lb = this._makeLabel(t.name || `Task ${id}`, t.status === 'in_progress');
        mesh.add(lb);
        mesh.userData.label = lb;
        mesh.userData.permLabel = true;
      }
      this.nodeGroup.add(mesh);
      this.nodeMeshes.push(mesh);
    }

    const segs = [];
    const cols = [];
    const push = (a, b, hex) => {
      const c = new THREE.Color(hex);
      segs.push(a.x, a.y, a.z, b.x, b.y, b.z);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    let n = 0;
    if (this.showRelationships) {
      for (const r of rels) {
        if (n >= 400) break;
        const a = pos.get(Number(r.enabler_task_id));
        const b = pos.get(Number(r.enabled_task_id));
        if (a && b) { push(a, b, '#9b6dff'); n++; }
      }
    }
    if (this.showSubtasks) {
      for (const t of list) {
        if (n >= 400) break;
        if (!t.parent_id) continue;
        const a = pos.get(Number(t.parent_id));
        const b = pos.get(Number(t.id));
        if (a && b) { push(a, b, '#c9c9c9'); n++; }
      }
    }
    if (segs.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      this.edgeGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.5,
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
    for (const m of this.nodeMeshes) {
      const f = this.focusId != null && m.userData.id === this.focusId;
      m.scale.setScalar(m.userData.base * (f ? 1.7 : 1));
      m.material.opacity = this.focusId != null && !f ? 0.4 : 0.95;
    }
  }

  _pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.nodeMeshes, false)[0];
    return hit ? hit.object : null;
  }

  _pointerMove(e) {
    const obj = this._pick(e);
    const id = obj ? obj.userData.id : null;
    if (id === this.hoverId) return;
    if (this.hoverId != null) {
      const prev = this.nodeMeshes.find((m) => m.userData.id === this.hoverId);
      if (prev && prev.userData.label && !prev.userData.permLabel) {
        prev.remove(prev.userData.label);
        prev.userData.label = null;
      }
    }
    this.hoverId = id;
    this.renderer.domElement.style.cursor = id != null ? 'pointer' : 'default';
    if (obj && !obj.userData.permLabel && !obj.userData.label) {
      const lb = this._makeLabel(obj.userData.task.name || `Task ${id}`, false);
      obj.add(lb);
      obj.userData.label = lb;
    }
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
    const t = this._clock.getElapsedTime();

    for (const m of this.nodeMeshes) {
      m.quaternion.copy(this.camera.quaternion);
      if (m.userData.inProgress) {
        m.scale.setScalar(m.userData.base * (1 + Math.sin(t * 4) * 0.18));
      }
    }

    if (this._easeTarget) {
      this.controls.target.lerp(this._easeTarget, 0.08);
      if (this.controls.target.distanceTo(this._easeTarget) < 0.02) this._easeTarget = null;
    }

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
      this.renderer.domElement.removeEventListener('click', this._onClick);
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    if (this.labelRenderer) this.labelRenderer.domElement.remove();
    this.scene = this.camera = this.renderer = null;
    this.labelRenderer = this.controls = null;
    this.nodeMeshes = [];
  }
}
