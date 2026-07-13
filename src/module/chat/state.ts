/**
 * Chat-card state.
 *
 * `ChatMessage.flags.shimmeringreach` is the single source of truth for a card. The HTML is
 * a *pure render* of it: every mutation rewrites the flags and re-renders the whole card.
 * Nothing is ever patched in place, so a card cannot drift from its own state.
 *
 * Rolls are stored as `Roll.toJSON()` and rehydrated with `RollDP.fromData()`. The old
 * system spread Roll instances into flags, which silently dropped the prototype and forced
 * it to reconstruct the pool size by arithmetic on the term data.
 */

import type { Defense, Soak } from '../config';

/** A serialized RollDP, as produced by `roll.toJSON()`. */
export type RollJSON = Record<string, unknown>;

export type CardKind = 'skill' | 'attack' | 'multi-skill' | 'dv' | 'drain';

/** Who rolled, resolved back to a live actor by id (token id first, for unlinked tokens). */
export interface ActorRef {
    actorId: string;
    tokenId: string | null;
    name: string;
    img: string;
}

export interface RollState {
    roll: RollJSON;
    /** A single reroll of the missed dice. Once per roll, ever. */
    reroll?: RollJSON;
}

export interface AttackerState extends RollState {
    actor: ActorRef;
    /** Hidden from players; they see `?` until the GM reveals it. */
    blind: boolean;
    /** Attack cards only. */
    weapon?: {
        name: string;
        dv: number;
        soak: Soak;
        skill: string;
    };
    /** Skill and multi-skill cards. */
    label?: string;
    /** DV cards: flat damage with no opposed roll. */
    dv?: number;
    dvSoak?: Soak;
    /** Drain cards: how much drain still has to be paid after resisting it. */
    drain?: number;
}

export interface DefenderState extends RollState {
    actor: ActorRef;
    /** Which defence they used, and whether they spent initiative on it. */
    defense?: Defense;
    active?: boolean;
    /** Damage already applied, so the card can offer an Undo instead of a second hit. */
    dmgSet?: { hp: number; stam: number; mana?: number };
}

export interface CardState {
    kind: CardKind;
    attacker: AttackerState;
    /**
     * Keyed by a stable id (token id, else actor id) rather than by array index. The old
     * system re-indexed a numeric map on every change and then had to scan it to work out
     * who was who.
     */
    defenders: Record<string, DefenderState>;
}

/** The key a defender is filed under. Token first: two goblins are two defenders. */
export function defenderKey(ref: ActorRef): string {
    return ref.tokenId ?? ref.actorId;
}
