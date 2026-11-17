/**
 * Touch controls for phones/tablets.
 *
 * Only instantiated when DEVICE.isMobile, so desktop players keep exactly the
 * keyboard/mouse setup they had. Rather than teaching every game system about
 * touch, this dispatches the same keyboard and mouse events the game already
 * listens for, plus two direct camera/stick hooks for analogue movement and
 * looking (pointer lock, which desktop uses for looking, doesn't exist on iOS).
 *
 * Layout: thumbstick bottom-left, action buttons bottom-right, and the whole
 * background acts as the drag-to-look surface.
 */

export interface TouchControlCallbacks {
  /** Analogue movement, -1..1. x = right, y = screen-down. */
  onMove(x: number, y: number): void;
  /** Look drag in pixels. */
  onLook(dx: number, dy: number): void;
}

const STYLE_ID = 'fr-touch-controls-style';

const STYLE = `
.fr-touch-root {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.fr-touch-look {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  touch-action: none;
}
.fr-touch-stick {
  position: absolute;
  left: max(16px, env(safe-area-inset-left));
  bottom: max(20px, env(safe-area-inset-bottom));
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: rgba(12, 12, 16, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.22);
  pointer-events: auto;
  touch-action: none;
  display: grid;
  place-items: center;
}
.fr-touch-knob {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: rgba(232, 197, 71, 0.85);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.45);
  will-change: transform;
}
.fr-touch-buttons {
  position: absolute;
  right: max(14px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: repeat(2, 62px);
  gap: 9px;
  pointer-events: none;
}
.fr-touch-buttons button {
  pointer-events: auto;
  touch-action: none;
  width: 62px;
  height: 62px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(12, 12, 16, 0.5);
  color: #f4f4f4;
  font: 600 13px/1.15 system-ui, -apple-system, sans-serif;
  padding: 0 4px;
}
.fr-touch-buttons button.fr-touch-wide {
  grid-column: span 2;
  width: 100%;
  height: 54px;
}
.fr-touch-buttons button.fr-touch-active {
  background: rgba(232, 197, 71, 0.88);
  color: #16161a;
  border-color: rgba(255, 255, 255, 0.5);
}
`;

export class TouchControls {
  private root: HTMLDivElement;
  private lookSurface: HTMLDivElement;
  private stick: HTMLDivElement;
  private knob: HTMLDivElement;
  private sprintButton: HTMLButtonElement;

  private lookPointerId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;

  private stickPointerId: number | null = null;
  private stickCentreX = 0;
  private stickCentreY = 0;
  private readonly stickRadius = 46;

  private using = false;
  private sprinting = false;

  private readonly callbacks: TouchControlCallbacks;

  constructor(callbacks: TouchControlCallbacks) {
    this.callbacks = callbacks;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    this.root = document.createElement('div');
    this.root.className = 'fr-touch-root';
    this.root.setAttribute('data-touch-controls', '');

    this.lookSurface = document.createElement('div');
    this.lookSurface.className = 'fr-touch-look';

    this.stick = document.createElement('div');
    this.stick.className = 'fr-touch-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'fr-touch-knob';
    this.stick.appendChild(this.knob);

    const buttons = document.createElement('div');
    buttons.className = 'fr-touch-buttons';

    const useButton = this.makeButton('Use / Clean', 'fr-touch-wide');
    useButton.dataset['action'] = 'use';

    this.sprintButton = this.makeButton('Run');

    const interactButton = this.makeButton('Interact');
    interactButton.dataset['action'] = 'interact';

    const jobsButton = this.makeButton('Jobs');
    jobsButton.dataset['action'] = 'jobs';

    const toolsButton = this.makeButton('Tools');
    toolsButton.dataset['action'] = 'tools';

    const cancelButton = this.makeButton('Cancel', 'fr-touch-wide');
    cancelButton.dataset['action'] = 'cancel';

    buttons.append(useButton, this.sprintButton, interactButton, jobsButton, toolsButton, cancelButton);

    this.root.append(this.lookSurface, this.stick, buttons);
    document.body.appendChild(this.root);

    this.bindLook();
    this.bindStick();
    this.bindButton(useButton, () => this.startUse(), () => this.stopUse());
    this.bindButton(this.sprintButton, () => this.toggleSprint(), null);
    this.bindButton(interactButton, () => this.tapKey('KeyE', 'e'), null);
    this.bindButton(jobsButton, () => this.tapKey('KeyJ', 'j'), null);
    this.bindButton(toolsButton, () => this.tapKey('KeyQ', 'q'), null);
    this.bindButton(cancelButton, () => this.tapKey('Escape', 'Escape'), null);
  }

  dispose(): void {
    this.stopUse();
    if (this.sprinting) this.toggleSprint();
    this.root.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  // ---------------------------------------------------------------- building blocks

  private makeButton(label: string, extraClass?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (extraClass) button.classList.add(extraClass);
    return button;
  }

  private bindButton(
    button: HTMLButtonElement,
    onPress: () => void,
    onRelease: (() => void) | null
  ): void {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.add('fr-touch-active');
      onPress();
    });

    const release = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      if (onRelease) {
        onRelease();
        button.classList.remove('fr-touch-active');
      }
    };

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', event => {
      if (onRelease && this.using) release(event);
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  // ---------------------------------------------------------------- look

  private bindLook(): void {
    this.lookSurface.addEventListener('pointerdown', event => {
      if (this.lookPointerId !== null) return;
      this.lookPointerId = event.pointerId;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      this.capturePointer(this.lookSurface, event.pointerId);
      event.preventDefault();
    });

    this.lookSurface.addEventListener('pointermove', event => {
      if (event.pointerId !== this.lookPointerId) return;
      const dx = event.clientX - this.lookLastX;
      const dy = event.clientY - this.lookLastY;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      if (dx !== 0 || dy !== 0) this.callbacks.onLook(dx, dy);
      event.preventDefault();
    });

    const endLook = (event: PointerEvent): void => {
      if (event.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
      event.preventDefault();
    };
    this.lookSurface.addEventListener('pointerup', endLook);
    this.lookSurface.addEventListener('pointercancel', endLook);
  }

  // ---------------------------------------------------------------- movement stick

  private bindStick(): void {
    this.stick.addEventListener('pointerdown', event => {
      if (this.stickPointerId !== null) return;
      this.stickPointerId = event.pointerId;
      const rect = this.stick.getBoundingClientRect();
      this.stickCentreX = rect.left + rect.width / 2;
      this.stickCentreY = rect.top + rect.height / 2;
      this.capturePointer(this.stick, event.pointerId);
      this.updateStick(event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    });

    this.stick.addEventListener('pointermove', event => {
      if (event.pointerId !== this.stickPointerId) return;
      this.updateStick(event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    });

    const endStick = (event: PointerEvent): void => {
      if (event.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.callbacks.onMove(0, 0);
      event.preventDefault();
      event.stopPropagation();
    };
    this.stick.addEventListener('pointerup', endStick);
    this.stick.addEventListener('pointercancel', endStick);
  }

  /** Pointer capture keeps a drag alive if the finger slides off the element. */
  private capturePointer(element: Element, pointerId: number): void {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Capture is best-effort; dragging still works without it.
    }
  }

  private updateStick(clientX: number, clientY: number): void {
    let dx = clientX - this.stickCentreX;
    let dy = clientY - this.stickCentreY;

    const distance = Math.hypot(dx, dy);
    if (distance > this.stickRadius) {
      const scale = this.stickRadius / distance;
      dx *= scale;
      dy *= scale;
    }

    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.callbacks.onMove(dx / this.stickRadius, dy / this.stickRadius);
  }

  // ---------------------------------------------------------------- synthetic input

  private getCanvas(): HTMLCanvasElement | null {
    return document.querySelector<HTMLCanvasElement>('#app canvas');
  }

  private centre(): { x: number; y: number } {
    return { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
  }

  /**
   * Holds the "left mouse button" down at the crosshair, which is how desktop
   * scrubs stains and picks up rubbish.
   */
  private startUse(): void {
    const canvas = this.getCanvas();
    if (!canvas || this.using) return;
    const { x, y } = this.centre();
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true, cancelable: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: x,
        clientY: y,
        button: 0,
        buttons: 1,
        bubbles: true,
        cancelable: true,
      })
    );
    this.using = true;
  }

  private stopUse(): void {
    if (!this.using) return;
    const canvas = this.getCanvas();
    if (canvas) {
      const { x, y } = this.centre();
      canvas.dispatchEvent(
        new MouseEvent('mouseup', {
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 0,
          bubbles: true,
          cancelable: true,
        })
      );
    }
    this.using = false;
  }

  private tapKey(code: string, key: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
    window.setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
    }, 90);
  }

  private toggleSprint(): void {
    this.sprinting = !this.sprinting;
    window.dispatchEvent(
      new KeyboardEvent(this.sprinting ? 'keydown' : 'keyup', {
        code: 'ShiftLeft',
        key: 'Shift',
        bubbles: true,
      })
    );
    this.sprintButton.classList.toggle('fr-touch-active', this.sprinting);
  }
}
