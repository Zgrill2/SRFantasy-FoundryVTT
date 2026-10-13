/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ShimmeringReachActor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
    const actorData = this.data;
    const data = actorData.data;
    const flags = actorData.flags.shimmeringreach || {};
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    this.items.forEach(i => i._prepareDerivedWeaponData(this.data, i.data)) // This data is calculated post actor setup
    this._prepareBlockParryData(this.data); // Finally these defense values are calculated
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== 'character') return;

    // Make modifications to data here. For example:
    const data = actorData.data;

    /* Calculated Character Data */

    //assigning cast stat to perceive magic
	  data.skills.perceive_magic.attr = data.skills.spellcasting.attr;

    // bars - health, stamina, mana
	  data.health.max = data.abilities.bod.value + 16;
	  data.mana.max = data.abilities[data.skills.spellcasting.attr].value + 16;
	  data.stamina.max = data.abilities.wil.value + 16;

    //drain soak
	  data.drainres.value = data.abilities.wil.value * 2;
    
    // soak
	  data.soaks.armor.value = data.abilities.bod.value + Math.ceil(0.5 * (data.abilities.log.value));
	  data.soaks.physical.value = data.abilities.str.value + Math.ceil(0.5 * (data.abilities.agi.value));
	  data.soaks.mental.value = data.abilities.wil.value + Math.ceil(0.5 * (data.abilities.cha.value));

    //defense
      data.defenses.dodge.passive = data.abilities.rea.value + data.abilities.int.value;
	  data.defenses.dodge.active = data.defenses.dodge.passive + data.skills.dodge.value + Math.min(data.skills.dodge.value,Math.ceil(data.tradition.rank.value / 2));
	  
      data.defenses.block.passive = data.defenses.dodge.passive;
	  data.defenses.block.active = data.defenses.block.passive + data.skills.weapon_skill.value + Math.min(data.skills.weapon_skill.value,Math.ceil(data.tradition.rank.value / 2));
	  
      data.defenses.parry.passive = data.defenses.dodge.passive;
	  data.defenses.parry.active = data.defenses.parry.passive + data.skills.weapon_skill.value + Math.min(data.skills.weapon_skill.value,Math.ceil(data.tradition.rank.value / 2));
	  
      data.defenses.mental.passive = data.abilities.wil.value + data.abilities.cha.value;
	  data.defenses.mental.active = data.defenses.mental.passive + data.skills.perserverence.value + Math.min(data.skills.perserverence.value,Math.ceil(data.tradition.rank.value / 2));
	  
      data.defenses.physical.passive = data.abilities.bod.value + data.abilities.agi.value;
	  data.defenses.physical.active = data.defenses.physical.passive + data.skills.perserverence.value + Math.min(data.skills.perserverence.value,Math.ceil(data.tradition.rank.value / 2));

    //Updating skills
    for (let [key, skill_group] of Object.entries(data.skill_groups)) {
      Object.entries(data.skills).forEach(k => {
          let [key, val] = k
          if (skill_group.members.includes(key)) {
            if (skill_group.value > 0) {
              val.value = skill_group.value;
              val.isGroupRanked = true;
            }
            else {
              val.isGroupRanked = false;
            }
          }
      });
    }

    for (let [key, skill] of Object.entries(data.skills)) {
        if (skill.attr != "none") {
          skill.dicepool += skill.value + data.abilities[skill.attr].value + Math.min(skill.value,Math.ceil(data.tradition.rank.value / 2)) -1 * (skill.value == 0);
        }
    }

    const item_set = actorData.items;

    Object.entries(item_set).forEach(knowskill => {
      if (knowskill[1].type == 'skill') {        
        knowskill[1].data.dicepool = knowskill[1].data.rank  + Math.min(knowskill[1].data.rank,Math.ceil(data.tradition.rank.value / 2));
        if(knowskill[1].data.attr != "none") {
          knowskill[1].data.dicepool += data.abilities[knowskill[1].data.attr].value;
        }
      }
    });
	
	//Wound Penalties
	data.wound_penalty.value = Math.ceil(Math.floor((data.health.max - data.health.value)/(data.wound_penalty.resilient_wounds+6)) +  Math.floor((data.stamina.max - data.stamina.value)/(data.wound_penalty.resilient_wounds+6)) +  Math.floor((data.mana.max - data.mana.value)/(data.wound_penalty.resilient_wounds+6))-data.wound_penalty.ignore_wounds,0);
	
	

  }

  /**
   * Prepares block/parry pools after weapons are setup (technically this could happen after weapons are setup but before weapon derived data is set up)
   * @param actorData Actor data document
   */
  _prepareBlockParryData(actorData) {
    // Make modifications to data here. For example:
    const data = actorData.data;
    const shield_bonuses = [0,1,4,5,7];

    //let weapon = this._getEquippedWeapon(actorData.items);
    //let weapon = this._getEquippedWeapon(actorData.items);
    let weapon;
    actorData.items.forEach((item) => {
      if (item.data.type == 'weapon') {
        if (item.data.data.active) {
          weapon = item;
        }
      }
    });

    if(weapon && weapon.data.data.skill == 'weapon_skill') {
      data.defenses.block.active += shield_bonuses[weapon.data.data.shield]
      data.defenses.parry.active += weapon.data.data.reach
      if (weapon.data.data.shield == 1) {
        weapon.data.data.dicepool -= 2
      }
    }

  }

  /**
   * Inefficient search for equipped weapon
   * Should just cache the equipped weapon so we do not have to iterate through all items
   * @param items actorData.items
   */
  _getEquippedWeapon(items) {
    items.forEach((item) => {
      if (item.data.type == 'weapon') {
        if (item.data.data.active) {
          return item;
        }
      }
    });
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    // Make modifications to data here. For example:
    const data = actorData.data;
    data.xp = (data.cr * data.cr) * 100;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.data.type !== 'character') return;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    /*
	if (data.abilities) {
      for (let [k, v] of Object.entries(data.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    // Add level for easier access, or fall back to 0.
    if (data.attributes.level) {
      data.lvl = data.attributes.level.value ?? 0;
    }*/
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.data.type !== 'npc') return;

    // Process additional NPC data here.
  }
  
  
  
    applyActiveEffects() {
    const overrides = {};

    // Organize non-disabled effects by their application priority
    const changes = this.effects.reduce((changes, e) => {
      if ( e.data.disabled ) return changes;
      return changes.concat(e.data.changes.map(c => {
        c = foundry.utils.duplicate(c);
        c.effect = e;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
    }, []);
    changes.sort((a, b) => a.priority - b.priority);

    // Apply all changes
    for ( let change of changes ) {
		console.log("applying",this,change);
      const result = change.effect.apply(this, change);
	  console.log("result",result);
      if ( result !== null ) overrides[change.key] = result;
    }

    // Expand the set of final overrides
    this.overrides = foundry.utils.expandObject(overrides);
  }



}