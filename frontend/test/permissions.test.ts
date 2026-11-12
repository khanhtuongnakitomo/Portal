import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessRoute } from '../src/lib/permissions.ts'

test('one manager account can use personal booking and management views', () => {
  assert.equal(canAccessRoute('/student', 'MANAGER'), true)
  assert.equal(canAccessRoute('/manager', 'MANAGER'), true)
  assert.equal(canAccessRoute('/admin', 'MANAGER'), false)
})

test('students retain personal booking access without management permissions', () => {
  assert.equal(canAccessRoute('/student', 'USER'), true)
  assert.equal(canAccessRoute('/manager', 'USER'), false)
  assert.equal(canAccessRoute('/admin', 'USER'), false)
})

test('admins retain access to both operational views and administration', () => {
  for (const route of ['/student', '/manager', '/admin']) assert.equal(canAccessRoute(route, 'ADMIN'), true)
})

test('unknown routes are not implicitly authorized', () => {
  assert.equal(canAccessRoute('/future-admin-tool', 'USER'), false)
})
