import { autoSplit, drainSplit } from '../rules/damage';
import { requestGmAction } from './gmRelay';
import { cardState, resolveActor } from './render';
import { defenderKey, type ActorRef, type CardState } from './state';

/**
 * The click layer: turns a click on a card into an intent.
 *
 * Anything that only touches the clicker's own actor is done right here on their client —
 * they own it. Anything touching the shared card goes through the GM relay.
 */

/**
 * Who is defending? Whoever the clicker has selected.
 *
 * Not Foundry's targeting: a player "signs up" to defend by selecting their own token and
 * clicking the defence on the attacker's card. That is how the table already plays.
 */
export function selectedActorRefs(): ActorRef[] {
    const controlled = canvas?.tokens?.controlled ?? [];

    if (controlled.length > 0) {
        return controlled
            .filter((t) => t.actor)
            .map((t) => ({
                actorId: t.actor!.id!,
                tokenId: t.id,
                name: t.actor!.name!,
                img: t.actor!.img!,
            }));
    }

    // Nothing selected: fall back to the player's own character.
    const own = game.user?.character;
    if (own) {
        return [{ actorId: own.id!, tokenId: null, name: own.name!, img: own.img! }];
    }

    ui.notifications?.warn('Select a token first.');
    return [];
}

function messageIdOf(el: HTMLElement): string | undefined {
    return el.closest<HTMLElement>('[data-message-id]')?.dataset.messageId;
}

function stateOf(messageId: string): CardState | null {
    const msg = game.messages?.get(messageId) as ChatMessage.Implementation | undefined;
    return msg ? cardState(msg) : null;
}

/** Roll a defence for every token the clicker has selected. */
async function onDefend(event: MouseEvent, target: HTMLElement): Promise<void> {
    const messageId = messageIdOf(target);
    if (!messageId) return;

    const defense = target.dataset.defense as any;
    const active = target.dataset.state === 'active';

    for (const ref of selectedActorRefs()) {
        await requestGmAction('defend', {
            messageId,
            ref,
            defense,
            active,
            // Ctrl commits you fully: a bigger pool, at twice the initiative.
            totalDefense: active && event.ctrlKey,
            modifier: 0,
            explode: false,
            applyWounds: true,
        });
    }
}

/** Answer a group check with whatever tokens you have selected. */
async function onRollIn(_event: MouseEvent, target: HTMLElement): Promise<void> {
    const messageId = messageIdOf(target);
    if (!messageId) return;

    for (const ref of selectedActorRefs()) {
        await requestGmAction('rollIn', { messageId, ref });
    }
}

async function onAddSoakTarget(_event: MouseEvent, target: HTMLElement): Promise<void> {
    const messageId = messageIdOf(target);
    if (!messageId) return;

    for (const ref of selectedActorRefs()) {
        await requestGmAction('addSoakTarget', { messageId, ref });
    }
}

/** Shift-click the hits badge to reroll what missed. */
async function onReroll(event: MouseEvent, target: HTMLElement): Promise<void> {
    if (!event.shiftKey) return;

    const messageId = messageIdOf(target);
    if (!messageId) return;

    await requestGmAction('reroll', {
        messageId,
        key: target.dataset.defender ?? null,
    });
}

async function onRemoveDefender(_event: MouseEvent, target: HTMLElement): Promise<void> {
    const messageId = messageIdOf(target);
    const key = target.dataset.defender;
    if (!messageId || !key) return;

    await requestGmAction('removeDefender', { messageId, key });
}

/**
 * Take the damage.
 *
 * The split is chosen to cross as few wound thresholds as possible — see rules/damage.ts.
 * The actor update happens here, on the owner's own client, because they own their sheet;
 * only the note on the shared card needs a GM.
 */
async function onApplyDamage(_event: MouseEvent, target: HTMLElement): Promise<void> {
    const messageId = messageIdOf(target);
    const key = target.dataset.defender;
    if (!messageId || !key) return;

    const state = stateOf(messageId);
    const defender = state?.defenders[key];
    if (!state || !defender) return;

    const actor = resolveActor(defender.actor);
    if (!actor?.isOwner) {
        ui.notifications?.warn('You do not have permission to soak for that actor.');
        return;
    }

    const damage = Number(target.dataset.damage ?? 0);
    if (damage <= 0) return;

    const sys = actor.system as any;
    const split = autoSplit(
        damage,
        sys.abilities.bod.value,
        sys.health,
        sys.stamina,
        sys.wound_penalty.resilient_wounds,
    );

    await actor.update({
        'system.health.value': sys.health.value - split.hp,
        'system.stamina.value': sys.stamina.value - split.stam,
    } as any);

    await requestGmAction('recordDamage', { messageId, key, dmgSet: split });
}

/** Shift-click to give it back. */
async function onUndoDamage(event: MouseEvent, target: HTMLElement): Promise<void> {
    if (!event.shiftKey) return;

    const messageId = messageIdOf(target);
    const key = target.dataset.defender;
    if (!messageId || !key) return;

    const state = stateOf(messageId);
    const defender = state?.defenders[key];
    if (!state || !defender?.dmgSet) return;

    const actor = resolveActor(defender.actor);
    if (!actor?.isOwner) return;

    const sys = actor.system as any;
    const { hp, stam, mana } = defender.dmgSet;

    await actor.update({
        'system.health.value': sys.health.value + hp,
        'system.stamina.value': sys.stamina.value + stam,
        ...(mana ? { 'system.mana.value': sys.mana.value + mana } : {}),
    } as any);

    await requestGmAction('clearDamage', { messageId, key });
}

/** Drain burns mana first, and only bites into health once the reserves are dry. */
async function onApplyDrain(_event: MouseEvent, target: HTMLElement): Promise<void> {
    const messageId = messageIdOf(target);
    if (!messageId) return;

    const state = stateOf(messageId);
    if (!state) return;

    const actor = resolveActor(state.attacker.actor);
    if (!actor?.isOwner) {
        ui.notifications?.warn('You do not have permission to take drain for that actor.');
        return;
    }

    const sys = actor.system as any;
    const split = drainSplit(state.attacker.drain ?? 0, sys.mana, sys.health);

    await actor.update({
        'system.mana.value': sys.mana.value - split.mana,
        'system.health.value': sys.health.value - split.hp,
    } as any);

    const key = defenderKey(state.attacker.actor);
    await requestGmAction('recordDamage', {
        messageId,
        key,
        dmgSet: { hp: split.hp, stam: 0, mana: split.mana },
    });
}

const CARD_ACTIONS: Record<
    string,
    (event: MouseEvent, target: HTMLElement) => Promise<void> | void
> = {
    defend: onDefend,
    rollIn: onRollIn,
    addSoakTarget: onAddSoakTarget,
    reroll: onReroll,
    removeDefender: onRemoveDefender,
    applyDamage: onApplyDamage,
    undoDamage: onUndoDamage,
    applyDrain: onApplyDrain,
    toggleDice: (_e, target) => {
        target.closest('.sr-card')?.querySelector('.dice-tray')?.classList.toggle('hidden');
    },
};

/**
 * Wire up a rendered chat message.
 *
 * `renderChatMessage` was renamed to `renderChatMessageHTML` and hands a real element rather
 * than a jQuery object. We listen for both and normalize, so the system works either way.
 * Crucially we bail immediately on any message that isn't one of ours — the old code
 * dereferenced its own flag unconditionally and threw a TypeError on *every* ordinary chat
 * message, filling the console with noise.
 */
function activateCard(_message: ChatMessage.Implementation, element: HTMLElement | any): void {
    const html: HTMLElement = element?.jquery ? element[0] : element;
    const card = html?.querySelector?.<HTMLElement>('.sr-card');
    if (!card) return;

    // During the deprecation window both hook names fire, which would bind the listener
    // twice and double every click.
    if (card.dataset.wired) return;
    card.dataset.wired = 'true';

    card.addEventListener('click', (event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-card-action]');
        if (!target) return;

        const action = CARD_ACTIONS[target.dataset.cardAction!];
        if (!action) return;

        event.preventDefault();
        void action(event as MouseEvent, target);
    });
}

export function registerChatListeners(): void {
    let seen = false;

    const wire = (hookName: string) =>
        Hooks.on(hookName as any, (message: any, html: any) => {
            if (!seen) {
                seen = true;
                console.log(`shimmeringreach | chat cards wired via ${hookName}`);
            }
            activateCard(message, html);
        });

    // v13+ name, and the legacy name, so we work on either.
    wire('renderChatMessageHTML');
    wire('renderChatMessage');
}
