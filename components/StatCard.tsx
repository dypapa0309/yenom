interface StatCardProps {
  label: string
  value: string
  sub?: string
  subPositive?: boolean
  subNegative?: boolean
  accent?: boolean
}

export default function StatCard({
  label,
  value,
  sub,
  subPositive,
  subNegative,
  accent,
}: StatCardProps) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight num ${accent ? 'text-[#2563EB]' : 'text-[#111111]'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1.5 num ${
          subPositive ? 'text-[#16A34A]' :
          subNegative ? 'text-red-500' :
          'text-[#6B7280]'
        }`}>
          {sub}
        </p>
      )}
    </div>
  )
}
