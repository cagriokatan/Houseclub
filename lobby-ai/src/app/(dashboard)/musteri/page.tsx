import { DepartmentWorkspace } from '@/components/dashboard/DepartmentWorkspace'

export default function MusteriPage() {
  return (
    <DepartmentWorkspace
      department="MUSTERI_ILISKILERI"
      title="Müşteri İlişkileri"
      icon="🤝"
      description="Teklifler, müşteri raporları, strateji dokümanları"
    />
  )
}
