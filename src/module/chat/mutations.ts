/**
 * Card state transitions, as pure reducers.
 *
 * Each returns a *new* CardState; none touch a document. The effectful layer (handlers.ts)
 * calls these and then writes the result to the message's flags in one update.
 */

import type { CardState, DefenderState, RollJSON } from './state';

function clone(state: CardState): CardState {
    return structuredClone(state);
}

/** Is this actor already signed up as a defender? */
export function hasDefender(state: CardState, key: string): boolean {
    return key in state.defenders;
}

export function addDefender(state: CardState, key: string, defender: DefenderState): CardState {
    const next = clone(state);
    next.defenders[key] = defender;
    return next;
}

export function removeDefender(state: CardState, key: string): CardState {
    const next = clone(state);
    delete next.defenders[key];
    return next;
}

/**
 * Spend the one reroll.
 *
 * Rerolls are once per roll, forever — so this refuses rather than overwrites. `key` is a
 * defender key, or null for the attacker.
 */
export function applyReroll(state: CardState, key: string | null, roll: RollJSON): CardState {
    const next = clone(state);
    const target = key === null ? next.attacker : next.defenders[key];

    if (!target || target.reroll) return state;

    target.reroll = roll;
    return next;
}

export function canReroll(state: CardState, key: string | null): boolean {
    const target = key === null ? state.attacker : state.defenders[key];
    return Boolean(target) && !target!.reroll;
}

/** Record that damage landed, so the card offers an Undo rather than a second helping. */
export function setDmgSet(
    state: CardState,
    key: string,
    dmgSet: DefenderState['dmgSet'],
): CardState {
    const next = clone(state);
    const defender = next.defenders[key];
    if (!defender) return state;

    defender.dmgSet = dmgSet;
    return next;
}

export function clearDmgSet(state: CardState, key: string): CardState {
    const next = clone(state);
    const defender = next.defenders[key];
    if (!defender) return state;

    delete defender.dmgSet;
    return next;
}

/** Reveal a blind roll. */
export function reveal(state: CardState): CardState {
    const next = clone(state);
    next.attacker.blind = false;
    return next;
}
