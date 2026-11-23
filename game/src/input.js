// Keyboard and mouse input for Velora Bay. Held keys live in a Set the world reads every step;
// one-shot presses are queued so a tap between two frames is never lost; the mouse position and
// its buttons are tracked in window pixels and the renderer turns them into world coordinates.

export function createInput(canvas) {
  const held = new Set();
  const pressedQueue = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false, rightDown: false };
  /** Latched toggles flipped by a single key press (not held): L flips the headlights. */
  const toggles = { headlights: true };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      pressedQueue.add(event.code);
      if (event.code === 'KeyL') toggles.headlights = !toggles.headlights;
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (event.button === 0) {
      mouse.down = true;
      mouse.pressed = true;
    }
    if (event.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    toggles,
    down(code) {
      return held.has(code);
    },
    /** True once per physical press; calling this consumes the press. */
    pressed(code) {
      if (!pressedQueue.has(code)) return false;
      pressedQueue.delete(code);
      return true;
    },
    /** Consume a mouse click (left button press edge). */
    takeClick() {
      const was = mouse.pressed;
      mouse.pressed = false;
      return was;
    },
    /** Drop every queued press: called when a menu, dialogue or shop opens, so a key tapped
     *  during play (a stride on WASD, a stray Enter) does not leak into the new screen. */
    flush() {
      pressedQueue.clear();
      mouse.pressed = false;
    },
    /** Movement axes from WASD / arrows: x right, y down, each -1..1. */
    moveAxes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
  };
}
