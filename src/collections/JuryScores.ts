import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isAdminUser, isJuryUser } from '../lib/access'

export const CRITERIA = [
  { name: 'comprehension', label: 'Compréhension de la problématique', max: 15 },
  { name: 'interpretation', label: 'Maîtrise et interprétation des textes bibliques', max: 25 },
  { name: 'solutions', label: 'Pertinence des solutions bibliques proposées', max: 25 },
  { name: 'applicability', label: 'Démonstration concrète et applicabilité', max: 20 },
  { name: 'argumentation', label: 'Argumentation et défense', max: 10 },
  { name: 'originality', label: 'Originalité et qualité de présentation', max: 5 },
] as const

/**
 * Notes du jury sur 100 (cahier des charges §11.2).
 * Chaque juré ne voit et ne modifie que ses propres notes ; le verrouillage des délibérations
 * se règle dans « Pilotage du concours ».
 */
export const JuryScores: CollectionConfig = {
  slug: 'jury-scores',
  labels: { singular: 'Note du jury', plural: 'Notes du jury' },
  admin: {
    group: 'Concours Authentique Homme',
    useAsTitle: 'label',
    defaultColumns: ['candidature', 'phase', 'juror', 'total'],
    description:
      'Une fiche par juré, par candidat et par phase. La note du jury retenue est la moyenne des fiches.',
  },
  access: {
    read: ({ req }) => {
      if (isAdminUser(req.user as never)) return true
      if (isJuryUser(req.user as never) && req.user) return { juror: { equals: req.user.id } }
      return false
    },
    create: ({ req }) => isAdminUser(req.user as never) || isJuryUser(req.user as never),
    update: ({ req }) => {
      if (isAdminUser(req.user as never)) return true
      if (isJuryUser(req.user as never) && req.user) return { juror: { equals: req.user.id } }
      return false
    },
    delete: ({ req }) => isAdminUser(req.user as never),
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data
        const user = req.user as { id: string | number; role?: string } | null
        const settings = (await req.payload.findGlobal({
          slug: 'reglages-concours',
          depth: 0,
          overrideAccess: true,
        })) as { juryLocked?: boolean }
        if (settings.juryLocked && !isAdminUser(user as never)) {
          throw new APIError('Les délibérations sont verrouillées.', 403)
        }
        // Un juré note toujours en son nom.
        if (isJuryUser(user as never) && user) data.juror = user.id
        if (operation === 'create' && !data.juror && user) data.juror = user.id

        let total = 0
        for (const criterion of CRITERIA) {
          const value = Number(data[criterion.name] ?? originalDoc?.[criterion.name] ?? 0)
          if (Number.isNaN(value) || value < 0 || value > criterion.max) {
            throw new APIError(`« ${criterion.label} » doit être entre 0 et ${criterion.max}.`, 400)
          }
          total += value
        }
        data.total = total

        const candidatureId =
          typeof data.candidature === 'object' && data.candidature
            ? data.candidature.id
            : data.candidature
        const phase = data.phase ?? originalDoc?.phase ?? 'preselection'
        const juror = typeof data.juror === 'object' && data.juror ? data.juror.id : data.juror
        const existing = await req.payload.find({
          collection: 'jury-scores',
          where: {
            and: [
              { candidature: { equals: candidatureId } },
              { juror: { equals: juror } },
              { phase: { equals: phase } },
              ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.docs.length) {
          throw new APIError(
            'Ce juré a déjà une fiche pour ce candidat et cette phase : modifiez-la plutôt.',
            400,
          )
        }

        const candidate = (await req.payload.findByID({
          collection: 'candidatures',
          id: candidatureId,
          depth: 0,
          overrideAccess: true,
        })) as { candidateNumber?: string; fullName?: string }
        data.label = `${candidate.fullName || candidate.candidateNumber} — ${
          phase === 'finale' ? 'Finale' : 'Présélection'
        } — ${total}/100`
        return data
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        {
          name: 'candidature',
          label: 'Candidat',
          type: 'relationship',
          relationTo: 'candidatures',
          required: true,
          filterOptions: { status: { equals: 'preselectionne' } },
        },
        {
          name: 'phase',
          label: 'Phase',
          type: 'select',
          required: true,
          defaultValue: 'preselection',
          options: [
            { label: 'Présélection (10 candidats)', value: 'preselection' },
            { label: 'Grande finale', value: 'finale' },
          ],
        },
      ],
    },
    {
      name: 'juror',
      label: 'Juré',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        description: 'Renseigné automatiquement avec le compte connecté.',
      },
    },
    ...CRITERIA.map((criterion) => ({
      name: criterion.name,
      label: `${criterion.label} (sur ${criterion.max})`,
      type: 'number' as const,
      required: true,
      min: 0,
      max: criterion.max,
    })),
    {
      name: 'total',
      label: 'Total sur 100',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'comment',
      label: 'Commentaire du juré',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
