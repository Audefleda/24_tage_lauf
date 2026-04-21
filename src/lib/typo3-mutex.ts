// Shared per-user mutex for all TYPO3 write operations.
// Serializes concurrent requests for the same user so read-modify-write
// cycles don't overwrite each other.
// Note: effective within a single serverless function instance only —
// sufficient for a 5–30 user app on Vercel.
import 'server-only'

const userLocks = new Map<string, Promise<void>>()

export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(userId) ?? Promise.resolve()
  let resolveMyLock!: () => void
  const myLock = new Promise<void>((resolve) => {
    resolveMyLock = resolve
  })
  userLocks.set(userId, myLock)

  await previous.catch(() => {})

  try {
    return await fn()
  } finally {
    resolveMyLock()
    if (userLocks.get(userId) === myLock) {
      userLocks.delete(userId)
    }
  }
}
