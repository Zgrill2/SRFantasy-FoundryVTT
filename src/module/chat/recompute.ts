/**
 * CardState -> view model. Pure: no Foundry imports, no documents, no I/O.
 *
 * Everything the card template needs is computed here, so the template stays declarative and
 * the arithmetic stays testable.
 */

import { computeDamage } from '../rules/damage';
import type { CardState, DefenderState, RollState } from './state';

/** Hits from a roll, plus its reroll if one was spent. */
export function hitsOf(state: RollState, hitsFromJson: (r: unknown) => number): number {
    const base = hitsFromJson(state.roll);
    const extra = state.reroll ? hitsFromJson(state.reroll) : 0;
    return base + extra;
}

export interface DefenderView {
    key: string;
    name: string;
    hits: number;
    /** Null when the defender met or beat the attacker. */
    netHits: number | null;
    avoided: boolean;
    /** Null when avoided or fully soaked. */
    damage: number | null;
    /** Already applied — the card offers Undo instead. */
    applied: boolean;
    dmgSet?: DefenderState['dmgSet'];
}

export interface CardView {
    kind: CardState['kind'];
    attackerHits: number;
    /** Whether the attacker has already spent their one reroll. */
    attackerRerolled: boolean;
    defenders: DefenderView[];
}

/**
 * Resolve a card.
 *
 * `soakOf` looks up the defender's relevant soak — it takes the defender because soak is a
 * property of the person being hit, not of the card.
 */
export function recompute(
    state: CardState,
    hitsFromJson: (r: unknown) => number,
    soakOf: (defender: DefenderState) => number,
): CardView {
    const attackerHits = hitsOf(state.attacker, hitsFromJson);
    const dv = state.attacker.weapon?.dv ?? state.attacker.dv ?? 0;

    const defenders = Object.entries(state.defenders).map(([key, d]): DefenderView => {
        const hits = hitsOf(d, hitsFromJson);

        // A DV card has no opposed roll: the damage is flat, soak is all that stands
        // between you and it.
        if (state.kind === 'dv') {
            const flat = dv - soakOf(d);
            return {
                key,
                name: d.actor.name,
                hits: 0,
                netHits: null,
                avoided: flat <= 0,
                damage: flat > 0 ? flat : null,
                applied: Boolean(d.dmgSet),
                dmgSet: d.dmgSet,
            };
        }

        const avoided = attackerHits <= hits;
        const damage =
            state.kind === 'attack'
                ? computeDamage(attackerHits, hits, dv, soakOf(d))
                : null;

        return {
            key,
            name: d.actor.name,
            hits,
            netHits: avoided ? null : attackerHits - hits,
            avoided,
            damage,
            applied: Boolean(d.dmgSet),
            dmgSet: d.dmgSet,
        };
    });

    return {
        kind: state.kind,
        attackerHits,
        attackerRerolled: Boolean(state.attacker.reroll),
        defenders,
    };
}
