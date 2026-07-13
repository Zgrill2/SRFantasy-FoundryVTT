import {
    BUCKLER_ATTACK_PENALTY,
    BUCKLER_INDEX,
    type Ability,
    type SkillKey,
} from '../config';
import { knowledgeDicepool, weaponDicepool, weaponDv } from '../rules/derive';

/**
 * Item-derived values are computed here, lazily, and are never stored.
 *
 * They used to live in the item's schema as real fields, written during the *actor's*
 * derived pass. But Foundry resets a document's `system` from its source at the start of
 * every prepare cycle, and an item can be re-prepared on its own — without the parent
 * actor's pass running. When that happened the computed pool was wiped back to its stored
 * zero and stayed there. Editing a weapon on its own sheet was one such path.
 *
 * Getters dodge the whole problem: they read the actor's finished data at the moment they
 * are asked, so they cannot go stale and cannot be persisted by accident.
 */
export class SRItem extends Item {
    /** The wielder, if this item is owned by one. */
    get owner(): Actor.Implementation | null {
        return this.actor ?? null;
    }

    /** Damage Value: the weapon's own Power, plus the ability that drives it. */
    get damageValue(): number {
        if (this.type !== 'weapon') return 0;

        const w = this.system as any;
        const abilities = (this.actor?.system as any)?.abilities;
        const value = abilities?.[w.attr as Ability]?.value ?? null;

        return weaponDv(w.power, value);
    }

    /**
     * Attack pool: reach plus the pool of whichever skill the weapon is swung (or cast) with.
     *
     * A Buckler is small enough to keep your weapon hand free, but it fouls your swing — and
     * only while you are actually holding it.
     */
    get attackPool(): number {
        if (this.type !== 'weapon') return 0;

        const w = this.system as any;
        const skills = (this.actor?.system as any)?.skills;
        if (!skills) return 0;

        const skillPool = skills[w.skill as SkillKey]?.dicepool ?? 0;
        let pool = weaponDicepool(w.reach, skillPool);

        if (w.active && w.shield === BUCKLER_INDEX && w.skill === 'weapon_skill') {
            pool -= BUCKLER_ATTACK_PENALTY;
        }

        return pool;
    }

    /** A knowledge skill's pool. Unlike the old system, it keeps its Tradition bonus. */
    get knowledgePool(): number {
        if (this.type !== 'skill') return 0;

        const s = this.system as any;
        const actorSys = this.actor?.system as any;
        if (!actorSys) return s.rank;

        const value =
            s.attr === 'none' ? null : (actorSys.abilities?.[s.attr as Ability]?.value ?? null);

        return knowledgeDicepool(s.rank, value, actorSys.tradition.rank.value);
    }

    /** Whatever pool this item rolls, if it rolls one. */
    get dicepool(): number {
        if (this.type === 'weapon') return this.attackPool;
        if (this.type === 'skill') return this.knowledgePool;
        return 0;
    }

    get isEquipped(): boolean {
        return Boolean((this.system as any).active);
    }
}
