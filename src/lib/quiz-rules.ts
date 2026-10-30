/** Règles de l’épreuve partagées avec le navigateur (aucune bonne réponse ici). */
export const QUIZ_TOTAL_POINTS = 50
export const AI_TOTAL_POINTS = 50
export const REFLECTION_MIN_WORDS = 80
export const REFLECTION_MAX_WORDS = 400

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
