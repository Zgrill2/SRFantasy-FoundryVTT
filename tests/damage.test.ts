import { describe, expect, it } from 'vitest';

import { autoSplit, computeDamage, drainSplit, maxStaminaAbsorb } from '../src/module/rules/damage';
import { cumulativeAtMost } from '../src/module/rules/binomial';
import { compareCombatants, nextTurnIndex, type TurnState } from '../src/module/rules/combat';

const track = (value: number, max: number) => ({ value, max });

describe('maxStaminaAbsorb', () => {
    it('is capped by Body', () => {
        expect(maxStaminaAbsorb(4, track(20, 20))).toBe(4);
    });

    it('never drives stamina to zero', () => {
        expect(maxStaminaAbsorb(10, track(3, 20))).toBe(2);
    });

    it('absorbs nothing once stamina is spent', () => {
        expect(maxStaminaAbsorb(10, track(0, 20))).toBe(0);
    });
});

describe('autoSplit', () => {
    it('sends damage to stamina when health would take the wound', () => {
        // Body 6, both tracks full. 4 damage all fits in stamina under a tier of 6.
        const s = autoSplit(4, 6, track(20, 20), track(20, 20), 0);
        expect(s).toEqual({ hp: 0, stam: 4 });
        expect(s.hp + s.stam).toBe(4);
    });

    it('puts everything on health when stamina is spent', () => {
        // Stamina at 0 can absorb nothing. The old loop had an off-by-one here that
        // silently assigned the whole hit to stamina instead.
        expect(autoSplit(5, 6, track(20, 20), track(0, 20), 0)).toEqual({ hp: 5, stam: 0 });
    });

    it('overflows to health once stamina is capped by Body', () => {
        expect(autoSplit(10, 3, track(20, 20), track(20, 20), 0)).toEqual({ hp: 7, stam: 3 });
    });

    it('accounts for damage already taken, choosing the split that crosses fewest tiers', () => {
        // Health sits 5 into a tier of 6 — one more point there costs a die.
        // Stamina is fresh, so 3 points there are free. Body 6 permits it.
        const s = autoSplit(3, 6, track(15, 20), track(20, 20), 0);
        expect(s).toEqual({ hp: 0, stam: 3 });
    });

    it('takes the free health hit rather than tipping stamina over a threshold', () => {
        // Stamina is 5 into its tier (1 more crosses); health is fresh (5 are free).
        const s = autoSplit(2, 6, track(20, 20), track(15, 20), 0);
        expect(s.stam).toBe(0);
        expect(s.hp).toBe(2);
    });

    it('is a no-op for a zero-damage hit', () => {
        expect(autoSplit(0, 6, track(20, 20), track(20, 20), 0)).toEqual({ hp: 0, stam: 0 });
    });
});

describe('drainSplit', () => {
    it('burns mana first', () => {
        expect(drainSplit(4, track(10, 16), track(20, 20))).toMatchObject({ mana: 4, hp: 0 });
    });

    it('spills into health once the reserves are dry', () => {
        expect(drainSplit(9, track(4, 16), track(20, 20))).toMatchObject({ mana: 4, hp: 5 });
    });

    it('goes straight to health with no mana left', () => {
        expect(drainSplit(3, track(0, 16), track(20, 20))).toMatchObject({ mana: 0, hp: 3 });
    });
});

describe('computeDamage', () => {
    it('is net hits plus DV, less soak', () => {
        expect(computeDamage(5, 2, 7, 4)).toBe(3 + 7 - 4);
    });

    it('is null when the defender matches or beats the attacker', () => {
        expect(computeDamage(3, 3, 10, 0)).toBeNull();
        expect(computeDamage(2, 5, 10, 0)).toBeNull();
    });

    it('is null when soak eats the whole hit', () => {
        expect(computeDamage(4, 3, 2, 9)).toBeNull();
    });
});

describe('cumulativeAtMost', () => {
    it('is 1 for an empty pool', () => {
        expect(cumulativeAtMost(0, 0)).toBe(1);
    });

    it('gives the chance of zero hits on one die as 2/3', () => {
        expect(cumulativeAtMost(0, 1)).toBeCloseTo(2 / 3, 10);
    });

    it('sums to 1 across the whole pool', () => {
        expect(cumulativeAtMost(6, 6)).toBeCloseTo(1, 10);
    });

    it('stays finite for pools that would overflow a factorial', () => {
        // The old implementation computed n! directly and returned NaN past ~170 dice.
        const p = cumulativeAtMost(100, 300);
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(1);
    });
});

describe('nextTurnIndex', () => {
    const t = (initiative: number, defeated = false): TurnState => ({ initiative, defeated });

    it('advances down the order', () => {
        expect(nextTurnIndex([t(22), t(15), t(8)], 0)).toBe(1);
    });

    it('skips anyone who has spent their initiative', () => {
        expect(nextTurnIndex([t(22), t(0), t(8)], 0)).toBe(2);
    });

    it('skips the defeated', () => {
        expect(nextTurnIndex([t(22), t(15, true), t(8)], 0)).toBe(2);
    });

    it('wraps for a new pass while anyone still has initiative', () => {
        // The fast character outlasts the others and goes again in the same round.
        expect(nextTurnIndex([t(12), t(0), t(0)], 2)).toBe(0);
    });

    it('ends the round only when everyone is spent', () => {
        expect(nextTurnIndex([t(0), t(0), t(0)], 1)).toBeNull();
    });

    it('ends the round when the only combatants left standing are defeated', () => {
        expect(nextTurnIndex([t(10, true)], -1)).toBeNull();
    });

    it('opens a round at the top', () => {
        expect(nextTurnIndex([t(22), t(15)], -1)).toBe(0);
    });
});

describe('compareCombatants', () => {
    const c = (over: Partial<Parameters<typeof compareCombatants>[0]>) => ({
        order: 0,
        reaction: 0,
        luckMax: 0,
        luckCurrent: 0,
        name: 'a',
        id: '1',
        ...over,
    });

    it('sorts by rolled order, highest first', () => {
        expect(compareCombatants(c({ order: 20 }), c({ order: 10 }))).toBeLessThan(0);
    });

    it('breaks ties on reaction, then luck', () => {
        expect(compareCombatants(c({ reaction: 5 }), c({ reaction: 3 }))).toBeLessThan(0);
        expect(
            compareCombatants(c({ reaction: 3, luckMax: 4 }), c({ reaction: 3, luckMax: 2 })),
        ).toBeLessThan(0);
    });

    it('is stable on a perfect tie', () => {
        expect(compareCombatants(c({ id: '1' }), c({ id: '2' }))).toBeLessThan(0);
    });
});
