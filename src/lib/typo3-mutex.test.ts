import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { withUserLock } from './typo3-mutex'

describe('withUserLock', () => {
  it('executes the function and returns its result', async () => {
    const result = await withUserLock('user-1', async () => 42)
    expect(result).toBe(42)
  })

  it('serializes concurrent calls for the same user', async () => {
    const order: string[] = []
    let resolveFirst!: () => void
    const firstBlocks = new Promise<void>((r) => {
      resolveFirst = r
    })

    const p1 = withUserLock('user-serial', async () => {
      order.push('first-start')
      await firstBlocks
      order.push('first-end')
      return 'a'
    })

    const p2 = withUserLock('user-serial', async () => {
      order.push('second-start')
      order.push('second-end')
      return 'b'
    })

    // p2 should not start until p1 finishes
    // Give the event loop a tick to ensure p2 would start if not blocked
    await new Promise((r) => setTimeout(r, 10))
    expect(order).toEqual(['first-start'])

    resolveFirst()
    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1).toBe('a')
    expect(r2).toBe('b')
    expect(order).toEqual([
      'first-start',
      'first-end',
      'second-start',
      'second-end',
    ])
  })

  it('allows concurrent calls for different users', async () => {
    const order: string[] = []
    let resolveA!: () => void
    let resolveB!: () => void
    const blockA = new Promise<void>((r) => {
      resolveA = r
    })
    const blockB = new Promise<void>((r) => {
      resolveB = r
    })

    const pA = withUserLock('user-A', async () => {
      order.push('A-start')
      await blockA
      order.push('A-end')
    })

    const pB = withUserLock('user-B', async () => {
      order.push('B-start')
      await blockB
      order.push('B-end')
    })

    // Both should have started since they are different users
    await new Promise((r) => setTimeout(r, 10))
    expect(order).toContain('A-start')
    expect(order).toContain('B-start')

    resolveB()
    await pB
    expect(order).toContain('B-end')
    // A should still be blocked
    expect(order).not.toContain('A-end')

    resolveA()
    await pA
    expect(order).toContain('A-end')
  })

  it('does not deadlock when the function throws', async () => {
    // First call throws
    await expect(
      withUserLock('user-throw', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    // Second call should still proceed (not deadlocked)
    const result = await withUserLock('user-throw', async () => 'recovered')
    expect(result).toBe('recovered')
  })

  it('propagates errors from the function', async () => {
    await expect(
      withUserLock('user-err', async () => {
        throw new Error('test error')
      })
    ).rejects.toThrow('test error')
  })

  it('serializes three concurrent calls in order', async () => {
    const order: number[] = []
    const resolvers: (() => void)[] = []

    const promises = [1, 2, 3].map((n) =>
      withUserLock('user-triple', async () => {
        order.push(n)
        await new Promise<void>((r) => resolvers.push(r))
        return n
      })
    )

    // Only first should have started
    await new Promise((r) => setTimeout(r, 10))
    expect(order).toEqual([1])

    // Resolve first
    resolvers[0]()
    await new Promise((r) => setTimeout(r, 10))
    expect(order).toEqual([1, 2])

    // Resolve second
    resolvers[1]()
    await new Promise((r) => setTimeout(r, 10))
    expect(order).toEqual([1, 2, 3])

    // Resolve third
    resolvers[2]()
    const results = await Promise.all(promises)
    expect(results).toEqual([1, 2, 3])
  })

  it('releases lock even when previous call in chain threw', async () => {
    const order: string[] = []

    // First call succeeds
    const p1 = withUserLock('user-chain-err', async () => {
      order.push('p1')
    })

    // Second call throws
    const p2 = withUserLock('user-chain-err', async () => {
      order.push('p2-throw')
      throw new Error('p2 error')
    })

    // Third call should still execute
    const p3 = withUserLock('user-chain-err', async () => {
      order.push('p3')
      return 'done'
    })

    await p1
    await p2.catch(() => {})
    const result = await p3

    expect(order).toEqual(['p1', 'p2-throw', 'p3'])
    expect(result).toBe('done')
  })
})
