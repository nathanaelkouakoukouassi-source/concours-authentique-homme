import { DossierUpload as DossierUpload_concours } from '../../../components/admin/DossierUpload'
import { NotifyPreselected as NotifyPreselected_concours } from '../../../components/admin/NotifyPreselected'
import { Ranking as Ranking_concours, VoteHelp as VoteHelp_concours } from '../../../components/admin/Ranking'
import { PhotoPreview as PhotoPreview_concours } from '../../../components/PhotoPreview'
import { SelectionPanel as SelectionPanel_concours } from '../../../components/admin/SelectionPanel'
import { WorksFiles as WorksFiles_concours } from '../../../components/admin/WorksFiles'
import { NewAccessCode as NewAccessCode_concours } from '../../../components/admin/NewAccessCode'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  '/components/PhotoPreview#PhotoPreview': PhotoPreview_concours,
  '/components/admin/DossierUpload#DossierUpload': DossierUpload_concours,
  '/components/admin/NotifyPreselected#NotifyPreselected': NotifyPreselected_concours,
  '/components/admin/Ranking#Ranking': Ranking_concours,
  '/components/admin/Ranking#VoteHelp': VoteHelp_concours,
  '/components/admin/SelectionPanel#SelectionPanel': SelectionPanel_concours,
  '/components/admin/WorksFiles#WorksFiles': WorksFiles_concours,
  '/components/admin/NewAccessCode#NewAccessCode': NewAccessCode_concours,
  '@payloadcms/next/rsc#CollectionCards': CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
}
