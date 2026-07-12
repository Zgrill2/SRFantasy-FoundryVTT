import { BONUS_TARGETS } from '../config';

const { SchemaField, NumberField } = foundry.data.fields;

/** A non-negative integer stat. */
export const int = (initial = 0, extra: Record<string, unknown> = {}) =>
    new NumberField({ required: true, nullable: false, integer: true, initial, min: 0, ...extra });

/** An integer that may go negative (modifiers, biases). */
export const signedInt = (initial = 0) =>
    new NumberField({ required: true, nullable: false, integer: true, initial });

/** An ability score. */
export const ability = () => new SchemaField({ value: int(1) });

/**
 * A damage track (Health / Stamina / Mana). `max` is derived every prepare cycle, so its
 * stored value is only ever a placeholder.
 */
export const track = (initial = 16) =>
    new SchemaField({
        value: int(initial),
        min: int(0),
        max: int(initial),
    });

/**
 * The bonus accumulator.
 *
 * One plain NumberField per legal target. Feature items sum into these during
 * prepareDerivedData, and — because they are real schema paths — an ActiveEffect with
 * `key: "system.bonuses.defense_dodge", mode: ADD` works with no extra code at all.
 *
 * This indirection is what makes effects survive: Foundry applies them *before*
 * prepareDerivedData runs, so an effect pointed straight at a derived value like
 * `system.defenses.dodge.active` would simply be overwritten when we recompute it.
 * Bonuses go in here; derivation reads them.
 */
export const bonuses = () =>
    new SchemaField(
        Object.fromEntries(BONUS_TARGETS.map((key) => [key, signedInt(0)])) as Record<
            (typeof BONUS_TARGETS)[number],
            ReturnType<typeof signedInt>
        >,
    );
