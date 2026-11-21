export const CATEGORY_PRESETS = ['LECTURE', 'WORKSHOP', 'EXAM', 'CLUB', 'FACULTY', 'MAINTENANCE'] as const

export type ActivityCategory = (typeof CATEGORY_PRESETS)[number]

export function activityCategoryKey(category?: string) {
  const known = CATEGORY_PRESETS.find((value) => value === category)
  return known ? `staff.category_${known}` : 'staff.activityEvent'
}

export const QUICK_REJECT_REASONS = [
  'staff.rejectPresetClass',
  'staff.rejectPresetConflict',
  'staff.rejectPresetPurpose',
  'staff.rejectPresetCapacity',
] as const
