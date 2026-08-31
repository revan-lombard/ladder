import { addMonths, monthLabel } from '../../lib/dates'

export default function MonthPicker({
  month,
  onChange,
}: {
  month: string
  onChange: (monthISO: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(addMonths(month, -1))}
        className="h-9 w-9 rounded-lg bg-white/10 font-bold"
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="text-sm font-bold w-32 text-center">{monthLabel(month)}</span>
      <button
        onClick={() => onChange(addMonths(month, 1))}
        className="h-9 w-9 rounded-lg bg-white/10 font-bold"
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  )
}
