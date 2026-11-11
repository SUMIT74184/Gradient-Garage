// Converts src/data/*.ts into api/seed/*.json so the API can seed Postgres with
// the content the site shows today. Run: node scripts/export-seed.mjs
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const FILES = {
  models: ["src/data/models.ts", "localModels"],
  datasets: ["src/data/datasets.ts", "localDatasets"],
  demos: ["src/data/demos.ts", "localDemos"],
  libraries: ["src/data/libraries.ts", "localLibraries"],
};

const web = new URL("..", import.meta.url).pathname;
const out = join(web, "..", "api", "seed");
const tmp = await mkdtemp(join(tmpdir(), "gg-seed-"));
try {
  for (const [name, [file, exportName]] of Object.entries(FILES)) {
    const source = await readFile(join(web, file), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    const js = join(tmp, `${name}.mjs`);
    await writeFile(js, outputText);
    const mod = await import(pathToFileURL(js).href);
    const rows = mod[exportName];
    if (!Array.isArray(rows)) throw new Error(`${file} has no array export ${exportName}`);
    await writeFile(join(out, `${name}.json`), JSON.stringify(rows, null, 2) + "\n");
    console.log(`${name}: ${rows.length}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
