import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Same public URL + service-role convention as tests/e2e/deactivated-user-login.spec.ts.
const SUPABASE_URL = 'https://hlahrypglnmjjxrdtfkm.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Same seeded Admin account tests/e2e/tasking.spec.ts uses -- Admin holds
// every permission (migration 0054 backfill), including manage_users.
const SEEDED_EMAIL = 'genesis-e2e-seed@genesis-app-e2e-test.dev'
const SEEDED_PASSWORD = 'E2eSeedPass123!'

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

test('Users tab shows every staff member, not just the caller', async ({ page }) => {
  // Regression lock for the Critical finding fixed by migration 0056:
  // profiles' SELECT policy used to be own-row-only, so listStaff() could
  // never return more than the caller's own row.
  const admin = adminClient()
  const { data: staffRole } = await admin.from('roles').select('id').eq('name', 'Staff').single()
  const email = `e2e-second-staff-${Date.now()}@genesis-app-e2e-test.dev`
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password: 'TempPass123!',
    email_confirm: true,
  })
  await admin.from('profiles').insert({
    id: created.user!.id,
    full_name: 'E2E Second Staff Member',
    role_id: staffRole!.id,
    active: true,
  })

  try {
    await page.goto('/login')
    await page.getByLabel('Email').fill(SEEDED_EMAIL)
    await page.getByLabel('Password').fill(SEEDED_PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('**/orders')

    await page.goto('/admin/users')
    await expect(page.getByTestId('staff-list')).toContainText('E2E Second Staff Member')
    // The seeded caller's own row plus the newly created one -- with the old
    // own-row-only RLS policy this would be exactly 1, no matter who else exists.
    expect(await page.getByTestId('staff-row').count()).toBeGreaterThanOrEqual(2)
  } finally {
    await admin.auth.admin.deleteUser(created.user!.id)
  }
})

test('cannot revoke manage_users from the last remaining active holder', async ({ page }) => {
  // Exercises the lockout guard in setRolePermission (src/app/actions/admin-users.ts)
  // end to end through the real UI/server action, not just a DB query.
  const admin = adminClient()
  const roleName = `E2E Lockout Guard Role ${Date.now()}`
  const email = `e2e-lockout-${Date.now()}@genesis-app-e2e-test.dev`

  const { data: existingHolders } = await admin
    .from('role_permissions')
    .select('role_id')
    .eq('permission_key', 'manage_users')
  const otherRoleIds = (existingHolders ?? []).map((r) => r.role_id)

  const { data: newRole } = await admin.from('roles').insert({ name: roleName }).select().single()
  await admin.from('role_permissions').insert({ role_id: newRole!.id, permission_key: 'manage_users' })

  const { data: created } = await admin.auth.admin.createUser({
    email,
    password: 'TempPass123!',
    email_confirm: true,
  })
  await admin.from('profiles').insert({
    id: created.user!.id,
    full_name: 'E2E Lockout Guard Test',
    role_id: newRole!.id,
    active: true,
  })

  try {
    // Make the new role the SOLE active holder of manage_users, so the
    // "would this leave zero holders" guard actually has something to catch.
    // This briefly removes manage_users from every other role (including
    // Admin) -- restored in `finally` below before anything else.
    if (otherRoleIds.length > 0) {
      await admin
        .from('role_permissions')
        .delete()
        .eq('permission_key', 'manage_users')
        .in('role_id', otherRoleIds)
    }

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('TempPass123!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('**/orders')

    await page.goto('/admin/users')
    await page.getByRole('tab', { name: 'Roles' }).click()

    const roleCard = page.getByTestId('role-card').filter({ hasText: roleName })
    await roleCard.getByLabel('Manage Users & Roles').uncheck()

    await expect(
      page.getByText('Removing this would leave nobody able to manage users.')
    ).toBeVisible()

    // Confirm the guard actually blocked the write, not just the UI message.
    const { data: stillGranted } = await admin
      .from('role_permissions')
      .select('role_id')
      .eq('role_id', newRole!.id)
      .eq('permission_key', 'manage_users')
      .maybeSingle()
    expect(stillGranted).not.toBeNull()
  } finally {
    // Restore the real roles' manage_users grants first, before any other
    // cleanup, to minimize the window where nobody else can manage users.
    if (otherRoleIds.length > 0) {
      const { error: restoreError } = await admin
        .from('role_permissions')
        .insert(otherRoleIds.map((role_id) => ({ role_id, permission_key: 'manage_users' })))
      expect(restoreError, 'failed to restore manage_users on a live role').toBeNull()
    }
    await admin.auth.admin.deleteUser(created.user!.id)
    await admin.from('role_permissions').delete().eq('role_id', newRole!.id)
    await admin.from('roles').delete().eq('id', newRole!.id)
  }
})
