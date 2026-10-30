/**
 * Épreuve de sélection : QCM biblique (sur 50) + courte réflexion notée par l’IA (sur 50).
 * Les questions sont modifiables dans le back-office (Pilotage du concours → Épreuve) ;
 * ces questions par défaut sont utilisées tant qu’aucune n’y est saisie.
 * Textes bibliques : Luc 15 : 11-32 (traduction Louis Segond 1910).
 */

export type QuizQuestion = {
  question: string
  options: string[]
  /** Index (à partir de 0) de la bonne réponse — jamais envoyé au navigateur. */
  correct: number
}

import { QUIZ_TOTAL_POINTS } from './quiz-rules'

export {
  AI_TOTAL_POINTS,
  QUIZ_TOTAL_POINTS,
  REFLECTION_MAX_WORDS,
  REFLECTION_MIN_WORDS,
  countWords,
} from './quiz-rules'

export const DEFAULT_REFLECTION_PROMPT =
  'En vous appuyant sur Luc 15 : 11-32, expliquez en quelques lignes comment un homme qui a connu l’échec et la honte peut retrouver sa dignité et reprendre sa place dans la société. Citez au moins une référence biblique et proposez une solution concrète.'

export const DEFAULT_QUIZ: QuizQuestion[] = [
  {
    question: 'Dans Luc 15, que demande le fils cadet à son père ?',
    options: [
      'Sa bénédiction avant un voyage',
      'La part de bien qui doit lui revenir',
      'Un travail dans les champs',
      'La permission de se marier',
    ],
    correct: 1,
  },
  {
    question: 'Où le fils cadet s’en va-t-il ?',
    options: [
      'À Jérusalem',
      'Dans le désert',
      'Dans un pays éloigné',
      'Chez son oncle',
    ],
    correct: 2,
  },
  {
    question: 'Comment dissipe-t-il son bien ?',
    options: [
      'En vivant dans la débauche',
      'En le prêtant à ses amis',
      'En achetant des terres',
      'En le donnant aux pauvres',
    ],
    correct: 0,
  },
  {
    question: 'Quel travail finit-il par accepter ?',
    options: [
      'Pêcheur sur le lac',
      'Serviteur dans un temple',
      'Garder les pourceaux',
      'Vendangeur dans une vigne',
    ],
    correct: 2,
  },
  {
    question: 'De quoi aurait-il voulu se rassasier ?',
    options: [
      'Du pain des serviteurs de son père',
      'Des carouges que mangeaient les pourceaux',
      'Des restes d’un festin',
      'Des fruits d’un figuier',
    ],
    correct: 1,
  },
  {
    question: 'Après être « rentré en lui-même », que décide-t-il de dire à son père ?',
    options: [
      '« Rends-moi ma part. »',
      '« J’ai péché contre le ciel et contre toi. »',
      '« Mon frère m’a chassé. »',
      '« Je reviens réclamer mon héritage. »',
    ],
    correct: 1,
  },
  {
    question: 'Que fait le père lorsqu’il voit son fils de loin ?',
    options: [
      'Il attend qu’il vienne s’excuser',
      'Il envoie un serviteur le questionner',
      'Ému de compassion, il court, se jette à son cou et l’embrasse',
      'Il lui demande de travailler comme ouvrier',
    ],
    correct: 2,
  },
  {
    question: 'Qu’est-ce que le père fait apporter pour son fils ?',
    options: [
      'Une épée, un bouclier et un cheval',
      'La plus belle robe, un anneau et des souliers',
      'De l’or, de l’encens et de la myrrhe',
      'Une tente, du pain et du vin',
    ],
    correct: 1,
  },
  {
    question: 'Comment réagit le fils aîné en apprenant la fête ?',
    options: [
      'Il se met en colère et ne veut pas entrer',
      'Il organise lui-même la fête',
      'Il quitte la maison à son tour',
      'Il offre un cadeau à son frère',
    ],
    correct: 0,
  },
  {
    question: 'Selon le père, pourquoi fallait-il se réjouir ?',
    options: [
      'Parce que la récolte était abondante',
      'Parce que le fils aîné allait se marier',
      'Parce que son frère était mort et est revenu à la vie ; il était perdu et il est retrouvé',
      'Parce que la dette de la famille était payée',
    ],
    correct: 2,
  },
]

/** Questions sans les bonnes réponses, pour le navigateur. */
export function publicQuiz(questions: QuizQuestion[]) {
  return questions.map((item) => ({ question: item.question, options: item.options }))
}

/** Note du QCM ramenée sur 50 points. */
export function scoreQuiz(questions: QuizQuestion[], answers: Array<number | null>) {
  if (!questions.length) return 0
  const good = questions.filter((item, index) => answers[index] === item.correct).length
  return Math.round((good / questions.length) * QUIZ_TOTAL_POINTS * 10) / 10
}
