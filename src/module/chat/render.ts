import { DEFENSE_DEFS, DEFENSES, type Defense } from '../config';
import { FLAG_SCOPE, TEMPLATE_PATH } from '../constants';
import { RollDP } from '../dice/RollDP';
import { recompute } from './recompute';
import type { CardState, DefenderState, RollJSON, RollState } from './state';

const { renderTemplate } = foundry.applications.handlebars;

/**
 * A GM-posted card asks a question; it does not answer one. A group check or a falling rock
 * has no roll of its own, so its stored roll is empty.
 */
function hasRoll(json: RollJSON | undefined): boolean {
    return Boolean(json && Object.keys(json).length > 0);
}

/** Rehydrate a stored roll back into a real RollDP, prototype and all. */
export function rollFromJson(json: RollJSON): RollDP {
    return (Roll.fromData as any)(json) as RollDP;
}

function hitsFromJson(json: unknown): number {
    const roll = json as RollJSON;
    return hasRoll(roll) ? rollFromJson(roll).hits : 0;
}

/** Read a card's state off a message. Returns null for any message that isn't ours. */
export function cardState(message: ChatMessage.Implementation): CardState | null {
    return ((message as any).getFlag(FLAG_SCOPE, 'card') as CardState | undefined) ?? null;
}

/** The actor a defender (or attacker) refers to, resolved through the token if there is one. */
export function resolveActor(ref: {
    actorId: string;
    tokenId: string | null;
}): Actor.Implementation | null {
    if (ref.tokenId) {
        const token = canvas?.tokens?.get(ref.tokenId);
        if (token?.actor) return token.actor;
    }
    return (game.actors?.get(ref.actorId) as Actor.Implementation | undefined) ?? null;
}

/** What a defender soaks this card's damage with. */
function soakOf(state: CardState, defender: DefenderState): number {
    const soakKey = state.attacker.weapon?.soak ?? state.attacker.dvSoak ?? 'armor';
    const actor = resolveActor(defender.actor);
    return (actor?.system as any)?.soaks?.[soakKey]?.value ?? 0;
}

/** The dice tray for one roll: faces, hits, the odds. Null when there is no roll to show. */
function trayFor(state: RollState) {
    if (!hasRoll(state.roll)) return null;

    const roll = rollFromJson(state.roll);
    const reroll = state.reroll ? rollFromJson(state.reroll) : null;

    return {
        faces: [...roll.faces, ...(reroll?.faces ?? [])],
        hits: roll.hits + (reroll?.hits ?? 0),
        pool: roll.pool,
        dice: roll.rolled + (reroll?.rolled ?? 0),
        woundPenalty: roll.woundPenalty,
        percentile: roll.percentile.toFixed(1),
        rerolled: Boolean(reroll),
        misses: roll.misses,
    };
}

/**
 * Build the card's HTML from its state, and nothing else.
 *
 * The state is the truth; this is only a view of it. That is why every mutation re-renders
 * the whole card rather than editing the DOM — a card cannot drift out of sync with itself.
 */
export async function renderCard(state: CardState): Promise<string> {
    const view = recompute(state, hitsFromJson, (d) => soakOf(state, d));

    const defenses = DEFENSES.map((key: Defense) => ({
        key,
        label: DEFENSE_DEFS[key].label,
        allowPassive: DEFENSE_DEFS[key].allowPassive,
    }));

    const isGM = game.user?.isGM ?? false;

    return renderTemplate(`${TEMPLATE_PATH}/chat/card.hbs`, {
        state,
        view,
        defenses,
        attackerTray: trayFor(state.attacker),
        defenderTrays: Object.fromEntries(
            Object.entries(state.defenders).map(([key, d]) => [key, trayFor(d)]),
        ),
        isGM,
        // An obscured card is public, but its numbers are not. The GM always sees through it.
        hideNumbers: Boolean(state.obscured) && !isGM,
    });
}

/**
 * Write new state to a card and re-render it, in one update.
 *
 * Only a GM (or the message's author) can do this, which is why every player-initiated card
 * change routes through the relay first.
 */
export async function updateCard(
    message: ChatMessage.Implementation,
    state: CardState,
): Promise<void> {
    await message.update({
        content: await renderCard(state),
        [`flags.${FLAG_SCOPE}.card`]: state,
    } as any);
}

/** Post a fresh card. */
export async function postCard(
    state: CardState,
    options: { blind?: boolean; whisperGMs?: boolean; speaker?: object } = {},
): Promise<ChatMessage.Implementation> {
    const whisper = options.whisperGMs
        ? game.users!.filter((u) => u.isGM).map((u) => u.id!)
        : undefined;

    return (await ChatMessage.create({
        content: await renderCard(state),
        speaker: options.speaker,
        blind: options.blind,
        whisper,
        flags: { [FLAG_SCOPE]: { card: state } },
    } as any)) as ChatMessage.Implementation;
}
