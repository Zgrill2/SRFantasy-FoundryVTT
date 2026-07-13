import { SYSTEM_SOCKET } from '../constants';

/**
 * The GM relay.
 *
 * Players own their own actors, so they apply their own damage directly. But the *shared*
 * parts of a card — rolling a defence onto someone else's message, spending initiative,
 * granting an effect, recording that damage landed — need permissions a player does not
 * have. Those go over a socket and a GM performs them.
 *
 * The old system broadcast these undirected, and *every* connected GM ran the handler — so
 * with two GMs logged in, initiative was charged twice and damage applied twice. Here the
 * sender elects exactly one GM and addresses the message to them; every other listener drops
 * it on the floor.
 */

export interface RelayMessage {
    /** The GM elected to run this. Everyone else ignores it. */
    gmId: string;
    action: string;
    payload: unknown;
}

type Handler = (payload: any, senderId: string) => Promise<void> | void;

const handlers = new Map<string, Handler>();

export function onGmAction(action: string, handler: Handler): void {
    handlers.set(action, handler);
}

/** The GM who will act. Lowest id among active GMs, so every client elects the same one. */
function electGm(): User.Implementation | undefined {
    return game.users!
        .filter((u) => u.isGM && u.active)
        .sort((a, b) => a.id!.localeCompare(b.id!))[0];
}

/**
 * Run a privileged action: do it here if we're the elected GM, otherwise ask them to.
 *
 * Returns false if no GM is connected — nothing can be adjudicated without one, and saying
 * so is better than failing silently.
 */
export async function requestGmAction(action: string, payload: unknown): Promise<boolean> {
    const gm = electGm();
    if (!gm) {
        ui.notifications?.warn('No GM is connected, so this cannot be resolved.');
        return false;
    }

    if (gm.id === game.user!.id) {
        await handlers.get(action)?.(payload, game.user!.id);
        return true;
    }

    game.socket!.emit(SYSTEM_SOCKET, {
        gmId: gm.id!,
        action,
        payload,
    } satisfies RelayMessage);

    return true;
}

export function registerRelay(): void {
    game.socket!.on(SYSTEM_SOCKET, async (message: RelayMessage, senderId: string) => {
        // Only the elected GM acts. This is what stops two GMs double-applying everything.
        if (message.gmId !== game.user!.id) return;

        const handler = handlers.get(message.action);
        if (!handler) {
            console.warn(`shimmeringreach | no handler for relayed action "${message.action}"`);
            return;
        }

        await handler(message.payload, senderId);
    });
}
