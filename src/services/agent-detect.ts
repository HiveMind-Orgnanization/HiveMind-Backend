/**
 * Heuristic: pick the best agent specialization for a given mission title + objective.
 * Returns the specialization string matching agents seeded in the DB.
 */
export function detectAgentSpecialization(title: string, objective: string): string {
  const text = `${title} ${objective}`.toLowerCase();

  const rules: { pattern: RegExp; spec: string }[] = [
    { pattern: /\b(code|build|develop|implement|backend|frontend|api|login|page|app|website|database|deploy|engineer|programming|software)\b/, spec: "Development" },
    { pattern: /\b(design|ui|ux|visual|brand|logo|mockup|figma|wireframe|layout|color|typography|graphic|aesthetic)\b/, spec: "Design" },
    { pattern: /\b(market|campaign|meme|viral|social media|promote|advertise|growth|reach|influencer|content|seo|ads)\b/, spec: "Marketing" },
    { pattern: /\b(research|analyze|data|insight|survey|competitive|report|study|trend|intel|signal)\b/, spec: "Research" },
    { pattern: /\b(treasury|fund|budget|payment|escrow|token|sol|crypto|wallet|financial|revenue|cost)\b/, spec: "Treasury" },
    { pattern: /\b(analytic|metric|measure|track|dashboard|kpi|performance|monitor|stat)\b/, spec: "Analytics" },
    { pattern: /\b(coordinat|sync|orchestrat|route|schedule|manage|workflow|pipeline)\b/, spec: "Coordination" },
    { pattern: /\b(strateg|plan|roadmap|goal|objective|vision|mission|priorit|direct)\b/, spec: "Strategy" },
  ];

  for (const { pattern, spec } of rules) {
    if (pattern.test(text)) return spec;
  }

  return "Strategy";
}
