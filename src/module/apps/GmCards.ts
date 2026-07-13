import { postCard } from '../chat/render';
import type { CardState } from '../chat/state';
import { SKILLS, SKILL_KEYS, SOAKS, SOAK_LABELS, type SkillKey, type Soak } from '../config';
import { SYSTEM_NAME } from '../constants';

const { DialogV2 } = foundry.applications.api;

/**
 * The two cards the GM throws at the whole table: "everyone roll Perception", and
 * "rocks fall, soak 20".
 *
 * Both were macro-only in the old system — you had to know the function name to call. They
 * are scene-control tools now, so they are simply there.
 */

type Visibility = 'visible' | 'obscured' | 'secret';

const num = (form: HTMLFormElement, name: string): number =>
    Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value) || 0;

const bool = (form: HTMLFormElement, name: string): boolean =>
    Boolean((form.elements.namedItem(name) as HTMLInputElement | null)?.checked);

const str = (form: HTMLFormElement, name: string): string =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';

/**
 * Visible: everyone sees the numbers.
 * Obscured: the card is public, the numbers are not — players see `?`, the GM sees the truth.
 * Secret: the players never see the card at all.
 */
const VISIBILITY_FIELD = `
  <fieldset class="sr-visibility">
    <legend>Visibility</legend>
    <label><input type="radio" name="visibility" value="visible" checked /> Visible</label>
    <label><input type="radio" name="visibility" value="obscured" /> Obscured — players see "?"</label>
    <label><input type="radio" name="visibility" value="secret" /> Secret — GM only</label>
  </fieldset>`;

function visibilityOf(form: HTMLFormElement): Visibility {
    const checked = form.querySelector<HTMLInputElement>('input[name="visibility"]:checked');
    return (checked?.value as Visibility) ?? 'visible';
}

/** The GM speaks for the world, not for any one actor. */
function gmSpeaker() {
    return ChatMessage.getSpeaker({ alias: 'Shimmering Reach' } as any);
}

// ------------------------------------------------------------------------ group check

interface GroupCheckResult {
    skill: SkillKey;
    modifier: number;
    explode: boolean;
    applyWounds: boolean;
    visibility: Visibility;
}

/**
 * Post a skill check for the table.
 *
 * Nobody is pre-selected: the card names a skill, and each player answers it by selecting
 * their token and clicking. The modifiers set here apply to everyone who answers, so the
 * whole party is genuinely rolling the same test.
 */
export async function postGroupCheck(): Promise<void> {
    const options = SKILL_KEYS.map(
        (key) => `<option value="${key}">${SKILLS[key].label}</option>`,
    ).join('');

    const result = (await DialogV2.prompt({
        window: { title: 'Group skill check' },
        content: `
        <div class="sr-roll-dialog">
          <label>
            Skill
            <select name="skill" autofocus>${options}</select>
          </label>
          <label>
            Dice pool modifier
            <input type="number" name="modifier" value="0" />
          </label>
          <label class="checkbox">
            <input type="checkbox" name="applyWounds" checked />
            Apply wound penalty
          </label>
          <label class="checkbox">
            <input type="checkbox" name="explode" />
            Exploding 6s
          </label>
          ${VISIBILITY_FIELD}
        </div>`,
        ok: {
            label: 'Post',
            callback: (_event: unknown, button: any) => {
                const form = button.form as HTMLFormElement;
                return {
                    skill: str(form, 'skill') as SkillKey,
                    modifier: num(form, 'modifier'),
                    explode: bool(form, 'explode'),
                    applyWounds: bool(form, 'applyWounds'),
                    visibility: visibilityOf(form),
                } satisfies GroupCheckResult;
            },
        },
        rejectClose: false,
    } as any)) as GroupCheckResult | null;

    if (!result) return;

    const state: CardState = {
        kind: 'multi-skill',
        obscured: result.visibility === 'obscured',
        attacker: {
            actor: { actorId: '', tokenId: null, name: 'Group check', img: '' },
            blind: false,
            label: SKILLS[result.skill].label,
            skill: result.skill,
            modifier: result.modifier,
            explode: result.explode,
            applyWounds: result.applyWounds,
            // The card itself makes no roll. It is a question, not an answer.
            roll: {},
        },
        defenders: {},
    };

    await postCard(state, {
        whisperGMs: result.visibility === 'secret',
        speaker: gmSpeaker(),
    });
}

// ------------------------------------------------------------------------- damage card

interface DamageCardResult {
    dv: number;
    label: string;
    soak: Soak;
    visibility: Visibility;
}

/**
 * Flat damage, with no attack to dodge: rocks fall.
 *
 * Each player clicks once to see what it costs them after soak, and again to take it. Two
 * steps on purpose — nobody should lose health to a stray click.
 */
export async function postDamageCard(): Promise<void> {
    const soakOptions = SOAKS.map(
        (key) =>
            `<label><input type="radio" name="soak" value="${key}" ${
                key === 'armor' ? 'checked' : ''
            } /> ${SOAK_LABELS[key]}</label>`,
    ).join('');

    const result = (await DialogV2.prompt({
        window: { title: 'Damage card' },
        content: `
        <div class="sr-roll-dialog">
          <label>
            Damage Value
            <input type="number" name="dv" value="0" min="0" autofocus />
          </label>
          <label>
            Label
            <input type="text" name="label" placeholder="Rocks fall" />
          </label>
          <fieldset>
            <legend>Resisted by</legend>
            ${soakOptions}
          </fieldset>
          ${VISIBILITY_FIELD}
        </div>`,
        ok: {
            label: 'Post',
            callback: (_event: unknown, button: any) => {
                const form = button.form as HTMLFormElement;
                const soak =
                    form.querySelector<HTMLInputElement>('input[name="soak"]:checked')?.value ??
                    'armor';

                return {
                    dv: num(form, 'dv'),
                    label: str(form, 'label') || 'Damage',
                    soak: soak as Soak,
                    visibility: visibilityOf(form),
                } satisfies DamageCardResult;
            },
        },
        rejectClose: false,
    } as any)) as DamageCardResult | null;

    if (!result) return;

    const state: CardState = {
        kind: 'dv',
        obscured: result.visibility === 'obscured',
        attacker: {
            actor: { actorId: '', tokenId: null, name: result.label, img: '' },
            blind: false,
            label: result.label,
            dv: result.dv,
            dvSoak: result.soak,
            roll: {},
        },
        defenders: {},
    };

    await postCard(state, {
        whisperGMs: result.visibility === 'secret',
        speaker: gmSpeaker(),
    });
}

/**
 * Put both on the scene controls, so the GM can reach them without remembering a macro name.
 */
export function registerSceneControls(): void {
    Hooks.on('getSceneControlButtons', (controls: any) => {
        if (!game.user?.isGM) return;

        controls[SYSTEM_NAME] = {
            name: SYSTEM_NAME,
            title: 'Shimmering Reach',
            icon: 'fas fa-dice-d6',
            // A button group, not a canvas layer: these post to chat, they don't draw.
            layer: undefined,
            tools: {
                groupCheck: {
                    name: 'groupCheck',
                    title: 'Group skill check',
                    icon: 'fas fa-users',
                    button: true,
                    onChange: () => void postGroupCheck(),
                },
                damageCard: {
                    name: 'damageCard',
                    title: 'Damage card (rocks fall)',
                    icon: 'fas fa-mountain',
                    button: true,
                    onChange: () => void postDamageCard(),
                },
            },
        };
    });
}
