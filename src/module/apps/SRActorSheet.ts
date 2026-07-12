import {
    ABILITIES,
    BONUS_TARGETS,
    ABILITY_LABELS,
    CAST_STATS,
    DEFENSES,
    DEFENSE_DEFS,
    SKILLS,
    SKILL_GROUPS,
    SOAKS,
    SOAK_LABELS,
    TRACKS,
    bonusTargetLabel,
    type Ability,
    type Defense,
    type SkillGroupKey,
    type SkillKey,
    type Soak,
} from '../config';
import { SYSTEM_NAME, TEMPLATE_PATH } from '../constants';

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

const part = (name: string) => ({ template: `${TEMPLATE_PATH}/actor/${name}.hbs` });

/**
 * fvtt-types models ApplicationV2's render context as a deep generic chain, and mixing
 * Handlebars into ActorSheetV2 and then subclassing it blows the compiler's comparison
 * depth. Loosening the context generics here collapses that; the sheet's own context is
 * shaped in _prepareContext regardless.
 */
declare abstract class AnyActorSheetV2 extends ActorSheetV2<any, any, any> {
    constructor(...args: any[]);
}

const ActorSheetBase = HandlebarsApplicationMixin(
    ActorSheetV2 as unknown as typeof AnyActorSheetV2,
);

export class SRActorSheet extends ActorSheetBase {
    static override DEFAULT_OPTIONS = {
        classes: ['shimmeringreach', 'sheet', 'actor'],
        position: { width: 720, height: 780 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false },
        actions: {
            createItem: SRActorSheet.#createItem,
            editItem: SRActorSheet.#editItem,
            deleteItem: SRActorSheet.#deleteItem,
            equipWeapon: SRActorSheet.#equipWeapon,
            toggleFeature: SRActorSheet.#toggleFeature,
        },
    };

    static override PARTS = {
        header: part('header'),
        tabs: { template: 'templates/generic/tab-navigation.hbs' },
        stats: { ...part('tabs/stats'), scrollable: [''] },
        description: part('tabs/description'),
        features: { ...part('tabs/features'), scrollable: [''] },
        effects: { ...part('tabs/effects'), scrollable: [''] },
    };

    static override TABS = {
        primary: {
            initial: 'stats',
            tabs: [
                { id: 'stats', label: 'SR.Tab.Stats' },
                { id: 'description', label: 'SR.Tab.Description' },
                { id: 'features', label: 'SR.Tab.Features' },
                { id: 'effects', label: 'SR.Tab.Effects' },
            ],
        },
    };

    override async _prepareContext(options: any) {
        const context = (await super._prepareContext(options)) as any;
        const actor = this.actor;
        const sys = actor.system as any;

        context.actor = actor;
        context.system = sys;
        context.source = actor.toObject();
        context.systemFields = (actor.system as any).schema.fields;
        context.isEditable = this.isEditable;

        /**
         * `edit_stats` is the play/build switch. With it off, the sheet shows only what the
         * dice care about — pools, soaks, defences — and hides the raw numbers behind them,
         * so nobody nudges a Body score mid-session.
         */
        context.editMode = this.isEditable && sys.edit_stats.enable;

        context.tracks = TRACKS.map((key) => ({
            key,
            label: key[0]!.toUpperCase() + key.slice(1),
            value: sys[key].value,
            max: sys[key].max,
        }));

        context.abilities = ABILITIES.map((key) => ({
            key,
            label: ABILITY_LABELS[key],
            value: sys.abilities[key].value,
        }));

        context.castStats = CAST_STATS.map((key) => ({
            key,
            label: ABILITY_LABELS[key as Ability],
        }));

        context.soaks = SOAKS.map((key: Soak) => ({
            key,
            label: SOAK_LABELS[key],
            value: sys.soaks[key].value,
        }));

        context.defenses = DEFENSES.map((key: Defense) => ({
            key,
            label: DEFENSE_DEFS[key].label,
            allowPassive: DEFENSE_DEFS[key].allowPassive,
            passive: sys.defenses[key].passive,
            active: sys.defenses[key].active,
        }));

        context.skillGroups = Object.entries(SKILL_GROUPS).map(([groupKey, group]) => ({
            key: groupKey,
            label: group.label,
            isGroup: group.isGroup,
            rank: sys.skill_groups[groupKey as SkillGroupKey]?.value ?? 0,
            members: group.members.map((skillKey: SkillKey) => ({
                key: skillKey,
                label: SKILLS[skillKey].label,
                hideDicepool: 'hideDicepool' in SKILLS[skillKey],
                rank: sys.skills[skillKey].value,
                dicepool: sys.skills[skillKey].dicepool,
                isGroupRanked: sys.skills[skillKey].isGroupRanked,
            })),
        }));

        // Items, bucketed by type. Spells are a flat list — the old sheet indexed them into
        // a one-element array by spellLevel, so owning any spell threw and the whole sheet
        // failed to render.
        context.weapons = actor.itemTypes.weapon;
        context.features = actor.itemTypes.feature;
        context.knowledgeSkills = actor.itemTypes.skill;
        context.languages = actor.itemTypes.language;
        context.spells = actor.itemTypes.spell;
        context.gear = actor.itemTypes.item;

        context.effects = Array.from(actor.allApplicableEffects());

        // So the Features tab can name what each feature actually buffs.
        context.bonusLabels = Object.fromEntries(
            BONUS_TARGETS.map((key) => [key, bonusTargetLabel(key)]),
        );

        context.enrichedBiography = await TextEditor.implementation.enrichHTML(sys.biography, {
            secrets: actor.isOwner,
            relativeTo: actor,
        });

        return context;
    }

    /** Hand each tab part its own tab descriptor, so it knows whether it is the active one. */
    override async _preparePartContext(partId: string, context: any, options: any) {
        const ctx = (await super._preparePartContext(partId, context, options)) as any;
        if (ctx.tabs && partId in ctx.tabs) ctx.tab = ctx.tabs[partId];
        return ctx;
    }

    // --------------------------------------------------------------------------- actions

    static async #createItem(this: SRActorSheet, _event: PointerEvent, target: HTMLElement) {
        const type = target.dataset.type!;
        await this.actor.createEmbeddedDocuments('Item', [
            { name: `New ${type}`, type } as any,
        ]);
    }

    static #editItem(this: SRActorSheet, _event: PointerEvent, target: HTMLElement) {
        this.#item(target)?.sheet?.render(true);
    }

    static async #deleteItem(this: SRActorSheet, _event: PointerEvent, target: HTMLElement) {
        await this.#item(target)?.delete();
    }

    /**
     * You can only bring one weapon to bear at a time — equipping this one puts the others
     * away, in a single update so the sheet doesn't flicker through an invalid state.
     */
    static async #equipWeapon(this: SRActorSheet, _event: PointerEvent, target: HTMLElement) {
        const weapon = this.#item(target);
        if (!weapon) return;

        const equipping = !(weapon.system as any).active;

        const updates = this.actor.itemTypes.weapon
            .filter((w) => w.id === weapon.id || (w.system as any).active)
            .map((w) => ({
                _id: w.id,
                'system.active': w.id === weapon.id ? equipping : false,
            }));

        await this.actor.updateEmbeddedDocuments('Item', updates as any);
    }

    static async #toggleFeature(this: SRActorSheet, _event: PointerEvent, target: HTMLElement) {
        const feature = this.#item(target);
        if (!feature) return;

        await feature.update({ 'system.active': !(feature.system as any).active } as any);
    }

    #item(target: HTMLElement): Item.Implementation | undefined {
        const id = target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
        return id ? (this.actor.items.get(id) as Item.Implementation | undefined) : undefined;
    }
}

export function registerActorSheet(): void {
    foundry.documents.collections.Actors.unregisterSheet(
        'core',
        foundry.appv1.sheets.ActorSheet,
    );
    foundry.documents.collections.Actors.registerSheet(SYSTEM_NAME, SRActorSheet as any, {
        label: 'SR.System',
        makeDefault: true,
        types: ['character'],
    });
}
