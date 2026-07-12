/**
 * Shimmering Reach initiative — pure logic.
 *
 * Combat is not a round-robin. Everyone rolls an initiative score; taking a turn costs 10
 * from it, and active defences eat into the same pool. The tracker keeps sweeping the order
 * — pass after pass — and the fast keep acting while the slow have already spent
 * themselves. A round ends only when nobody has anything left, at which point initiative is
 * rolled fresh.
 */

import { INITIATIVE_PER_TURN } from '../config';

export interface TurnState {
    initiative: number | null;
    defeated: boolean;
}

/** A combatant can act while they still have initiative to spend and are still standing. */
function canAct(t: TurnState): boolean {
    return !t.defeated && (t.initiative ?? 0) > 0;
}

/**
 * Who acts next.
 *
 * Returns the index of the next combatant, or `null` to mean "nobody can act — end the
 * round". `currentTurn` is the index of whoever just acted; pass -1 at the start of a pass.
 *
 * The wrap is the whole mechanic: when nobody *below* the pointer can still act but someone
 * *above* it can, we start a new pass from the top rather than ending the round.
 */
export function nextTurnIndex(turns: readonly TurnState[], currentTurn: number): number | null {
    if (!turns.some(canAct)) return null;

    // Finish the current pass first.
    for (let i = currentTurn + 1; i < turns.length; i++) {
        if (canAct(turns[i]!)) return i;
    }

    // Everyone after the pointer is spent, but someone still has initiative: new pass.
    for (let i = 0; i < turns.length; i++) {
        if (canAct(turns[i]!)) return i;
    }

    return null;
}

/** Taking a turn costs initiative. */
export function initiativeAfterTurn(initiative: number): number {
    return initiative - INITIATIVE_PER_TURN;
}

export interface SortableCombatant {
    /** Rolled initiative total plus the actor's initiative bias. The primary ordering. */
    order: number;
    reaction: number;
    luckMax: number;
    luckCurrent: number;
    name: string;
    id: string;
}

/**
 * Turn order: by rolled order, then by the qualities that would let you act first anyway —
 * raw Reaction, then Luck. Name and id only ever break a perfect tie, so the order is
 * stable across re-renders.
 */
export function compareCombatants(a: SortableCombatant, b: SortableCombatant): number {
    return (
        b.order - a.order ||
        b.reaction - a.reaction ||
        b.luckMax - a.luckMax ||
        b.luckCurrent - a.luckCurrent ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
    );
}
