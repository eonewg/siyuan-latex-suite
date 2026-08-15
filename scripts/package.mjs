import archiver from "archiver";
import {createWriteStream} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = createWriteStream(resolve(root, "package.zip"));
const archive = archiver("zip", {zlib: {level: 9}});

archive.on("warning", (error) => {
    if (error.code !== "ENOENT") throw error;
});
archive.on("error", (error) => {
    throw error;
});
archive.pipe(output);
archive.directory(resolve(root, "dist"), false);
await archive.finalize();
