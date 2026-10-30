import type { CollectionConfig } from 'payload'
import { adminOnly, isAdminUser } from '../lib/access'

/** Comptes du comité d’organisation et du jury (accès au back-office /admin). */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Membre du comité ou du jury',
    plural: 'Comité et jury',
  },
  admin: {
    group: 'Administration',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: ({ req }) => {
      if (isAdminUser(req.user as never)) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
    update: ({ req }) => {
      if (isAdminUser(req.user as never)) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
  },
  fields: [
    {
      name: 'name',
      label: 'Nom et prénoms',
      type: 'text',
    },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Administrateur du concours', value: 'admin' },
        { label: 'Membre du jury', value: 'jury' },
      ],
      access: {
        update: ({ req }) => isAdminUser(req.user as never),
      },
      admin: {
        description:
          'Un membre du jury ne voit que la saisie de ses propres notes ; un administrateur gère tout le concours.',
      },
    },
  ],
  versions: false,
}
