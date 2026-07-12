import {
    ABILITIES,
    CAST_STATS,
    DEFENSES,
    DEFENSE_DEFS,
    SKILLS,
    SKILL_GROUPS,
    SKILL_KEYS,
    SOAKS,
    type SkillKey,
} from '../../config';
import { ability, bonuses, int, signedInt, track } from '../fields';

const { SchemaField, NumberField, StringField, BooleanField, HTMLField } = foundry.data.fields;

const abilities = () =>
    new SchemaField(Object.fromEntries(ABILITIES.map((a) => [a, ability()])));

/**
 * Skills. `value` is the purchased rank; `dicepool` and `isGroupRanked` are derived every
 * prepare cycle.
 *
 * `attr` is stored rather than looked up from config because Spellcasting's attribute is the
 * character's Cast Stat — a per-character choice, not a fixed property of the skill.
 */
const skills = () =>
    new SchemaField(
        Object.fromEntries(
            SKILL_KEYS.map((key) => [
                key,
                new SchemaField({
                    value: int(0),
                    attr: new StringField({
                        required: true,
                        initial: SKILLS[key].attr,
                        choices: ABILITIES,
                    }),
                    isGroupRanked: new BooleanField({ initial: false }),
                    dicepool: signedInt(0),
                }),
            ]),
        ),
    );

/**
 * Skill groups. Buying a group at rank N sets every member to N — you buy the group *or*
 * its members, never both. `ungrouped` is a display bucket with no purchasable rank.
 */
const skillGroups = () =>
    new SchemaField(
        Object.fromEntries(
            Object.keys(SKILL_GROUPS).map((key) => [key, new SchemaField({ value: int(0) })]),
        ),
    );

const soaks = () =>
    new SchemaField(Object.fromEntries(SOAKS.map((s) => [s, new SchemaField({ value: int(0) })])));

const defenses = () =>
    new SchemaField(
        Object.fromEntries(
            DEFENSES.map((d) => [
                d,
                new SchemaField({
                    passive: int(0),
                    active: int(0),
                }),
            ]),
        ),
    );

export const CharacterData = () => ({
    biography: new HTMLField({ required: true, initial: '' }),

    // Damage tracks. Their maxima are derived; the stored numbers are placeholders.
    health: track(),
    stamina: track(),
    mana: track(),

    abilities: abilities(),

    /**
     * Tradition: a caster's depth of practice. It sharpens every skill they already have
     * (see rules/derive.ts traditionBonus), which is why it sits on the actor rather than
     * on the magic skills.
     */
    tradition: new SchemaField({ rank: new SchemaField({ value: int(1) }) }),

    /** The ability a caster channels through. Drives Mana max and Spellcasting. */
    castStat: new StringField({ required: true, initial: 'log', choices: CAST_STATS }),

    luck: new SchemaField({
        current: new SchemaField({ value: int(1) }),
        max: new SchemaField({ value: int(1) }),
    }),

    /** Dice rolled to resist Drain. Derived from Willpower. */
    drainres: new SchemaField({ value: int(0) }),

    skills: skills(),
    skill_groups: skillGroups(),

    // Derived, but stored so tokens, macros, and effects can read them.
    soaks: soaks(),
    defenses: defenses(),

    initiative: new SchemaField({
        /** How many d6 you roll for initiative. */
        dice: int(1),
        /** A flat adjustment to turn order, applied after the roll. */
        bias: signedInt(0),
    }),

    wound_penalty: new SchemaField({
        /** Derived: dice subtracted from every roll. */
        value: int(0),
        /** Wound levels shrugged off entirely. */
        ignore_wounds: int(0),
        /** Widens each wound tier, so you bleed more before it costs you. */
        resilient_wounds: int(0),
    }),

    /** Feature items and ActiveEffects accumulate here; derivation reads it. */
    bonuses: bonuses(),

    /** Unlocks editing of raw stats on the sheet. Off during play. */
    edit_stats: new SchemaField({ enable: new BooleanField({ initial: false }) }),
});

export type CharacterSchema = ReturnType<typeof CharacterData>;

export class Character extends foundry.abstract.TypeDataModel<
    CharacterSchema,
    Actor.Implementation
> {
    static override defineSchema(): CharacterSchema {
        return CharacterData();
    }
}

/** The defence a given skill drives — used when a defence roll needs its skill. */
export function defenseSkill(defense: keyof typeof DEFENSE_DEFS): SkillKey {
    return DEFENSE_DEFS[defense].skill;
}

/** Foundry's dice-formula data, so `@abilities.rea.value` resolves in the initiative roll. */
export type CharacterSystem = Character;
