import { RollDP } from "../dice-roller/roll.mjs";
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class ShimmeringReachItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
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
    const itemData = this.data;
    const data = itemData.data;
    const flags = itemData.flags.shimmeringreach || {};

    // Make separate methods for each Item type (weapon, buff, knowledge, etc.) to keep
    // things organized.
    if (itemData.type == "feature") {
      this._prepareFeatureData(this.parent.data, itemData);
    }
    else if (itemData.type == "weapon") {
      // We do not prepare weapon data here because it was already prepared as part of setting up Actor
      //this._prepareWeaponData(this.parent.data, itemData);
    }
    //this._prepareWeaponData(itemData);
  }

  _prepareFeatureData(actorData, itemData) {
    const adata = actorData;
    const idata = itemData;
    let qdata = adata;
    if (itemData.active != true){ return; }
    let [category, selection] = itemData.category.split(".")
    let parts = itemData.category.split(".");
    let b = idata.bonus;
    let res = this.recursiveFeaturePrep(adata, parts, b);
  }

  recursiveFeaturePrep(adata, partz, bon) {
		let actorData = adata;
		const parts = partz;
		const bonus = bon;
		
		if (parts.length > 0 && !(actorData[parts[0]] == undefined))
		{
			const p = parts.slice(1);
			const qData = actorData[parts[0]];
			const t = this.recursiveFeaturePrep(qData,p,bonus);
			if (t != false){
				actorData[parts[0]] = t;
				return(actorData);
			}
		}
		if (parts.length == 0){
			actorData += bonus;
			
			return (actorData);
		}
		return (false);
	}

  _prepareDerivedWeaponData(actorData, itemData) {
    if (itemData.type == 'weapon') {
			
	    itemData.data.dv = itemData.data.power;
		if(actorData.data.abilities[itemData.data.attr]){
			itemData.data.dv += actorData.data.abilities[itemData.data.attr].value;
		}
		//(itemData.document).update({dv: itemData.data.dv});
	    itemData.data.dicepool = itemData.data.reach + actorData.data.skills[itemData.data.skill].dicepool;
		
		
      return;
    }
    if (itemData.type == 'skill') {
      // Instead we should just default to only having INT and LOG selectable
      if (itemData.data.attr == 'none') {
        itemData.data.dicepool = itemData.data.rank;
        return;
      }
      itemData.data.dicepool = itemData.data.rank + actorData.data.abilities[itemData.data.attr].value
    }
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
   getRollData() {
    // If present, return the actor's roll data.
    if ( !this.actor ) return null;
    const rollData = this.actor.getRollData();
    rollData.item = foundry.utils.deepClone(this.data.data);

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this.data;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.data.data.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.data.description ?? ''
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new RollDP(rollData.item.formula, rollData).roll();
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
}
