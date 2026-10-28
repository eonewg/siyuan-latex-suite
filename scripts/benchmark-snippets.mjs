import {build} from "esbuild";

// Uses the existing build toolchain; this measures the matching engine, not SiYuan UI latency.
const source = `
import {SnippetEngine} from './src/core/snippet-engine';
import {parseSnippets} from './src/core/snippet-parser';
import {BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE} from './src/bundled-snippets-source';
const snippets = parseSnippets(BUNDLED_SNIPPETS_SOURCE, BUNDLED_SNIPPET_VARIABLES_SOURCE);
const engine = new SnippetEngine();
const value = 'x+y+'.repeat(50) + 'xsr';
for (let i = 0; i < 200; i++) engine.find(value, value.length, 'block', 'auto', snippets);
const runs = [];
for (let round = 0; round < 5; round++) {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) engine.find(value, value.length, 'block', 'auto', snippets);
    runs.push(performance.now() - start);
}
const medianMs = [...runs].sort((a,b) => a-b)[2];
console.log(JSON.stringify({node: process.version, rules: snippets.length, formulaLength: value.length,
    iterations: 1000, medianMs, runs}, null, 2));
`;
const result = await build({stdin: {contents: source, resolveDir: process.cwd(), loader: "ts"},
    bundle: true, platform: "node", format: "esm", write: false});
await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
