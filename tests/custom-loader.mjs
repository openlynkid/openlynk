import path from "node:path";
import { pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  let target = specifier;
  if (target.startsWith("@/")) {
    const relative = target.slice(2);
    const resolvedPath = path.resolve(process.cwd(), "src", relative);
    target = pathToFileURL(resolvedPath).href;
  }

  try {
    return await nextResolve(target, context);
  } catch (err) {
    if (
      err.code === "ERR_MODULE_NOT_FOUND" ||
      err.code === "ERR_UNSUPPORTED_DIR_IMPORT"
    ) {
      const cleanTarget = target.replace(/\/$/, "");
      const candidates = [
        cleanTarget + ".js",
        cleanTarget + ".mjs",
        cleanTarget + ".ts",
        cleanTarget + ".tsx",
        cleanTarget + "/index.js",
        cleanTarget + "/index.ts",
        cleanTarget + "/index.tsx",
      ];
      for (const candidate of candidates) {
        try {
          return await nextResolve(candidate, context);
        } catch {}
      }
    }
    throw err;
  }
}
