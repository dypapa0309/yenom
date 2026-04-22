import { Insight, InsightSeverity } from '@/lib/insights/generator'

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  info: 'border-l-[#2563EB] bg-[#EFF6FF]',
  warning: 'border-l-red-500 bg-red-50',
  tip: 'border-l-[#6B7280] bg-[#F9FAFB]',
}

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  info: '정보',
  warning: '주의',
  tip: '팁',
}

interface InsightCardProps {
  insight: Insight
}

export default function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className={`border-l-2 rounded-r-lg px-4 py-3 ${SEVERITY_STYLES[insight.severity]}`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
          {SEVERITY_LABEL[insight.severity]}
        </span>
        <span className="text-sm font-semibold text-[#111111]">{insight.title}</span>
      </div>
      <p className="text-sm text-[#374151]">{insight.description}</p>
    </div>
  )
}
