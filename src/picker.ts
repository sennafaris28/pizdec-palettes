// The colour picker popover: saturation/brightness square, hue bar, hex field,
// Save / Cancel. Dragging uses pointer capture on the element itself, so it
// works in any window (Obsidian can open Settings in a separate window).

import { App, Scope } from "obsidian";
import { hexToHsv, hsvToHex, normalizeHex, HSV } from "./palettes";

export interface PickerOptions {
  app: App;
  anchor: HTMLElement;
  title: string;
  initial: string;
  /** Every change while picking (live preview). */
  onInput: (hex: string) => void;
  /** Save pressed (or Enter). */
  onSave: (hex: string) => void;
  /** Cancel, Esc, clicking away or the settings closing: put the old colour back. */
  onCancel: () => void;
}

let current: ColorPicker | null = null;

/** Open a picker (closing, i.e. cancelling, any other one first). */
export function openPicker(opts: PickerOptions): ColorPicker {
  current?.cancel();
  current = new ColorPicker(opts);
  return current;
}

/** Cancel the open picker, if any (e.g. when the settings tab closes). */
export function cancelOpenPicker(): void {
  current?.cancel();
}

export class ColorPicker {
  private el: HTMLElement;
  private hsv: HSV;
  private hex: string;
  private done = false;
  private scope: Scope;
  private area!: HTMLElement;
  private areaKnob!: HTMLElement;
  private hue!: HTMLElement;
  private hueKnob!: HTMLElement;
  private input!: HTMLInputElement;
  private newSwatch!: HTMLElement;
  private onOutside = (e: PointerEvent) => {
    if (!this.el.contains(e.target as Node)) this.cancel();
  };

  constructor(private o: PickerOptions) {
    this.hex = normalizeHex(o.initial) ?? "#000000";
    this.hsv = hexToHsv(this.hex);
    const doc = o.anchor.ownerDocument;
    // Inside a modal (Settings) the popover must live in it, or the modal pulls focus back.
    const host = (o.anchor.closest(".modal") as HTMLElement | null) ?? doc.body;
    this.el = host.createDiv({ cls: "pzp-picker" });
    this.build();
    this.position();
    this.render(false);

    this.scope = new Scope(o.app.scope);
    this.scope.register([], "Escape", () => { this.cancel(); return false; });
    this.scope.register([], "Enter", () => { this.save(); return false; });
    o.app.keymap.pushScope(this.scope);
    // Next tick, so the click that opened the picker doesn't close it.
    window.setTimeout(() => !this.done && doc.addEventListener("pointerdown", this.onOutside, true), 0);
    window.setTimeout(() => this.input.select(), 0);
  }

  private build() {
    this.el.createDiv({ cls: "pzp-title", text: this.o.title });
    this.area = this.el.createDiv({ cls: "pzp-area" });
    this.area.createDiv({ cls: "pzp-area-white" });
    this.area.createDiv({ cls: "pzp-area-black" });
    this.areaKnob = this.area.createDiv({ cls: "pzp-knob" });
    this.hue = this.el.createDiv({ cls: "pzp-hue" });
    this.hueKnob = this.hue.createDiv({ cls: "pzp-knob" });

    drag(this.area, (x, y) => {
      this.hsv = { ...this.hsv, s: x, v: 1 - y };
      this.render(true);
    });
    drag(this.hue, (x) => {
      this.hsv = { ...this.hsv, h: Math.min(x * 360, 359.9) };
      this.render(true);
    });

    const row = this.el.createDiv({ cls: "pzp-row" });
    const swatches = row.createDiv({ cls: "pzp-compare" });
    const old = swatches.createDiv({ cls: "pzp-old", attr: { "aria-label": "Previous colour — click to go back to it" } });
    old.style.background = this.hex;
    old.addEventListener("click", () => this.set(this.o.initial));
    this.newSwatch = swatches.createDiv({ cls: "pzp-new" });
    this.input = row.createEl("input", { cls: "pzp-hex", attr: { type: "text", spellcheck: "false", maxlength: "7" } });
    this.input.addEventListener("input", () => {
      const h = normalizeHex(this.input.value);
      if (h) {
        this.hsv = hexToHsv(h);
        this.hex = h;
        this.render(false, true);
        this.o.onInput(h);
      }
      this.input.toggleClass("is-invalid", !h);
    });

    const buttons = this.el.createDiv({ cls: "pzp-buttons" });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.cancel());
    buttons.createEl("button", { cls: "mod-cta", text: "Save" }).addEventListener("click", () => this.save());
  }

  private set(hex: string) {
    const h = normalizeHex(hex);
    if (!h) return;
    this.hsv = hexToHsv(h);
    this.render(true);
  }

  /** Redraw from this.hsv; `emit` sends the colour to the live preview. */
  private render(emit: boolean, keepInput = false) {
    const { h, s, v } = this.hsv;
    if (emit) this.hex = hsvToHex(this.hsv);
    this.area.style.background = `hsl(${h}, 100%, 50%)`;
    this.areaKnob.style.left = `${s * 100}%`;
    this.areaKnob.style.top = `${(1 - v) * 100}%`;
    this.areaKnob.style.background = this.hex;
    this.hueKnob.style.left = `${(h / 360) * 100}%`;
    this.hueKnob.style.background = `hsl(${h}, 100%, 50%)`;
    this.newSwatch.style.background = this.hex;
    if (!keepInput) {
      this.input.value = this.hex;
      this.input.removeClass("is-invalid");
    }
    if (emit) this.o.onInput(this.hex);
  }

  /** Next to the anchor, kept inside the window. */
  private position() {
    const win = this.o.anchor.ownerDocument.defaultView ?? window;
    const a = this.o.anchor.getBoundingClientRect();
    const w = 260, hgt = this.el.offsetHeight || 330, pad = 8;
    let left = a.left - w - 12;
    if (left < pad) left = Math.min(a.right + 12, win.innerWidth - w - pad);
    let top = a.top + a.height / 2 - hgt / 2;
    top = Math.max(pad, Math.min(top, win.innerHeight - hgt - pad));
    this.el.style.left = `${Math.max(pad, left)}px`;
    this.el.style.top = `${top}px`;
  }

  save() {
    if (this.done) return;
    const h = normalizeHex(this.input.value) ?? this.hex;
    this.close();
    this.o.onSave(h);
  }

  cancel() {
    if (this.done) return;
    this.close();
    this.o.onCancel();
  }

  private close() {
    this.done = true;
    if (current === this) current = null;
    this.o.anchor.ownerDocument.removeEventListener("pointerdown", this.onOutside, true);
    this.o.app.keymap.popScope(this.scope);
    this.el.remove();
  }
}

/** Pointer dragging inside `el`, reporting x/y as 0–1 fractions of its size. */
function drag(el: HTMLElement, onMove: (x: number, y: number) => void) {
  const report = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onMove(x, y);
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    el.addClass("is-dragging");
    report(e);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (el.hasPointerCapture(e.pointerId)) report(e);
  });
  const stop = (e: PointerEvent) => {
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.removeClass("is-dragging");
  };
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
}
