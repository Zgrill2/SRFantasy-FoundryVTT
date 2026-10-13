// Import document classes.
import { ShimmeringReachActor } from "./documents/actor.mjs";
import { ShimmeringReachItem } from "./documents/item.mjs";
import { SRCombatant } from "./srcombat/srcombatant.mjs";
// Import sheet classes.
import { ShimmeringReachActorSheet } from "./sheets/actor-sheet.mjs";
import { ShimmeringReachItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { SHIMMERINGREACH } from "./helpers/config.mjs";

// Import custom Roll class
import { RollDP } from "./dice-roller/roll.mjs"

// Import SR Combat module
import { SRCombat } from "./srcombat/srcombat.mjs";

// Import renders
import {customAttackDialog,renderAttackChatData,deleteDefenderMessage,toggleDicerollDisplay,rerollChatCard,addDefenseMessages,customDefenseDialog,customSoakDialog,simpleSoak, registerRenderSocket, testEmit, simpleDrain,renderSkillChatData,customSkillDialog,renderDvChatData, customDvDialog, addSoakMessage,undoDamageApply,multiSkillDialog} from './roll-cards/render.js';

// Import measurement calculations
import { measureDistances } from "./canvas/canvas.js";


// Import settings
import { registerSystemSettings } from "./settings.js";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {


/* ---- Welcome to Shimmering Reach ---- */

	var phrase = `Loading Shimmering Reach System                                                       
   _____  __     _                                    _                  ____                      __   
  / ___/ / /_   (_)____ ___   ____ ___   ___   _____ (_)____   ____ _   / __ \\ ___   ____ _ _____ / /_  
  \\__ \\ / __ \\ / // __ '__ \\ / __ '__ \\ / _ \\ / ___// // __ \\ / __  /  / /_/ // _ \\ / __ '// ___// __ \\ 
 ___/ // / / // // / / / / // / / / / //  __// /   / // / / // /_/ /  / _, _//  __// /_/ // /__ / / / / 
/____//_/ /_//_//_/ /_/ /_//_/ /_/ /_/ \\___//_/   /_//_/ /_/ \\__, /  /_/ |_| \\___/ \\__,_/ \\___//_/ /_/  
                                                            /____/                                      
 `;

/* ----------------------------------------------- */

console.log(phrase)
	
	
	
	let rollMacro = {"rollWeaponMacro": rollWeaponMacro};

	let languages = {
		"common": "common",
		"dwarvish": "dwarvish",
		"elvish": "elvish",
		"daemonic": "daemonic",
		"draconic": "draconic",
		"seivan": "seivan",
		"gexian": "gexian",
		"mawu": "mawu"
	}
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.shimmeringreach = {
    ShimmeringReachActor,
    ShimmeringReachItem,
    RollDP,
    SRCombat,
    rollMacro,
	renderDvChatData,
	customDvDialog,
	multiSkillDialog
  };


  
  // Add custom constants for configuration.
  CONFIG.SHIMMERINGREACH = SHIMMERINGREACH;
  CONFIG.SHIMMERINGREACH.languages = languages;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
   
   //    formula: "@initiative.dice d6 + @abilities.rea.value",
  CONFIG.Combat.initiative = {
	formula: "(@initiative.dice)d6 + @abilities.rea.value",
    decimals: 2
  };




  // Define custom Document classes
  CONFIG.Actor.documentClass = ShimmeringReachActor;
  CONFIG.Item.documentClass = ShimmeringReachItem;
  CONFIG.Combat.documentClass = SRCombat;
  CONFIG.Combatant.documentClass = SRCombatant;



  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("shimmeringreach", ShimmeringReachActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("shimmeringreach", ShimmeringReachItemSheet, { makeDefault: true });

  registerSystemSettings();
  registerRenderSocket();
  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
  
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function() {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper('toLowerCase', function(str) {
  return str.toLowerCase();
});

// Custom Handlebars Helpers
Handlebars.registerHelper('isInSkillGroup', function(skill_group_members, skill_name) {
  return skill_group_members.includes(skill_name);
});

Handlebars.registerHelper("checkedNot", function (condition) {
    return (condition) ? "" : "checked";
});
  
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  On Hook                                     */
/* -------------------------------------------- */

// diagonal movement
Hooks.on("canvasInit", function() {

  // Extend Diagonal Measurement
  SquareGrid.prototype.measureDistances = measureDistances;
});

Hooks.on("init", function() {
	$(document).on('click','.hits-block', (event)	=> { 
		event.preventDefault();
		if (event.shiftKey){
			rerollChatCard(event);
		}
		else {
			toggleDicerollDisplay(event);
		}
	});
	
	$(document).on('click','.delete-defender', (event) => {
		event.preventDefault();
		deleteDefenderMessage(event);
		
	});
	
	$(document).on('click','.defense-block', (event) => {
		event.preventDefault();
		let options = {
			total_defense: event.ctrlKey
		}
		if (!event.shiftKey){
			addDefenseMessages(event, options);
		}
		else {
			customDefenseDialog(event,options);
		}
	});
	
	$(document).on('click','.defense-block-active', (event) => {
		event.preventDefault();
		let options = {
			total_defense: event.ctrlKey
		}
		if (!event.shiftKey){
			addDefenseMessages(event, options);
		}
		else {
			customDefenseDialog(event,options);
		}
	});
	$(document).on('click','.multiskill-roll', (event) => {
		event.preventDefault();
		let options = {
		}
		addDefenseMessages(event, options);
	});
	
	$(document).on('click','.incoming-damage-block', (event) => {
		event.preventDefault();
		if (!event.shiftKey) {
			simpleSoak(event);
		}
		else {
			customSoakDialog(event);
		}
	});
  
	$(document).on('click','.incoming-drain-block', (event) => {
		event.preventDefault();
		simpleDrain(event);
	});
	
	$(document).on('click','.dvsoak', (event) => {
		event.preventDefault();
		addSoakMessage(event);
	});
	
	$(document).on('click','.undo-damage-block', (event) => {
		event.preventDefault();
		
		if (event.shiftKey){
			undoDamageApply(event);
		}
	});
});

Hooks.on("renderChatMessage", (event, html, messageData) => {
	Object.entries($(html).find('.delete-defender')).forEach(target => {
		if (target[0] != "length" && target[0] != "prevObject"){
			if (game.actors.get(target[1].dataset.actorId).permission != 3){
				target[1].style.display = "none";
			}
		}
	});
	console.log(messageData);
	if (messageData.message.blind || messageData.message.flags.shimmeringreach.attacker.blind){
		Object.entries($(html).find('.blind-gm')).forEach(target => {
			if (target[0] != "length" && target[0] != "prevObject" && !(game.users.current.isGM)){
					target[1].style.display = "none";
			}
		});

		Object.entries($(html).find('.blind-player')).forEach(target => {
			if (target[0] != "length" && target[0] != "prevObject" && game.users.current.isGM){
					target[1].style.display = "none";
			}
		});
	}
	
	
	
});

Hooks.on("polyglot.init", (LanguageProvider) => {
    class ShimmeringReachLanguageProvider extends LanguageProvider {
        get originalAlphabets() {
            return {
                "common": "130% Thorass",
                "dwarvish": "220% ElderFuthark",
                "elvish": "150% Tengwar",
				"daemonic": "230% Infernal",
				"draconic": "170% Iokharic",
				"seivan": "120% Barazhad",
				"gexian": "120% Qijomi",
				"mawu": "120% JungleSlang"
            };
        }
        get originalTongues() {
            return {
                "_default": "common",
                "common": "common",
                "dwarvish": "dwarvish",
                "elvish": "elvish",
				"daemonic": "daemonic",
				"draconic": "draconic",
				"seivan": "seivan",
				"gexian": "gexian",
				"mawu": "mawu"
			};
        }
        getUserLanguages(actor) {
            let known_languages = new Set();
            let literate_languages = new Set();
			//console.log(actor.data.items);
			known_languages.add("common");
            for (let [i,lang] of actor.data.items.entries()){
                if(lang.type == "language") known_languages.add(lang.name);
			}
            return [known_languages, literate_languages];
        }
    }
    polyglot.registerSystem("shimmeringreach", ShimmeringReachLanguageProvider);
})

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
	if (data.type !== "Item") return;
	if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
	const item = data.data;
	// Create the macro command
	if (item.type == "weapon"){
		const command = `game.shimmeringreach.rollMacro.rollWeaponMacro("${item._id}");`;
		
		let macro = game.macros.contents.find(m => (m.name === item.name) && (m.command === command));
		if (!macro) {
			macro = await Macro.create({
				name: item.name,
				type: "script",
				img: item.img,
				command: command,
				flags: { "shimmeringreach.itemMacro": true }
			});
		game.user.assignHotbarMacro(macro, slot);
		}
	}
	
	return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  return item.roll();
}

function rollWeaponMacro(itemId) {
	const speaker = ChatMessage.getSpeaker();
	let actor;
	if (speaker.token) actor = game.actors.tokens[speaker.token];
	if (!actor) actor = game.actors.get(speaker.actor);
	const item = actor ? actor.items.get(itemId) : null;
	if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item with ID ${itemId}`);

	let dataset = {
		"weapon": item.id	
	}

	if (event.shiftKey){
		customAttackDialog(dataset,actor,{});
	}
	else {
		renderAttackChatData(dataset,actor,{});
	}

}