import { App, Notice, Plugin, PluginSettingTab, Setting, setIcon } from "obsidian";
import { BUILTINS, COLORS, FOLLOWS, Palette, colorOf, paletteCss, uniqueName } from "./palettes";
import { cancelOpenPicker, openPicker } from "./picker";

interface Data {
  /** Id of the palette in use. */
  active: string;
  /** Your own palettes (the built-ins aren't stored). */
  palettes: Palette[];
}

const DEFAULT_DATA: Data = { active: "pizdec", palettes: [] };
const STYLE_ID = "pizdec-palettes";
const GLOW_CLASS = "pz-glow";

export default class PizdecPalettes extends Plugin {
  data: Data = { ...DEFAULT_DATA, palettes: [] };
  /** Colour being tried in the picker, shown before it's saved. */
  private preview: { key: string; hex: string } | null = null;
  /** Every window we style: the main one plus popouts (incl. a separate Settings window). */
  private docs = new Set<Document>();

  async onload() {
    const saved = (await this.loadData()) as Partial<Data> | null;
    this.data = { ...DEFAULT_DATA, ...saved, palettes: saved?.palettes ?? [] };
    if (!this.find(this.data.active)) this.data.active = "pizdec";

    this.addDoc(document);
    this.registerEvent(this.app.workspace.on("window-open", (_w, win) => this.addDoc(win.document)));
    this.addSettingTab(new PalettesTab(this.app, this));
    this.addCommand({
      id: "next-palette",
      name: "Switch to the next palette",
      callback: () => {
        const all = this.all();
        const i = all.findIndex((p) => p.id === this.data.active);
        const next = all[(i + 1) % all.length];
        void this.activate(next.id);
        new Notice(`Palette: ${next.name}`);
      },
    });
  }

  onunload() {
    cancelOpenPicker();
    for (const doc of this.docs) {
      doc.getElementById(STYLE_ID)?.remove();
      doc.body?.removeClass(GLOW_CLASS);
    }
  }

  all(): Palette[] {
    return [...BUILTINS, ...this.data.palettes];
  }

  find(id: string): Palette | undefined {
    return this.all().find((p) => p.id === id);
  }

  active(): Palette {
    return this.find(this.data.active) ?? BUILTINS[0];
  }

  /** Start styling a window's document (safe to call repeatedly). */
  addDoc(doc: Document) {
    this.docs.add(doc);
    this.apply();
  }

  /** Write the active palette (plus any live preview) into every window. */
  apply() {
    const base = this.active();
    const p = this.preview ? { ...base, colors: { ...base.colors, [this.preview.key]: this.preview.hex } } : base;
    const css = paletteCss(p);
    for (const doc of [...this.docs]) {
      if (!doc.defaultView || doc.defaultView.closed) {
        this.docs.delete(doc);
        continue;
      }
      let style = doc.getElementById(STYLE_ID);
      if (!style) {
        style = doc.createElement("style");
        style.id = STYLE_ID;
        doc.head.appendChild(style);
      }
      if (style.textContent !== css) style.textContent = css;
      doc.body.toggleClass(GLOW_CLASS, p.glow);
    }
  }

  setPreview(key: string, hex: string | null) {
    this.preview = hex ? { key, hex } : null;
    this.apply();
  }

  async save() {
    await this.saveData(this.data);
    this.apply();
  }

  async activate(id: string) {
    this.data.active = id;
    await this.save();
  }

  /** A new palette copied from `from`, made active. */
  async create(from: Palette): Promise<Palette> {
    const p: Palette = {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: uniqueName(from.builtin ? `My ${from.name}` : `${from.name} copy`, this.all().map((x) => x.name)),
      glow: from.glow,
      colors: { ...from.colors },
    };
    this.data.palettes.push(p);
    this.data.active = p.id;
    await this.save();
    return p;
  }

  async remove(id: string) {
    this.data.palettes = this.data.palettes.filter((p) => p.id !== id);
    if (this.data.active === id) this.data.active = "pizdec";
    await this.save();
  }
}

class PalettesTab extends PluginSettingTab {
  private confirmDelete = false;

  constructor(app: App, private plugin: PizdecPalettes) {
    super(app, plugin);
  }

  hide() {
    cancelOpenPicker();
    this.confirmDelete = false;
  }

  display() {
    const { containerEl: el, plugin } = this;
    plugin.addDoc(el.ownerDocument); // Settings may be in its own window
    el.empty();
    el.addClass("pzp-settings");
    const active = plugin.active();

    new Setting(el)
      .setName("Palette")
      .setDesc("The colours Pizdec Dark uses. New palette starts as a copy of the one shown.")
      .addDropdown((d) => {
        const builtins = d.selectEl.createEl("optgroup", { attr: { label: "Built-in" } });
        for (const p of BUILTINS) builtins.createEl("option", { value: p.id, text: p.name });
        if (plugin.data.palettes.length) {
          const mine = d.selectEl.createEl("optgroup", { attr: { label: "Yours" } });
          for (const p of plugin.data.palettes) mine.createEl("option", { value: p.id, text: p.name });
        }
        d.setValue(active.id).onChange(async (id) => {
          this.confirmDelete = false;
          await plugin.activate(id);
          this.display();
        });
      })
      .addButton((b) =>
        b.setButtonText("New palette").setCta().onClick(async () => {
          const p = await plugin.create(active);
          this.display();
          new Notice(`Created “${p.name}”. Rename it and change any colour.`);
          window.setTimeout(() => (el.querySelector(".pzp-name input") as HTMLInputElement | null)?.select(), 0);
        }),
      );

    if (active.builtin) {
      el.createDiv({
        cls: "pzp-note",
        text: "Built-in palettes can't be changed. Click New palette to make your own copy, then edit any colour.",
      });
    } else {
      new Setting(el)
        .setName("Name")
        .setClass("pzp-name")
        .addText((t) =>
          t.setValue(active.name).onChange(async (v) => {
            active.name = v.trim() || "Untitled palette";
            await plugin.save();
            const opt = el.querySelector(`option[value="${active.id}"]`);
            if (opt) opt.textContent = active.name;
          }),
        )
        .addButton((b) => {
          b.setButtonText(this.confirmDelete ? "Click again to delete" : "Delete")
            .setWarning()
            .onClick(async () => {
              if (!this.confirmDelete) {
                this.confirmDelete = true;
                this.display();
                return;
              }
              this.confirmDelete = false;
              await plugin.remove(active.id);
              new Notice(`Deleted “${active.name}”.`);
              this.display();
            });
        });
      new Setting(el)
        .setName("Neon glow on headings")
        .setDesc("A soft glow in the mid accent on headings and the note title.")
        .addToggle((t) =>
          t.setValue(active.glow).onChange(async (v) => {
            active.glow = v;
            await plugin.save();
          }),
        );
    }

    let group = "";
    for (const c of COLORS) {
      if (c.group !== group) {
        group = c.group;
        new Setting(el).setName(group).setHeading();
      }
      const source = FOLLOWS[c.key] ? COLORS.find((x) => x.key === FOLLOWS[c.key]) : undefined;
      const following = !!source && !active.colors[c.key];
      const s = new Setting(el).setName(c.label);
      const desc = following ? `${c.desc ?? ""} Follows ${source!.label}.`.trim() : c.desc;
      if (desc) s.setDesc(desc);
      if (source && !following && !active.builtin) {
        s.addExtraButton((b) =>
          b.setIcon("link").setTooltip(`Follow ${source.label} again`).onClick(async () => {
            delete active.colors[c.key];
            await plugin.save();
            this.display();
          }),
        );
      }
      const swatch = s.controlEl.createEl("button", { cls: "pzp-swatch" });
      const paint = (hex: string) => {
        swatch.style.setProperty("--pzp-color", hex);
        swatch.setAttr("aria-label", hex);
        label.setText(hex);
      };
      const label = swatch.createSpan({ cls: "pzp-swatch-hex" });
      swatch.createSpan({ cls: "pzp-swatch-chip" });
      paint(colorOf(active, c.key));
      if (active.builtin) {
        swatch.addClass("is-locked");
        swatch.addEventListener("click", () => new Notice("Built-in palette — click New palette to edit a copy."));
        continue;
      }
      swatch.addEventListener("click", () => {
        const before = colorOf(active, c.key);
        swatch.addClass("is-picking");
        openPicker({
          app: this.app,
          anchor: swatch,
          title: c.label,
          initial: before,
          onInput: (hex) => {
            plugin.setPreview(c.key, hex);
            paint(hex);
          },
          onSave: async (hex) => {
            swatch.removeClass("is-picking");
            active.colors[c.key] = hex;
            plugin.setPreview(c.key, null);
            await plugin.save();
            if (Object.values(FOLLOWS).includes(c.key) || FOLLOWS[c.key]) this.display(); // a follower may change
            else paint(hex);
          },
          onCancel: () => {
            swatch.removeClass("is-picking");
            plugin.setPreview(c.key, null);
            paint(before);
          },
        });
      });
    }

    const foot = el.createDiv({ cls: "pzp-note" });
    foot.appendText("The main accent (links, tags, buttons, selection) is Obsidian's own ");
    foot.createEl("strong", { text: "Settings → Appearance → Accent color" });
    foot.appendText(". These palettes override the theme's Style Settings colours.");
    const icon = foot.createSpan({ cls: "pzp-note-icon" });
    setIcon(icon, "info");
    foot.prepend(icon);
  }
}
