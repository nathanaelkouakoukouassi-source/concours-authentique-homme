import type { Access, CollectionConfig } from 'payload'
import {
  CANDIDATURE_STATUSES,
  CHURCH_ROLES,
  COMMITMENTS,
  EDUCATION_LEVELS,
  SITUATIONS,
} from '../lib/candidature-schema'

const isPayloadAdmin: Access = ({ req }) => req.user?.collection === 'users'

const toOptions = (values: readonly string[]) => values.map((value) => ({ label: value, value }))

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
    read: isPayloadAdmin,
    create: isPayloadAdmin,
    update: isPayloadAdmin,
    delete: isPayloadAdmin,
  },
  admin: {
    group: 'Concours Authentique Homme',
    useAsTitle: 'fullName',
    defaultColumns: ['candidateNumber', 'fullName', 'churchName', 'status', 'createdAt'],
    listSearchableFields: ['candidateNumber', 'fullName', 'churchName', 'email', 'phone'],
    description:
      'Dossiers privés des candidats. Filtrez par statut pour retrouver les dossiers conformes, à vérifier ou présélectionnés. Le téléphone et l’e-mail ne sont jamais publiés.',
    pagination: { defaultLimit: 50 },
  },
  hooks: {
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
      admin: { description: 'Visible uniquement dans le back-office.' },
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
              name: 'photo',
              label: 'Photo',
              type: 'upload',
              relationTo: 'candidate-photos',
            },
            {
              type: 'row',
              fields: [
                { name: 'phone', label: 'Téléphone', type: 'text', required: true, index: true },
                { name: 'email', label: 'E-mail', type: 'email', required: true, index: true },
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
              admin: { readOnly: true },
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
