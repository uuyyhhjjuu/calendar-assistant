import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "public", "ocr");
await mkdir(output, { recursive: true });

const core = join(root, "node_modules", "tesseract.js-core");
const variants = (await readdir(core)).filter((name) => name.endsWith(".wasm.js"));
if (variants.length < 4) throw new Error("OCR WASM package is incomplete. Run npm install first.");
const assets = [
  [join(root, "node_modules", "tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  ...variants.map((name) => [join(core, name), name]),
  ...["chi_sim", "eng"].map((language) => [
    join(root, "node_modules", "@tesseract.js-data", language, "4.0.0_best_int", `${language}.traineddata.gz`),
    `${language}.traineddata.gz`,
  ]),
  [join(root, "node_modules", "tesseract.js", "LICENSE.md"), "TESSERACT-LICENSE.md"],
  [join(core, "LICENSE"), "CORE-LICENSE.txt"],
];
for (const [source, name] of assets) {
  if ((await stat(source)).size === 0) throw new Error(`OCR asset is empty: ${name}`);
  await copyFile(source, join(output, name));
}
await writeFile(join(output, "NOTICE.txt"), "Tesseract.js and Tesseract.js-core: Apache-2.0, https://github.com/naptha/tesseract.js\nLanguage data packages: MIT, https://github.com/naptha/tessdata\nImages are processed in the browser; these are public engine/model assets only.\n");
console.log(`Prepared ${assets.length} self-hosted OCR assets (no runtime CDN).`);
