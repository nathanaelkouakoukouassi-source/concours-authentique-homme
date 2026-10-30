import { put } from '@vercel/blob'
import { randomInt } from 'crypto'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  COMMITMENTS,
  EMAIL_PATTERN,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  TEXT_FIELDS,
  checkConformity,
  normalizePhone,
  type CandidatureData,
} from '@/lib/candidature-schema'

const rateLimits = new Map<string, number[]>()
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT = 5
const NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function isRateLimited(ip: string) {
  const now = Date.now()
  const recent = (rateLimits.get(ip) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  rateLimits.set(ip, recent)
  return false
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[character]
  })
}

function generateCandidateNumber() {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)]
  }
  return `AH26-${code}`
}

function fail(message: string, status: number) {
  return Response.json({ success: false, message }, { status })
}

function emailLayout(title: string, inner: string) {
  return `
    <div style="margin:0;background:#f7f4fb;padding:32px 16px;font-family:Arial,sans-serif;color:#201750">
      <div style="max-width:640px;margin:0 auto;background:white;border:1px solid #ddd5e8;border-radius:20px;overflow:hidden">
        <div style="background:#1b0c67;padding:28px;color:white">
          <p style="margin:0 0 8px;color:#fbb257;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Concours Authentique Homme</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:26px">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;font-size:15px;line-height:1.6">${inner}</div>
        <div style="padding:16px 24px;border-top:1px solid #ddd5e8;font-size:12px;color:#665e78">Ministère Porteur d’Amour — 3 Jours de Reconnaissance 2026</div>
      </div>
    </div>`
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MINISTRY_FROM_EMAIL
  if (!apiKey || !from) return false
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return fail('Format de requête invalide.', 415)
  }
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > PHOTO_MAX_BYTES + 200_000) {
    return fail('La candidature est trop volumineuse. Réduisez la taille de la photo.', 413)
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  if (isRateLimited(ip)) {
    return fail('Trop de tentatives ont été effectuées. Veuillez patienter quelques minutes.', 429)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Les données reçues sont invalides.', 400)
  }

  // Piège à robots : un humain ne remplit jamais ce champ caché.
  const honeypot = form.get('website')
  if (typeof honeypot === 'string' && honeypot.trim()) {
    return Response.json({ success: true, candidateNumber: '' })
  }

  const data: CandidatureData = { commitments: [] }
  for (const field of TEXT_FIELDS) {
    const value = form.get(field)
    if (typeof value === 'string' && value.trim()) data[field] = value.trim().slice(0, 300)
  }
  const allowedCommitments: string[] = COMMITMENTS.map((item) => item.name)
  data.commitments = form
    .getAll('commitments')
    .filter((value): value is string => typeof value === 'string')
    .filter((value) => allowedCommitments.includes(value))

  // Conditions bloquantes : on ne peut ni contacter ni retenir le candidat sans elles.
  if (!data.lastName || !data.firstName || !data.email || !EMAIL_PATTERN.test(data.email)) {
    return fail(
      'Certaines informations obligatoires sont manquantes. Veuillez vérifier votre formulaire.',
      400,
    )
  }
  if (data.isChristian !== 'Oui') {
    return fail(
      'Votre candidature ne remplit pas actuellement les conditions obligatoires du concours.',
      400,
    )
  }

  const photoEntry = form.get('photo')
  const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null
  if (photo && !PHOTO_TYPES.includes(photo.type)) {
    return fail('Format de photo non accepté. Utilisez JPG, PNG ou WEBP.', 400)
  }
  if (photo && photo.size > PHOTO_MAX_BYTES) {
    return fail('La photo ne doit pas dépasser 4 Mo.', 400)
  }

  if (data.phone) data.phone = normalizePhone(data.phone)
  data.email = data.email.toLowerCase()

  const payload = await getPayload({ config })

  // Contrôle automatique (§6.1) + détection de doublon évident.
  const issues = checkConformity(data, Boolean(photo))
  const duplicates = await payload.find({
    collection: 'candidatures',
    where: {
      or: [
        { email: { equals: data.email } },
        ...(data.phone ? [{ phone: { equals: data.phone } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const duplicate = duplicates.docs[0] as { candidateNumber?: string } | undefined
  if (duplicate) {
    issues.push(
      `Doublon possible : même e-mail ou téléphone que la candidature ${duplicate.candidateNumber || 'existante'}.`,
    )
  }
  const status = duplicate ? 'a-verifier' : issues.length ? 'non-conforme' : 'conforme'

  let candidateNumber = generateCandidateNumber()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await payload.find({
      collection: 'candidatures',
      where: { candidateNumber: { equals: candidateNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!existing.docs.length) break
    candidateNumber = generateCandidateNumber()
  }

  let photoPathname: string | undefined
  try {
    if (photo) {
      // Stockage privé Vercel Blob : la photo n’est lisible que via /api/concours/photo/<id>.
      const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type.split('/')[1]
      const blob = await put(
        `candidats/${candidateNumber}.${extension}`,
        Buffer.from(await photo.arrayBuffer()),
        { access: 'private', contentType: photo.type, addRandomSuffix: true },
      )
      photoPathname = blob.pathname
    }

    await payload.create({
      collection: 'candidatures',
      data: {
        ...data,
        candidateNumber,
        status,
        conformityIssues: issues.join('\n'),
        publishEducation: data.publishEducation === 'Oui',
        photoPathname,
        submittedFromIp: ip,
      },
      overrideAccess: true,
    })
  } catch {
    return fail(
      'L’enregistrement de votre candidature a échoué. Veuillez réessayer dans quelques instants.',
      503,
    )
  }

  // E-mails : la candidature est déjà enregistrée, un échec d’envoi ne la bloque pas.
  const origin = new URL(request.url).origin
  const role = data.churchRole === 'Autre' ? data.churchRoleOther : data.churchRole
  const statusLabel =
    status === 'conforme' ? 'Conforme' : status === 'a-verifier' ? 'À vérifier' : 'Non conforme'

  const committeeHtml = emailLayout(
    'Nouvelle candidature',
    `<p><strong>${escapeHtml(candidateNumber)}</strong> — ${escapeHtml(`${data.firstName} ${data.lastName}`)}</p>
     <p>${escapeHtml(data.churchName || '')}${role ? ` · ${escapeHtml(role)}` : ''}<br/>${escapeHtml(`${data.city || ''}, ${data.country || ''}`)}</p>
     <p><strong>Statut automatique :</strong> ${statusLabel}</p>
     ${issues.length ? `<p style="color:#b42318;white-space:pre-wrap">${escapeHtml(issues.join('\n'))}</p>` : ''}
     <p><a href="${origin}/admin/collections/candidatures" style="color:#4736b6;font-weight:700">Ouvrir le dossier dans le back-office</a></p>`,
  )

  const candidateHtml = emailLayout(
    'Votre candidature est enregistrée',
    `<p>Bonjour ${escapeHtml(data.firstName || '')},</p>
     <p>Félicitations ! Votre candidature au concours AUTHENTIQUE HOMME a bien été enregistrée.</p>
     <p style="margin:24px 0;padding:16px;border-radius:14px;background:#fff0df;text-align:center">
       Votre numéro de candidature<br/>
       <strong style="font-size:22px;letter-spacing:2px;color:#1b0c67">${escapeHtml(candidateNumber)}</strong>
     </p>
     <p>Votre dossier sera examiné par le comité d’organisation. Vous recevrez une notification par e-mail concernant la suite de votre candidature.</p>
     <p>Merci pour votre intérêt et votre participation.</p>
     <p style="margin-top:24px">Le comité d’organisation<br/>Ministère Porteur d’Amour</p>`,
  )

  const destination = process.env.MINISTRY_DESTINATION_EMAIL
  await Promise.allSettled([
    destination
      ? sendEmail(
          destination,
          `Nouvelle candidature Authentique Homme — ${candidateNumber}`,
          committeeHtml,
          data.email,
        )
      : Promise.resolve(false),
    sendEmail(
      data.email,
      `Votre candidature AUTHENTIQUE HOMME — ${candidateNumber}`,
      candidateHtml,
      destination,
    ),
  ])

  return Response.json({ success: true, candidateNumber })
}
