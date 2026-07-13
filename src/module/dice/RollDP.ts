import { percentile } from '../rules/binomial';

export interface RollDPOptions {
    /** Subtract this many dice from the pool before rolling. Floored at zero. */
    woundPenalty?: number;
    /** 6s explode into another die. */
    explode?: boolean;
}

/**
 * A Shimmering Reach dice pool.
 *
 * Roll a handful of d6; every 5 or 6 is a hit. Ones are marked as failures for the look of
 * the thing, but they cost you nothing — there is no glitch rule.
 *
 * Formula: `Nd6[x=6]cf=1cs>=5`
 */
export class RollDP extends Roll {
    /**
     * Build a pool.
     *
     * `pool` is the dice you would roll if you were hale. Wounds come off the top, and a
     * badly hurt character can be reduced to rolling nothing at all — which is the point.
     */
    static fromPool(pool: number, options: RollDPOptions = {}, data: any = {}): RollDP {
        const wounded = Math.max(0, pool - (options.woundPenalty ?? 0));
        const explode = options.explode ? 'x=6' : '';

        return new RollDP(`${wounded}d6${explode}cf=1cs>=5`, data, {
            pool,
            woundPenalty: options.woundPenalty ?? 0,
            explode: Boolean(options.explode),
        } as any);
    }

    /**
     * Dice actually rolled, after wounds — not the same as the pool you wish you had.
     * (Named `rolled` rather than `dice` because Roll#dice already means the DiceTerms.)
     */
    get rolled(): number {
        return (this.terms[0] as any)?.number ?? 0;
    }

    /** The pool before wounds were taken off it. */
    get pool(): number {
        return (this.options as any).pool ?? this.rolled;
    }

    get woundPenalty(): number {
        return (this.options as any).woundPenalty ?? 0;
    }

    get explode(): boolean {
        return Boolean((this.options as any).explode);
    }

    /** Hits: 5s and 6s. This is what `total` counts, via the `cs>=5` modifier. */
    get hits(): number {
        return this._evaluated ? (this.total ?? 0) : 0;
    }

    /** The individual die faces, for the dice tray on the card. */
    get faces(): { value: number; hit: boolean; one: boolean }[] {
        const results = (this.terms[0] as any)?.results ?? [];
        return results
            .filter((r: any) => r.active !== false)
            .map((r: any) => ({
                value: r.result,
                hit: r.result >= 5,
                one: r.result === 1,
            }))
            .sort((a: any, b: any) => b.value - a.value);
    }

    /**
     * How this roll compares to the pool it came from: the share of rolls of this size that
     * would have done no better. Tells a player whether the dice betrayed them or the pool
     * was simply too thin.
     */
    get percentile(): number {
        return percentile(this.hits, this.rolled);
    }

    /**
     * The dice that missed — what a reroll gets to try again.
     */
    get misses(): number {
        return Math.max(0, this.rolled - this.hits);
    }
}
