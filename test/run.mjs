// Bundles the pure module and checks it. Run: npm test
import esbuild from "esbuild";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

fs.mkdirSync("test/.build", { recursive: true });
await esbuild.build({ entryPoints: ["src/palettes.ts"], bundle: true, format: "cjs", platform: "node", outfile: "test/.build/palettes.cjs", logLevel: "silent" });
const P = createRequire(import.meta.url)("./.build/palettes.cjs");

for (const hex of ["#161a1f", "#ff2a6d", "#000000", "#ffffff", "#0d1b2a", "#7fc99a"]) assert.equal(P.hsvToHex(P.hexToHsv(hex)), hex, hex);
assert.equal(P.normalizeHex("ABC"), "#aabbcc");
assert.equal(P.normalizeHex("#12345g"), null);
const navy = P.BUILTINS.find((p) => p.id === "navy");
assert.equal(P.colorOf(navy, "sidebar"), "#0d1b2a", "sidebar follows editor background");
assert.match(P.paletteCss(navy), /--pz-sidebar: #0d1b2a;/);
assert.equal(P.paletteCss(navy).match(/--pz-/g).length, P.COLORS.length);
for (const p of P.BUILTINS) for (const c of P.COLORS) assert.ok(P.normalizeHex(P.colorOf(p, c.key)), `${p.id} ${c.key}`);
assert.equal(P.uniqueName("My Navy", ["My Navy", "My Navy 2"]), "My Navy 3");
console.log("palettes: all checks passed");
