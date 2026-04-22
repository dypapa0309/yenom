import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export default function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
        <div className="w-4 h-4 border-2 border-[#9CA3AF] rounded" />
      </div>
      <h3 className="text-sm font-semibold text-[#111111] mb-1">{title}</h3>
      <p className="text-sm text-[#6B7280] max-w-xs">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button className="mt-5 h-8 text-xs bg-[#111111] hover:bg-[#333333] text-white">
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  )
}
