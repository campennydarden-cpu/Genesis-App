import { signup } from './actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Genesis — Create Account</h1>
      <p className="mb-4 text-sm text-slate-500">
        Temporary first-run signup — not a real staff-invite flow. See{' '}
        <code>Genesis Rebuild - Foundation Phase Design.md</code> for what&apos;s deferred.
      </p>
      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <form action={signup} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-white">
          Sign Up
        </button>
      </form>
    </div>
  )
}
