/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([

    // Actor partials.
    "systems/shimmeringreach/templates/actor/actor-features.html",
    //"systems/shimmeringreach/templates/actor/actor-items.html",
    //"systems/shimmeringreach/templates/actor/actor-spells.html",
    //"systems/shimmeringreach/templates/actor/actor-effects.html",
  ]);
};
