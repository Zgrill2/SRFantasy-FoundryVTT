/**
 * Declaration merging for fvtt-types.
 *
 * fvtt-types has no way to know which document subtypes and data models a system registers,
 * so without this every `item.type === 'weapon'` narrows to `never` and every
 * `CONFIG.Item.dataModels[...]` assignment is rejected. Declaring them here teaches the
 * compiler our schemas, which is what makes `item.system` correctly typed per subtype.
 */

import type { Character } from '../data/actor/Character';
import type {
    Feature,
    Gear,
    KnowledgeSkill,
    Language,
    Spell,
    Weapon,
} from '../data/item/Items';
import type { SRActor } from '../documents/SRActor';
import type { SRItem } from '../documents/SRItem';

declare global {
    interface DataModelConfig {
        Actor: {
            character: typeof Character;
        };
        Item: {
            item: typeof Gear;
            feature: typeof Feature;
            weapon: typeof Weapon;
            skill: typeof KnowledgeSkill;
            spell: typeof Spell;
            language: typeof Language;
        };
    }

    interface DocumentClassConfig {
        Actor: typeof SRActor;
        Item: typeof SRItem;
    }
}

export {};
