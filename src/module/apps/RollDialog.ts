import { DEFAULT_MODIFIERS, type RollModifiers } from '../chat/rolls';

const { DialogV2 } = foundry.applications.api;

/**
 * The Shift-click dialog: everything you might want to change about a roll before you make
 * it. Plain click skips this entirely, because most rolls need none of it.
 *
 * Returns null if the roll is cancelled.
 */
export interface RollPromptOptions {
    /** Attacks let you push the damage. */
    showDv?: boolean;
    /**
     * Spellcasting weapons let you reach past what you can safely hold. Overload buys you
     * power now and hands you Drain to pay for it afterwards.
     */
    showOverload?: boolean;
}

export interface RollPromptResult extends RollModifiers {
    dvModifier: number;
    overload: number;
    overloadSoak: number;
}

const num = (form: HTMLFormElement, name: string): number =>
    Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value) || 0;

const bool = (form: HTMLFormElement, name: string): boolean =>
    Boolean((form.elements.namedItem(name) as HTMLInputElement | null)?.checked);

export async function promptRoll(
    title: string,
    options: RollPromptOptions = {},
): Promise<RollPromptResult | null> {
    const content = `
    <div class="sr-roll-dialog">
      <label>
        Dice pool modifier
        <input type="number" name="modifier" value="0" autofocus />
      </label>
      ${
          options.showDv
              ? `<label>
        Damage modifier
        <input type="number" name="dvModifier" value="0" />
      </label>`
              : ''
      }
      ${
          options.showOverload
              ? `<hr />
      <label>
        Overload
        <input type="number" name="overload" value="0" min="0"
               title="Power now, Drain afterwards" />
      </label>
      <label>
        Overload soak bonus
        <input type="number" name="overloadSoak" value="0" />
      </label>`
              : ''
      }
      <label class="checkbox">
        <input type="checkbox" name="applyWounds" checked />
        Apply wound penalty
      </label>
      <label class="checkbox">
        <input type="checkbox" name="explode" />
        Exploding 6s
      </label>
      <label class="checkbox">
        <input type="checkbox" name="blind" />
        Hide from players
      </label>
    </div>`;

    const result = await DialogV2.prompt({
        window: { title },
        content,
        ok: {
            label: 'Roll',
            callback: (_event: unknown, button: any) => {
                const form = button.form as HTMLFormElement;
                return {
                    modifier: num(form, 'modifier'),
                    dvModifier: num(form, 'dvModifier'),
                    overload: num(form, 'overload'),
                    overloadSoak: num(form, 'overloadSoak'),
                    applyWounds: bool(form, 'applyWounds'),
                    explode: bool(form, 'explode'),
                    blind: bool(form, 'blind'),
                } satisfies RollPromptResult;
            },
        },
        rejectClose: false,
    } as any);

    return (result as RollPromptResult | null) ?? null;
}

export { DEFAULT_MODIFIERS };
