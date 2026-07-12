/**
 * Damage, soak, and drain — pure functions.
 */

import { WOUND_TIER_BASE } from '../config';
import type { TrackState } from './derive';

export interface DamageSplit {
    /** Damage taken on the Health track. */
    hp: number;
    /** Damage taken on the Stamina track. */
    stam: number;
}

/**
 * How much of a hit Stamina can absorb.
 *
 * Your Body is what lets you roll with a blow rather than break under it — but Stamina can
 * never be driven to 0 this way. Past that, it's Health.
 *
 * (In the old code this cap was read from a variable called `armor`, which actually held
 * `abilities.bod`. It was Body all along.)
 */
export function maxStaminaAbsorb(body: number, stamina: TrackState): number {
    return Math.max(0, Math.min(body, stamina.value - 1));
}

/**
 * Split incoming damage between Health and Stamina so that it crosses as few wound
 * thresholds as possible.
 *
 * Both tracks may already be partway into a wound tier, so the best split isn't simply
 * "absorb as much as you can" — sometimes taking one more point on Health is free while
 * the same point on Stamina would tip you over a threshold and cost a die on every roll.
 * Ties break toward Stamina, since Health is the track that kills you.
 *
 * This is now what BOTH the one-click soak button and the soak dialog's opening slider
 * position use. They used to disagree: the button greedily dumped into Stamina, while only
 * the dialog did this search.
 */
export function autoSplit(
    dv: number,
    body: number,
    health: TrackState,
    stamina: TrackState,
    resilientWounds: number,
): DamageSplit {
    if (dv <= 0) return { hp: 0, stam: 0 };

    const tier = resilientWounds + WOUND_TIER_BASE;

    // How far each track already sits into its current, partially-filled wound tier.
    const hpProgress = (health.max - health.value) % tier;
    const stamProgress = (stamina.max - stamina.value) % tier;

    const minHp = Math.max(0, dv - maxStaminaAbsorb(body, stamina));

    let bestHp = dv;
    let bestWounds = Number.POSITIVE_INFINITY;

    // Descend so that, on a tie, the split putting *less* on Health wins.
    for (let hp = dv; hp >= minHp; hp--) {
        const stam = dv - hp;
        const wounds =
            Math.floor((hp + hpProgress) / tier) + Math.floor((stam + stamProgress) / tier);

        if (wounds <= bestWounds) {
            bestWounds = wounds;
            bestHp = hp;
        }
    }

    return { hp: bestHp, stam: dv - bestHp };
}

/**
 * Drain burns mana first, and only bites into Health once the reserves are dry.
 */
export function drainSplit(dv: number, mana: TrackState, health: TrackState): DamageSplit & { mana: number } {
    const manaDamage = Math.min(Math.max(0, dv), mana.value);
    const hpDamage = Math.max(0, dv - mana.value);

    return {
        mana: manaDamage,
        hp: hpDamage,
        stam: 0,
    };
}

/**
 * Damage from a resolved attack: how badly you were beaten, plus the weapon's own bite,
 * less what your body or mind shrugs off.
 *
 * Returns null when the attack was avoided outright or fully soaked.
 */
export function computeDamage(
    attackerHits: number,
    defenderHits: number,
    dv: number,
    soakValue: number,
): number | null {
    if (attackerHits <= defenderHits) return null;

    const netHits = attackerHits - defenderHits;
    const damage = netHits + dv - soakValue;

    return damage > 0 ? damage : null;
}

/** Wound tier size for an actor, given their Resilient Wounds. */
export function woundTier(resilientWounds: number): number {
    return resilientWounds + WOUND_TIER_BASE;
}
