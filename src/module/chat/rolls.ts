import { SKILLS, type SkillKey } from '../config';
import { RollDP } from '../dice/RollDP';
import type { SRItem } from '../documents/SRItem';
import { postCard } from './render';
import type { ActorRef, CardState } from './state';

/**
 * The entry points: sheet click -> evaluated roll -> chat card.
 */

export interface RollModifiers {
    modifier: number;
    explode: boolean;
    applyWounds: boolean;
    blind: boolean;
}

export const DEFAULT_MODIFIERS: RollModifiers = {
    modifier: 0,
    explode: false,
    applyWounds: true,
    blind: false,
};

export function actorRef(actor: Actor.Implementation, token?: Token.Implementation | null): ActorRef {
    return {
        actorId: actor.id!,
        tokenId: token?.id ?? actor.token?.id ?? null,
        name: actor.name!,
        img: actor.img!,
    };
}

async function rollPool(
    actor: Actor.Implementation,
    pool: number,
    mods: RollModifiers,
): Promise<RollDP> {
    const sys = actor.system as any;

    const roll = RollDP.fromPool(pool + mods.modifier, {
        explode: mods.explode,
        woundPenalty: mods.applyWounds ? sys.wound_penalty.value : 0,
    });

    await roll.evaluate();
    return roll;
}

/** A plain skill test. */
export async function rollSkill(
    actor: Actor.Implementation,
    skill: SkillKey,
    mods: RollModifiers = DEFAULT_MODIFIERS,
): Promise<void> {
    const sys = actor.system as any;
    const roll = await rollPool(actor, sys.skills[skill].dicepool, mods);

    await postSkillCard(actor, SKILLS[skill].label, roll, mods);
}

/** A knowledge skill, which is an item rather than a fixed skill. */
export async function rollKnowledge(
    actor: Actor.Implementation,
    item: SRItem,
    mods: RollModifiers = DEFAULT_MODIFIERS,
): Promise<void> {
    const roll = await rollPool(actor, item.knowledgePool, mods);
    await postSkillCard(actor, item.name!, roll, mods);
}

async function postSkillCard(
    actor: Actor.Implementation,
    label: string,
    roll: RollDP,
    mods: RollModifiers,
): Promise<void> {
    const state: CardState = {
        kind: 'skill',
        attacker: {
            actor: actorRef(actor),
            label,
            blind: mods.blind,
            roll: roll.toJSON() as any,
        },
        defenders: {},
    };

    await postCard(state, {
        blind: mods.blind,
        whisperGMs: mods.blind,
        speaker: ChatMessage.getSpeaker({ actor } as any),
    });
}

/**
 * An attack.
 *
 * The card carries the weapon's DV and which soak resists it, so that when a defender later
 * signs up, the card can resolve the whole exchange from its own state.
 */
export async function rollAttack(
    actor: Actor.Implementation,
    weapon: SRItem,
    mods: RollModifiers = DEFAULT_MODIFIERS,
    dvModifier = 0,
): Promise<void> {
    const w = weapon.system as any;
    const roll = await rollPool(actor, weapon.attackPool, mods);

    const state: CardState = {
        kind: 'attack',
        attacker: {
            actor: actorRef(actor),
            blind: mods.blind,
            roll: roll.toJSON() as any,
            weapon: {
                name: weapon.name!,
                dv: weapon.damageValue + dvModifier,
                soak: w.soak,
                skill: w.skill,
            },
        },
        defenders: {},
    };

    await postCard(state, {
        blind: mods.blind,
        whisperGMs: mods.blind,
        speaker: ChatMessage.getSpeaker({ actor } as any),
    });
}

/**
 * Drain, after resisting it.
 *
 * You roll your Drain Resistance against the Overload you reached for; whatever you fail to
 * shrug off is what you pay, in mana and then in blood.
 */
export async function rollDrain(
    actor: Actor.Implementation,
    overload: number,
    soakBonus = 0,
    explode = false,
): Promise<void> {
    const sys = actor.system as any;

    const roll = RollDP.fromPool(sys.drainres.value + soakBonus, {
        explode,
        woundPenalty: sys.wound_penalty.value,
    });
    await roll.evaluate();

    const state: CardState = {
        kind: 'drain',
        attacker: {
            actor: actorRef(actor),
            label: 'Drain',
            blind: false,
            roll: roll.toJSON() as any,
            drain: Math.max(0, overload - roll.hits),
        },
        defenders: {},
    };

    await postCard(state, { speaker: ChatMessage.getSpeaker({ actor } as any) });
}
