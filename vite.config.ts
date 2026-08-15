import {defineConfig} from "vite";
import {resolve} from "node:path";

export default defineConfig({
    build: {
        target: "es2022",
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            // SiYuan's plugin loader follows the official plugin-sample and
            // instantiates the bundle through CommonJS (`module.exports`).
            formats: ["cjs"],
            fileName: () => "index.js",
            cssFileName: "index",
        },
        rollupOptions: {
            external: ["siyuan"],
        },
        sourcemap: false,
    },
});
