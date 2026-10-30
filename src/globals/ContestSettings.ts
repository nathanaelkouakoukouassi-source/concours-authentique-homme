import type { GlobalConfig } from 'payload'
import { adminOnly } from '../lib/access'

export const VOTE_STATUSES = [
  { label: 'Vote à venir', value: 'a-venir' },
  { label: 'Vote ouvert', value: 'ouvert' },
  { label: 'Vote clôturé', value: 'clos' },
  { label: 'Résultats en cours de validation', value: 'validation' },
  { label: 'Résultats publiés', value: 'publies' },
] as const

/**
 * Pilotage du concours : un seul écran pour ouvrir/fermer les étapes et publier.
 */
export const ContestSettings: GlobalConfig = {
  slug: 'reglages-concours',
  label: 'Pilotage du concours',
  admin: {
    group: 'Concours Authentique Homme',
    description:
      'Ouvrez et fermez chaque étape, envoyez les codes aux présélectionnés et publiez les résultats.',
  },
  // Lecture réservée aux administrateurs : le site lit ces réglages côté serveur.
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '1. Inscriptions',
          fields: [
            {
              name: 'registrationsOpen',
              label: 'Inscriptions ouvertes',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'registrationDeadline',
                  label: 'Date limite affichée',
                  type: 'text',
                  admin: { placeholder: 'ex. 30 novembre 2026' },
                },
                {
                  name: 'minimumAge',
                  label: 'Âge minimum affiché',
                  type: 'text',
                  admin: { placeholder: 'ex. 18 ans' },
                },
              ],
            },
            {
              name: 'registrationClosesAt',
              label: 'Clôture automatique des inscriptions',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
                description:
                  'À cette date, les inscriptions se ferment et la sélection automatique des meilleurs candidats se lance.',
              },
            },
          ],
        },
        {
          label: 'Épreuve et sélection',
          fields: [
            {
              name: 'selectionPanel',
              type: 'ui',
              admin: {
                components: { Field: '/components/admin/SelectionPanel#SelectionPanel' },
              },
            },
            {
              name: 'autoSelectionEnabled',
              label: 'Sélection automatique activée',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description:
                  'À la clôture : classement des candidatures conformes (QCM sur 50 + réflexion notée par l’IA sur 50), présélection des meilleures, publication de la liste et envoi des codes d’accès.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'preselectionSize',
                  label: 'Nombre de candidats retenus',
                  type: 'number',
                  defaultValue: 10,
                  min: 1,
                  max: 50,
                },
                {
                  name: 'autoPublishList',
                  label: 'Publier automatiquement la liste',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'autoNotify',
                  label: 'Envoyer automatiquement les codes d’accès',
                  type: 'checkbox',
                  defaultValue: true,
                },
              ],
            },
            {
              name: 'selectionStatus',
              label: 'État de la sélection automatique',
              type: 'select',
              defaultValue: 'en-attente',
              options: [
                { label: 'En attente de la clôture', value: 'en-attente' },
                { label: 'En cours', value: 'en-cours' },
                { label: 'Terminée', value: 'terminee' },
                { label: 'Erreur (voir le journal)', value: 'erreur' },
              ],
              admin: { readOnly: true },
            },
            {
              name: 'selectionRunAt',
              label: 'Dernière exécution',
              type: 'date',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'selectionLog',
              label: 'Journal de la sélection',
              type: 'textarea',
              admin: { readOnly: true },
            },
            {
              name: 'reflectionPrompt',
              label: 'Consigne de la courte réflexion',
              type: 'textarea',
              admin: {
                description:
                  'Laissez vide pour utiliser la consigne par défaut sur Luc 15 : 11-32. Ne la modifiez plus une fois les inscriptions ouvertes.',
              },
            },
            {
              name: 'quizQuestions',
              label: 'Questions du QCM',
              type: 'array',
              labels: { singular: 'Question', plural: 'Questions' },
              admin: {
                description:
                  'Laissez vide pour utiliser les 10 questions par défaut sur Luc 15. Ne modifiez plus les questions une fois les inscriptions ouvertes : les notes déjà calculées ne changeraient pas.',
              },
              fields: [
                { name: 'question', label: 'Question', type: 'text', required: true },
                {
                  name: 'options',
                  label: 'Réponses proposées',
                  type: 'array',
                  minRows: 2,
                  maxRows: 6,
                  fields: [{ name: 'text', label: 'Réponse', type: 'text', required: true }],
                },
                {
                  name: 'correctOption',
                  label: 'Numéro de la bonne réponse (1 = première)',
                  type: 'number',
                  required: true,
                  min: 1,
                  max: 6,
                },
              ],
            },
          ],
        },
        {
          label: '2. Présélection et dossier',
          fields: [
            {
              name: 'preselectionPublished',
              label: 'Publier la liste des candidats présélectionnés sur le site',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  'Affiche publiquement les candidatures au statut « Présélectionné » cochées « Fiche publique ».',
              },
            },
            {
              name: 'dossierUpload',
              type: 'ui',
              admin: { components: { Field: '/components/admin/DossierUpload#DossierUpload' } },
            },
            {
              name: 'dossierPathname',
              label: 'Dossier officiel (fichier privé)',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'dossierFilename',
              label: 'Nom du fichier',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              name: 'dossierEnabled',
              label: 'Téléchargement du dossier activé pour les présélectionnés',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'submissionDeadline',
                  label: 'Date limite de soumission des travaux',
                  type: 'text',
                  admin: { placeholder: 'ex. 10 décembre 2026 à 23 h 59' },
                },
                {
                  name: 'whatsappNumber',
                  label: 'Numéro WhatsApp officiel du concours',
                  type: 'text',
                  admin: { placeholder: 'ex. +225 07 00 00 00 00' },
                },
              ],
            },
            {
              name: 'instructions',
              label: 'Consignes affichées dans l’espace candidat',
              type: 'textarea',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'worksUploadOpen',
                  label: 'Dépôt des travaux ouvert dans l’espace candidat',
                  type: 'checkbox',
                  defaultValue: true,
                },
                {
                  name: 'worksClosesAt',
                  label: 'Fermeture automatique du dépôt (facultatif)',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' } },
                },
              ],
            },
            {
              name: 'notifyPreselected',
              type: 'ui',
              admin: {
                components: { Field: '/components/admin/NotifyPreselected#NotifyPreselected' },
              },
            },
          ],
        },
        {
          label: '3. Vote du public',
          fields: [
            {
              name: 'voteStatus',
              label: 'État du vote',
              type: 'select',
              required: true,
              defaultValue: 'a-venir',
              options: VOTE_STATUSES.map((status) => ({ ...status })),
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'voteOpensAt',
                  label: 'Ouverture automatique (facultatif)',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' } },
                },
                {
                  name: 'voteClosesAt',
                  label: 'Clôture automatique (facultatif)',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' } },
                },
              ],
            },
            {
              name: 'voteHelp',
              type: 'ui',
              admin: {
                components: { Field: '/components/admin/Ranking#VoteHelp' },
              },
            },
          ],
        },
        {
          label: '4. Jury et résultats',
          fields: [
            {
              name: 'juryLocked',
              label: 'Verrouiller les délibérations (le jury ne peut plus modifier ses notes)',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'ranking',
              type: 'ui',
              admin: { components: { Field: '/components/admin/Ranking#Ranking' } },
            },
            {
              name: 'resultsPublished',
              label: 'Publier le classement de la présélection',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'showJuryScore',
              label: 'Afficher la note du jury dans les résultats publics',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              name: 'finalistsPublished',
              label: 'Annoncer les trois finalistes',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'finalTopic',
              label: 'Sujet de la grande finale (visible des finalistes dans leur espace)',
              type: 'textarea',
            },
            {
              name: 'laureatesPublished',
              label: 'Proclamer les lauréats (classement de la grande finale)',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
      ],
    },
  ],
}
