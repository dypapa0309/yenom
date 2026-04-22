interface ChartCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

export default function ChartCard({ title, children, className = '' }: ChartCardProps) {
  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-[#111111] mb-4">{title}</h3>
      {children}
    </div>
  )
}
