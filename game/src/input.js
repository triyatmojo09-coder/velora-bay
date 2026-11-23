// VELORA BAY 3D — keyboard state with edge detection + mouse orbit (drag yaw/pitch, wheel zoom).
export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.pressed = new Set();
    this.yawOff = 0;        // camera orbit offset from behind-player heading
    this.pitch = 0.32;      // camera elevation angle (rad)
    this.dist = 8;
    this.dragging = false;
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', (e) => { this.dragging = true; this._lx = e.clientX; this._ly = e.clientY; });
    addEventListener('pointerup', () => { this.dragging = false; });
    addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yawOff -= (e.clientX - this._lx) * 0.005;
      this.pitch = Math.max(0.06, Math.min(1.1, this.pitch + (e.clientY - this._ly) * 0.004));
      this._lx = e.clientX; this._ly = e.clientY;
    });
    dom.addEventListener('wheel', (e) => {
      this.dist = Math.max(5, Math.min(13, this.dist + Math.sign(e.deltaY) * 1.2));
    }, { passive: true });
  }
  isDown(code) { return this.keys.has(code); }
  consumePress(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  axis(neg, pos) { return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0); }
  endFrame() { this.pressed.clear(); }
}
