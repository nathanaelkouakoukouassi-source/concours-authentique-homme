import type { Access, CollectionConfig } from 'payload'
import { PHOTO_TYPES } from '../lib/candidature-schema'

const isPayloadAdmin: Access = ({ req }) => req.user?.collection === 'users'

/**
 * Photos des candidats AUTHENTIQUE HOMME.
 * Stockage privé : seules les personnes connectées au back-office peuvent les voir.
 * Les photos ne sont créées que par la route serveur /api/concours/candidature.
 */
export const CandidatePhotos: CollectionConfig = {
  slug: 'candidate-photos',
  labels: {
    singular: 'Photo de candidat',
    plural: 'Photos des candidats',
  },
  access: {
    read: isPayloadAdmin,
    create: isPayloadAdmin,
    update: isPayloadAdmin,
    delete: isPayloadAdmin,
  },
  admin: {
    group: 'Concours Authentique Homme',
    useAsTitle: 'alt',
    description: 'Photos privées transmises lors des inscriptions. Jamais publiques sans validation.',
  },
  // Taille maximale (PHOTO_MAX_BYTES) contrôlée par la route d’inscription.
  upload: {
    mimeTypes: PHOTO_TYPES,
  },
  fields: [
    {
      name: 'alt',
      label: 'Description',
      type: 'text',
      required: true,
    },
  ],
}
