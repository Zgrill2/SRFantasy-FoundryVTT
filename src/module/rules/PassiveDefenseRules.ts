import { SR5Actor } from '../actor/SR5Actor';
import { SR5Item } from '../item/SR5Item';
import { Translation } from '../utils/strings';

/**
 * Everything around SR5#190 'Active Defenses'
 */
export type PassiveDefenseData = Record<string, { label: Translation; value: number | undefined; initMod: number; weapon?: string; disabled?: boolean }>;

export const PassiveDefenseRules = {
    /**
     * What active defenses are available for the given item? Based on SR5#190 'Active Defenses'
     * @param weapon The equipped weapon used for the attack.
     * @param actor The actor performing the attack.
     */
    availablePassiveDefenses: (weapon: SR5Item, actor: SR5Actor): PassiveDefenseData => {
        // General purpose active defenses. ()
        const passiveDefenses: PassiveDefenseData = {};

        // Shimmering Reach Note - for now, display all 3 passive options to user
        // later we will filter these down based on the attack
        //if (!weapon.isMeleeWeapon) return passiveDefenses;

        // Melee weapon specific passive defenses.

        // passive dodge = reaction + intuition
        passiveDefenses['dodge'] = {
            label: 'SR5.Dodge',
            value: actor.getAttribute('reaction').value + actor.getAttribute('intuition').value,
            initMod: 0,
        };
        // passive physical = body + agility
        passiveDefenses['physical'] = {
            label: 'SR5.PhysicalResist',
            value: actor.getAttribute('body').value + actor.getAttribute('agility').value,
            initMod: 0,
        };
        // passive mental = willpower + charisma
        passiveDefenses['mental'] = {
            label: 'SR5.MentalResist',
            value: actor.getAttribute('willpower').value + actor.getAttribute('charisma').value,
            initMod: 0,
        };

        return passiveDefenses;
    },
};
