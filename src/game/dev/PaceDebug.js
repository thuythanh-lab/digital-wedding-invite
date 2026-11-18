/**
 * DEVELOPMENT-ONLY pacing overlay (dev server + ?pace). Never in production:
 * it is imported dynamically inside an `import.meta.env.DEV` branch.
 *
 * Shows scroll position, overall / section progress, character path distance
 * and animation state, camera position, scroll velocity and how much moves on
 * screen per scrolled pixel. The bar on the right is the whole journey:
 * blue = movement sections, amber = information sections, red ticks = places
 * where one pixel of scroll moves a lot, the white line = where you are.
 */
export class PaceDebug {
  constructor(scene) {
    this.s = scene;
    this.vel = 0;
    this.lastTop = null;
    this.lastT = 0;
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:6px;bottom:6px;z-index:60;pointer-events:none;'
      + 'font:11px/1.35 ui-monospace,Consolas,monospace;color:#fff;background:rgba(0,0,0,.72);'
      + 'padding:6px 8px;border-radius:6px;white-space:pre;max-width:calc(100% - 40px)';
    this.panel = el;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;right:2px;top:60px;bottom:60px;width:12px;z-index:60;pointer-events:none;'
      + 'background:rgba(0,0,0,.35);border-radius:3px';
    this.bar = bar;
    const frame = document.getElementById('frame') || document.body;
    frame.append(el, bar);
    this.drawBar();
  }

  drawBar() {
    const p = this.s.pace;
    const total = p.pxAt(p.bEnd);
    const pct = (px) => `${(100 * px) / total}%`;
    this.bar.replaceChildren();
    p.sections.forEach((sec) => {
      const a = p.pxAt(sec.b0); const b = p.pxAt(sec.b1);
      const d = document.createElement('div');
      d.title = sec.label;
      d.style.cssText = `position:absolute;left:0;right:0;top:${pct(a)};height:${pct(b - a)};`
        + `background:${sec.kind === 'info' ? 'rgba(236,201,106,.85)' : 'rgba(120,180,230,.75)'};border-top:1px solid #000`;
      this.bar.append(d);
    });
    // hot spots: > 2 logical units of on-screen motion per scrolled px
    for (let b = 0; b < p.bEnd; b += 2) {
      if (p.unitsPerPx(b) <= 2) continue;
      const t = document.createElement('div');
      t.style.cssText = `position:absolute;left:-4px;width:4px;height:2px;top:${pct(p.pxAt(b))};background:#e33`;
      this.bar.append(t);
    }
    this.here = document.createElement('div');
    this.here.style.cssText = 'position:absolute;left:-3px;right:-3px;height:2px;background:#fff;box-shadow:0 0 3px #000';
    this.bar.append(this.here);
  }

  update(time) {
    const s = this.s; const p = s.pace;
    const top = s.scroller.value;
    if (this.lastTop != null && time > this.lastT) {
      const v = ((top - this.lastTop) / (time - this.lastT)) * 1000;
      this.vel = this.vel * 0.8 + v * 0.2;
    }
    this.lastTop = top; this.lastT = time;
    const b = s.b; const total = p.pxAt(p.bEnd);
    const sec = p.sectionAt(b);
    const local = (b - sec.b0) / Math.max(1e-6, sec.b1 - sec.b0);
    this.here.style.top = `${(100 * p.pxAt(b)) / total}%`;
    this.panel.textContent = [
      `scroll ${top.toFixed(0)} / ${total.toFixed(0)} px   (${((100 * top) / total).toFixed(1)} %)`,
      `section ${sec.label} [${sec.kind}]  ${(100 * Math.min(1, Math.max(0, local))).toFixed(0)} %`,
      `b ${b.toFixed(1)}   d Thủy ${s.thuy.st.d.toFixed(1)}  Minh ${s.minh.st.d.toFixed(1)}`,
      `anim Thủy ${s.thuy.st.key}  Minh ${s.minh.st.key}`,
      `camera y ${s.cameras.main.scrollY.toFixed(0)}   velocity ${this.vel.toFixed(0)} px/s`,
      `motion ${p.unitsPerPx(b).toFixed(2)} units/px   hearts ${s.heartCount}`,
    ].join('\n');
  }
}
