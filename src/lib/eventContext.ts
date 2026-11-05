// Contexte "course liée à un événement" — même principe que le contexte de duel.
// La progression elle-même est déjà synchronisée côté serveur via sync_event_progress
// après chaque course validée ; ce contexte sert uniquement à afficher l'événement
// visé pendant la course et à guider l'utilisateur.

export const EVENT_CONTEXT_KEY = "freakout_event_context";

export interface EventContext {
  id: string;
  title: string;
  distance: number;
  userId?: string;
  startedAt?: number;
}

export function setEventContext(ctx: EventContext) {
  try {
    localStorage.setItem(EVENT_CONTEXT_KEY, JSON.stringify(ctx));
  } catch { /* ignore */ }
}

export function readEventContext(): EventContext | null {
  try {
    const raw = localStorage.getItem(EVENT_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as EventContext) : null;
  } catch {
    return null;
  }
}

export function clearEventContext() {
  try {
    localStorage.removeItem(EVENT_CONTEXT_KEY);
  } catch { /* ignore */ }
}
