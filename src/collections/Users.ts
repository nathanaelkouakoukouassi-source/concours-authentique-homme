import type { CollectionConfig } from 'payload'

/** Comptes du comité d’organisation (accès au back-office /admin). */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Membre du comité',
    plural: 'Membres du comité',
  },
  admin: {
    group: 'Administration',
    useAsTitle: 'email',
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
  },
  fields: [
    {
      name: 'name',
      label: 'Nom et prénoms',
      type: 'text',
    },
  ],
  versions: false,
}
