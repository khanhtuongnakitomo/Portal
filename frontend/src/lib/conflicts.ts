import type { Booking } from './types'

export interface ConflictInfo {
  letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  groupSize: number
  overlaps: { start: Date; end: Date }[]
  rivals: Booking[]
}

export const CONFLICT_COLORS: Record<ConflictInfo['letter'], { bar: string; badge: string; text: string }> = {
  A: { bar: 'bg-conflict-a', badge: 'bg-conflict-a text-paper', text: 'text-conflict-a' },
  B: { bar: 'bg-conflict-b', badge: 'bg-conflict-b text-paper', text: 'text-conflict-b' },
  C: { bar: 'bg-conflict-c', badge: 'bg-conflict-c text-paper', text: 'text-conflict-c' },
  D: { bar: 'bg-conflict-d', badge: 'bg-conflict-d text-paper', text: 'text-conflict-d' },
  E: { bar: 'bg-conflict-e', badge: 'bg-conflict-e text-paper', text: 'text-conflict-e' },
  F: { bar: 'bg-conflict-f', badge: 'bg-conflict-f text-paper', text: 'text-conflict-f' },
}

const letters = ['A', 'B', 'C', 'D', 'E', 'F'] as const
// Public calendar responses redact owner ids. Keep anonymous reservations distinct
// without exposing or inventing an identity in the UI.
const bookerKey = (booking: Booking) => `${booking.kind}:${booking.userId || booking.id}`

type Interval = { start: Date; end: Date }

function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = []
  for (const interval of intervals.sort((a, b) => +a.start - +b.start)) {
    const previous = merged[merged.length - 1]
    if (previous && interval.start <= previous.end) {
      if (interval.end > previous.end) previous.end = interval.end
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

/** Connected overlap groups, scoped to a room and different bookers. */
export function conflictMap(bookings: Booking[]): Map<string, ConflictInfo> {
  const result = new Map<string, ConflictInfo>()
  const byRoom = new Map<string, Booking[]>()
  for (const booking of bookings) {
    if (booking.status !== 'PENDING' && booking.status !== 'APPROVED' && booking.status !== 'KEY_CHECKED_OUT') continue
    const room = byRoom.get(booking.roomId)
    if (room) room.push(booking)
    else byRoom.set(booking.roomId, [booking])
  }

  for (const room of byRoom.values()) {
    const sorted = room.sort((a, b) => +new Date(a.start) - +new Date(b.start) || a.id.localeCompare(b.id))
    const adjacency = new Map<Booking, { rival: Booking; interval: Interval }[]>()
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      const aStart = new Date(a.start)
      const aEnd = new Date(a.end)
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]
        const bStart = new Date(b.start)
        if (bStart >= aEnd) break
        if (bookerKey(a) === bookerKey(b)) continue
        const bEnd = new Date(b.end)
        const end = aEnd < bEnd ? aEnd : bEnd
        if (aStart >= end || bStart >= end) continue
        const interval = { start: aStart > bStart ? aStart : bStart, end }
        const aEdges = adjacency.get(a) ?? []
        const bEdges = adjacency.get(b) ?? []
        aEdges.push({ rival: b, interval })
        bEdges.push({ rival: a, interval })
        adjacency.set(a, aEdges)
        adjacency.set(b, bEdges)
      }
    }

    const visited = new Set<Booking>()
    for (const first of sorted) {
      if (visited.has(first) || !adjacency.has(first)) continue
      const group: Booking[] = []
      const stack = [first]
      visited.add(first)
      while (stack.length) {
        const booking = stack.pop()!
        group.push(booking)
        for (const { rival } of adjacency.get(booking)!) {
          if (visited.has(rival)) continue
          visited.add(rival)
          stack.push(rival)
        }
      }
      group.sort((a, b) => +new Date(a.start) - +new Date(b.start) || a.id.localeCompare(b.id))
      const bookers = new Map<string, ConflictInfo['letter']>()
      for (const booking of group) {
        const key = bookerKey(booking)
        if (!bookers.has(key)) bookers.set(key, letters[bookers.size % letters.length])
      }
      for (const booking of group) {
        const edges = adjacency.get(booking)!
        result.set(booking.id, {
          letter: bookers.get(bookerKey(booking))!,
          groupSize: group.length,
          overlaps: mergeIntervals(edges.map(({ interval }) => interval)),
          rivals: edges.map(({ rival }) => rival),
        })
      }
    }
  }
  return result
}

/** Exact contested intervals, merged per room (not entire booking durations). */
export function conflictBands(bookings: Booking[]): { roomId: string; start: Date; end: Date }[] {
  const conflicts = conflictMap(bookings)
  const byRoom = new Map<string, Interval[]>()
  for (const booking of bookings) {
    const info = conflicts.get(booking.id)
    if (!info) continue
    const intervals = byRoom.get(booking.roomId)
    if (intervals) intervals.push(...info.overlaps)
    else byRoom.set(booking.roomId, [...info.overlaps])
  }
  return [...byRoom].flatMap(([roomId, intervals]) => mergeIntervals(intervals).map((interval) => ({ roomId, ...interval })))
}
