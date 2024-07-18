import { SR5Actor } from '../actor/SR5Actor';
import { SR5Item } from '../item/SR5Item';
import { Translation } from '../utils/strings';
/**
 * Everything around SR5#190 'Active Defenses'
 */
export type ActiveDefenseData = Record<string, { label: Translation; value: number | undefined; initMod: number; weapon?: string; disabled?: boolean }>;

export const ActiveDefenseRules = {
    /**
     * What active defenses are available for the given item? Based on SR5#190 'Active Defenses'
     * @param weapon The equipped weapon used for the attack.
     * @param actor The actor performing the attack.
     *
     * The PhysicalDefenseTest already includes passive dodge value, so active values do not include it in this file
     * Shimmering Reach Transformation - left TODO
     *      Include Parry if weapon is ranged and defender has Ranged Parry ability
     *      Determine if spell is targeting dodge, physical, mental, or some combonation thereof
     *      Handle Full Defense toggle
     *      Include 2x dodge skill if defender is wearing Light Armor
     *      Include Tradition bonus for all Active Defenses
     */
    availableActiveDefenses: (weapon: SR5Item, actor: SR5Actor): ActiveDefenseData => {
        // General purpose active defenses. ()
        const activeDefenses: ActiveDefenseData = {};

        /* Shimmerign Reach - Full Defense Rules
         *   Spend 10 instead of 5 to activate Full Defense. Full Defense enables "free" active defenses of all
         *   defense types until end of round
         *  Implementation - Full Defense does cost -10 init but should treated as a toggle, not a specific defense type
         */

        //     full_defense: {
        //         label: 'SR5.FullDefense',
        //         value: actor.getFullDefenseAttribute()?.value,
        //         initMod: -10,
        //     },
        // };

        // Spells, melee weapons, and ranged weapons can be dodged
        // Active dodge gets 2x dodge skill if defender is wearing Light Armor
        if (weapon.isSpell || weapon.isMeleeWeapon || weapon.isRangedWeapon) {
            activeDefenses['dodge'] = {
                label: 'SR5.Dodge',
                value: actor.findActiveSkill('dodge')?.value ?? 0,
                initMod: -5,
            };
        }

        // Melee weapons and Ranged weapons can be blocked if defender is holding a shield
        // Shield value depends on type of shield being held
        if (weapon.isMeleeWeapon || weapon.isRangedWeapon) {
            // use the highest block of all equipped shields
            let shield: SR5Item | undefined;
            const equippedShields = actor.getEquippedShields().filter((item) => item.isShield);
            equippedShields.forEach((item) => {
                shield = item.getBlock() > (shield?.getBlock() ?? 0) ? item : shield;
            });
            if (shield) {
                activeDefenses['block'] = {
                    label: 'SR5.Block',
                    value: shield?.getBlock() ?? 0,
                    initMod: -5,
                };
            }
        }

        // Melee weapons can be parried if defender is holding a melee weapon
        // Defenders with the Ranged Parry ability can parry ranged weapon attacks
        if (weapon.isMeleeWeapon) {
            // use the highest reach of all equipped melee weapons
            let defenseWeapon: SR5Item | undefined;
            const equippedMeleeWeapons = actor.getEquippedWeapons().filter((item) => item.isMeleeWeapon);
            equippedMeleeWeapons.forEach((item) => {
                defenseWeapon = weapon.getReach() > (defenseWeapon?.getReach() ?? 0) ? item : defenseWeapon;
            });
            activeDefenses['parry'] = {
                label: 'SR5.Parry',
                weapon: defenseWeapon?.name ?? '',
                value: defenseWeapon?.getReach() ?? 0,
                initMod: -5,
            };
        }

        /*
         * Shimmering Reach Active Defenses for Spells
         * Need to implement further logic checking if "weapon" is attacking as physical, mental, or dodge
         */
        if (weapon.isSpell) {
            // passive physical = body + agility
            activeDefenses['physical'] = {
                label: 'SR5.PhysicalResist',
                value: actor.getSkill('perserverence')?.value ?? 0,
                initMod: 0,
            };
            // passive mental = willpower + charisma
            activeDefenses['mental'] = {
                label: 'SR5.MentalResist',
                value: actor.getSkill('perserverence')?.value ?? 0,
                initMod: 0,
            };
        }

        return activeDefenses;
    },
};
