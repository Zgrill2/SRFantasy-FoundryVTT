import {
    BUCKLER_ATTACK_PENALTY,
    BUCKLER_INDEX,
    SKILL_GROUPS,
    SKILL_KEYS,
    type Ability,
    type BonusTarget,
    type SkillKey,
} from '../config';
import {
    defenses,
    drainResistance,
    healthMax,
    knowledgeDicepool,
    manaMax,
    shieldBlockBonus,
    skillDicepool,
    soaks,
    staminaMax,
    weaponDicepool,
    weaponDv,
    woundPenalty,
    type Abilities,
} from '../rules/derive';

export class SRActor extends Actor {
    /**
     * All derivation happens here, in one ordered pass.
     *
     * Foundry's prepare cycle is: prepareBaseData → embedded item prep + ActiveEffects →
     * prepareDerivedData. The old system split derivation across the first and last of
     * those, which is precisely how knowledge-skill dicepools ended up computed twice, the
     * second pass quietly dropping the Tradition bonus. Everything cross-document now lives
     * in this one method, in an order that is explicit and readable.
     *
     * ActiveEffects have already landed in `system.bonuses` by the time we get here, which
     * is exactly why bonuses are routed through that field rather than written straight onto
     * derived values — see data/fields.ts.
     */
    override prepareDerivedData(): void {
        super.prepareDerivedData();
        if (this.type !== 'character') return;

        const sys = this.system as any;

        // 1. Feature items add to whatever the ActiveEffects already contributed.
        this.#applyFeatureBonuses(sys);

        // 2. A purchased skill group sets every member's rank.
        this.#applySkillGroups(sys);

        // 3. The Cast Stat drives both magic skills.
        const castStat = sys.castStat as Ability;
        sys.skills.spellcasting.attr = castStat;
        sys.skills.perceive_magic.attr = castStat;

        // 4. Core stats.
        const abilities = this.#abilities(sys);
        const tradition = sys.tradition.rank.value as number;
        const bonuses = sys.bonuses as Record<BonusTarget, number>;

        sys.health.max = healthMax(abilities);
        sys.stamina.max = staminaMax(abilities);
        sys.mana.max = manaMax(abilities, castStat);
        sys.drainres.value = drainResistance(abilities);

        const soakValues = soaks(abilities, bonuses);
        for (const [key, value] of Object.entries(soakValues)) {
            sys.soaks[key].value = value;
        }

        for (const key of SKILL_KEYS) {
            const skill = sys.skills[key];
            skill.dicepool = skillDicepool(
                skill.value,
                abilities[skill.attr as Ability],
                tradition,
                bonuses[`skill_${key}` as BonusTarget] ?? 0,
            );
        }

        const ranks = Object.fromEntries(
            SKILL_KEYS.map((k) => [k, sys.skills[k].value as number]),
        ) as Record<SkillKey, number>;

        const defenseValues = defenses(abilities, ranks, tradition, bonuses);
        for (const [key, pools] of Object.entries(defenseValues)) {
            sys.defenses[key].passive = pools.passive;
            sys.defenses[key].active = pools.active;
        }

        // Wound penalties depend on the maxima computed above.
        sys.wound_penalty.value = woundPenalty(
            { health: sys.health, stamina: sys.stamina, mana: sys.mana },
            sys.wound_penalty.resilient_wounds,
            sys.wound_penalty.ignore_wounds,
        );

        // 5. Weapons need finished skill pools, so they come last.
        this.#prepareWeapons(sys, abilities, tradition);

        // 6. The equipped weapon reaches back into Block and Parry.
        this.#applyEquippedWeapon(sys);
    }

    #abilities(sys: any): Abilities {
        return Object.fromEntries(
            Object.entries(sys.abilities).map(([k, v]) => [k, (v as any).value]),
        ) as Abilities;
    }

    /** Active Feature items each add their bonus to one named stat. */
    #applyFeatureBonuses(sys: any): void {
        for (const item of this.items) {
            if (item.type !== 'feature') continue;
            const feature = item.system as any;
            if (!feature.active) continue;

            const target = feature.target as BonusTarget;
            if (target in sys.bonuses) {
                sys.bonuses[target] += feature.bonus;
            }
        }
    }

    /** A group bought at rank N sets all its members to N, and locks them. */
    #applySkillGroups(sys: any): void {
        for (const [groupKey, group] of Object.entries(SKILL_GROUPS)) {
            if (!group.isGroup) continue;

            const groupRank = sys.skill_groups[groupKey]?.value ?? 0;
            for (const member of group.members) {
                const skill = sys.skills[member];
                if (!skill) continue;

                if (groupRank > 0) {
                    skill.value = groupRank;
                    skill.isGroupRanked = true;
                } else {
                    skill.isGroupRanked = false;
                }
            }
        }
    }

    #prepareWeapons(sys: any, abilities: Abilities, tradition: number): void {
        for (const item of this.items) {
            if (item.type === 'weapon') {
                const w = item.system as any;
                w.dv = weaponDv(w.power, abilities[w.attr as Ability] ?? null);
                w.dicepool = weaponDicepool(w.reach, sys.skills[w.skill as SkillKey].dicepool);
                continue;
            }

            if (item.type === 'skill') {
                const s = item.system as any;
                const attrValue =
                    s.attr === 'none' ? null : (abilities[s.attr as Ability] ?? null);
                s.dicepool = knowledgeDicepool(s.rank, attrValue, tradition);
            }
        }
    }

    /**
     * A shield you are actually holding improves your Block; a long weapon improves your
     * Parry. A Buckler is small enough to keep your weapon hand free, but it fouls your
     * swing.
     */
    #applyEquippedWeapon(sys: any): void {
        const weapon = this.items.find(
            (i) => i.type === 'weapon' && (i.system as any).active,
        );
        if (!weapon) return;

        const w = weapon.system as any;
        if (w.skill !== 'weapon_skill') return;

        sys.defenses.block.active += shieldBlockBonus(w.shield);
        sys.defenses.parry.active += w.reach;

        if (w.shield === BUCKLER_INDEX) {
            w.dicepool -= BUCKLER_ATTACK_PENALTY;
        }
    }

    /** The equipped weapon, if any. */
    get equippedWeapon(): Item.Implementation | undefined {
        return this.items.find((i) => i.type === 'weapon' && (i.system as any).active);
    }
}
