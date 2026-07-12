import {
    ABILITIES,
    ABILITY_LABELS,
    BONUS_TARGETS,
    HANDEDNESS,
    SHIELDS,
    SOAKS,
    SOAK_LABELS,
    WEAPON_SKILLS,
    bonusTargetLabel,
    type Ability,
    type Soak,
} from '../config';
import { SYSTEM_NAME, TEMPLATE_PATH } from '../constants';

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

/** See SRActorSheet: loosen the context generics so the mixin chain stays comparable. */
declare abstract class AnyItemSheetV2 extends ItemSheetV2<any, any, any> {
    constructor(...args: any[]);
}

const ItemSheetBase = HandlebarsApplicationMixin(ItemSheetV2 as unknown as typeof AnyItemSheetV2);

export class SRItemSheet extends ItemSheetBase {
    static override DEFAULT_OPTIONS = {
        classes: ['shimmeringreach', 'sheet', 'item'],
        position: { width: 520, height: 480 },
        window: { resizable: true },
        form: { submitOnChange: true, closeOnSubmit: false },
    };

    static override PARTS = {
        header: { template: `${TEMPLATE_PATH}/item/header.hbs` },
        // Resolved per item type in _configureRenderParts.
        body: { template: `${TEMPLATE_PATH}/item/item.hbs` },
        description: { template: `${TEMPLATE_PATH}/item/description.hbs` },
    };

    /** Each item type gets its own body template; everything else is shared. */
    override _configureRenderParts(options: any) {
        const parts = super._configureRenderParts(options);
        parts.body = { template: `${TEMPLATE_PATH}/item/${this.item.type}.hbs` };
        return parts;
    }

    override async _prepareContext(options: any) {
        const context = (await super._prepareContext(options)) as any;
        const item = this.item;

        context.item = item;
        context.system = item.system;
        context.source = item.toObject();
        context.systemFields = (item.system as any).schema.fields;
        context.isEditable = this.isEditable;

        context.abilities = ABILITIES.map((key) => ({ key, label: ABILITY_LABELS[key] }));
        context.soaks = SOAKS.map((key: Soak) => ({ key, label: SOAK_LABELS[key] }));

        context.weaponSkills = WEAPON_SKILLS.map((key) => ({
            key,
            label: key === 'spellcasting' ? 'Spellcasting' : 'Weapon Skill',
        }));

        context.shields = SHIELDS.map((label, index) => ({ index, label }));
        context.handedness = HANDEDNESS.map((label, index) => ({ index, label }));

        /**
         * Feature targets are a closed list, not a free-text path. The old sheet let you
         * type a dotted path into a text box, which was never validated and never applied.
         */
        context.bonusTargets = BONUS_TARGETS.map((key) => ({
            key,
            label: bonusTargetLabel(key),
        }));

        context.enrichedDescription = await TextEditor.implementation.enrichHTML(
            (item.system as any).description ?? '',
            { secrets: item.isOwner, relativeTo: item },
        );

        return context;
    }
}

export function registerItemSheet(): void {
    foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);
    foundry.documents.collections.Items.registerSheet(SYSTEM_NAME, SRItemSheet as any, {
        label: 'SR.System',
        makeDefault: true,
    });
}
