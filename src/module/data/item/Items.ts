/**
 * Item data models.
 *
 * All six live in one file — they're small, and keeping them together makes the shape of
 * the item layer legible at a glance.
 */

import { ABILITIES, BONUS_TARGETS, HANDEDNESS, SHIELDS, WEAPON_SKILLS, SOAKS } from '../../config';
import { int, signedInt } from '../fields';

const { SchemaField, StringField, BooleanField, HTMLField, NumberField } = foundry.data.fields;

const description = () => new HTMLField({ required: true, initial: '' });

type AnySchema = Record<string, foundry.data.fields.DataField.Any>;

abstract class ItemModel<S extends AnySchema> extends foundry.abstract.TypeDataModel<
    S,
    Item.Implementation
> {}

// ---------------------------------------------------------------------------- Gear

export const GearData = () => ({
    description: description(),
    quantity: int(1),
    weight: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
    active: new BooleanField({ initial: false }),
});

export class Gear extends ItemModel<ReturnType<typeof GearData>> {
    static override defineSchema() {
        return GearData();
    }
}

// ------------------------------------------------------------------------- Feature

/**
 * A Feature is a flat bonus to one named stat.
 *
 * `target` is a validated enum, not a hand-typed dotted path. The old system let you type
 * anything into a text box and then walked the actor object with it — which never actually
 * ran (it checked the wrong property and bailed every time), and would have corrupted
 * actor data by concatenating a number onto an object if it ever had.
 */
export const FeatureData = () => ({
    description: description(),
    target: new StringField({
        required: true,
        initial: BONUS_TARGETS[0],
        choices: BONUS_TARGETS,
    }),
    bonus: signedInt(0),
    active: new BooleanField({ initial: true }),
});

export class Feature extends ItemModel<ReturnType<typeof FeatureData>> {
    static override defineSchema() {
        return FeatureData();
    }
}

// -------------------------------------------------------------------------- Weapon

export const WeaponData = () => ({
    description: description(),

    /** Base damage before the wielding ability is added. */
    power: int(6),
    /** Extends both your attack pool and your Parry — a longer weapon threatens further. */
    reach: int(0),
    /** Index into config HANDEDNESS. */
    handedness: int(0, { max: HANDEDNESS.length - 1 }),
    /** Index into config SHIELDS. Feeds Block; a Buckler costs attack dice. */
    shield: int(0, { max: SHIELDS.length - 1 }),

    /** The ability added to Power to get Damage Value. */
    attr: new StringField({ required: true, initial: 'str', choices: ABILITIES }),
    /** Whether this weapon swings or is cast. */
    skill: new StringField({ required: true, initial: 'weapon_skill', choices: WEAPON_SKILLS }),
    /** Which of the target's soaks resists this weapon's damage. */
    soak: new StringField({ required: true, initial: 'armor', choices: SOAKS }),

    /** Equipped. Only one weapon is equipped at a time. */
    active: new BooleanField({ initial: false }),

    /** Optional sound played when this weapon connects. */
    sound: new StringField({ required: false, initial: '' }),

    // Derived.
    dv: signedInt(0),
    dicepool: signedInt(0),
});

export class Weapon extends ItemModel<ReturnType<typeof WeaponData>> {
    static override defineSchema() {
        return WeaponData();
    }
}

// ----------------------------------------------------------------- Knowledge skill

/** A knowledge skill, bought as an item rather than drawn from the fixed skill list. */
export const KnowledgeSkillData = () => ({
    description: description(),
    rank: int(0),
    /** 'none' for a skill no attribute meaningfully supports. */
    attr: new StringField({
        required: true,
        initial: 'none',
        choices: ['none', ...ABILITIES],
    }),
    // Derived.
    dicepool: signedInt(0),
});

export class KnowledgeSkill extends ItemModel<ReturnType<typeof KnowledgeSkillData>> {
    static override defineSchema() {
        return KnowledgeSkillData();
    }
}

// --------------------------------------------------------------------------- Spell

export const SpellData = () => ({
    description: description(),
    spellLevel: int(1),
});

export class Spell extends ItemModel<ReturnType<typeof SpellData>> {
    static override defineSchema() {
        return SpellData();
    }
}

// ------------------------------------------------------------------------ Language

/** A language the character speaks. Read by the Polyglot module integration. */
export const LanguageData = () => ({
    description: description(),
});

export class Language extends ItemModel<ReturnType<typeof LanguageData>> {
    static override defineSchema() {
        return LanguageData();
    }
}
