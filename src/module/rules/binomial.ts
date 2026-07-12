/**
 * The odds behind a dice pool.
 *
 * Two faces in six are hits, so hits are Binomial(pool, 1/3). The chat card shows
 * P(X <= hits) — "how many rollers of this pool would have done no better than you" — which
 * tells a player at a glance whether the dice betrayed them or the pool was simply too thin.
 */

const HIT_PROBABILITY = 1 / 3;

/**
 * P(X = k) for X ~ Binomial(n, 1/3), and the running total up to k.
 *
 * Computed by recurrence rather than from factorials: the old code evaluated n! directly,
 * which overflows to Infinity past a pool of 170 and returns NaN. The recurrence is exact
 * and stable for any pool a table will ever roll.
 *
 *   P(0) = (2/3)^n
 *   P(k) = P(k-1) · (n - k + 1) / (2k)
 */
export function cumulativeAtMost(hits: number, pool: number): number {
    if (pool <= 0) return 1;

    const k = Math.max(0, Math.min(hits, pool));

    let term = (1 - HIT_PROBABILITY) ** pool; // P(X = 0)
    let total = term;

    for (let i = 1; i <= k; i++) {
        term *= (pool - i + 1) / (2 * i);
        total += term;
    }

    return Math.min(1, total);
}

/** The same, as a display percentage. */
export function percentile(hits: number, pool: number): number {
    return cumulativeAtMost(hits, pool) * 100;
}
