export type AgentKind = "chat" | "search" | "coding" | "vision";
export function routePrompt(prompt: string, hasImages: boolean): AgentKind {
  if (hasImages) return "vision";
  if (/\\b(current|latest|today|weather|news|price|trending|recent|near me|this week|right now|search the web)\\b/i.test(prompt)) return "search";
  if (/\\b(code|debug|typescript|javascript|react|hono|python|sql|function|compiler|error|stack trace|implement|refactor|program)\\b/i.test(prompt)) return "coding";
  return "chat";
}