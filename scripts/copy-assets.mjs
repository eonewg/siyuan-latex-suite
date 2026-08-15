import {cpSync, existsSync, mkdirSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const assets = ["plugin.json", "README.md", "README_zh_CN.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "icon.png", "preview.png"];

mkdirSync(dist, {recursive: true});
for (const asset of assets) {
    const source = resolve(root, asset);
    if (existsSync(source)) cpSync(source, resolve(dist, asset));
}
cpSync(resolve(root, "i18n"), resolve(dist, "i18n"), {recursive: true});
