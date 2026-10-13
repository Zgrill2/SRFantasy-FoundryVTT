import { RollDP } from "../dice-roller/roll.mjs";
import {onManageActiveEffect, prepareActiveEffectCategories} from "../helpers/effects.mjs";
import {renderAttackChatData,customAttackDialog,renderSkillChatData,customSkillDialog} from '../roll-cards/render.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class ShimmeringReachActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["shimmeringreach", "sheet", "actor"],
      template: "systems/shimmeringreach/templates/actor/actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  /** @override */
  get template() {
    return `systems/shimmeringreach/templates/actor/actor-${this.actor.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.actor.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.data = actorData.data;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);
	//console.log(context);
    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
	//// Currently buggy, doesn't write to abilities group
	/*
    for (let [k, v] of Object.entries(context.data.abilities)) {
      v.label = game.i18n.localize(CONFIG.SHIMMERINGREACH.abilities[k]) ?? k;
    }*/
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const features = [];
    const weapons = [];
    const known_skills = [];
	const spells = [[]];
    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to features.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Append to spells.
      else if (i.type === 'spell') {
        if (i.data.spellLevel != undefined) {
          spells[i.data.spellLevel].push(i);
        }
      }
      else if (i.type == 'weapon') {
        weapons.push(i)
      }
      else if (i.type == 'skill') {
        known_skills.push(i)
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.spells = spells;
    context.weapons = weapons;
    context.known_skills = known_skills;
   }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    //html.find('.rollable').click(this._onRoll.bind(this));

    // Rollable abilities.
    html.find('.bland-roll').click(this._onRoll.bind(this));
    html.find('.skill-roll').click(this._skillRoll.bind(this));
  
    // high level item checkboxes
    html.find('.group-toggle').click(this._groupToggle.bind(this));
    html.find('.buff-toggle').click(this._buffToggle.bind(this));
    html.find('.attack-message').click(this._attackMessage.bind(this));
    html.find('.page-edit-toggle').click(this._editToggle.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `Rolling [ability] ${dataset.label}` : '';
      let roll = new RollDP(dataset.roll, this.actor.getRollData(), dataset.explode, dataset.applywounds).roll();
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  
  /**  Render Custom Chat Messages  **/  
  _skillRoll(event) {
		event.preventDefault();
		let dataset = event.currentTarget.dataset;
		
		let options = {
			blind: event.ctrlKey
		}
		if (!event.shiftKey){
			renderSkillChatData(dataset,this.actor,options);
		}
		else {
			customSkillDialog(dataset,this.actor,options);
		}
	}

  _attackMessage(event) {
		event.preventDefault();
		let dataset = event.currentTarget.dataset;
		if (!event.shiftKey){
			renderAttackChatData(dataset, this.actor, {});
		}
		else {
			customAttackDialog(dataset, this.actor,{});
		}
	}

/** Toggle A Buff Ability **/
  _buffToggle(event) {
    event.preventDefault();
    
    const element = event.currentTarget;
    const dataset = element.dataset;
    
    let buffs = this.actor.items;
    
    let id = dataset.buff;
    
    buffs.forEach(buff => {
      if (buff.data.type === 'feature') {
        if (buff.data.id === id) {
          buff.data.data.active = !buff.data.data.active;
          const newdata = buff.data;
          this.actor.updateEmbeddedEntity("OwnedItem", newdata);
        }
      }			  
    });
   }

  _groupToggle(event) {
    console.log("testweapon")
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    
    let id = dataset.weapon;
    let weapons = this.actor.items;
    let a = [];
    weapons.forEach(weapon => {
      if (weapon.data.type === 'weapon') {
        if(weapon.id == id) {
          console.log("toggle weapon state")
          const newdata = { 
            _id: weapon.id, 
            data: { 
              active: !weapon.data.data.active
          }};
          a.push(newdata);
          //this.actor.updateEmbeddedEntity("OwnedItem", newdata);
          //this.actor.updateOwnedItem(weapon.data);          
        }
        else if(weapon.data.data.active === true) {
          console.log("untoggle")
          const newdata = { 
            _id: weapon.id, 
            data: { 
              active: false
          }};
          a.push(newdata);
          //this.actor.updateEmbeddedEntity("OwnedItem",newdata);          
        }
      }
    });
	
		this.updateWeapons(a);
    console.log(this.actor)
  }

  // is this async for performance reasons?
	async updateWeapons(weapons) {
    this.actor.updateEmbeddedDocuments("Item", weapons)
    /*
		weapons.forEach(weapon => {
			setTimeout(function(){this.actor.updateEmbeddedDocuments("Item", weapon.data)}.bind(this), i*50);
			//await this.actor.updateEmbeddedEntity("OwnedItem",weapon);
			i +=1;
		});*/
	}

  // vestigial function - scheduled for removal
	_editToggle(event){/*
		event.preventDefault();
		
	   const element = event.currentTarget;
	   const dataset = element.dataset;
			
			
			
	let message = $(event.currentTarget).parentsUntil('.sheet-body');
		console.log(event);
		console.log(this);
		console.log(document);
		
			let red3 = document.getElementsByClassName("page-edit-toggle");
			console.log(red3);
			//red3[0].hidden = true;
			console.log(red3);*/
	}
  
}