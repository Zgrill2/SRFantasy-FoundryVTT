/// <reference path="../Shadowrun.ts" />
declare namespace Shadowrun {
    export interface ShieldData extends ShieldPartData, DescriptionPartData, ImportFlags, TechnologyPartData {}

    export interface ShieldPartData {
        shield: {
            category: ShieldCategory;
            block: number;
        };
    }

    /**
     * Shield categories.
     */
    export type ShieldCategory = 'buckler' | 'medium' | 'heavy' | 'tower' | '';
}
