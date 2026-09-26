import { useTranslation } from 'react-i18next'
import { Modal } from '@shared/ui/molecules/Modal'
import { LanCard } from './LanCard'

// Reachable from the sign-in page, so a PC that cannot reach its server can still be pointed somewhere else.
export function LanSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal open={open} onClose={onClose} title={t('lan.title')} size="xl">
      <LanCard />
    </Modal>
  )
}
