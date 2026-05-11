/**
 * Mission classification, shallow "RAG" from design artifacts, and static UI/stack checks.
 * Complements LLM critique + `PreviewManager.diagnoseArtifactBuild`.
 */

/** Same signals as missions route (landing); dashboard/DEX wording triggers polish gates too. */
export function isLandingStyleBrief(title: string, objective: string): boolean {
  const t = `${title} ${objective}`.toLowerCase();
  if (
    /\blanding page\b|\blanding site\b|\bhomepage\b|\bhome page\b|\bmarketing site\b|\bmarketing page\b|\bmarketing website\b|\bsplash page\b/.test(t)
  ) {
    return true;
  }
  if (
    (t.includes("production ready") || t.includes("production-ready")) &&
    /\b(page|site|landing|homepage|frontend|website|web app)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

export function isUiPolishMission(title: string, objective: string): boolean {
  if (isLandingStyleBrief(title, objective)) return true;
  const t = `${title} ${objective}`.toLowerCase();
  return /\b(dashboard|\bdex\b|defi|portfolio|trading\s+ui|analytics\s+dashboard)\b/.test(t);
}

export function chunkText(s: string, maxChunk: number): string[] {
  const t = s.trim();
  if (t.length === 0) return [];
  if (t.length <= maxChunk) return [t];
  const parts: string[] = [];
  for (let i = 0; i < t.length; i += maxChunk) parts.push(t.slice(i, i + maxChunk));
  return parts;
}

/** Latest `design/ui-spec.md` body for prompt injection ("RAG-lite"). */
export function pickLatestDesignUiSpec(
  artifacts: Array<{ path: string; content: string; createdAt: number }>,
): { content: string; createdAt: number } | null {
  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
  const rows = artifacts.filter((a) => {
    const n = norm(a.path);
    return n.endsWith("/design/ui-spec.md") || n === "design/ui-spec.md";
  });
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.createdAt - a.createdAt);
  const top = rows[0];
  return top?.content?.trim()
    ? { content: top.content, createdAt: top.createdAt }
    : null;
}

export function buildDesignRagUserBlock(
  artifacts: Array<{ path: string; content: string; createdAt: number }>,
  maxChars = 7000,
): string {
  const spec = pickLatestDesignUiSpec(artifacts);
  if (!spec) return "";
  const [first, ...rest] = chunkText(spec.content, Math.min(4500, maxChars));
  if (!first) return "";
  let block = "## Retrieved design spec (implement faithfully; do not ignore)\n\n" + first.trim();
  if (rest.length > 0 && block.length + 120 < maxChars) {
    block +=
      "\n\n…(spec continues — key themes are above; prioritize tokens, sections, components from full spec in repo)…\n" +
      rest.join("\n").slice(0, maxChars - block.length - 100);
  }
  return block.slice(0, maxChars);
}

const TW_TOKEN =
  /\b(bg-|from-|to-|via-|text-|border-|rounded|shadow|backdrop-|flex|grid|inline-flex|gap-|space-[xy]-|p[trblxy]?-|m[trblxy]?-|w-|h-|min-h|max-w|min-w|sticky|relative|absolute|fixed|overflow-|z-|hidden|sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|dark:|transition|duration|ease|opacity|blur|brightness|invert|backdrop|divide-|ring)\b/g;

function frontendPackageDeps(content: string | undefined): Record<string, string> {
  if (!content) return {};
  try {
    const j = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
  } catch {
    return {};
  }
}

/** Require Tailwind in package + config for UI-heavy missions (stack default). */
export function verifyTailwindStack(paths: string[], contents: Map<string, string>, title: string, objective: string): string[] {
  if (!isUiPolishMission(title, objective)) return [];
  const issues: string[] = [];
  const lowerPaths = paths.map((p) => p.replace(/\\/g, "/").toLowerCase());
  const hasTailwindFile = lowerPaths.some(
    (p) => p.includes("tailwind.config") || p.includes("tailwind.config.ts") || p.includes("tailwind.config.js"),
  );
  const pkgKey = [...contents.keys()].find((k) => k.replace(/\\/g, "/").toLowerCase() === "frontend/package.json");
  const pkgRaw = pkgKey ? contents.get(pkgKey) : undefined;
  const deps = frontendPackageDeps(pkgRaw);
  const hasTailwindDep = Boolean(deps.tailwindcss || deps["@tailwindcss/vite"]);

  if (!hasTailwindDep) {
    issues.push(
      "Stack (HiveMind UI default): Add Tailwind — `tailwindcss`, `postcss`, `autoprefixer` (or `@tailwindcss/vite`), wire `tailwind.config.*` / `postcss.config.*`, and `@tailwind`/`@theme`/`@tailwind base` directives in CSS; use utility classes throughout TSX.",
    );
  } else if (!hasTailwindFile && !deps["@tailwindcss/vite"]) {
    issues.push(
      "Tailwind dependency present — add `tailwind.config.js`/`tailwind.config.ts` (or `@tailwindcss/vite` in vite.config) and ensure CSS entry imports Tailwind.",
    );
  }
  return issues;
}

export function verifyUiContentHeuristics(contents: Map<string, string>, title: string, objective: string): string[] {
  if (!isUiPolishMission(title, objective)) return [];
  const issues: string[] = [];
  const keys = [...contents.keys()].map((k) => k.replace(/\\/g, "/"));

  let tailwindishScore = 0;
  let cssChars = 0;
  let appCandidate = "";

  for (const [rel, src] of contents.entries()) {
    const p = rel.replace(/\\/g, "/").toLowerCase();
    if (p.startsWith("frontend/") && p.endsWith(".css")) cssChars += src.length;
    if (/^frontend\/src\/app\.(tsx|jsx)$/i.test(p)) appCandidate = src;
    if (/\.(tsx|jsx)$/i.test(p) && p.startsWith("frontend/")) {
      const m = src.match(TW_TOKEN);
      tailwindishScore += m?.length ?? 0;
    }
  }

  const hasTailwindFile = keys.some((k) => k.includes("tailwind.config"));
  const pkgKey = [...contents.keys()].find((k) => k.replace(/\\/g, "/").toLowerCase() === "frontend/package.json");
  const deps = frontendPackageDeps(pkgKey ? contents.get(pkgKey) : undefined);
  const tailwindConfigured = Boolean(deps.tailwindcss || deps["@tailwindcss/vite"] || hasTailwindFile);

  if (tailwindConfigured && tailwindishScore < 28) {
    issues.push(
      `UI heuristic: Tailwind-like setup detected but JSX has few utility-like tokens (${tailwindishScore}); add layouts (flex/grid), spacing, typography, responsive breakpoints, borders/shadows, and cohesive dark/light styling.`,
    );
  }

  if (!tailwindConfigured && cssChars < 450) {
    issues.push(
      "UI heuristic: little or no substantive CSS alongside missing Tailwind — ship either full Tailwind stack or ≥500 chars of purposeful global/layout CSS imported from entry.",
    );
  }

  if (appCandidate) {
    const classNames = appCandidate.match(/\bclassName\s*=/g)?.length ?? 0;
    const headings = appCandidate.match(/<[hH][1-6][\s>]/g)?.length ?? 0;
    if (appCandidate.length < 4200 && headings >= 3 && classNames <= 6) {
      issues.push(
        "UI heuristic: `App.tsx` looks like stacked headings — extract sections into components, add nav/sidebar/cards, buttons with states, and real layout/CSS.",
      );
    }
  }

  return issues;
}

const VITE_API_TEMPLATE_API = /\$\{\s*import\.meta\.env\.VITE_API_URL\s*\}\/api\//;
const VITE_API_CONCAT_API = /import\.meta\.env\.VITE_API_URL\s*\+\s*["']\/api\//;

/** Catches `${VITE_API_URL}/api/foo` which becomes /api/api/foo in HiveMind preview. */
/** Vite 2/3 with modern plugin-react → `vite.createFilter is not a function` at config load. */
export function verifyStaleViteToolchain(contents: Map<string, string>): string[] {
  const pkgKey = [...contents.keys()].find((k) => k.replace(/\\/g, "/").toLowerCase() === "frontend/package.json");
  const raw = pkgKey ? contents.get(pkgKey) : undefined;
  if (!raw) return [];
  let j: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    j = JSON.parse(raw) as typeof j;
  } catch {
    return [];
  }
  const spec = j.devDependencies?.vite ?? j.dependencies?.vite;
  if (!spec) return [];
  const m = String(spec).trim().match(/(\d+)/);
  if (!m) return [];
  const major = parseInt(m[1]!, 10);
  if (!Number.isFinite(major) || major >= 5) return [];
  return [
    "frontend/package.json pins Vite < 5 — update to `vite` ^5.4.x and `@vitejs/plugin-react` ^4.3.x (HiveMind preview normalizes this server-side, but fix sources for consistency). Old Vite cannot provide APIs plugin-react expects (`createFilter`).",
  ];
}

export function verifyViteApiUrlAntipattern(contents: Map<string, string>): string[] {
  const bad: string[] = [];
  for (const [p, c] of contents.entries()) {
    const pl = p.replace(/\\/g, "/");
    if (!/^frontend\/.*\.(tsx|ts|jsx|js)$/i.test(pl)) continue;
    if (VITE_API_TEMPLATE_API.test(c) || VITE_API_CONCAT_API.test(c)) bad.push(pl);
  }
  if (bad.length === 0) return [];
  return [
    `Remove duplicate /api/ after import.meta.env.VITE_API_URL (${bad.slice(0, 6).join(", ")}${bad.length > 6 ? "…" : ""}). HiveMind sets VITE_API_URL to the API root (.../api); use \`\${import.meta.env.VITE_API_URL}/games\` not .../api/games. After fetch, use response.ok and Array.isArray(...) before .map.`,
  ];
}

/**
 * Frontend ships <BrowserRouter><Routes> but no `<Route path="/" …/>` and no catch-all → at runtime
 * RR6 fires "No routes matched location '/'" and the preview iframe is blank.
 * Catch this statically so the verify-repair loop can fix it before the user ever opens the preview.
 */
export function verifyReactRouterHasHomeRoute(contents: Map<string, string>): string[] {
  let usesRouter = false;
  let hasRoutes = false;
  let hasRootRoute = false;
  let hasCatchAll = false;
  for (const [p, src] of contents.entries()) {
    const pl = p.replace(/\\/g, "/").toLowerCase();
    if (!pl.startsWith("frontend/") || !/\.(tsx|jsx)$/i.test(pl)) continue;
    if (!src.includes("react-router-dom")) continue;
    usesRouter = true;
    if (/<\s*Routes\b/.test(src) || /createBrowserRouter\s*\(/.test(src)) hasRoutes = true;
    // path="/" with optional spaces; allow single or double quotes
    if (/<\s*Route\b[^>]*\bpath\s*=\s*(["'])\/\1/.test(src)) hasRootRoute = true;
    // Common index route patterns: `<Route index …/>`, exact path "" or "/*"
    if (/<\s*Route\b[^>]*\bindex\b/.test(src)) hasRootRoute = true;
    if (/<\s*Route\b[^>]*\bpath\s*=\s*(["'])\1/.test(src)) hasRootRoute = true; // path=""
    if (/<\s*Route\b[^>]*\bpath\s*=\s*(["'])\*\1/.test(src)) hasCatchAll = true;
    if (/<\s*Route\b[^>]*\bpath\s*=\s*(["'])\/\*\1/.test(src)) hasCatchAll = true;
  }
  if (!usesRouter || !hasRoutes) return [];
  if (hasRootRoute || hasCatchAll) return [];
  return [
    "React Router renders no UI at `/` — `<Routes>` is present but no `<Route path=\"/\">`, `<Route index />`, or catch-all `<Route path=\"*\">` exists. The preview iframe loads at `/` so the page will be blank with a 'No routes matched location \"/\"' console warning. Add an explicit home route OR a catch-all that renders the main view.",
  ];
}

/**
 * BrowserRouter inside Sandpack's iframe is mounted at `/` — a hardcoded `basename` to a deeper path
 * (e.g. "/preview/abc/") makes routes never match in the live preview. The hosted Vite build path
 * is injected at build time, so source files should not pin a basename.
 */
export function verifyNoHardcodedBasename(contents: Map<string, string>): string[] {
  const bad: string[] = [];
  for (const [p, src] of contents.entries()) {
    const pl = p.replace(/\\/g, "/");
    if (!/^frontend\/.*\.(tsx|jsx)$/i.test(pl)) continue;
    if (!src.includes("react-router-dom")) continue;
    // Detect basename="/something" or basename={'/something'} — but allow basename={import.meta.env.BASE_URL}
    const m = src.match(/basename\s*=\s*(?:["']([^"']+)["']|\{\s*["']([^"']+)["']\s*\})/);
    if (m && (m[1] ?? m[2])) bad.push(pl);
  }
  if (bad.length === 0) return [];
  return [
    `Remove hardcoded \`basename\` on Router in ${bad.slice(0, 4).join(", ")}${bad.length > 4 ? "…" : ""}. The hosted Vite preview injects \`basename={import.meta.env.BASE_URL}\` automatically; a string literal breaks Sandpack and double-prefixes hosted routes.`,
  ];
}
