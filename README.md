# Pizdec Palettes

Colour palettes for the [Pizdec Dark](https://github.com/sennafaris28/pizdec-dark) Obsidian theme.

- **Built-in palettes:** Pizdec, Navy and Cyberpunk.
- **Your own palettes:** **New palette** copies the one you're looking at. Name it, change any colour, and make as many as you like. Delete one with a double click on **Delete**.
- **A colour picker that behaves:**
  - Drag the square and the hue bar, or type a hex value.
  - The whole app recolours live while you pick.
  - **Save** keeps the colour. **Cancel**, **Esc** or clicking away puts the previous one back. Click the left half of the preview chip to go back to where you started.
  - Works when Obsidian opens Settings in its own window.
- **Neon glow** on headings, per palette, in a colour you pick (it follows Mid accent until you set it).
- Command **Switch to the next palette**, so you can bind a hotkey.

Open **Settings → Pizdec Palettes**. The main accent (links, tags, buttons, selection) stays Obsidian's own
**Settings → Appearance → Accent color**.

These palettes take priority over the theme's Style Settings colours. You don't need Style Settings with this plugin.

## Install

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/pizdec-palettes/`, then enable
**Pizdec Palettes** under **Settings → Community plugins**. You can also install it with BRAT.

## Develop

```bash
npm install
npm run build
npm test
```
