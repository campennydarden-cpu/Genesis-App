import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

test('a deactivated user is signed out and blocked from logging back in', async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const email = `e2e-deactivated-${Date.now()}@genesis-app-e2e-test.dev`
  const password = 'TempPass123!'

  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  const staffRole = await admin.from('roles').select('id').eq('name', 'Staff').single()
  await admin.from('profiles').insert({
    id: created.user!.id,
    full_name: 'E2E Deactivated Test',
    role_id: staffRole.data!.id,
    active: true,
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/orders')

  await admin.from('profiles').update({ active: false }).eq('id', created.user!.id)

  await page.goto('/orders')
  await page.waitForURL('**/login**')
  await expect(page.getByText('Your account has been deactivated.')).toBeVisible()

  await admin.auth.admin.deleteUser(created.user!.id)
})
