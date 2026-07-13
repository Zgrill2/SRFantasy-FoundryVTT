import {
    ACTIVE_DEFENSE_COST,
    DEFENSE_DEFS,
    TOTAL_DEFENSE_COST,
    type Defense,
} from '../config';
import { RollDP } from '../dice/RollDP';
import { onGmAction } from './gmRelay';
import { addDefender, applyReroll, canReroll, clearDmgSet, hasDefender, removeDefender, setDmgSet } from './mutations';
import { cardState, resolveActor, rollFromJson, updateCard } from './render';
import { defenderKey, type ActorRef, type CardState, type DefenderState } from './state';

/**
 * The privileged half of the card system. Everything here runs on exactly one GM's client,
 * reached through the relay.
 */

interface DefendPayload {
    messageId: string;
    ref: ActorRef;
    defense: Defense;
    active: boolean;
    totalDefense: boolean;
    modifier: number;
    explode: boolean;
    applyWounds: boolean;
}

function message(id: string): ChatMessage.Implementation | undefined {
    return game.messages?.get(id) as ChatMessage.Implementation | undefined;
}

/** The combatant for an actor in the current fight, if they're in it. */
function combatantOf(actor: Actor.Implementation, ref: ActorRef) {
    return game.combat?.combatants.find((c) =>
        ref.tokenId ? c.tokenId === ref.tokenId : c.actorId === actor.id,
    );
}

const effectName = (defense: Defense, total: boolean) =>
    total ? 'Total Defense' : `Active ${DEFENSE_DEFS[defense].label}`;

/**
 * Roll a defence onto a card.
 *
 * An active defence is bought with initiative — you throw yourself aside now and pay for it
 * later in the round. You pay only once: the effect that marks you as actively defending
 * lasts the round, and while it stands every further attack is met with the same pool for
 * free. With no initiative left, you simply cannot.
 */
async function gmDefend(p: DefendPayload): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    const key = defenderKey(p.ref);
    if (hasDefender(state, key)) return; // already defending; don't roll twice

    const actor = resolveActor(p.ref);
    if (!actor) return;

    const sys = actor.system as any;

    if (p.active) {
        const name = effectName(p.defense, p.totalDefense);
        const already = actor.effects.find(
            (e) => e.name === name || e.name === 'Total Defense',
        );

        if (!already) {
            const combatant = combatantOf(actor, p.ref);
            const initiative = combatant?.initiative ?? 0;

            if (!combatant || initiative <= 0) {
                ui.notifications?.warn(
                    `${actor.name} has no initiative left for an active defense.`,
                );
                return;
            }

            const cost = p.totalDefense ? TOTAL_DEFENSE_COST : ACTIVE_DEFENSE_COST;
            await combatant.update({ initiative: initiative - cost });

            await actor.createEmbeddedDocuments('ActiveEffect', [
                {
                    // `label`/`icon` were renamed to `name`/`img`.
                    name,
                    img: 'icons/svg/shield.svg',
                    origin: actor.uuid,
                    duration: { rounds: 1 },
                    disabled: false,
                } as any,
            ]);
        }
    }

    const pool = sys.defenses[p.defense][p.active ? 'active' : 'passive'] + p.modifier;

    const roll = RollDP.fromPool(pool, {
        explode: p.explode,
        woundPenalty: p.applyWounds ? sys.wound_penalty.value : 0,
    });
    await roll.evaluate();

    const defender: DefenderState = {
        actor: p.ref,
        defense: p.defense,
        active: p.active,
        roll: roll.toJSON() as any,
    };

    await updateCard(msg, addDefender(state, key, defender));
}

/**
 * Roll in to a group check.
 *
 * The GM names a skill; you bring your own pool. The modifiers the GM set when posting the
 * card apply to everyone who answers it, so the whole party is rolling the same test.
 */
async function gmRollIn(p: { messageId: string; ref: ActorRef }): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    const skill = state.attacker.skill;
    if (!skill) return;

    const key = defenderKey(p.ref);
    if (hasDefender(state, key)) return; // already rolled; one answer each

    const actor = resolveActor(p.ref);
    if (!actor) return;

    const sys = actor.system as any;
    const pool = (sys.skills[skill]?.dicepool ?? 0) + (state.attacker.modifier ?? 0);

    const roll = RollDP.fromPool(pool, {
        explode: state.attacker.explode ?? false,
        woundPenalty: (state.attacker.applyWounds ?? true) ? sys.wound_penalty.value : 0,
    });
    await roll.evaluate();

    await updateCard(
        msg,
        addDefender(state, key, { actor: p.ref, roll: roll.toJSON() as any }),
    );
}

/** A DV card has no roll to make: soak is all that stands between you and the damage. */
async function gmAddSoakTarget(p: { messageId: string; ref: ActorRef }): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    const key = defenderKey(p.ref);
    if (hasDefender(state, key)) return;

    const roll = RollDP.fromPool(0);
    await roll.evaluate();

    await updateCard(
        msg,
        addDefender(state, key, { actor: p.ref, roll: roll.toJSON() as any }),
    );
}

/** Reroll the dice that missed. Once, and only once. */
async function gmReroll(p: { messageId: string; key: string | null }): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    if (!canReroll(state, p.key)) {
        ui.notifications?.warn('That roll has already been rerolled.');
        return;
    }

    const target = p.key === null ? state.attacker : state.defenders[p.key];
    if (!target) return;

    const misses = rollFromJson(target.roll).misses;
    if (misses <= 0) return;

    const roll = RollDP.fromPool(misses);
    await roll.evaluate();

    await updateCard(msg, applyReroll(state, p.key, roll.toJSON() as any));
}

async function gmRemoveDefender(p: { messageId: string; key: string }): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    await updateCard(msg, removeDefender(state, p.key));
}

/**
 * Record that damage landed.
 *
 * The defender's own client already wrote the damage to their actor — they own it. This only
 * marks the card, which is a shared document a player may not touch. Splitting it this way
 * keeps players in control of their own sheets while the GM arbitrates the shared record.
 */
async function gmRecordDamage(p: {
    messageId: string;
    key: string;
    dmgSet: DefenderState['dmgSet'];
}): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    await updateCard(msg, setDmgSet(state, p.key, p.dmgSet));
}

async function gmClearDamage(p: { messageId: string; key: string }): Promise<void> {
    const msg = message(p.messageId);
    const state = msg ? cardState(msg) : null;
    if (!msg || !state) return;

    await updateCard(msg, clearDmgSet(state, p.key));
}

export function registerCardHandlers(): void {
    onGmAction('defend', gmDefend);
    onGmAction('rollIn', gmRollIn);
    onGmAction('addSoakTarget', gmAddSoakTarget);
    onGmAction('reroll', gmReroll);
    onGmAction('removeDefender', gmRemoveDefender);
    onGmAction('recordDamage', gmRecordDamage);
    onGmAction('clearDamage', gmClearDamage);
}

export type { CardState };
