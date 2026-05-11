import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/** Resolves to "pnpm" if pnpm is on PATH, otherwise falls back to "npm". */
let _pkgManagerCache: string | null = null;
async function pkgManager(): Promise<string> {
  if (_pkgManagerCache) return _pkgManagerCache;
  const result = await new Promise<string>((resolve) => {
    execFile("pnpm", ["--version"], { timeout: 5000 }, (err) => {
      resolve(err ? "npm" : "pnpm");
    });
  });
  _pkgManagerCache = result;
  return result;
}

/**
 * Translate a pnpm-style command to npm-equivalent when npm is the package manager.
 * pnpm exec <bin> → npx <bin>, pnpm run <script> → npm run <script>, pnpm install → npm install
 */
function resolveCmd(pm: string, args: string[]): { cmd: string; args: string[] } {
  if (pm === "pnpm") return { cmd: "pnpm", args };
  if (args[0] === "exec") return { cmd: "npx", args: args.slice(1) };
  if (args[0] === "run") return { cmd: "npm", args };
  if (args[0] === "install") return { cmd: "npm", args };
  return { cmd: "npm", args };
}

export type PreviewArtifact = { path: string; content: string };

/**
 * HiveMind preview sets `VITE_API_URL` to `/preview/<session>/api` — the API root **already ends with `/api`**.
 * Generated code often uses `${VITE_API_URL}/api/...` → `/api/api/...`, upstream 500s, and `.map` crashes on non-arrays.
 */
export function sanitizeViteApiUrlDoubleApi(repoRelativePath: string, content: string): string {
  const p = repoRelativePath.replace(/\\/g, "/").toLowerCase();
  if (!p.startsWith("frontend/")) return content;
  if (!/\.(tsx|ts|jsx|js|html|vue|svelte)$/i.test(p)) return content;
  if (!content.includes("VITE_API_URL")) return content;
  let next = content;
  let prev = "";
  while (next !== prev) {
    prev = next;
    next = next.replace(
      /(\$\{\s*import\.meta\.env\.VITE_API_URL\s*\})\/+api\/+/gi,
      "$1/",
    );
    next = next.replace(
      /import\.meta\.env\.VITE_API_URL\s*\+\s*(["'])\/+api\/+/gi,
      "import.meta.env.VITE_API_URL + $1/",
    );
  }
  return next;
}

export type PreviewSession = {
  id: string;
  missionId: string;
  wallet: string;
  rootDir: string;
  frontendDistDir: string;
  frontendPort: number;
  backendPort: number;
  createdAt: number;
  procs: {
    backend?: ChildProcessWithoutNullStreams;
  };
  servers: {
    frontend?: ReturnType<typeof createServer>;
  };
};

function safeRelPath(p: string): string | null {
  const normalized = p.replace(/\\/g, "/").replace(/^\/+/, "");
  const segs = normalized.split("/").filter((s) => s.length > 0 && s !== ".");
  if (segs.some((s) => s === "..")) return null;
  if (segs.length === 0) return null;
  return segs.join("/");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile() || s.isDirectory();
  } catch {
    return false;
  }
}

function pickPort(): number {
  // Simple port picker (best-effort). For hackathon/local usage this is fine.
  return 20_000 + Math.floor(Math.random() * 20_000);
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function readJsonFile<T>(absPath: string): Promise<T | null> {
  try {
    const raw = await readFile(absPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type PkgJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** First semver major from strings like "^2.9.18", ">=5", "5.4.21". */
function viteMajorFromSpec(spec: string | undefined): number | null {
  if (!spec?.trim()) return null;
  const m = String(spec).trim().match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * LLMs often pin Vite 2/3 (`vite.createFilter` missing) while plugin-react resolves badly →
 * `TypeError: vite.createFilter is not a function`. Align to maintained Vite 5 + plugin-react 4 before install.
 */
async function normalizeLegacyViteFrontendPackageJson(
  frontendDir: string,
): Promise<{ upgraded: boolean }> {
  const pkgPath = path.join(frontendDir, "package.json");
  const pkg = await readJsonFile<PkgJson>(pkgPath);
  if (!pkg) return { upgraded: false };

  const viteFromDeps = pkg.dependencies?.vite;
  const viteFromDev = pkg.devDependencies?.vite;
  const viteSpec = viteFromDev ?? viteFromDeps;
  if (!viteSpec) return { upgraded: false };

  const major = viteMajorFromSpec(viteSpec);
  if (major === null || major >= 5) return { upgraded: false };

  pkg.dependencies = { ...(pkg.dependencies ?? {}) };
  pkg.devDependencies = { ...(pkg.devDependencies ?? {}) };
  if (pkg.dependencies.vite) delete pkg.dependencies.vite;

  pkg.devDependencies.vite = "^5.4.21";
  pkg.devDependencies["@vitejs/plugin-react"] = "^4.3.6";
  if (pkg.dependencies["@vitejs/plugin-react"]) delete pkg.dependencies["@vitejs/plugin-react"];
  if (pkg.devDependencies["@vitejs/plugin-react-swc"] ?? pkg.dependencies["@vitejs/plugin-react-swc"]) {
    pkg.devDependencies["@vitejs/plugin-react-swc"] = "^3.7.2";
    delete pkg.dependencies["@vitejs/plugin-react-swc"];
  }

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  for (const lock of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
    await unlink(path.join(frontendDir, lock)).catch(() => {});
  }

  return { upgraded: true };
}

/**
 * LLMs frequently hallucinate incorrect npm package names (e.g. `@lucide/react` instead of
 * `lucide-react`). Fix known aliases before install so pnpm doesn't 404.
 */
const PKG_NAME_ALIASES: Record<string, string> = {
  "@lucide/react": "lucide-react",
  "lucide/react": "lucide-react",
  "@radix/react-icons": "@radix-ui/react-icons",
  "@heroicons/react": "heroicons",           // heroicons is the correct name
  "react-icons/fi": "react-icons",
  "react-icons/ri": "react-icons",
  "@emotion/css": "@emotion/react",
  "framer": "framer-motion",
  "@tanstack/react-query-devtools": "@tanstack/react-query",
  "react-query": "@tanstack/react-query",     // v5 renamed
  "swr/infinite": "swr",
  "zustand/middleware": "zustand",
  "@shadcn/ui": "",                           // not a real package — remove it
  "shadcn-ui": "",
  "class-variance-authority/dist/types": "class-variance-authority",
};

async function normalizePackageNames(frontendDir: string): Promise<void> {
  const pkgPath = path.join(frontendDir, "package.json");
  let raw: string;
  try { raw = await readFile(pkgPath, "utf8"); } catch { return; }
  let pkg: Record<string, unknown>;
  try { pkg = JSON.parse(raw) as Record<string, unknown>; } catch { return; }

  let changed = false;
  for (const section of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const block = pkg[section] as Record<string, string> | undefined;
    if (!block) continue;
    for (const [wrong, correct] of Object.entries(PKG_NAME_ALIASES)) {
      if (!(wrong in block)) continue;
      const ver = block[wrong]!;
      delete block[wrong];
      if (correct) block[correct] = block[correct] ?? ver; // keep existing ver if already present
      changed = true;
    }
  }

  if (changed) {
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    // Delete lock file so reinstall picks up renamed deps
    for (const lock of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
      await unlink(path.join(frontendDir, lock)).catch(() => {});
    }
  }
}

/**
 * Tailwind v4 removed the PostCSS-plugin approach entirely — `require('tailwindcss')` in
 * postcss.config.js throws at build time if tailwindcss@4 is installed.
 * LLMs often generate v3-style config but pin `tailwindcss: "latest"` (→ v4 now).
 *
 * Fix: if the generated CSS uses v3 directives (@tailwind base / components / utilities)
 * force tailwindcss to ^3.4.0, ensure postcss.config.js exists and is correct, and
 * ensure tailwind.config.ts exists with a minimal content glob.
 */
async function normalizeTailwindForBuild(frontendDir: string): Promise<void> {
  const pkgPath = path.join(frontendDir, "package.json");
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return;
  }
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;

  const twVersion = devDeps.tailwindcss ?? deps.tailwindcss ?? "";
  if (!twVersion) return; // no tailwindcss at all — nothing to do

  // Detect CSS syntax style: v4 uses `@import "tailwindcss"`, v3 uses `@tailwind …`
  const srcDir = path.join(frontendDir, "src");
  const cssFiles: string[] = [];
  const addCss = async (dir: string) => {
    if (!(await fileExists(dir))) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await addCss(abs);
      else if (e.isFile() && /\.css$/i.test(e.name)) cssFiles.push(abs);
    }
  };
  await addCss(srcDir);
  // Also check root-level CSS in frontend/
  const rootCss = await readdir(frontendDir, { withFileTypes: true }).catch(() => []);
  for (const e of rootCss) {
    if (e.isFile() && /\.css$/i.test(e.name)) cssFiles.push(path.join(frontendDir, e.name));
  }

  let hasV3Directives = false;
  let hasV4Import = false;
  for (const f of cssFiles) {
    const src = await readFile(f, "utf8").catch(() => "");
    if (/@tailwind\s+(base|components|utilities)/.test(src)) hasV3Directives = true;
    if (/@import\s+["']tailwindcss["']/.test(src)) hasV4Import = true;
  }

  // Determine installed major from spec
  const specMajor = (() => {
    const m = String(twVersion).match(/(\d+)/);
    if (!m) return null;
    return parseInt(m[1]!, 10);
  })();

  const usingV4TailwindVite = Boolean(devDeps["@tailwindcss/vite"] ?? deps["@tailwindcss/vite"]);

  // Case 1: v3 directives but v4+ installed (or "latest" which resolves to v4)
  const needsDowngrade =
    hasV3Directives &&
    !hasV4Import &&
    !usingV4TailwindVite &&
    (twVersion === "latest" || (specMajor !== null && specMajor >= 4));

  if (needsDowngrade) {
    if (devDeps.tailwindcss) devDeps.tailwindcss = "^3.4.0";
    else deps.tailwindcss = "^3.4.0";
    // Ensure postcss + autoprefixer exist
    if (!devDeps.postcss && !deps.postcss) devDeps.postcss = "^8.4.47";
    if (!devDeps.autoprefixer && !deps.autoprefixer) devDeps.autoprefixer = "^10.4.20";
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    // Remove lock files so npm/pnpm reinstalls with pinned version
    for (const lock of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
      await unlink(path.join(frontendDir, lock)).catch(() => {});
    }
  }

  // Ensure postcss.config.js exists and uses v3 plugin when v3 directives present
  if (hasV3Directives && !usingV4TailwindVite) {
    const postcssConfigs = ["postcss.config.js", "postcss.config.cjs", "postcss.config.ts"];
    const hasPostcss = (await Promise.all(postcssConfigs.map((f) => fileExists(path.join(frontendDir, f))))).some(Boolean);
    if (!hasPostcss) {
      await writeFile(
        path.join(frontendDir, "postcss.config.js"),
        `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`,
        "utf8",
      );
    }
    // Ensure tailwind.config.ts exists
    const twConfigs = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs"];
    const hasTwConfig = (await Promise.all(twConfigs.map((f) => fileExists(path.join(frontendDir, f))))).some(Boolean);
    if (!hasTwConfig) {
      await writeFile(
        path.join(frontendDir, "tailwind.config.ts"),
        `import type { Config } from 'tailwindcss';\nexport default { content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'], theme: { extend: {} }, plugins: [] } satisfies Config;\n`,
        "utf8",
      );
    }
  }

  // Case 2: v4 import style but @tailwindcss/vite missing from devDeps
  if (hasV4Import && !usingV4TailwindVite) {
    devDeps["@tailwindcss/vite"] = "^4.0.0";
    if (devDeps.tailwindcss) devDeps.tailwindcss = "^4.0.0";
    else deps.tailwindcss = "^4.0.0";
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    for (const lock of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
      await unlink(path.join(frontendDir, lock)).catch(() => {});
    }
  }
}

/**
 * Generated tsconfig.json files often enable strict mode without skipLibCheck, causing
 * third-party type errors to abort the build. Always set skipLibCheck + noEmit: false.
 */
/** Patch backend/tsconfig.json to be maximally permissive for preview builds. */
async function normalizeBackendTsConfigForBuild(backendDir: string): Promise<void> {
  const tsconfigPath = path.join(backendDir, "tsconfig.json");
  let tsconfig: Record<string, unknown> = {};
  try {
    const raw = await readFile(tsconfigPath, "utf8");
    tsconfig = JSON.parse(raw) as Record<string, unknown>;
  } catch { /* create from scratch */ }
  const co = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
  // Always set these — they prevent the vast majority of TS7016 / strict-mode failures.
  co.skipLibCheck = true;
  co.strict = false;
  co.noImplicitAny = false;
  co.noEmit = false;
  if (!co.target) co.target = "ES2020";
  if (!co.module) co.module = "commonjs";
  if (!co.esModuleInterop) co.esModuleInterop = true;
  if (!co.resolveJsonModule) co.resolveJsonModule = true;
  if (!co.outDir) co.outDir = "dist";
  if (!co.rootDir) co.rootDir = "src";
  tsconfig.compilerOptions = co;
  if (!tsconfig.include) tsconfig.include = ["src/**/*"];
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");
}

async function normalizeTsConfigForBuild(frontendDir: string): Promise<void> {
  const tsconfigPath = path.join(frontendDir, "tsconfig.json");
  let tsconfig: Record<string, unknown> = {};
  try {
    const raw = await readFile(tsconfigPath, "utf8");
    tsconfig = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // No tsconfig — create a permissive one so Vite's esbuild doesn't fail on type issues.
  }
  const co = (tsconfig.compilerOptions ?? {}) as Record<string, unknown>;
  co.skipLibCheck = true;
  co.noEmit = false;
  if (!co.target) co.target = "ESNext";
  if (!co.module) co.module = "ESNext";
  if (!co.moduleResolution) co.moduleResolution = "bundler";
  if (!co.jsx) co.jsx = "react-jsx";
  if (!co.lib) co.lib = ["ESNext", "DOM", "DOM.Iterable"];
  tsconfig.compilerOptions = co;
  if (!tsconfig.include) tsconfig.include = ["src"];
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");
}

function looksLikeJsx(source: string): boolean {
  // Heuristic: JSX tags in a .js file will break older Vite/Rollup setups unless treated as .jsx.
  // Avoid matching "<=" etc by requiring a likely tag name.
  return /<\s*[A-Za-z][\w:-]*[\s/>]/.test(source);
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string) => {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) out.push(abs);
    }
  };
  await walk(dir);
  return out;
}

async function convertJsxJsToJsx(frontendDir: string): Promise<{ converted: number }> {
  const srcDir = path.join(frontendDir, "src");
  if (!(await fileExists(srcDir))) return { converted: 0 };
  const files = await listFilesRecursive(srcDir);

  // 1) Rename *.js containing JSX → *.jsx (remove the .js to prevent Vite parsing it as plain JS).
  let converted = 0;
  const renamed = new Map<string, string>(); // from rel.js → rel.jsx
  for (const abs of files) {
    if (!abs.endsWith(".js")) continue;
    const raw = await readFile(abs, "utf8").catch(() => "");
    if (!raw) continue;
    if (!looksLikeJsx(raw)) continue;
    const nextAbs = abs.replace(/\.js$/i, ".jsx");
    await writeFile(nextAbs, raw, "utf8");
    await unlink(abs).catch(() => {});
    converted++;
    renamed.set(
      path.relative(frontendDir, abs).replace(/\\/g, "/"),
      path.relative(frontendDir, nextAbs).replace(/\\/g, "/"),
    );
  }

  // 2) Update explicit ".js" imports to ".jsx" in all source files.
  if (renamed.size > 0) {
    const updatedFiles = await listFilesRecursive(srcDir);
    for (const abs of updatedFiles) {
      if (!/\.(jsx|js|ts|tsx)$/.test(abs)) continue;
      const raw = await readFile(abs, "utf8").catch(() => "");
      if (!raw) continue;
      let next = raw;
      for (const [from, to] of renamed) {
        const fromBase = from.replace(/^src\//, "").replace(/\.js$/i, "");
        const toBase = to.replace(/^src\//, "").replace(/\.jsx$/i, "");
        // Replace explicit extension imports: "./App.js" → "./App.jsx"
        next = next.replace(new RegExp(`${fromBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.js`, "g"), `${toBase}.jsx`);
      }
      if (next !== raw) await writeFile(abs, next, "utf8");
    }
  }

  return { converted };
}

/**
 * LLMs often emit react-router-dom v5 APIs (`Switch`, `Route component=`) while pnpm resolves v6 → build fails.
 * Best-effort rewrite so preview builds succeed.
 */
function rewriteReactRouterV5ToV6(source: string): string {
  if (!source.includes("react-router-dom")) return source;

  let s = source;
  const hadV5Apis =
    /\bSwitch\b/.test(s) ||
    /\bcomponent=\{/.test(s) ||
    /<Redirect\b/.test(s) ||
    /\bRedirect\b/.test(s);
  if (!hadV5Apis) return source;

  // v5 `<Switch>` / import Switch → `<Routes>` / Routes
  s = s.replace(/\bSwitch\b/g, "Routes");

  // `<Redirect .../>` → `<Navigate ... />` (v6); keep props like `to=`
  s = s.replace(/<Redirect\b/g, "<Navigate");

  // `import { ..., Redirect }` → Navigate (already replaced in JSX above)
  s = s.replace(/\bRedirect\b/g, "Navigate");

  // Self-closing Route: strip `exact`, map `component={X}` → `element={<X />}`
  // (Do not use `[^/]*` for attrs — `path="/"` contains `/` and would break the match.)
  // Only touch tags that still use `component=` — avoids breaking `element={<Foo/>}` (inner `/>`).
  s = s.replace(/<Route\s+([\s\S]*?)\s*\/>/g, (full, inner: string) => {
    if (!/component=\{/.test(inner)) return full;
    let attrs = inner
      .replace(/\bexact\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    attrs = attrs.replace(/component=\{([^}]+)\}/g, "element={<$1 />}");
    return `<Route ${attrs} />`;
  });

  return s;
}

async function normalizeReactRouterDomForV6Bundle(frontendDir: string): Promise<{ filesUpdated: number }> {
  const srcDir = path.join(frontendDir, "src");
  if (!(await fileExists(srcDir))) return { filesUpdated: 0 };
  const files = await listFilesRecursive(srcDir);
  let filesUpdated = 0;
  for (const abs of files) {
    if (!/\.(tsx|jsx|ts|js)$/i.test(abs)) continue;
    const raw = await readFile(abs, "utf8").catch(() => "");
    if (!raw) continue;
    const next = rewriteReactRouterV5ToV6(raw);
    if (next !== raw) {
      await writeFile(abs, next, "utf8");
      filesUpdated++;
    }
  }
  return { filesUpdated };
}

function escapeRegExp(part: string): string {
  return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Vite emits import.meta.env.BASE_URL from --base; RR6 needs basename or no route matches → blank SPA. */
function injectHostedPreviewRouterBasename(source: string): string | null {
  if (!source.includes("react-router-dom")) return null;
  if (/\b(HashRouter|MemoryRouter)\b/.test(source)) return null;
  if (/createBrowserRouter\s*\(|RouterProvider\b/.test(source)) return null;

  const deny = new Set(["Routes", "Route", "Outlet", "Link", "NavLink", "Navigate"]);
  const tags = new Set<string>();
  for (const m of source.matchAll(/BrowserRouter\s+as\s+(\w+)/g)) {
    if (!deny.has(m[1]!)) tags.add(m[1]!);
  }
  if (/\bBrowserRouter\b/.test(source)) tags.add("BrowserRouter");

  if (tags.size === 0) return null;

  let s = source;
  let changed = false;

  const basenameProp = ` basename={import.meta.env.BASE_URL}`;

  for (const tag of tags) {
    const re = new RegExp(`<${escapeRegExp(tag)}\\b(?![^>]*\\bbasename\\s*=)([^>]*)>`, "g");
    const next = s.replace(re, (full, attrs: string) => {
      // Skip closing-style mistakes
      if (full.startsWith("</")) return full;
      changed = true;
      const a = attrs ?? "";
      return `<${tag}${a}${basenameProp}>`;
    });
    s = next;
  }

  return changed ? s : null;
}

async function applyHostedPreviewRouterBasenames(frontendDir: string): Promise<{ filesUpdated: number }> {
  const srcDir = path.join(frontendDir, "src");
  if (!(await fileExists(srcDir))) return { filesUpdated: 0 };
  const files = await listFilesRecursive(srcDir);
  let filesUpdated = 0;
  for (const abs of files) {
    if (!/\.(tsx|jsx)$/i.test(abs)) continue;
    const raw = await readFile(abs, "utf8").catch(() => "");
    if (!raw) continue;
    const next = injectHostedPreviewRouterBasename(raw);
    if (next && next !== raw) {
      await writeFile(abs, next, "utf8");
      filesUpdated++;
    }
  }
  return { filesUpdated };
}

async function stubMissingCssLinkedFromIndex(frontendDir: string, html: string): Promise<void> {
  const rels = new Set<string>();
  for (const m of html.matchAll(/href=(["'])(?!https?:)([^"']+)\1/gi)) {
    const raw = (m[2] ?? "").trim();
    if (!/\.css(\?|#|$)/i.test(raw)) continue;
    let rel = raw.replace(/^\//, "").replace(/^\.\//, "");
    if (rel.startsWith("//")) continue;
    rels.add(rel);
  }
  for (const rel of rels) {
    const abs = path.join(frontendDir, rel);
    if (!(await fileExists(abs))) {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, "/* Stub — referenced from index.html but artifact had no file. */\n", "utf8");
    }
  }
}

/**
 * Bare `href="styles.css"` is resolved like a package name and Rollup fails; use `./styles.css`
 * (matches our rule that project-root CSS links stay relative for Vite + hosted base path).
 */
function normalizeIndexHtmlBareStylesheetHrefs(html: string): string {
  return html.replace(/<link\b[^>]*>/gi, (tag: string) => {
    if (!/\bhref\s*=/i.test(tag)) return tag;
    const isCss =
      /\.css(\?|#|$)/i.test(tag) ||
      /\brel\s*=\s*["']stylesheet["']/i.test(tag) ||
      /\btype\s*=\s*["']text\/css["']/i.test(tag);
    if (!isCss) return tag;
    return tag.replace(/\bhref\s*=\s*(["'])([^"']+)\1/i, (_m, q: string, href: string) => {
      const h = href.trim();
      if (/^https?:\/\//i.test(h) || h.startsWith("//")) return `href=${q}${h}${q}`;
      if (h.startsWith("./") || h.startsWith("../")) return `href=${q}${h}${q}`;
      if (h.startsWith("/")) return `href=${q}${h}${q}`;
      return `href=${q}./${h}${q}`;
    });
  });
}

/**
 * Inline module scripts in index.html: `import "styles.css"` is a bare specifier for Rollup.
 * Only rewrite single-segment filenames (e.g. styles.css), not packages or paths with `/` or `@`.
 */
function normalizeIndexHtmlBareStringCssImports(html: string): string {
  return html.replace(/\bimport\s+(["'])((?![./]|https?:\/\/)[^"'\\]+\.css)\1/gi, (full, q: string, spec: string) => {
    const s = spec.trim();
    if (s.startsWith("@") || s.includes("/") || s.includes("\\")) return full;
    return `import ${q}./${s}${q}`;
  });
}

/** Bare `src="src/main.tsx"` is resolved as an npm-like id — use `/src/main.tsx`. */
function normalizeIndexHtmlModuleScriptRoots(html: string): string {
  return html.replace(/<script\b[^>]*>/gi, (openTag: string) => {
    const srcM = /\bsrc\s*=\s*(["'])([^"']+)\1/i.exec(openTag);
    if (!srcM) return openTag;
    const srcRaw = srcM[2]!.trim();
    if (/^https?:\/\//i.test(srcRaw)) return openTag;
    const looksLikeSourceEntry = /\.(tsx|ts|jsx|js)(\?[^"'#]*)?(#|$)/i.test(srcRaw);
    const isModule =
      /\btype\s*=\s*["']module["']/i.test(openTag) || /\btype\s*=\s*module\b/i.test(openTag);

    let tag = openTag;
    if (looksLikeSourceEntry && !isModule) {
      tag = tag.replace(/<script\b/i, `<script type="module"`);
    }
    if (!looksLikeSourceEntry && !isModule) return openTag;

    return tag.replace(/\bsrc\s*=\s*(["'])([^"']+)\1/i, (_m, q: string, src: string) => {
      const s = String(src).trim();
      if (/^https?:\/\//i.test(s)) return `src=${q}${s}${q}`;
      const stripLeadingDot = s.replace(/^\.\//, "");
      const root = stripLeadingDot.startsWith("/") ? stripLeadingDot : `/${stripLeadingDot}`;
      return `src=${q}${root}${q}`;
    });
  });
}

/**
 * - `href="/style.css"` breaks Vite (treated as absolute module). Use `./style.css`.
 * - Create missing linked root-level *.css so build does not fail.
 * - Match `<div id>` to entry `getElementById` when possible.
 */
async function syncIndexHtmlWithEntryMountSelector(frontendDir: string): Promise<void> {
  const indexPath = path.join(frontendDir, "index.html");
  if (!(await fileExists(indexPath))) return;
  let html = await readFile(indexPath, "utf8");

  // Any `<link … href="/…css">` → relative so Vite resolves under `frontend/`.
  html = html.replace(
    /(<link[^>]*\bhref=)(["'])\/(?!\/)([^"'?#]+\.css)\2/gi,
    (_m, prefix, q: string, assetPath: string) => `${prefix}${q}./${assetPath.replace(/^\/+/, "")}${q}`,
  );
  html = html.replace(/href=(["'])style\.css\1/g, (_m, q: string) => `href=${q}./style.css${q}`);
  // Non-`<link>` tags (invalid but common) — e.g. plain `href="/style.css"`.
  html = html.replace(
    /href=(["'])\/(?!\/)([^"'?#]+\.css)\1/gi,
    (_m, q: string, assetPath: string) => `href=${q}./${assetPath.replace(/^\/+/, "")}${q}`,
  );

  const entryCandidates = [
    "src/main.tsx",
    "src/main.jsx",
    "src/main.ts",
    "src/main.js",
    "src/index.tsx",
    "src/index.jsx",
  ];
  let entrySrc = "";
  for (const rel of entryCandidates) {
    const abs = path.join(frontendDir, rel);
    if (await fileExists(abs)) {
      entrySrc = await readFile(abs, "utf8").catch(() => "");
      break;
    }
  }
  const idMatch =
    entrySrc.match(/getElementById\s*\(\s*["']([\w.-]+)["']\s*\)/) ??
    entrySrc.match(/querySelector\s*\(\s*["']#([\w.-]+)["']\s*\)/);
  const mountId = idMatch?.[1];

  if (mountId && !html.includes(`id="${mountId}"`) && !html.includes(`id='${mountId}'`)) {
    html = html.replace(/<div\s+id=["'][^"']*["']/, `<div id="${mountId}"`);
  }

  html = normalizeIndexHtmlBareStylesheetHrefs(html);
  html = normalizeIndexHtmlBareStringCssImports(html);
  html = normalizeIndexHtmlModuleScriptRoots(html);

  await writeFile(indexPath, html, "utf8");
  await stubMissingCssLinkedFromIndex(frontendDir, html);
}

async function ensureViteIndexHtml(frontendDir: string): Promise<{ created: boolean; entry?: string }> {
  const index = path.join(frontendDir, "index.html");
  if (await fileExists(index)) return { created: false };

  // Try to infer the entry from common Vite React layouts.
  const candidates = [
    "src/main.tsx",
    "src/main.jsx",
    "src/main.ts",
    "src/main.js",
    "src/index.tsx",
    "src/index.jsx",
    "src/index.ts",
    "src/index.js",
  ];
  for (const rel of candidates) {
    if (await fileExists(path.join(frontendDir, rel))) {
      const entryForHtml = rel;
      const html = [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"UTF-8\" />",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
        "    <title>HiveMind Preview</title>",
        "  </head>",
        "  <body>",
        "    <div id=\"root\"></div>",
        `    <script type=\"module\" src=\"/${entryForHtml}\"></script>`,
        "  </body>",
        "</html>",
        "",
      ].join("\n");
      await writeFile(index, html, "utf8");
      return { created: true, entry: entryForHtml };
    }
  }

  // Last-resort scaffold: if there is an App component but no entry file, create one.
  const appCandidates = ["src/App.tsx", "src/App.jsx", "src/App.ts", "src/App.js", "App.tsx", "App.jsx", "App.ts", "App.js"];
  let appRel: string | null = null;
  for (const rel of appCandidates) {
    if (await fileExists(path.join(frontendDir, rel))) {
      appRel = rel.startsWith("src/") ? rel : `src/${rel}`;
      break;
    }
  }
  if (appRel) {
    const mainRel = "src/main.tsx";
    const mainAbs = path.join(frontendDir, mainRel);
    if (!(await fileExists(mainAbs))) {
      const main = [
        "import React from 'react';",
        "import ReactDOM from 'react-dom';",
        "import App from './App';",
        "",
        "ReactDOM.render(",
        "  <React.StrictMode>",
        "    <App />",
        "  </React.StrictMode>,",
        "  document.getElementById('root')",
        ");",
        "",
      ].join("\n");
      await mkdir(path.dirname(mainAbs), { recursive: true });
      await writeFile(mainAbs, main, "utf8");
    }
    const html = [
      "<!doctype html>",
      "<html lang=\"en\">",
      "  <head>",
      "    <meta charset=\"UTF-8\" />",
      "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
      "    <title>HiveMind Preview</title>",
      "  </head>",
      "  <body>",
      "    <div id=\"root\"></div>",
      `    <script type=\"module\" src=\"/${mainRel}\"></script>`,
      "  </body>",
      "</html>",
      "",
    ].join("\n");
    await writeFile(index, html, "utf8");
    return { created: true, entry: mainRel };
  }

  return { created: false };
}

function serveStaticSpa(distDir: string, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const reqPath = decodeURIComponent(url.pathname || "/");
  const rel = reqPath.replace(/^\/+/, "");
  const candidate = path.join(distDir, rel);
  const sendFile = async (fp: string) => {
    const buf = await readFile(fp);
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeFor(fp));
    res.setHeader("Cache-Control", fp.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
    res.end(buf);
  };

  (async () => {
    // If exact file exists, serve it.
    if (await fileExists(candidate)) {
      const s = await stat(candidate);
      if (s.isFile()) return sendFile(candidate);
    }
    // SPA fallback.
    const index = path.join(distDir, "index.html");
    if (await fileExists(index)) return sendFile(index);
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("preview_frontend_not_built");
  })().catch((e) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(String(e instanceof Error ? e.message : e));
  });
}

async function run(cmd: string, args: string[], cwd: string, env?: Record<string, string | undefined>): Promise<void> {
  const resolved = cmd === "pnpm" ? resolveCmd(await pkgManager(), args) : { cmd, args };
  return new Promise((resolve, reject) => {
    const child = spawn(resolved.cmd, resolved.args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${resolved.cmd} ${resolved.args.join(" ")} exited ${code}`));
    });
  });
}

/** Like `run` but captures stdout+stderr for build diagnostics / repair loops. */
async function runCaptured(
  cmd: string,
  args: string[],
  cwd: string,
  env?: Record<string, string | undefined>,
): Promise<{ code: number; combined: string }> {
  const resolved = cmd === "pnpm" ? resolveCmd(await pkgManager(), args) : { cmd, args };
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn(resolved.cmd, resolved.args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stderr?.on("data", (d: Buffer) => chunks.push(d));
    child.stdout?.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? 1, combined: Buffer.concat(chunks).toString("utf8") });
    });
  });
}

/** Preview + swarm repair need a backend dir; frontend-only missions may omit it — stub minimal HTTP. */
async function ensureMinimalBackendStub(rootDir: string): Promise<void> {
  const backendDir = path.join(rootDir, "backend");
  await mkdir(backendDir, { recursive: true });
  const pkgPath = path.join(backendDir, "package.json");
  // Only inject stub files that are actually missing — don't overwrite LLM-generated ones.
  if (!(await fileExists(pkgPath))) {
    const pkg = {
      name: "hivemind-preview-stub-backend",
      version: "1.0.0",
      scripts: { start: "node server.js" },
      dependencies: {},
    };
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }
  const serverPath = path.join(backendDir, "server.js");
  if (!(await fileExists(serverPath))) {
    const server = [
      "const http = require(\"node:http\");",
      "const port = Number(process.env.PORT || 3000);",
      "http.createServer((req, res) => {",
      "  res.setHeader(\"Content-Type\", \"application/json\");",
      "  if ((req.url || \"\").startsWith(\"/health\")) {",
      '    res.end(JSON.stringify({ ok: true }));',
      "    return;",
      "  }",
      "  res.statusCode = 404;",
      '  res.end(JSON.stringify({ error: \"stub_backend\" }));',
      `}).listen(port, \"127.0.0.1\", () => {});`,
      "",
    ].join("\n");
    await writeFile(serverPath, server, "utf8");
  }
}

/**
 * Parse TypeScript compiler errors to find missing @types packages (TS7016).
 * e.g. "Could not find a declaration file for module 'better-sqlite3'" → "@types/better-sqlite3"
 */
function extractMissingTypesFromBuildLog(log: string): string[] {
  const found = new Set<string>();
  // TS7016: Could not find a declaration file for module 'xxx'
  const re = /Could not find a declaration file for module ['"]([^'"]+)['"]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(log)) !== null) {
    const pkg = m[1]!;
    if (pkg.startsWith(".") || pkg.startsWith("/")) continue;
    const base = pkg.startsWith("@") ? pkg.split("/").slice(0, 2).join("/") : pkg.split("/")[0]!;
    if (base) found.add(`@types/${base}`);
  }
  return [...found];
}

/**
 * Parse Vite/Rollup build errors to find npm packages that the code imports but that aren't
 * installed. Returns only bare specifiers (not relative paths).
 */
function extractMissingPackagesFromBuildLog(log: string): string[] {
  const patterns = [
    /Failed to resolve import ["']([^"'.][^"']*)["']/gi,
    /Could not resolve ["']([^"'.][^"']*)["']/gi,
    /\[vite\].*resolve import ["']([^"'.][^"']*)["']/gi,
    /Cannot find module ["']([^"'.][^"']*)["']/gi,
    /Module not found.*["']([^"'.][^"']*)["']/gi,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(log)) !== null) {
      const raw = m[1];
      if (!raw || raw.startsWith(".") || raw.startsWith("/")) continue;
      // Normalize: '@scope/pkg/sub' → '@scope/pkg', 'pkg/sub' → 'pkg'
      const base = raw.startsWith("@")
        ? raw.split("/").slice(0, 2).join("/")
        : raw.split("/")[0]!;
      if (base) found.add(base);
    }
  }
  // Filter out Node built-ins and already-known packages that just resolve differently
  const nodeBuiltins = new Set([
    "node:path","node:fs","node:crypto","node:http","node:https","node:os","node:url",
    "path","fs","crypto","http","https","os","url","util","stream","events","buffer",
    "assert","child_process","net","tls","zlib","querystring","string_decoder",
  ]);
  return [...found].filter((p) => !nodeBuiltins.has(p));
}

/**
 * Adds missing packages (and @types/ for TS7016 errors) to a package.json and reinstalls.
 * Works for both frontend and backend dirs. Returns what was added.
 */
async function autoHealMissingPackages(
  projectDir: string,
  buildLog: string,
  runCapt: (cmd: string, args: string[], cwd: string) => Promise<{ code: number; combined: string }>,
): Promise<{ healed: boolean; added: string[] }> {
  const missingPkgs = extractMissingPackagesFromBuildLog(buildLog);
  const missingTypes = extractMissingTypesFromBuildLog(buildLog); // TS7016 → @types/xxx

  const pkgPath = path.join(projectDir, "package.json");
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return { healed: false, added: [] };
  }
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  const added: string[] = [];

  for (const name of missingPkgs) {
    if (!deps[name] && !devDeps[name]) { deps[name] = "latest"; added.push(name); }
  }
  for (const name of missingTypes) {
    if (!deps[name] && !devDeps[name]) { devDeps[name] = "latest"; added.push(name); }
  }
  if (added.length === 0) return { healed: false, added: [] };

  pkg.dependencies = deps;
  pkg.devDependencies = devDeps;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  await runCapt("pnpm", ["install"], projectDir);
  return { healed: true, added };
}

/**
 * Build a TypeScript backend with auto-heal retry.
 * If tsc still fails after healing, fall back to ts-node (skips compilation entirely).
 * Returns a command that can actually start the server.
 */
async function buildBackendWithHeal(
  backendDir: string,
  scripts: Record<string, string>,
  runCapt: (cmd: string, args: string[], cwd: string) => Promise<{ code: number; combined: string }>,
): Promise<{ cmd: string; args: string[] }> {
  const pm = await pkgManager();
  if (!scripts.build) return resolveCmd(pm, scripts.start ? ["run", "start"] : ["run", "dev"]);

  // Normalize tsconfig before every build attempt.
  await normalizeBackendTsConfigForBuild(backendDir);
  let buildResult = await runCapt("pnpm", ["run", "build"], backendDir);

  if (buildResult.code !== 0) {
    // Try to auto-heal missing packages / @types.
    const heal = await autoHealMissingPackages(backendDir, buildResult.combined, runCapt);
    if (heal.healed) {
      await normalizeBackendTsConfigForBuild(backendDir); // re-normalize after install
      buildResult = await runCapt("pnpm", ["run", "build"], backendDir);
    }
  }

  if (buildResult.code !== 0) {
    // tsc still failing — fall back to ts-node so the server runs without pre-compilation.
    // Check if ts-node is available (it's in devDependencies of the generated package.json).
    const hasTsNode = await fileExists(path.join(backendDir, "node_modules", ".bin", "ts-node"));
    if (hasTsNode) {
      // Find the TypeScript entry point.
      let entry = "src/index.ts";
      for (const candidate of ["src/index.ts", "src/server.ts", "src/app.ts", "index.ts"]) {
        if (await fileExists(path.join(backendDir, candidate))) { entry = candidate; break; }
      }
      return { cmd: path.join(backendDir, "node_modules", ".bin", "ts-node"), args: [entry] };
    }
  }

  // Build succeeded (or we gave up on tsc) — use the normal start script.
  return scripts.start
    ? resolveCmd(pm, ["run", "start"])
    : scripts.dev
      ? resolveCmd(pm, ["run", "dev"])
      : { cmd: "node", args: ["dist/index.js"] };
}

/**
 * Scan all source files for relative imports that point to missing files — create empty stubs
 * so Vite can resolve the graph. These stubs are minimal: just `export {};` or a default export.
 */
async function stubMissingRelativeImports(frontendDir: string): Promise<{ stubbed: number }> {
  const srcDir = path.join(frontendDir, "src");
  if (!(await fileExists(srcDir))) return { stubbed: 0 };
  const files = await listFilesRecursive(srcDir);
  const sourceFiles = files.filter((f) => /\.(tsx?|jsx?)$/i.test(f) && !f.includes("node_modules"));
  // Collect the set of all existing source paths (lower-cased for case-insensitive lookup)
  const existing = new Set(files.map((f) => f.toLowerCase()));
  let stubbed = 0;
  const importRe = /(?:from|import)\s+["'](\.[^"']+)["']/g;
  for (const abs of sourceFiles) {
    const src = await readFile(abs, "utf8").catch(() => "");
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src)) !== null) {
      const rel = m[1]!;
      const dir = path.dirname(abs);
      // Try common extensions when no extension is given
      const candidates = rel.endsWith(".tsx") || rel.endsWith(".ts") || rel.endsWith(".js") || rel.endsWith(".jsx")
        ? [path.resolve(dir, rel)]
        : [
            path.resolve(dir, rel + ".tsx"),
            path.resolve(dir, rel + ".ts"),
            path.resolve(dir, rel + ".jsx"),
            path.resolve(dir, rel + ".js"),
            path.resolve(dir, rel, "index.tsx"),
            path.resolve(dir, rel, "index.ts"),
          ];
      const resolved = candidates.find((c) => existing.has(c.toLowerCase()));
      if (!resolved) {
        // Create a stub at the first candidate path
        const stubPath = candidates[0]!;
        await mkdir(path.dirname(stubPath), { recursive: true });
        // Emit a valid TS/TSX stub that exports nothing (no type errors)
        const stub = `// auto-stub: missing module\nexport {};\n`;
        await writeFile(stubPath, stub, "utf8");
        existing.add(stubPath.toLowerCase());
        stubbed++;
      }
    }
  }
  return { stubbed };
}

async function dedupeViteApiPrefixOnDisk(frontendDir: string): Promise<{ filesUpdated: number }> {
  if (!(await fileExists(frontendDir))) return { filesUpdated: 0 };
  const all = await listFilesRecursive(frontendDir);
  let n = 0;
  for (const abs of all) {
    if (abs.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (!/\.(tsx|ts|jsx|js|html|vue|svelte)$/i.test(abs)) continue;
    const raw = await readFile(abs, "utf8").catch(() => "");
    if (!raw.includes("VITE_API_URL")) continue;
    const rel = `frontend/${path.relative(frontendDir, abs).replace(/\\/g, "/")}`;
    const next = sanitizeViteApiUrlDoubleApi(rel, raw);
    if (next !== raw) {
      await writeFile(abs, next, "utf8");
      n++;
    }
  }
  return { filesUpdated: n };
}

export class PreviewManager {
  private sessions = new Map<string, PreviewSession>();
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.resolve(process.cwd(), ".hivemind-previews");
  }

  /**
   * Materialize artifacts in a temp tree, normalize like preview, run install + `vite build`.
   * Temp dir always removed (best-effort). For swarm **build → repair** loops.
   *
   * Returns `patchedFiles` — files auto-healed during the run (e.g. updated package.json).
   * Callers with DB access should persist these so the next repair round starts from the
   * healed state instead of rediscovering the same missing packages.
   */
  async diagnoseArtifactBuild(
    artifacts: PreviewArtifact[],
  ): Promise<{ ok: boolean; log: string; patchedFiles?: Array<{ path: string; content: string }> }> {
    const id = randomBytes(4).toString("hex");
    const rootDir = path.join(this.baseDir, `_diag_${id}`);
    await mkdir(rootDir, { recursive: true });
    const chunks: string[] = [];
    const pushLog = (label: string, code: number, body: string) => {
      chunks.push(`${label} (exit ${code})\n${body}`.slice(0, 24_000));
    };
    try {
      for (const a of artifacts) {
        const rel = safeRelPath(a.path);
        if (!rel) continue;
        const abs = path.join(rootDir, rel);
        await mkdir(path.dirname(abs), { recursive: true });
        await writeFile(abs, a.content ?? "", "utf8");
      }
      const frontendDir = path.join(rootDir, "frontend");
      if (!(await fileExists(frontendDir))) {
        return { ok: false, log: "diagnose: missing frontend/ in artifacts." };
      }
      await ensureMinimalBackendStub(rootDir);
      const backendDir = path.join(rootDir, "backend");
      const previewAssetBase = `/preview/diag-${id}/`;
      const apiBasePath = `/preview/diag-${id}/api`;

      let       r = await runCaptured("pnpm", ["install"], backendDir);
      pushLog("pnpm install backend", r.code, r.combined);
      // Normalize backend tsconfig and attempt build with auto-heal.
      // Non-fatal: frontend can still be diagnosed even if backend fails.
      if (r.code === 0) {
        await normalizeBackendTsConfigForBuild(backendDir);
        const backendPkgDiag = await readJsonFile<PkgJson>(path.join(backendDir, "package.json"));
        if (backendPkgDiag?.scripts?.build) {
          const br = await runCaptured("pnpm", ["run", "build"], backendDir);
          pushLog("backend build", br.code, br.combined);
          if (br.code !== 0) {
            const heal = await autoHealMissingPackages(backendDir, br.combined, runCaptured);
            if (heal.healed) {
              await normalizeBackendTsConfigForBuild(backendDir);
              const br2 = await runCaptured("pnpm", ["run", "build"], backendDir);
              pushLog("backend build (after heal)", br2.code, br2.combined);
            }
          }
        }
      }

      await normalizePackageNames(frontendDir);
      await normalizeLegacyViteFrontendPackageJson(frontendDir);
      await normalizeTailwindForBuild(frontendDir);
      await normalizeTsConfigForBuild(frontendDir);
      await convertJsxJsToJsx(frontendDir);
      await normalizeReactRouterDomForV6Bundle(frontendDir);
      const ensured = await ensureViteIndexHtml(frontendDir);
      await syncIndexHtmlWithEntryMountSelector(frontendDir);
      await applyHostedPreviewRouterBasenames(frontendDir);
      await dedupeViteApiPrefixOnDisk(frontendDir);

      r = await runCaptured("pnpm", ["install"], frontendDir);
      pushLog("pnpm install frontend", r.code, r.combined);
      if (r.code !== 0) return { ok: false, log: chunks.join("\n---\n") };

      const frontendPkg = await readJsonFile<PkgJson>(path.join(frontendDir, "package.json"));
      const frontendScripts = frontendPkg?.scripts ?? {};
      if (!frontendScripts.build) {
        return { ok: false, log: chunks.join("\n---\n") + "\n---\ndiagnose: frontend/package.json missing scripts.build." };
      }
      if (!(await fileExists(path.join(frontendDir, "index.html")))) {
        return { ok: false, log: chunks.join("\n---\n") + "\n---\ndiagnose: missing frontend/index.html." };
      }
      void ensured;
      const hasVite = Boolean(frontendPkg?.devDependencies?.vite ?? frontendPkg?.dependencies?.vite);
      const buildEnv: Record<string, string | undefined> = {
        VITE_API_URL: apiBasePath,
        VITE_API_DISABLED: "false",
      };
      // Auto-stub missing relative imports BEFORE first build attempt.
      const stubResult = await stubMissingRelativeImports(frontendDir);
      const allAddedPackages: string[] = [];
      // Build with up to 3 attempts — each failure triggers missing-package auto-install.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (hasVite) {
          r = await runCaptured("pnpm", ["exec", "vite", "build", "--base", previewAssetBase], frontendDir, buildEnv);
        } else {
          r = await runCaptured("pnpm", ["run", "build"], frontendDir, buildEnv);
        }
        pushLog(`frontend build attempt ${attempt + 1}`, r.code, r.combined);
        if (r.code === 0) break;
        const heal = await autoHealMissingPackages(frontendDir, r.combined, runCaptured);
        if (!heal.healed) break; // no fixable missing packages — stop retrying
        allAddedPackages.push(...heal.added);
        pushLog(`auto-heal: added [${heal.added.join(", ")}] and reinstalled`, 0, "");
      }
      // Collect files that were patched during auto-heal so the caller can persist them to DB.
      const patchedFiles: Array<{ path: string; content: string }> = [];
      if (allAddedPackages.length > 0) {
        const updatedPkg = await readFile(path.join(frontendDir, "package.json"), "utf8").catch(() => null);
        if (updatedPkg) patchedFiles.push({ path: "frontend/package.json", content: updatedPkg });
      }
      if (stubResult.stubbed > 0) {
        // Collect all newly created stub files
        const allDisk = await listFilesRecursive(frontendDir);
        for (const abs of allDisk) {
          if (abs.includes("node_modules")) continue;
          const content = await readFile(abs, "utf8").catch(() => null);
          if (content?.startsWith("// auto-stub:")) {
            const rel = `frontend/${path.relative(frontendDir, abs).replace(/\\/g, "/")}`;
            patchedFiles.push({ path: rel, content });
          }
        }
      }
      if (r.code !== 0) return { ok: false, log: chunks.join("\n---\n"), patchedFiles };
      return { ok: true, log: chunks.join("\n---\n").slice(-12_000), patchedFiles };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      chunks.push(`exception: ${msg}`);
      return { ok: false, log: chunks.join("\n---\n") };
    } finally {
      await rm(rootDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  get(sessionId: string): PreviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  async stop(sessionId: string): Promise<boolean> {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    try {
      s.procs.backend?.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    try {
      s.servers.frontend?.close();
    } catch {
      /* ignore */
    }
    this.sessions.delete(sessionId);
    try {
      await rm(s.rootDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return true;
  }

  async start(input: { wallet: string; missionId: string; artifacts: PreviewArtifact[] }): Promise<PreviewSession> {
    const id = `P-${randomBytes(6).toString("hex")}`;
    await mkdir(this.baseDir, { recursive: true });
    const rootDir = path.join(this.baseDir, `${input.missionId}-${id}`);
    await mkdir(rootDir, { recursive: true });

    // Materialize artifacts.
    for (const a of input.artifacts) {
      const rel = safeRelPath(a.path);
      if (!rel) continue;
      const abs = path.join(rootDir, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, a.content ?? "", "utf8");
    }

    const frontendDir = path.join(rootDir, "frontend");
    const backendDir = path.join(rootDir, "backend");
    const frontendDistDir = path.join(frontendDir, "dist");
    if (!(await fileExists(frontendDir))) {
      throw new Error("preview_requires_frontend_folder");
    }
    await ensureMinimalBackendStub(rootDir);

    const backendPort = pickPort();
    const frontendPort = pickPort();
    /** Must match Fastify `/preview/:sessionId/*` so built JS/CSS load under this path (not `/assets/` at site root → blank iframe). */
    const previewAssetBase = `/preview/${id}/`;
    const apiBasePath = `/preview/${id}/api`;

    // Build + start backend with auto-heal (missing packages, @types, ts-node fallback).
    await run("pnpm", ["install"], backendDir);
    const backendPkg = await readJsonFile<PkgJson>(path.join(backendDir, "package.json"));
    const backendScripts = backendPkg?.scripts ?? {};
    const backendCmd = await buildBackendWithHeal(backendDir, backendScripts, runCaptured);
    const backendProc = spawn(backendCmd.cmd, backendCmd.args, {
      cwd: backendDir,
      env: { ...process.env, PORT: String(backendPort) },
      stdio: "pipe",
    });

    // Fix AI-hallucinated package names (e.g. @lucide/react → lucide-react).
    await normalizePackageNames(frontendDir);
    // Align ancient Vite 2/3 stacks before install — avoids `vite.createFilter is not a function` during config load.
    await normalizeLegacyViteFrontendPackageJson(frontendDir);
    // Pin Tailwind to v3 when v3 CSS syntax is used (v4 removed postcss plugin approach).
    await normalizeTailwindForBuild(frontendDir);
    // Patch tsconfig so strict lib checks / missing types never abort the build.
    await normalizeTsConfigForBuild(frontendDir);
    // Build frontend with API base path pointing at our proxy route (Vite requires index.html).
    await run("pnpm", ["install"], frontendDir);
    const frontendPkg = await readJsonFile<PkgJson>(path.join(frontendDir, "package.json"));
    const frontendScripts = frontendPkg?.scripts ?? {};
    // Normalize common generation mistake: JSX in .js files.
    await convertJsxJsToJsx(frontendDir);
    // Agents often emit react-router-dom v5; dependency is commonly v6.
    await normalizeReactRouterDomForV6Bundle(frontendDir);
    const ensured = await ensureViteIndexHtml(frontendDir);
    /** index.html `#root` vs `getElementById('app')` makes an empty-looking page; stylesheet href needs ./ under /preview/. */
    await syncIndexHtmlWithEntryMountSelector(frontendDir);
    /** Without basename, pathname /preview/id/ vs routes "/" → no match → blank SPA. import.meta.env.BASE_URL comes from --base below. */
    await applyHostedPreviewRouterBasenames(frontendDir);
    await dedupeViteApiPrefixOnDisk(frontendDir);
    if (!frontendScripts.build) {
      throw new Error("preview_frontend_missing_build_script");
    }
    if (!(await fileExists(path.join(frontendDir, "index.html")))) {
      throw new Error("preview_frontend_missing_index_html");
    }
    const hasVite = Boolean(
      frontendPkg?.devDependencies?.vite ?? frontendPkg?.dependencies?.vite,
    );
    const buildEnv = {
      VITE_API_URL: apiBasePath,
      VITE_API_DISABLED: "false",
    } as Record<string, string | undefined>;

    // Auto-stub missing relative imports before first build attempt.
    await stubMissingRelativeImports(frontendDir);
    let lastBuildErr: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (hasVite) {
          await run("pnpm", ["exec", "vite", "build", "--base", previewAssetBase], frontendDir, buildEnv);
        } else {
          await run("pnpm", ["run", "build"], frontendDir, buildEnv);
        }
        lastBuildErr = undefined;
        break; // success
      } catch (e) {
        lastBuildErr = e instanceof Error ? e.message : String(e);
        // Attempt to auto-install missing packages from the captured error.
        const heal = await autoHealMissingPackages(frontendDir, lastBuildErr, runCaptured);
        if (!heal.healed) break; // nothing fixable — stop retrying
        await run("pnpm", ["install"], frontendDir);
      }
    }
    if (lastBuildErr !== undefined) {
      const hint = ensured.created ? ` (index.html was synthesized from ${ensured.entry})` : "";
      throw new Error(`preview_frontend_build_failed${hint}: ${lastBuildErr}`);
    }

    // Serve built frontend.
    const server = createServer((req, res) => serveStaticSpa(frontendDistDir, req, res));
    await new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(frontendPort, "127.0.0.1", () => resolve());
    });

    const s: PreviewSession = {
      id,
      missionId: input.missionId,
      wallet: input.wallet,
      rootDir,
      frontendDistDir,
      frontendPort,
      backendPort,
      createdAt: Date.now(),
      procs: { backend: backendProc },
      servers: { frontend: server },
    };
    this.sessions.set(id, s);

    // Best-effort logging capture (avoid crashes on stream errors).
    backendProc.stdout.on("data", () => {});
    backendProc.stderr.on("data", () => {});
    backendProc.on("exit", () => {
      // If backend exits, keep session but backend proxy will fail; user can restart.
    });

    return s;
  }
}

let singleton: PreviewManager | null = null;
export function previewManager(): PreviewManager {
  if (!singleton) singleton = new PreviewManager();
  return singleton;
}

