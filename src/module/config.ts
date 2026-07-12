/**
 * Static game tables for Shimmering Reach.
 *
 * This is the single source of truth for the game's nouns. Schemas, sheets, and the
 * bonus system all derive their key sets from here, so adding a skill is a one-line
 * change rather than a hunt through template files.
 */

/** The eight ability scores. */
export const ABILITIES = ['bod', 'agi', 'rea', 'str', 'wil', 'int', 'log', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_LABELS: Record<Ability, string> = {
    bod: 'Body',
    agi: 'Agility',
    rea: 'Reaction',
    str: 'Strength',
    wil: 'Willpower',
    int: 'Intuition',
    log: 'Logic',
    cha: 'Charisma',
};

/** The abilities a caster may choose as their Cast Stat. Drives mana max and Spellcasting. */
export const CAST_STATS = ['int', 'log', 'cha'] as const satisfies readonly Ability[];
export type CastStat = (typeof CAST_STATS)[number];

/** The damage/resource tracks. Wound penalties accrue from all three independently. */
export const TRACKS = ['health', 'stamina', 'mana'] as const;
export type Track = (typeof TRACKS)[number];

export const SOAKS = ['armor', 'physical', 'mental'] as const;
export type Soak = (typeof SOAKS)[number];

export const SOAK_LABELS: Record<Soak, string> = {
    armor: 'Armor Soak',
    physical: 'Physical Soak',
    mental: 'Mental Soak',
};

export const DEFENSES = ['dodge', 'block', 'parry', 'mental', 'physical'] as const;
export type Defense = (typeof DEFENSES)[number];

export interface DefenseDef {
    label: string;
    /** Whether this defense may be used passively (no roll, no initiative cost). */
    allowPassive: boolean;
    /** The skill whose rank feeds this defense's active pool. */
    skill: SkillKey;
}

export const DEFENSE_DEFS: Record<Defense, DefenseDef> = {
    dodge: { label: 'Dodge', allowPassive: true, skill: 'dodge' },
    block: { label: 'Block', allowPassive: false, skill: 'weapon_skill' },
    parry: { label: 'Parry', allowPassive: false, skill: 'weapon_skill' },
    mental: { label: 'Mental Resist', allowPassive: true, skill: 'perserverence' },
    physical: { label: 'Physical Resist', allowPassive: true, skill: 'perserverence' },
};

export interface SkillDef {
    label: string;
    attr: Ability;
    /** Defense skills roll through the defense pools, so their raw pool is not shown. */
    hideDicepool?: boolean;
}

/**
 * The 22 active skills. `spellcasting.attr` is overridden per-character by the Cast Stat,
 * and `perceive_magic` always mirrors it — see rules/derive.ts.
 */
export const SKILLS = {
    strongman: { label: 'Strongman', attr: 'str' },
    gymnastics: { label: 'Gymnastics', attr: 'agi' },
    marathoner: { label: 'Marathoner', attr: 'bod' },
    traversal: { label: 'Traversal', attr: 'rea' },

    navigation: { label: 'Navigation', attr: 'int' },
    survival: { label: 'Survival', attr: 'wil' },
    medicine: { label: 'Medicine', attr: 'log' },
    animal_handling: { label: 'Animal Handling', attr: 'int' },

    con: { label: 'Con', attr: 'cha' },
    insight: { label: 'Insight', attr: 'int' },
    intimidation: { label: 'Intimidation', attr: 'cha' },
    negotiation: { label: 'Negotiation', attr: 'cha' },

    disguise: { label: 'Disguise', attr: 'int' },
    stealth: { label: 'Stealth', attr: 'agi' },
    legerdemain: { label: 'Legerdemain', attr: 'agi' },
    thievery: { label: 'Thievery', attr: 'agi' },

    spellcasting: { label: 'Spellcasting', attr: 'log' },
    perceive_magic: { label: 'Perceive Magic', attr: 'log' },
    weapon_skill: { label: 'Weapon Skill', attr: 'agi' },
    perception: { label: 'Perception', attr: 'int' },
    dodge: { label: 'Dodge', attr: 'int', hideDicepool: true },
    perserverence: { label: 'Perseverance', attr: 'int', hideDicepool: true },
} as const satisfies Record<string, SkillDef>;

export type SkillKey = keyof typeof SKILLS;
export const SKILL_KEYS = Object.keys(SKILLS) as SkillKey[];

/**
 * Skill groups. Buying a group at rank N sets every member to rank N (it clobbers
 * individual ranks — you buy the group OR the members, never both).
 * `ungrouped` is a display bucket only; it has no purchasable rank.
 */
export const SKILL_GROUPS = {
    athletics: {
        label: 'Athletics',
        isGroup: true,
        members: ['strongman', 'gymnastics', 'marathoner', 'traversal'],
    },
    exploration: {
        label: 'Exploration',
        isGroup: true,
        members: ['navigation', 'survival', 'medicine', 'animal_handling'],
    },
    influence: {
        label: 'Influence',
        isGroup: true,
        members: ['con', 'insight', 'intimidation', 'negotiation'],
    },
    subterfuge: {
        label: 'Subterfuge',
        isGroup: true,
        members: ['disguise', 'stealth', 'legerdemain', 'thievery'],
    },
    ungrouped: {
        label: 'Other',
        isGroup: false,
        members: [
            'spellcasting',
            'perceive_magic',
            'weapon_skill',
            'perception',
            'dodge',
            'perserverence',
        ],
    },
} as const satisfies Record<
    string,
    { label: string; isGroup: boolean; members: readonly SkillKey[] }
>;

export type SkillGroupKey = keyof typeof SKILL_GROUPS;
export const SKILL_GROUP_KEYS = Object.keys(SKILL_GROUPS) as SkillGroupKey[];

/** Shields, by index. The index is stored on the weapon as `system.shield`. */
export const SHIELDS = ['None', 'Buckler', 'Medium', 'Heavy', 'Tower'] as const;

/** Block bonus granted by each shield, indexed to SHIELDS. */
export const SHIELD_BLOCK_BONUS = [0, 1, 4, 5, 7] as const;

/** A Buckler is small enough to hold a weapon behind, but it costs you accuracy. */
export const BUCKLER_INDEX = 1;
export const BUCKLER_ATTACK_PENALTY = 2;

export const HANDEDNESS = ['Light', 'One-Handed', 'Two-Handed'] as const;

/** The skills a weapon may attack with. */
export const WEAPON_SKILLS = ['weapon_skill', 'spellcasting'] as const satisfies readonly SkillKey[];
export type WeaponSkill = (typeof WEAPON_SKILLS)[number];

/** Base points of damage a track absorbs per wound level, before Resilient Wounds. */
export const WOUND_TIER_BASE = 6;

/** Initiative spent by taking a turn. */
export const INITIATIVE_PER_TURN = 10;

/** Initiative spent on an active defense, and on Total Defense. */
export const ACTIVE_DEFENSE_COST = 5;
export const TOTAL_DEFENSE_COST = 10;

/**
 * Every stat a Feature item (or an ActiveEffect) may add to.
 *
 * These are the legal values of `system.target` on a feature, and the exact key set of
 * `system.bonuses` on the character. Effects target them as
 * `system.bonuses.<key>` with mode ADD.
 */
export const BONUS_TARGETS = [
    ...DEFENSES.map((d) => `defense_${d}` as const),
    ...SOAKS.map((s) => `soak_${s}` as const),
    ...SKILL_KEYS.map((s) => `skill_${s}` as const),
] as const;

export type BonusTarget = (typeof BONUS_TARGETS)[number];

export function bonusTargetLabel(target: BonusTarget): string {
    if (target.startsWith('defense_')) {
        return `Defense: ${DEFENSE_DEFS[target.slice(8) as Defense].label}`;
    }
    if (target.startsWith('soak_')) {
        return `Soak: ${SOAK_LABELS[target.slice(5) as Soak]}`;
    }
    return `Skill: ${SKILLS[target.slice(6) as SkillKey].label}`;
}

export const SR = {
    ABILITIES,
    ABILITY_LABELS,
    CAST_STATS,
    TRACKS,
    SOAKS,
    SOAK_LABELS,
    DEFENSES,
    DEFENSE_DEFS,
    SKILLS,
    SKILL_KEYS,
    SKILL_GROUPS,
    SKILL_GROUP_KEYS,
    SHIELDS,
    SHIELD_BLOCK_BONUS,
    HANDEDNESS,
    WEAPON_SKILLS,
    BONUS_TARGETS,
} as const;
