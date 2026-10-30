import { type HandleUploadBody, handleUpload } from '@vercel/blob/client'
import { WORK_RULES, type WorkKind } from '@/lib/works'
import { getSettings, payloadClient } from '@/lib/server/contest'
import {
  attachWork,
  currentCandidate,
  hasRoomFor,
  worksUploadIsOpen,
} from '@/lib/server/works'

export const maxDuration = 60

/**
 * Jeton d’envoi direct (navigateur → stockage privé) pour les travaux d’un présélectionné.
 * Le fichier ne transite pas par le serveur, ce qui permet d’aller au-delà de 4,5 Mo.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody
  const origin = new URL(request.url).origin

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = await payloadClient()
        const candidate = await currentCandidate(payload)
        if (!candidate) throw new Error('Veuillez vous reconnecter à votre espace candidat.')

        const settings = await getSettings(payload)
        if (!worksUploadIsOpen(settings as never)) {
          throw new Error('Le dépôt des travaux est fermé.')
        }

        const kind = (JSON.parse(clientPayload || '{}') as { kind?: WorkKind }).kind
        if (kind !== 'video' && kind !== 'pdf') throw new Error('Type de fichier inconnu.')
        const rules = WORK_RULES[kind]

        if (!pathname.startsWith(`travaux/${candidate.candidateNumber}/`)) {
          throw new Error('Chemin de fichier invalide.')
        }
        if (!(await hasRoomFor(rules.maxBytes))) {
          throw new Error(
            'L’espace de stockage du concours est presque plein. Contactez le comité pour transmettre votre fichier.',
          )
        }

        return {
          allowedContentTypes: rules.types,
          maximumSizeInBytes: rules.maxBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ candidateId: String(candidate.id), kind }),
        }
      },
      // Filet de sécurité : rappel de Vercel Blob une fois l’envoi terminé.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { candidateId, kind } = JSON.parse(tokenPayload || '{}') as {
          candidateId?: string
          kind?: WorkKind
        }
        if (!candidateId || (kind !== 'video' && kind !== 'pdf')) return
        const payload = await payloadClient()
        await attachWork(
          payload,
          candidateId,
          kind,
          { pathname: blob.pathname, size: 0 },
          origin,
        )
      },
    })
    return Response.json(jsonResponse)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Envoi impossible.' },
      { status: 400 },
    )
  }
}
