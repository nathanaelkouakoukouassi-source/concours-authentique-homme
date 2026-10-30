import type { CollectionConfig } from 'payload'

/** Visuels publics du concours (affiches, logos partenaires…). */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Visuel public',
    plural: 'Visuels publics',
  },
  admin: {
    group: 'Administration',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      label: 'Description',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
