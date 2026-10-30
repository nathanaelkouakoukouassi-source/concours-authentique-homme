import type { CollectionConfig } from 'payload'
import { adminOnly } from '../lib/access'

/**
 * Votes du public : un vote par adresse e-mail vérifiée (index unique).
 * Les votes sont créés uniquement par /api/concours/vote/confirmer.
 */
export const Votes: CollectionConfig = {
  slug: 'votes',
  labels: { singular: 'Vote', plural: 'Votes du public' },
  admin: {
    group: 'Concours Authentique Homme',
    useAsTitle: 'voterEmail',
    defaultColumns: ['candidature', 'voterEmail', 'status', 'createdAt'],
    description:
      'Trace vérifiable des votes. Passez un vote en « Rejeté » s’il est suspect : il ne sera plus compté.',
  },
  access: {
    read: adminOnly,
    create: () => false,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'voterEmail',
      label: 'E-mail du votant (vérifié)',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'candidature',
      label: 'Candidat',
      type: 'relationship',
      relationTo: 'candidatures',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      defaultValue: 'valide',
      options: [
        { label: 'Valide', value: 'valide' },
        { label: 'Rejeté', value: 'rejete' },
      ],
    },
    {
      name: 'ip',
      label: 'Adresse IP',
      type: 'text',
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
}

/** Codes de vérification envoyés aux votants (valables 15 minutes). */
export const VoteVerifications: CollectionConfig = {
  slug: 'vote-verifications',
  labels: { singular: 'Code de vote', plural: 'Codes de vote' },
  admin: { hidden: true },
  access: {
    read: adminOnly,
    create: () => false,
    update: () => false,
    delete: adminOnly,
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'candidature', type: 'relationship', relationTo: 'candidatures', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'attempts', type: 'number', defaultValue: 0 },
  ],
  timestamps: true,
}
