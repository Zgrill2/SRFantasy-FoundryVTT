

export class SRCombat extends Combat {
	
	constructor(...args) {
    super(...args);
  }
	
  
  /** @override */
	_sortCombatants(a, b) {
    const oa = Number.isNumeric(a.order) ? a.order : -9999;
    const ob = Number.isNumeric(b.order) ? b.order : -9999;
    let ord = ob - oa;
	
	let at = a.actor.data.data;
	let bt = b.actor.data.data;
	
	/* Sort by turn order.
	First pass through on new round all turn orders are identical, bypassing this part.
	Immediately afterwards the results of the sort are locked by writing them to turn order.
	*/
	if (ord !== 0 ) return ord;
		
	// tiebreak by REA. Returns positive if B is bigger
	
	let dR = bt.abilities.rea.value - at.abilities.rea.value;
	if (dR !== 0 ) return dR;
	// tiebreak by LUK
	let dL = bt.luck.max.value - at.luck.max.value;
	if (dL !== 0 ) return dL;
	
	
	let dLC = bt.luck.current.value - at.luck.current.value;
	if (dLC !== 0 ) return dLC;
	
	// sorting by name
    let [an, bn] = [a.token?.name || "", b.token?.name || ""];
    let cn = an.localeCompare(bn);
    if ( cn !== 0 ) return cn;
	
	//sort by token ID
    return a.tokenId - b.tokenId;
  }
  
  async firstTurn() { 
    let firstdude = {};
    for ( let [i, t] of this.turns.entries() ) {
      if (i == 0) {
        firstdude = t;
      };
    };

    let updates = [{_id: firstdude.id, initiative: firstdude.initiative - 10}]
    await this.updateEmbeddedDocuments("Combatant", updates);
    return;
  }
  
  
	/** @override */
	async nextTurn() {
    let turn = this.turn;

    // Determine the next turn number
    let next = null;
	  let hasinit = false;
  	do {
      for ( let [i, t] of this.turns.entries() ) {
        if ( t.actor?.effects.find(e => e.getFlag("core", "statusId") === CONFIG.Combat.defeatedStatusId ) ) continue;
		if ( t.initiative <= 0 ) continue; //if 0 init no turn
		hasinit = true; //someone alive has init left, do not go to next round
        if ( i <= turn ) continue; //if you've already had a turn, no turn
        next = i;
		    await this.setInitiative(t.id, t.initiative - 10);
        break;
      };
		  if (!hasinit) {
			  next = -1; //case for next round
		  }
		  else {
			  turn = -1; //wrap back around
		  };
	} while (next === null) ;
    // Maybe advance to the next round
    let round = this.round;
    if ( (this.round === 0) || (hasinit === false) ) {
      this.nextRound();
      return;
    }

    // Update the encounter
    const advanceTime = CONFIG.time.turnTime;
	
    this.update({round: round, turn: next}, {advanceTime});
    //	game.combat.rollAll();
  }
	
	
	/**  @override  */
	async nextRound() {
    let turn = 0;
    if ( this.settings.skipDefeated ) {
      turn = this.turns.findIndex(t => {
        return !(t.defeated ||
        t.actor?.effects.find(e => e.getFlag("core", "statusId") === CONFIG.Combat.defeatedStatusId ));
      });
      if (turn === -1) {
        ui.notifications.warn(game.i18n.localize("COMBAT.NoneRemaining"));
        turn = 0;
      }
    }
    let advanceTime = Math.max(this.turns.length - this.data.turn, 1) * CONFIG.time.turnTime;
    advanceTime += CONFIG.time.roundTime;
	
	await this.timeoutBuffs();
	
    await this.resetAll();
    await this.rollAll();
    await this.firstTurn();  

    this.update({round: this.round+1, turn: turn}, {advanceTime});
  }
  
  
  /**  @override  */
  async rollAll(options) {
    const ids = this.combatants.reduce((ids, c) => {
      if ( c.isOwner && !c.initiative) ids.push(c.id);
      return ids;
    }, []);
    
    await this.rollInitiative(ids, options);
    return;
  }

  
  /**  @override  */
  async rollInitiative(ids, {formula=null, updateTurn=false, messageOptions={}}={}) {
    // Structure input data
    ids = typeof ids === "string" ? [ids] : ids;
    const currentId = this.combatant.id;
    const rollMode = messageOptions.rollMode || game.settings.get("core", "rollMode");

    // Iterate over Combatants, performing an initiative roll for each
    const updates = [];
    const messages = [];
    for ( let [i, id] of ids.entries() ) {
    
      // Get Combatant data (non-strictly)
      const combatant = this.combatants.get(id);
      if ( !combatant?.isOwner ) return results;
      // Produce an initiative roll for the Combatant
      const roll = combatant.getInitiativeRoll(formula);
      var total_roll = roll.total
      updates.push({_id: id, initiative: total_roll});
      await combatant.setFlag("shimmeringreach", "order", (total_roll + combatant.actor.data.data.initiative.bias));
      // Construct chat message data
      let messageData = foundry.utils.mergeObject({
        speaker: {
          scene: this.scene.id,
          actor: combatant.actor?.id,
          token: combatant.token?.id,
          alias: combatant.name
        },
        flavor: game.i18n.format("COMBAT.RollsInitiative", {name: combatant.name}),
        flags: {"core.initiativeRoll": true}
      }, messageOptions);
      const chatData = await roll.toMessage(messageData, {
        create: false,
        rollMode: combatant.hidden && (rollMode === "roll") ? "gmroll" : rollMode
      });

      // Play 1 sound for the whole rolled set
      if ( i > 0 ) chatData.sound = null;
      messages.push(chatData);
    }
    if ( !updates.length ) return this;
    await this.updateEmbeddedDocuments("Combatant", updates);

    // Ensure the turn order remains with the same combatant
    if ( updateTurn ) {
      await this.update({turn: this.turns.findIndex(t => t.id === currentId)});
    }

    // Create multiple chat messages
    ChatMessage.implementation.create(messages);
    return this;
  }

  /**  @override  */
  async resetAll() {
    let updates = []
    for ( let c of this.combatants ) {
      updates.push({_id: c.id, initiative: null})
      await c.setFlag("shimmeringreach", "order", 0);
    };
    await this.updateEmbeddedDocuments("Combatant", updates);
    return;
  }
  
  async startCombat() {
	await this.resetAll();
    await this.rollAll();
    await this.firstTurn();  

    return this.update({round: 1, turn: 0});
  }
  
  async timeoutBuffs(){
	  
	  for (let c of this.combatants) {
			let actor = {};
			if (game.actors.tokens[c.token.id] !== undefined){
				actor = game.actors.tokens[c.token.id]
			}
			else {
				actor = c._actor;
			}
			
			for (let e of actor.data.effects){
				console.log(e);
				console.log(e.duration.remaining);
				if (e.duration.remaining < 1.1 && e.duration.type != "none"){
					console.log("deleted");
					await e.delete();
				}
			}
	  }
  }
  

}