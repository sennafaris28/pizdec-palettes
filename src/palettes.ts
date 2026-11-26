// Palettes — the pure parts (colour list, built-in presets, CSS, colour maths),
// kept free of Obsidian so the tests can load them.

export interface ColorDef {
  /** CSS variable name without the leading "--pz-". */
  key: string;
  label: string;
  desc?: string;
  group: "Surfaces" | "Text" | "Accents" | "Code highlighting";
}

/** Every colour Pizdec Dark builds on, in the order the settings show them. */
export const COLORS: ColorDef[] = [
  { key: "bg-0", label: "Editor background", desc: "Main background: editor, title bar, board, settings nav.", group: "Surfaces" },
  { key: "sidebar", label: "Sidebars", desc: "Left/right sidebars and the ribbon.", group: "Surfaces" },
  { key: "bg-1", label: "Raised base", desc: "Code blocks, inputs, alternating table rows.", group: "Surfaces" },
  { key: "bg-2", label: "Panels", desc: "Modals, status bar, settings content, table headers, board columns.", group: "Surfaces" },
  { key: "bg-3", label: "Panels — hover", desc: "Hovered buttons, setting cards.", group: "Surfaces" },
  { key: "line", label: "Cards & dividers", desc: "Board cards and fields, --- dividers, table borders, hover tint.", group: "Surfaces" },
  { key: "line-strong", label: "Cards — hover", group: "Surfaces" },
  { key: "text", label: "Text", group: "Text" },
  { key: "text-muted", label: "Muted text", group: "Text" },
  { key: "text-faint", label: "Faint text", desc: "Placeholders, code comments.", group: "Text" },
  { key: "accent-mid", label: "Mid accent", desc: "Inline code, checkboxes, scrollbars.", group: "Accents" },
  { key: "accent-2", label: "Pop accent", desc: "Caret, ==highlights==, NoteBoard today marker.", group: "Accents" },
  { key: "unresolved", label: "Unresolved links", desc: "Links to notes that don't exist yet.", group: "Accents" },
  { key: "glow", label: "Heading glow", desc: "Colour of the neon glow, when the palette has it on.", group: "Accents" },
  { key: "code-function", label: "Functions", group: "Code highlighting" },
  { key: "code-keyword", label: "Keywords", group: "Code highlighting" },
  { key: "code-string", label: "Strings", group: "Code highlighting" },
  { key: "code-value", label: "Numbers & values", group: "Code highlighting" },
];

/** Colours that follow another one until you set them (colour key → the one it follows). */
export const FOLLOWS: Record<string, string> = { sidebar: "bg-0", glow: "accent-mid" };

/** Colour key → hex. Keys in FOLLOWS may be missing: then they follow their source. */
export type Colors = Record<string, string>;

export interface Palette {
  id: string;
  name: string;
  /** Soft neon glow on headings. */
  glow: boolean;
  colors: Colors;
  /** Shipped with the plugin, can't be edited or deleted. */
  builtin?: boolean;
}

const PIZDEC: Colors = {
  "bg-0": "#161a1f", "bg-1": "#1b1e22", "bg-2": "#212427", "bg-3": "#2b2f32",
  line: "#414a4c", "line-strong": "#4b5558",
  text: "#d6dce2", "text-muted": "#98a1a8", "text-faint": "#646d74",
  "accent-mid": "#3bb8e2", "accent-2": "#59e7df", unresolved: "#c97a7a",
  "code-function": "#74b8f5", "code-keyword": "#e5739a", "code-string": "#7fc99a", "code-value": "#d9a066",
};

export const BUILTINS: Palette[] = [
  { id: "pizdec", name: "Pizdec", glow: false, builtin: true, colors: { ...PIZDEC } },
  {
    id: "navy", name: "Navy", glow: false, builtin: true,
    colors: { ...PIZDEC, "bg-0": "#0d1b2a", "accent-2": "#ff00ff", "code-keyword": "#ffcc00" },
  },
  {
    // Neon: violet-black night, cyan + hot pink, yellow strings, cyan glow.
    id: "cyberpunk", name: "Cyberpunk", glow: true, builtin: true,
    colors: {
      "bg-0": "#0b0b14", sidebar: "#08080f", "bg-1": "#11111e", "bg-2": "#161628", "bg-3": "#1f1f38",
      line: "#2e2e52", "line-strong": "#3a3a66",
      text: "#e0e6ff", "text-muted": "#9a9cc8", "text-faint": "#5c5f8a",
      "accent-mid": "#05d9e8", "accent-2": "#ff2a6d", unresolved: "#ff7a59",
      "code-function": "#05d9e8", "code-keyword": "#ff2a6d", "code-string": "#fcee0a", "code-value": "#b967ff",
    },
  },
];

/** The colour actually used for `key` (Sidebars falls back to Editor background). */
export function colorOf(p: Palette, key: string): string {
  return p.colors[key] ?? (FOLLOWS[key] ? colorOf(p, FOLLOWS[key]) : PIZDEC[key] ?? "#000000");
}

/**
 * The stylesheet for a palette. `html body.theme-dark` outranks the theme's own
 * defaults, its Style Settings palettes and Style Settings' pickers.
 */
export function paletteCss(p: Palette): string {
  const lines = COLORS.map((c) => `  --pz-${c.key}: ${colorOf(p, c.key)};`);
  return `html body.theme-dark {\n${lines.join("\n")}\n}\n`;
}

/** A name not used yet: "New palette", "New palette 2", … */
export function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base} ${n}`)) return `${base} ${n}`;
}

// ---- colour maths -------------------------------------------------------

/** "#abc" / "abc" / "#aabbcc" → "#aabbcc", or null if it isn't a hex colour. */
export function normalizeHex(s: string): string | null {
  let h = s.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? "#" + h : null;
}

export interface HSV { h: number; s: number; v: number } // h 0–360, s/v 0–1

export function hexToHsv(hex: string): HSV {
  const n = parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: HSV): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
