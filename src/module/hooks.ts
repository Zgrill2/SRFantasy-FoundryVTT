import './types/global';

import { registerActorSheet } from './apps/SRActorSheet';
import { registerItemSheet } from './apps/SRItemSheet';
import { registerChatListeners } from './chat/actions';
import { registerRelay } from './chat/gmRelay';
import { registerCardHandlers } from './chat/handlers';
import { RollDP } from './dice/RollDP';
import { SR } from './config';
import { SYSTEM_NAME } from './constants';
import { Character } from './data/actor/Character';
import {
    Feature,
    Gear,
    KnowledgeSkill,
    Language,
    Spell,
    Weapon,
} from './data/item/Items';
import { SRActor } from './documents/SRActor';
import { SRItem } from './documents/SRItem';

/**
 * Every Hooks registration in the system, so the boot sequence reads top to bottom.
 */
export function registerHooks(): void {
    Hooks.once('init', onInit);
    Hooks.once('ready', onReady);
}

function onInit(): void {
    console.log(`${SYSTEM_NAME} | Initialising Shimmering Reach`);

    // Expose the game tables for macros and the console.
    (CONFIG as any).SR = SR;

    CONFIG.Actor.documentClass = SRActor;
    CONFIG.Item.documentClass = SRItem;

    CONFIG.Actor.dataModels['character'] = Character;

    CONFIG.Item.dataModels['item'] = Gear;
    CONFIG.Item.dataModels['feature'] = Feature;
    CONFIG.Item.dataModels['weapon'] = Weapon;
    CONFIG.Item.dataModels['skill'] = KnowledgeSkill;
    CONFIG.Item.dataModels['spell'] = Spell;
    CONFIG.Item.dataModels['language'] = Language;

    // Item-borne effects are traversed on the actor rather than copied onto it. Without
    // this, an effect on an unequipped item still applies.
    CONFIG.ActiveEffect.legacyTransferral = false;

    // Initiative is a plain sum, not a hit-counting pool: roll your dice and add Reaction.
    CONFIG.Combat.initiative = {
        formula: '(@initiative.dice)d6 + @abilities.rea.value',
        decimals: 0,
    };

    // Registering the subclass is what lets Roll.fromData rehydrate a stored card roll
    // back into a RollDP. It resolves the class by NAME, which is why the bundle must not
    // be minified.
    CONFIG.Dice.rolls.push(RollDP as any);

    registerActorSheet();
    registerItemSheet();

    registerCardHandlers();
    registerChatListeners();
}

function onReady(): void {
    // The socket is only live once the game is ready.
    registerRelay();

    console.log(`${SYSTEM_NAME} | Ready`);
}
