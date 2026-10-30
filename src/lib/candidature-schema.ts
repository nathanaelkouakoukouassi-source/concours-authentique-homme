// Schéma partagé du concours AUTHENTIQUE HOMME (client + serveur).

export const CHURCH_ROLES = [
  'Fidèle / membre',
  'Responsable de département',
  'Responsable de jeunesse',
  'Chantre / musicien',
  'Évangéliste',
  'Pasteur / responsable spirituel',
  'Serviteur / servante',
  'Autre',
] as const

export const EDUCATION_LEVELS = [
  'Aucun diplôme déclaré',
  'BEPC',
  'BAC',
  'BAC +2',
  'BAC +3',
  'BAC +4',
  'BAC +5',
  'Doctorat',
  'Autre formation ou qualification',
] as const

export const SITUATIONS = [
  'Élève',
  'Étudiant',
  'Salarié',
  'Entrepreneur',
  'Travailleur indépendant',
  'Sans emploi',
  'Autre',
] as const

export const COMMITMENTS = [
  { name: 'certifyChristian', label: 'Je certifie être chrétien(ne).' },
  { name: 'certifyAccuracy', label: 'Je confirme l’exactitude des informations fournies.' },
  { name: 'acknowledgeRules', label: 'Je reconnais avoir pris connaissance du règlement.' },
  { name: 'respectConditions', label: 'Je m’engage à respecter les conditions du concours.' },
  {
    name: 'dataProcessing',
    label: 'J’autorise le traitement de mes données pour la gestion de ma candidature.',
  },
  {
    name: 'mediaConsent',
    label:
      'J’accepte les conditions de diffusion de ma photo et de mes prestations telles que précisées dans les autorisations du concours.',
  },
] as const

export const CANDIDATURE_STATUSES = [
  { label: 'Conforme', value: 'conforme' },
  { label: 'Non conforme', value: 'non-conforme' },
  { label: 'À vérifier', value: 'a-verifier' },
  { label: 'En attente de validation', value: 'en-attente' },
  { label: 'Présélectionné', value: 'preselectionne' },
  { label: 'Refusé', value: 'refuse' },
] as const

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// 4 Mo : la limite des requêtes sur Vercel est de 4,5 Mo.
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024

export const TEXT_FIELDS = [
  'lastName',
  'firstName',
  'phone',
  'email',
  'city',
  'country',
  'isChristian',
  'churchName',
  'denomination',
  'churchCity',
  'churchCountry',
  'churchRole',
  'churchRoleOther',
  'educationLevel',
  'fieldOfStudy',
  'situation',
  'situationOther',
  'currentRole',
  'organization',
  'publishEducation',
] as const

export type CandidatureData = Partial<Record<(typeof TEXT_FIELDS)[number], string>> & {
  commitments: string[]
}

export const REQUIRED_BY_STEP: Array<Array<(typeof TEXT_FIELDS)[number]>> = [
  ['lastName', 'firstName', 'phone', 'email', 'city', 'country'],
  ['isChristian', 'churchName', 'denomination', 'churchCity', 'churchCountry', 'churchRole'],
  ['educationLevel', 'situation'],
  [],
]

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Numéro international ou local : 8 à 15 chiffres, espaces, +, tirets ou points tolérés. */
export function isValidPhone(value: string) {
  const digits = value.replace(/[\s.\-()]/g, '')
  return /^\+?\d{8,15}$/.test(digits)
}

export function normalizePhone(value: string) {
  return value.replace(/[\s.\-()]/g, '')
}

/** Contrôle automatique des conditions obligatoires (cahier des charges §6.1). */
export function checkConformity(data: CandidatureData, hasPhoto: boolean) {
  const issues: string[] = []
  if (!data.lastName || !data.firstName) issues.push('Nom ou prénoms manquants.')
  if (!hasPhoto) issues.push('Photo du candidat manquante.')
  if (!data.phone || !isValidPhone(data.phone)) issues.push('Numéro de téléphone invalide.')
  if (!data.email || !EMAIL_PATTERN.test(data.email)) issues.push('Adresse e-mail invalide.')
  if (!data.city || !data.country) issues.push('Ville ou pays de résidence manquant.')
  if (data.isChristian !== 'Oui') issues.push('Le candidat ne s’est pas déclaré chrétien(ne).')
  if (!data.churchName) issues.push('Nom de l’église manquant.')
  if (!data.denomination || !data.churchCity || !data.churchCountry || !data.churchRole) {
    issues.push('Informations religieuses incomplètes.')
  }
  if (data.churchRole === 'Autre' && !data.churchRoleOther) {
    issues.push('Fonction dans l’église non précisée.')
  }
  if (!data.educationLevel || !data.situation) issues.push('Parcours incomplet.')
  const missingCommitments = COMMITMENTS.filter((c) => !data.commitments.includes(c.name))
  if (missingCommitments.length) issues.push('Tous les engagements n’ont pas été acceptés.')
  return issues
}
