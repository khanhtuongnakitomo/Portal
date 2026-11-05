export type ActivityCategory =
  | 'LECTURE'
  | 'WORKSHOP'
  | 'EXAM'
  | 'CLUB'
  | 'FACULTY'
  | 'MAINTENANCE'

export interface CategoryInfo {
  category: ActivityCategory
  label: string
  sublabel: string
  tag: string
  color: string
}

export const CATEGORY_PRESETS: CategoryInfo[] = [
  { category: 'LECTURE', label: 'Lecture', sublabel: 'University Lecture / Academic Class', tag: 'LECTURE', color: 'bg-accent text-paper' },
  { category: 'WORKSHOP', label: 'Workshop', sublabel: 'Technical Workshop / Seminar', tag: 'WORKSHOP', color: 'bg-ink text-paper' },
  { category: 'EXAM', label: 'Examination', sublabel: 'Official Exam / Assessment', tag: 'EXAM', color: 'bg-plum text-paper' },
  { category: 'CLUB', label: 'Club Activity', sublabel: 'Student Club / Society Event', tag: 'CLUB', color: 'bg-steel text-paper' },
  { category: 'FACULTY', label: 'Faculty Event', sublabel: 'Faculty, Departmental or VIP Meeting', tag: 'FACULTY', color: 'bg-[#2E3A4B] text-paper' },
  { category: 'MAINTENANCE', label: 'Maintenance', sublabel: 'Facility Maintenance / Technical Lockdown', tag: 'MAINTENANCE', color: 'bg-[#543B4E] text-paper' },
]

export const QUICK_REJECT_REASONS = [
  'Room needed for scheduled university class',
  'Conflicts with official event or maintenance',
  'Please provide more detailed academic purpose',
  'Exceeds allowed capacity or policy duration',
]
