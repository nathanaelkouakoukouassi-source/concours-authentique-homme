import { after } from 'next/server'
import type { CollectionAfterChangeHook, CollectionConfig, FieldAccess } from 'payload'
import { adminOnly, isAdminUser, isJuryUser } from '../lib/access'
import {
  CANDIDATURE_STATUSES,
  CHURCH_ROLES,
  COMMITMENTS,
  EDUCATION_LEVELS,
  SITUATIONS,
} from '../lib/candidature-schema'

const adminField: FieldAccess = ({ req }) => isAdminUser(req.user as never)

const toOptions = (values: readonly string[]) => values.map((value) => ({ label: value, value }))

/**
 * Dès qu’une candidature passe en « Présélectionné » (à la main dans le back-office),
 * le candidat reçoit automatiquement son code d’accès par e-mail, s’il ne l’a pas déjà.
 * La sélection automatique gère elle-même ses envois (context.skipAccessCode).
 */
const sendCodeOnPreselection: CollectionAfterChangeHook = ({ doc, previousDoc, req, context }) => {
  if (context?.skipAccessCode) return doc
  if (doc.status !== 'preselectionne' || previousDoc?.status === 'preselectionne') return doc
  if (doc.codeSentAt) return doc

  const task = async () => {
    const { sendAccessCode } = await import('../lib/server/access-code')
    const settings = (await req.payload.findGlobal({
      slug: 'reglages-concours',
      depth: 0,
      overrideAccess: true,
    })) as { submissionDeadline?: string | null }
    const error = await sendAccessCode(req.payload, doc, {
      submissionDeadline: settings.submissionDeadline,
    })
    if (error) {
      await req.payload.update({
        collection: 'candidatures',
        id: doc.id,
        data: { codeError: error.slice(0, 250) },
        overrideAccess: true,
        context: { skipAccessCode: true },
      })
    }
  }
  // Après la réponse, une fois l’enregistrement validé en base.
  try {
    after(task)
  } catch {
    setTimeout(() => void task(), 0)
  }
  return doc
}

/**
 * Candidatures au concours AUTHENTIQUE HOMME.
 * Les inscriptions arrivent uniquement par la route /api/concours/candidature,
 * qui attribue le numéro unique et le statut automatique (cahier des charges §5 et §6).
 */
export const Candidatures: CollectionConfig = {
  slug: 'candidatures',
  labels: {
    singular: 'Candidature',
    plural: 'Candidatures',
  },
  access: {
    // Le jury ne voit que les présélectionnés, sans coordonnées privées.
    read: ({ req }) => {
      if (isAdminUser(req.user as never)) return true
      if (isJuryUser(req.user as never)) return { status: { equals: 'preselectionne' } }
      return false
    },
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    group: 'Concours Authentique Homme',
    useAsTitle: 'fullName',
    defaultColumns: ['candidateNumber', 'fullName', 'status', 'selectionScore', 'selectionRank', 'published'],
    listSearchableFields: ['candidateNumber', 'fullName', 'churchName', 'email', 'phone'],
    description:
      'Dossiers privés des candidats. Filtrez par statut pour retrouver les dossiers conformes, à vérifier ou présélectionnés. Le téléphone et l’e-mail ne sont jamais publiés.',
    pagination: { defaultLimit: 50 },
  },
  hooks: {
    afterChange: [sendCodeOnPreselection],
    beforeChange: [
      ({ data }) => {
        if (data && (data.lastName || data.firstName)) {
          data.fullName = `${data.lastName || ''} ${data.firstName || ''}`.trim()
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'candidateNumber',
          label: 'Numéro de candidature',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: { readOnly: true, width: '33%' },
        },
        {
          name: 'status',
          label: 'Statut',
          type: 'select',
          required: true,
          defaultValue: 'en-attente',
          index: true,
          options: CANDIDATURE_STATUSES.map((status) => ({ ...status })),
          admin: { width: '33%' },
        },
        {
          name: 'fullName',
          label: 'Nom complet',
          type: 'text',
          admin: { readOnly: true, width: '33%' },
        },
      ],
    },
    {
      name: 'conformityIssues',
      label: 'Contrôle automatique',
      type: 'textarea',
      admin: {
        readOnly: true,
        description:
          'Résultat de la vérification à l’inscription. Vide = toutes les conditions obligatoires sont remplies.',
      },
    },
    {
      name: 'internalComment',
      label: 'Commentaire interne du comité',
      type: 'textarea',
      access: { read: adminField },
      admin: { description: 'Visible uniquement par les administrateurs.' },
    },
    {
      name: 'published',
      label: 'Fiche publique (visible sur le site une fois la liste publiée)',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identité',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'lastName', label: 'Nom', type: 'text', required: true },
                { name: 'firstName', label: 'Prénoms', type: 'text', required: true },
              ],
            },
            {
              name: 'photoPreview',
              label: 'Photo',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/PhotoPreview#PhotoPreview',
                },
              },
            },
            {
              name: 'photoPathname',
              label: 'Fichier photo (stockage privé)',
              type: 'text',
              admin: { readOnly: true },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'phone',
                  label: 'Téléphone',
                  type: 'text',
                  required: true,
                  index: true,
                  access: { read: adminField },
                },
                {
                  name: 'email',
                  label: 'E-mail',
                  type: 'email',
                  required: true,
                  index: true,
                  access: { read: adminField },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'city', label: 'Ville de résidence', type: 'text', required: true },
                { name: 'country', label: 'Pays de résidence', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Église',
          fields: [
            {
              name: 'isChristian',
              label: 'Se déclare chrétien(ne)',
              type: 'select',
              options: toOptions(['Oui', 'Non']),
            },
            {
              type: 'row',
              fields: [
                { name: 'churchName', label: 'Nom de l’église', type: 'text', index: true },
                { name: 'denomination', label: 'Dénomination', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'churchCity', label: 'Ville de l’église', type: 'text' },
                { name: 'churchCountry', label: 'Pays de l’église', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'churchRole',
                  label: 'Fonction dans l’église',
                  type: 'select',
                  options: toOptions(CHURCH_ROLES),
                },
                { name: 'churchRoleOther', label: 'Fonction précisée', type: 'text' },
              ],
            },
          ],
        },
        {
          label: 'Parcours',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'educationLevel',
                  label: 'Niveau d’études',
                  type: 'select',
                  options: toOptions(EDUCATION_LEVELS),
                },
                { name: 'fieldOfStudy', label: 'Domaine d’études', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'situation',
                  label: 'Situation actuelle',
                  type: 'select',
                  options: toOptions(SITUATIONS),
                },
                { name: 'situationOther', label: 'Situation précisée', type: 'text' },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'currentRole', label: 'Fonction actuelle', type: 'text' },
                { name: 'organization', label: 'Organisation ou établissement', type: 'text' },
              ],
            },
            {
              name: 'publishEducation',
              label: 'Accepte la publication du niveau d’études',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
        {
          label: 'Engagements',
          fields: [
            {
              name: 'commitments',
              label: 'Engagements acceptés',
              type: 'select',
              hasMany: true,
              options: COMMITMENTS.map((item) => ({ label: item.label, value: item.name })),
              admin: { readOnly: true },
            },
            {
              name: 'submittedFromIp',
              label: 'Adresse IP d’envoi',
              type: 'text',
              access: { read: adminField },
              admin: { readOnly: true },
            },
          ],
        },
        {
          label: 'Épreuve de sélection',
          description:
            'QCM corrigé automatiquement (sur 50) et courte réflexion notée par l’IA (sur 50). Le total sert à la sélection automatique.',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'selectionScore',
                  label: 'Note de sélection /100',
                  type: 'number',
                  index: true,
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
                {
                  name: 'quizScore',
                  label: 'QCM /50',
                  type: 'number',
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
                {
                  name: 'aiScore',
                  label: 'Réflexion (IA) /50',
                  type: 'number',
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
                {
                  name: 'selectionRank',
                  label: 'Rang à la sélection',
                  type: 'number',
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
              ],
            },
            {
              name: 'reflection',
              label: 'Courte réflexion du candidat',
              type: 'textarea',
              access: { read: adminField },
              admin: { readOnly: true, rows: 10 },
            },
            {
              name: 'aiFeedback',
              label: 'Appréciation de l’IA',
              type: 'textarea',
              access: { read: adminField },
              admin: { readOnly: true },
            },
            {
              name: 'aiDetails',
              label: 'Détail de la note IA',
              type: 'json',
              access: { read: adminField },
              admin: { readOnly: true },
            },
            {
              name: 'quizAnswers',
              label: 'Réponses au QCM (index des réponses choisies)',
              type: 'json',
              access: { read: adminField },
              admin: { readOnly: true },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'aiScoredAt',
                  label: 'Notée par l’IA le',
                  type: 'date',
                  access: { read: adminField },
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
                {
                  name: 'aiError',
                  label: 'Dernière erreur de notation',
                  type: 'text',
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
              ],
            },
          ],
        },
        {
          label: 'Travaux',
          description:
            'Travaux déposés par le candidat dans son espace (ou reçus par WhatsApp). Pour l’affichage public, mettez la vidéo sur YouTube en « non répertoriée » et collez le lien ci-dessous.',
          fields: [
            {
              name: 'worksFiles',
              type: 'ui',
              admin: { components: { Field: '/components/admin/WorksFiles#WorksFiles' } },
            },
            ...(['video', 'pdf'] as const).flatMap((kind) => [
              {
                name: `${kind}Pathname`,
                type: 'text' as const,
                access: { read: adminField },
                admin: { hidden: true },
              },
              {
                name: `${kind}Size`,
                type: 'number' as const,
                access: { read: adminField },
                admin: { hidden: true },
              },
              {
                name: `${kind}Filename`,
                type: 'text' as const,
                access: { read: adminField },
                admin: { hidden: true },
              },
              {
                name: `${kind}UploadedAt`,
                type: 'date' as const,
                access: { read: adminField },
                admin: { hidden: true },
              },
            ]),
            {
              name: 'worksStatus',
              label: 'Statut des travaux',
              type: 'select',
              defaultValue: 'attendus',
              options: [
                { label: 'Travaux attendus', value: 'attendus' },
                { label: 'Travaux reçus', value: 'recus' },
                { label: 'Travaux incomplets', value: 'incomplets' },
                { label: 'Travaux en vérification', value: 'verification' },
                { label: 'Travaux validés', value: 'valides' },
                { label: 'Travaux publiés', value: 'publies' },
              ],
            },
            { name: 'reflectionTitle', label: 'Titre de la réflexion', type: 'text' },
            {
              name: 'reflectionSummary',
              label: 'Introduction ou résumé',
              type: 'textarea',
            },
            {
              name: 'biblicalReferences',
              label: 'Références bibliques',
              type: 'textarea',
              admin: { description: 'Une référence par ligne, ex. Luc 15 : 11-32' },
            },
            {
              name: 'fullText',
              label: 'Texte intégral du travail écrit',
              type: 'textarea',
              admin: { rows: 20 },
            },
            {
              name: 'videoUrl',
              label: 'Lien de la vidéo (YouTube ou Vimeo)',
              type: 'text',
            },
          ],
        },
        {
          label: 'Suivi',
          fields: [
            {
              name: 'newAccessCode',
              type: 'ui',
              admin: { components: { Field: '/components/admin/NewAccessCode#NewAccessCode' } },
            },
            {
              name: 'accessCodeHash',
              type: 'text',
              access: { read: adminField, update: adminField },
              admin: { hidden: true },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'codeSentAt',
                  label: 'Code d’accès envoyé le',
                  type: 'date',
                  access: { read: adminField },
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
                {
                  name: 'codeError',
                  label: 'Échec d’envoi du code',
                  type: 'text',
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
                {
                  name: 'dossierDownloadedAt',
                  label: 'Dossier téléchargé le',
                  type: 'date',
                  access: { read: adminField },
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
                {
                  name: 'dossierDownloads',
                  label: 'Téléchargements',
                  type: 'number',
                  defaultValue: 0,
                  access: { read: adminField },
                  admin: { readOnly: true },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
