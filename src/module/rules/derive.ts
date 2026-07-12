/**
 * Every derived-stat formula in Shimmering Reach, as pure functions.
 *
 * No Foundry imports live here on purpose — this module is the game's rules engine and is
 * unit-tested directly. `documents/SRActor.ts` is the thin shell that feeds it document
 * data and writes the results back.
 */

import {
    ABILITIES,
    SHIELD_BLOCK_BONUS,
    WOUND_TIER_BASE,
    type Ability,
    type Defense,
    type SkillKey,
} from '../config';

export type Abilities = Record<Ability, number>;

/**
 * The Tradition bonus: magic sharpens what you already know, but it cannot teach you.
 * Half your Tradition rank (rounded up), capped by the rank you're augmenting — so a
 * skill you have never trained gains nothing.
 */
export function traditionBonus(rank: number, tradition: number): number {
    return Math.min(rank, Math.ceil(tradition / 2));
}

/**
 * A skill's dice pool: attribute + rank + Tradition bonus, less 1 for defaulting on a
 * skill you have no rank in at all.
 */
export function skillDicepool(
    rank: number,
    abilityValue: number,
    tradition: number,
    bonus = 0,
): number {
    const untrainedPenalty = rank === 0 ? 1 : 0;
    return abilityValue + rank + traditionBonus(rank, tradition) - untrainedPenalty + bonus;
}

/** Knowledge skills (owned `skill` items) get the Tradition bonus too. */
export function knowledgeDicepool(
    rank: number,
    abilityValue: number | null,
    tradition: number,
): number {
    const base = rank + traditionBonus(rank, tradition);
    return abilityValue === null ? base : base + abilityValue;
}

export function healthMax(a: Abilities): number {
    return a.bod + 16;
}

export function staminaMax(a: Abilities): number {
    return a.wil + 16;
}

/** Mana keys off the Cast Stat, so a caster's choice of tradition shapes their reserves. */
export function manaMax(a: Abilities, castStat: Ability): number {
    return a[castStat] + 16;
}

export function drainResistance(a: Abilities): number {
    return a.wil * 2;
}

export function soaks(a: Abilities, bonuses: Record<string, number> = {}) {
    return {
        armor: a.bod + Math.ceil(a.log / 2) + (bonuses.soak_armor ?? 0),
        physical: a.str + Math.ceil(a.agi / 2) + (bonuses.soak_physical ?? 0),
        mental: a.wil + Math.ceil(a.cha / 2) + (bonuses.soak_mental ?? 0),
    };
}

export interface DefensePools {
    passive: number;
    active: number;
}

/**
 * Defence pools.
 *
 * Passive is pure reflex, no roll and no initiative cost. Block and Parry have no reflexive
 * form — you cannot interpose a shield you aren't already moving — so their passive value
 * is your Dodge, and only the *active* pools reflect the weapon and shield you carry.
 *
 * Active adds the driving skill's rank plus its Tradition bonus.
 */
export function defenses(
    a: Abilities,
    skillRanks: Record<SkillKey, number>,
    tradition: number,
    bonuses: Record<string, number> = {},
): Record<Defense, DefensePools> {
    const active = (passive: number, skill: SkillKey, bonusKey: string): number => {
        const rank = skillRanks[skill] ?? 0;
        return passive + rank + traditionBonus(rank, tradition) + (bonuses[bonusKey] ?? 0);
    };

    const dodgePassive = a.rea + a.int;
    const mentalPassive = a.wil + a.cha;
    const physicalPassive = a.bod + a.agi;

    return {
        dodge: {
            passive: dodgePassive + (bonuses.defense_dodge ?? 0),
            active: active(dodgePassive, 'dodge', 'defense_dodge'),
        },
        block: {
            passive: dodgePassive + (bonuses.defense_block ?? 0),
            active: active(dodgePassive, 'weapon_skill', 'defense_block'),
        },
        parry: {
            passive: dodgePassive + (bonuses.defense_parry ?? 0),
            active: active(dodgePassive, 'weapon_skill', 'defense_parry'),
        },
        mental: {
            passive: mentalPassive + (bonuses.defense_mental ?? 0),
            active: active(mentalPassive, 'perserverence', 'defense_mental'),
        },
        physical: {
            passive: physicalPassive + (bonuses.defense_physical ?? 0),
            active: active(physicalPassive, 'perserverence', 'defense_physical'),
        },
    };
}

export interface TrackState {
    value: number;
    max: number;
}

/**
 * Wound penalty: every `resilient_wounds + 6` points of damage on *each* track costs you a
 * die. The three tracks accrue independently, so a wizard bleeding mana suffers alongside
 * one bleeding blood.
 *
 * `ignoreWounds` shrugs off that many levels. The result floors at 0 — the old code used
 * `Math.ceil(x, 0)`, which does nothing at all (Math.ceil takes one argument), and so could
 * hand out *negative* penalties, i.e. free dice.
 */
export function woundPenalty(
    tracks: { health: TrackState; stamina: TrackState; mana: TrackState },
    resilientWounds: number,
    ignoreWounds: number,
): number {
    const tier = resilientWounds + WOUND_TIER_BASE;
    const levels =
        Math.floor((tracks.health.max - tracks.health.value) / tier) +
        Math.floor((tracks.stamina.max - tracks.stamina.value) / tier) +
        Math.floor((tracks.mana.max - tracks.mana.value) / tier);

    return Math.max(0, levels - ignoreWounds);
}

/** Weapon Damage Value: the weapon's own Power, plus whatever ability drives it. */
export function weaponDv(power: number, abilityValue: number | null): number {
    return power + (abilityValue ?? 0);
}

/** Weapon attack pool: reach extends your threat as surely as skill does. */
export function weaponDicepool(reach: number, skillPool: number): number {
    return reach + skillPool;
}

export function shieldBlockBonus(shieldIndex: number): number {
    return SHIELD_BLOCK_BONUS[shieldIndex] ?? 0;
}

export function isAbility(key: string): key is Ability {
    return (ABILITIES as readonly string[]).includes(key);
}
