import { describe, expect, it } from 'vitest';

import {
    addDefender,
    applyReroll,
    canReroll,
    clearDmgSet,
    hasDefender,
    removeDefender,
    setDmgSet,
} from '../src/module/chat/mutations';
import { recompute } from '../src/module/chat/recompute';
import type { CardState, DefenderState } from '../src/module/chat/state';

/** Stand in for a serialized roll: just carry the hit count. */
const roll = (hits: number) => ({ hits }) as any;
const hitsFromJson = (r: any) => r.hits as number;

const defender = (name: string, hits: number): DefenderState => ({
    actor: { actorId: `a-${name}`, tokenId: `t-${name}`, name, img: '' },
    roll: roll(hits),
});

const attackCard = (attackerHits: number, dv = 6): CardState => ({
    kind: 'attack',
    attacker: {
        actor: { actorId: 'att', tokenId: null, name: 'Attacker', img: '' },
        blind: false,
        roll: roll(attackerHits),
        weapon: { name: 'Sword', dv, soak: 'armor', skill: 'weapon_skill' },
    },
    defenders: {},
});

describe('recompute — attack cards', () => {
    it('lands damage as net hits + DV, less soak', () => {
        const state = addDefender(attackCard(5), 't-goblin', defender('goblin', 2));
        const view = recompute(state, hitsFromJson, () => 4);

        const d = view.defenders[0]!;
        expect(d.avoided).toBe(false);
        expect(d.netHits).toBe(3);
        expect(d.damage).toBe(3 + 6 - 4);
    });

    it('counts a tie as avoided — the defender only has to match you', () => {
        const state = addDefender(attackCard(3), 't-goblin', defender('goblin', 3));
        const view = recompute(state, hitsFromJson, () => 0);

        expect(view.defenders[0]!.avoided).toBe(true);
        expect(view.defenders[0]!.netHits).toBeNull();
        expect(view.defenders[0]!.damage).toBeNull();
    });

    it('reports no damage when soak eats the whole hit', () => {
        const state = addDefender(attackCard(4, 2), 't-goblin', defender('goblin', 3));
        const view = recompute(state, hitsFromJson, () => 9);

        expect(view.defenders[0]!.avoided).toBe(false);
        expect(view.defenders[0]!.damage).toBeNull();
    });

    it('counts a reroll toward the attacker’s hits', () => {
        const state = applyReroll(attackCard(2), null, roll(3));
        const view = recompute(state, hitsFromJson, () => 0);

        expect(view.attackerHits).toBe(5);
        expect(view.attackerRerolled).toBe(true);
    });

    it('resolves each defender independently', () => {
        let state = addDefender(attackCard(5), 't-a', defender('a', 1));
        state = addDefender(state, 't-b', defender('b', 5));

        const view = recompute(state, hitsFromJson, () => 0);
        expect(view.defenders.map((d) => d.avoided)).toEqual([false, true]);
    });
});

describe('recompute — DV cards', () => {
    it('applies flat damage against soak, with no opposed roll', () => {
        const state: CardState = {
            kind: 'dv',
            attacker: {
                actor: { actorId: 'gm', tokenId: null, name: 'Trap', img: '' },
                blind: false,
                roll: roll(0),
                dv: 10,
                dvSoak: 'armor',
            },
            defenders: { 't-x': defender('x', 0) },
        };

        const view = recompute(state, hitsFromJson, () => 4);
        expect(view.defenders[0]!.damage).toBe(6);
        expect(view.defenders[0]!.netHits).toBeNull();
    });

    it('is fully soaked when soak meets the DV', () => {
        const state: CardState = {
            kind: 'dv',
            attacker: {
                actor: { actorId: 'gm', tokenId: null, name: 'Trap', img: '' },
                blind: false,
                roll: roll(0),
                dv: 4,
            },
            defenders: { 't-x': defender('x', 0) },
        };

        const view = recompute(state, hitsFromJson, () => 4);
        expect(view.defenders[0]!.avoided).toBe(true);
        expect(view.defenders[0]!.damage).toBeNull();
    });
});

describe('mutations', () => {
    it('does not mutate the state it is given', () => {
        const before = attackCard(3);
        const after = addDefender(before, 't-a', defender('a', 1));

        expect(Object.keys(before.defenders)).toHaveLength(0);
        expect(Object.keys(after.defenders)).toHaveLength(1);
    });

    it('keys defenders by token, so two goblins are two defenders', () => {
        let state = addDefender(attackCard(3), 't-1', defender('goblin', 1));
        state = addDefender(state, 't-2', defender('goblin', 2));

        expect(Object.keys(state.defenders)).toHaveLength(2);
        expect(hasDefender(state, 't-1')).toBe(true);
        expect(removeDefender(state, 't-1').defenders['t-2']).toBeDefined();
    });

    it('spends a reroll once and refuses a second', () => {
        const state = attackCard(2);
        expect(canReroll(state, null)).toBe(true);

        const once = applyReroll(state, null, roll(2));
        expect(canReroll(once, null)).toBe(false);

        // A second attempt is rejected, not silently overwritten.
        const twice = applyReroll(once, null, roll(9));
        expect(twice).toBe(once);
        expect(hitsFromJson(twice.attacker.reroll)).toBe(2);
    });

    it('rerolls a defender independently of the attacker', () => {
        let state = addDefender(attackCard(4), 't-a', defender('a', 1));
        state = applyReroll(state, 't-a', roll(3));

        expect(canReroll(state, 't-a')).toBe(false);
        expect(canReroll(state, null)).toBe(true);
        expect(recompute(state, hitsFromJson, () => 0).defenders[0]!.hits).toBe(4);
    });

    it('flips a defender to Undo once damage is recorded, and back again', () => {
        let state = addDefender(attackCard(5), 't-a', defender('a', 0));
        expect(recompute(state, hitsFromJson, () => 0).defenders[0]!.applied).toBe(false);

        state = setDmgSet(state, 't-a', { hp: 4, stam: 2 });
        const applied = recompute(state, hitsFromJson, () => 0).defenders[0]!;
        expect(applied.applied).toBe(true);
        expect(applied.dmgSet).toEqual({ hp: 4, stam: 2 });

        state = clearDmgSet(state, 't-a');
        expect(recompute(state, hitsFromJson, () => 0).defenders[0]!.applied).toBe(false);
    });

    it('ignores mutations aimed at a defender who is not on the card', () => {
        const state = attackCard(3);
        expect(setDmgSet(state, 'nobody', { hp: 1, stam: 1 })).toBe(state);
        expect(applyReroll(state, 'nobody', roll(1))).toBe(state);
    });
});
