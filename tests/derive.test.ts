import { describe, expect, it } from 'vitest';

import {
    defenses,
    drainResistance,
    healthMax,
    knowledgeDicepool,
    manaMax,
    skillDicepool,
    soaks,
    staminaMax,
    traditionBonus,
    woundPenalty,
    type Abilities,
} from '../src/module/rules/derive';
import type { SkillKey } from '../src/module/config';

const abilities = (over: Partial<Abilities> = {}): Abilities => ({
    bod: 1,
    agi: 1,
    rea: 1,
    str: 1,
    wil: 1,
    int: 1,
    log: 1,
    cha: 1,
    ...over,
});

const ranks = (over: Partial<Record<SkillKey, number>> = {}) =>
    ({ dodge: 0, weapon_skill: 0, perserverence: 0, ...over }) as Record<SkillKey, number>;

describe('traditionBonus', () => {
    it('is half the tradition rank, rounded up', () => {
        expect(traditionBonus(10, 4)).toBe(2);
        expect(traditionBonus(10, 5)).toBe(3);
    });

    it('is capped by the rank it augments — magic sharpens, it does not teach', () => {
        expect(traditionBonus(1, 10)).toBe(1);
        expect(traditionBonus(0, 10)).toBe(0);
    });
});

describe('skillDicepool', () => {
    it('is attribute + rank + tradition bonus', () => {
        // rank 4, AGI 3, tradition 6 -> bonus min(4, 3) = 3
        expect(skillDicepool(4, 3, 6)).toBe(3 + 4 + 3);
    });

    it('subtracts 1 when defaulting on an untrained skill', () => {
        expect(skillDicepool(0, 5, 6)).toBe(4);
    });

    it('gives an untrained skill no tradition bonus at all', () => {
        // 0 rank: bonus is capped at 0, and the -1 still applies.
        expect(skillDicepool(0, 5, 10)).toBe(4);
    });

    it('adds feature/effect bonuses', () => {
        expect(skillDicepool(2, 3, 0, 3)).toBe(3 + 2 + 0 + 3);
    });
});

describe('knowledgeDicepool', () => {
    it('gets the tradition bonus, like every other skill', () => {
        // This is bug #4: the old code computed it, then silently overwrote it.
        expect(knowledgeDicepool(4, 3, 6)).toBe(4 + 3 + 3);
    });

    it('works without a linked attribute', () => {
        expect(knowledgeDicepool(4, null, 6)).toBe(4 + 3);
    });
});

describe('resource tracks', () => {
    it('derives maxima from the driving abilities', () => {
        expect(healthMax(abilities({ bod: 5 }))).toBe(21);
        expect(staminaMax(abilities({ wil: 3 }))).toBe(19);
    });

    it('keys mana off the chosen cast stat', () => {
        const a = abilities({ log: 4, cha: 7 });
        expect(manaMax(a, 'log')).toBe(20);
        expect(manaMax(a, 'cha')).toBe(23);
    });

    it('derives drain resistance from willpower', () => {
        expect(drainResistance(abilities({ wil: 6 }))).toBe(12);
    });
});

describe('soaks', () => {
    it('is the driving ability plus half its partner, rounded up', () => {
        const s = soaks(abilities({ bod: 5, log: 4, str: 2, agi: 3, wil: 1, cha: 1 }));
        expect(s.armor).toBe(5 + 2);
        expect(s.physical).toBe(2 + 2);
        expect(s.mental).toBe(1 + 1);
    });

    it('applies bonuses', () => {
        expect(soaks(abilities({ bod: 5, log: 4 }), { soak_armor: 3 }).armor).toBe(10);
    });
});

describe('defenses', () => {
    const a = abilities({ rea: 3, int: 4, wil: 2, cha: 5, bod: 6, agi: 1 });

    it('derives passive pools from raw reflexes', () => {
        const d = defenses(a, ranks(), 0);
        expect(d.dodge.passive).toBe(7);
        expect(d.mental.passive).toBe(7);
        expect(d.physical.passive).toBe(7);
    });

    it('gives block and parry no reflexive form of their own — they fall back to dodge', () => {
        const d = defenses(a, ranks(), 0);
        expect(d.block.passive).toBe(d.dodge.passive);
        expect(d.parry.passive).toBe(d.dodge.passive);
    });

    it('adds the driving skill and its tradition bonus to the active pool', () => {
        const d = defenses(a, ranks({ dodge: 4, weapon_skill: 2, perserverence: 3 }), 6);
        expect(d.dodge.active).toBe(7 + 4 + 3); // min(4,3)=3
        expect(d.block.active).toBe(7 + 2 + 2); // min(2,3)=2
        expect(d.mental.active).toBe(7 + 3 + 3); // min(3,3)=3
    });
});

describe('woundPenalty', () => {
    const full = { health: { value: 20, max: 20 }, stamina: { value: 20, max: 20 }, mana: { value: 20, max: 20 } };

    it('is zero at full health', () => {
        expect(woundPenalty(full, 0, 0)).toBe(0);
    });

    it('accrues one die per 6 damage, on each track independently', () => {
        const hurt = {
            health: { value: 8, max: 20 }, // 12 damage -> 2
            stamina: { value: 14, max: 20 }, // 6 damage  -> 1
            mana: { value: 17, max: 20 }, // 3 damage  -> 0
        };
        expect(woundPenalty(hurt, 0, 0)).toBe(3);
    });

    it('widens the tier with resilient wounds', () => {
        const hurt = { ...full, health: { value: 10, max: 20 } }; // 10 damage
        expect(woundPenalty(hurt, 0, 0)).toBe(1); // tier 6  -> 1
        expect(woundPenalty(hurt, 4, 0)).toBe(1); // tier 10 -> 1
        expect(woundPenalty(hurt, 5, 0)).toBe(0); // tier 11 -> 0
    });

    it('shrugs off levels with ignore_wounds', () => {
        const hurt = { ...full, health: { value: 8, max: 20 } }; // 2 levels
        expect(woundPenalty(hurt, 0, 1)).toBe(1);
    });

    it('never goes negative — ignoring more wounds than you have is not free dice', () => {
        // The old code used Math.ceil(x, 0), whose second argument does nothing.
        expect(woundPenalty(full, 0, 5)).toBe(0);
    });
});
