import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { fr } from '@payloadcms/translations/languages/fr'
import { createHash } from 'crypto'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { Candidatures } from './collections/Candidatures'
import { JuryScores } from './collections/JuryScores'
import { Users } from './collections/Users'
import { VoteVerifications, Votes } from './collections/Votes'
import { ContestSettings } from './globals/ContestSettings'

const mongoUrl = process.env.MONGODB_URI || process.env.MONGODB_URL || ''

// Clé secrète : PAYLOAD_SECRET si défini, sinon dérivée de l'adresse (secrète) de la base.
const secret =
  process.env.PAYLOAD_SECRET ||
  (mongoUrl ? createHash('sha256').update(`payload-secret:${mongoUrl}`).digest('hex') : '')

// Adresse publique : NEXT_PUBLIC_SITE_URL si défini, sinon l'adresse de production Vercel.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined)

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: siteUrl,
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' — Concours Authentique Homme',
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    fallbackLanguage: 'fr',
    supportedLanguages: { fr },
  },
  collections: [Candidatures, JuryScores, Votes, VoteVerifications, Users],
  globals: [ContestSettings],
  editor: lexicalEditor(),
  secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Vercel + MongoDB Atlas fournit MONGODB_URI ; MONGODB_URL reste accepté.
  db: mongooseAdapter({
    url: mongoUrl,
  }),
})
