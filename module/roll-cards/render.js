import { RollDP } from "../dice-roller/roll.mjs";


async function handleSocket(data){

	console.log("emit captured",data);
	
	if (data.type == "addDefenseMessages" && game.users.current.data.role == 4){
		gmAddDefenseMessages(data.dataset,data.actors,data.messageId,data.options);
	}
	if (data.type == "rerollCombatCard" && game.users.current.data.role == 4){
		gmRerollCombatCard(data.dataset,data.messageId);
	}
	if (data.type == "deleteDefenderMessage" && game.users.current.data.role == 4){
		gmDeleteDefenderMessage(data.dataset,data.messageId);
	}
	if (data.type == "addSoakMessages" && game.users.current.data.role == 4){
		gmAddSoakMessage(data.dataset,data.actors,data.messageId,data.options);
	}
	if (data.type == "confirmDamageApply" && game.users.current.data.role == 4){
		gmConfirmDamageApply(data.dataset,data.messageId,data.dmgSet);
	}
	if (data.type == "undoDamageApply" && game.users.current.data.role == 4){
		gmUndoDamageApply(data.dataset,data.messageId);
	}

	
}

export function registerRenderSocket(){
	//console.log("Registering render.js socket access");
	game.socket.on('system.shimmeringreach',  handleSocket);
	//console.log(a);
}

export async function testEmit(){
	//console.log("testing emit");
	game.socket.emit('system.shimmeringreach', "test");
	//console.log(a);
}

function getAllGMs(){
	let gms = [];
	
	
	Object.entries(game.users.contents).forEach(user => {
		
		console.log(user);
		if (user[1].isGM){
			gms.push(user[1].id);
		}
	});
	return gms;
}

function getMessageFromEvent(event){
		return game.messages.get($(event.currentTarget).parentsUntil('.message').parent()[0].dataset.messageId);
}

export async function customAttackDialog(dataset,actor,options) {
	const template = "systems/shimmeringreach/templates/dialog/attack-dialog.html";
	
	
	//console.log(options);
	let weapon_id = dataset.weapon;
	let weapon = actor.data.items.get(weapon_id);
	
	let localOptions = {
		weapon: weapon,
		actor: actor
	}
	let confirmed = false;
	let d = new Dialog({
		title: "Custom Attack Roll",
		content: await renderTemplate(template,localOptions),
		buttons: {
		roll: {
		icon: '<i class="fas fa-check"></i>',
		label: "Roll",
		callback: () => confirmed = true
		},
		abort: {
		icon: '<i class="fas fa-times"></i>',
		label: "Cancel",
		callback: () => confirmed = false
		}
		},
		default: "abort",
		//render: html => console.log("Register interactivity in the rendered dialog"),
		close: html =>{

			//console.log("This always is logged no matter which option is chosen")
			console.log(html);
			if(confirmed) {
				options.dvMod = parseInt(html.find('[name=dvMod]')[0].value);
				options.dicepoolMod = parseInt(html.find('[name=dicepoolMod]')[0].value);
				let overload = parseInt(html.find('[name=overload]').length > 0 ? html.find('[name=overload]')[0].value : 0);
				let overload_soak = parseInt(html.find('[name=overload_soak]').length > 0 ? html.find('[name=overload_soak]')[0].value : 0);
				let overload_explode = html.find('[name=chk-explode-soak]')[0] ? html.find('[name=chk-explode-soak]')[0].checked : false;
				if (overload > 0){
					renderOverload(actor,overload,overload_soak, overload_explode);
				}
			//console.log('wounds',html.find('[name=chk-wounds]')[0].checked);
				options.wounds = html.find('[name=chk-wounds]')[0].checked;
				options.explode = html.find('[name=chk-explode]')[0].checked;
				
				//console.log(options);
				renderAttackChatData(dataset,actor,options);
			}
		}
	},
	{width: 300});
	d.render(true);
	
}

export async function customDefenseDialog(event,options) {
	const template = "systems/shimmeringreach/templates/dialog/defense-dialog.html";
	
	
	//console.log(options);
	
	
	let dataset = event.currentTarget.dataset;
	let defense_type = dataset.defense;
	let defense_state = dataset.state;
	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);
	let defender_list = getSelectedActors();
	
		
	let confirmed = false;
	let d = new Dialog({
		title: "Custom Defense Roll",
		content: await renderTemplate(template,{"defenders": defender_list}),
		buttons: {
		rollbutton: {
		icon: '<i class="fas fa-check"></i>',
		label: "Roll",
		callback: () => confirmed = true
		},
		abortbutton: {
		icon: '<i class="fas fa-times"></i>',
		label: "Cancel",
		callback: () => confirmed = false
		}
		},
		default: "abortbutton",
		//render: html => console.log("Register interactivity in the rendered dialog"),
		close: html =>{

			//console.log("This always is logged no matter which option is chosen")
			
			if(confirmed) {
				options.dicepoolMod = parseInt(html.find('[name=dicepoolMod]')[0].value);
				
				//console.log('wounds',html.find('[name=chk-wounds]')[0].checked);
				
				options.wounds = html.find('[name=chk-wounds]')[0].checked;
				options.explode = html.find('[name=chk-explode]')[0].checked;
				options.total_defense = html.find('[name=chk-total_defense]')[0].checked;
				
				
				//console.log(options);
				addDefenseMessages(event,options);
			}
		}
	},
	{width: 300});
	d.render(true);
	
}

async function confirmDamageApply(event,dmgSet){
	
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let messageId = event.currentTarget.closest('[data-message-id]').dataset.messageId;
	
	let message = game.messages.get(messageId);
	
	let defenders = message.getFlag("shimmeringreach","defenders");
	if (game.users.current.data.role != 4){
		game.socket.emit('system.shimmeringreach', {type: "confirmDamageApply", dataset: dataset, messageId: messageId, dmgSet: dmgSet})
	}
	else {
		gmConfirmDamageApply(dataset,messageId,dmgSet);
	}
	
	
}

async function gmConfirmDamageApply(dataset,messageId,dmgSet){
	
	
	let message = game.messages.get(messageId);
	
	let defenders = message.getFlag("shimmeringreach","defenders");
	
	Object.entries(defenders).forEach(async function (defender) {
		if ((defender[1].token_id == null && defender[1].actor._id == dataset.actor_id) || (defender[1].token_id == dataset.token_id)){
			defender[1].dmgSet = dmgSet;	
		}
	});
		
	await message.setFlag("shimmeringreach","defenders",null);
	
	await message.setFlag("shimmeringreach","defenders",defenders);
		
	await updateRollcardFlags(message);	
		
}

export async function undoDamageApply(event){
	
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let messageId = event.currentTarget.closest('[data-message-id]').dataset.messageId;
	
	let message = game.messages.get(messageId);
	
	let defenders = message.getFlag("shimmeringreach","defenders");
	if (game.users.current.data.role != 4){
		game.socket.emit('system.shimmeringreach', {type: "undoDamageApply", dataset: dataset, messageId: messageId})
	}
	else {
		gmUndoDamageApply(dataset,messageId);
	}
}

async function gmUndoDamageApply(dataset,messageId){
	
	let message = game.messages.get(messageId);
	
	let defenders = message.getFlag("shimmeringreach","defenders");
	
	Object.entries(defenders).forEach(async function (defender) {
		if ((defender[1].token_id == null && defender[1].actor._id == dataset.actor_id) || (defender[1].token_id == dataset.token_id)){
			let actor = {};
			if (dataset.token_id == ""){
				actor = game.actors.get(dataset.actor_id);
			}
			else {
				actor = game.actors.tokens[dataset.token_id];
			}
			console.log(actor);
	
		
			actor.update({"data.health.value" : actor.data.data.health.value + defender[1].dmgSet.hp,"data.stamina.value" : actor.data.data.stamina.value + defender[1].dmgSet.stam});
			
			delete defender[1].dmgSet;
			console.log(defender[1]);
		}
	});
	await message.setFlag("shimmeringreach","defenders",null);
	
	await message.setFlag("shimmeringreach","defenders",defenders);
		
	await updateRollcardFlags(message);	

}

export async function customSoakDialog(event) {

	const template = "systems/shimmeringreach/templates/dialog/soak-dialog.html";
	
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let actor = {};
	
	if (dataset.token_id == ""){
		actor = game.actors.get(dataset.actor_id);
	}
	else {
		actor = game.actors.tokens[dataset.token_id];
	}
	
	
	
	let actor_info = {
		dv: dataset.dv,
		armor: actor.data.data.abilities.bod,
		hp: actor.data.data.health,
		stam: actor.data.data.stamina,
		reswound: actor.data.data.wound_penalty.resilient_wounds
	}
	
	let options = {};
	let stammiss = (actor_info.stam.max - actor_info.stam.value)%(6+actor_info.reswound);
	let hpmiss = (actor_info.hp.max - actor_info.hp.value)%(6+actor_info.reswound);
	let optimalhp = 0;
	let optimalwounds = 99;
	let currwound = 0;
	for (let i = parseInt(actor_info.dv); i>= Math.max(0,dataset.dv - Math.min(actor_info.armor.value, actor_info.stam.value-1)); i--){
		currwound = Math.floor((i + hpmiss)/(6+actor_info.reswound)) + Math.floor((actor_info.dv - i + stammiss)/(6+actor_info.reswound));
		if (currwound <= optimalwounds){
			optimalwounds = currwound;
			optimalhp = i;
		}
	}
	
	let slide = {
		max: dataset.dv,
		min: Math.max(0,parseInt(dataset.dv) - Math.min(actor_info.armor.value, actor_info.stam.value)),
		value: optimalhp
	}
	
	actor_info.newstam = actor_info.stam.value - (dataset.dv - optimalhp);
	actor_info.newhp = actor_info.hp.value - optimalhp;
	
	let disp = {
		red: optimalhp,
		green: dataset.dv - optimalhp,
		greenwidth1: actor_info.newstam / actor_info.stam.max * 100,
		greenwidth2: (actor_info.stam.value - actor_info.newstam) / actor_info.stam.max * 100,
		redwidth1: actor_info.newhp / actor_info.hp.max * 100,
		redwidth2: (actor_info.hp.value - actor_info.newhp) / actor_info.hp.max * 100
	}
	
	let redwounds = [];
	let greenwounds = [];
	
	let fgw = actor_info.stam.max % (6+actor_info.reswound);
	let frw = actor_info.hp.max % (6+actor_info.reswound);
	
	greenwounds[0] = fgw;
	redwounds[0] = frw;
	
	for( let i = 1; i*(6+actor_info.reswound) + fgw <= actor_info.stam.max; i++){
		greenwounds[i] = (6+actor_info.reswound)
	}
	for( let i = 1; i*(6+actor_info.reswound) + fgw <= actor_info.hp.max; i++){
		redwounds[i] = (6+actor_info.reswound)
	}
	
	
	
	disp.greenwidth3 = 100 - disp.greenwidth1 - disp.greenwidth2;
	disp.redwidth3 = 100 - disp.redwidth1 - disp.redwidth2;
	//console.log("disp",disp);
	
	let local_data = {
		actor: actor,
		slide: slide,
		disp: disp,
		actor_info: actor_info,
		redwounds: redwounds,
		greenwounds: greenwounds
	}
	
	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);
		
	let confirmed = false;
	let d = new Dialog({
		title: "Custom Soak",
		content: await renderTemplate(template, local_data),
		buttons: {
		rollbutton: {
		icon: '<i class="fas fa-check"></i>',
		label: "Apply",
		callback: () => confirmed = true
		},
		abortbutton: {
		icon: '<i class="fas fa-times"></i>',
		label: "Cancel",
		callback: () => confirmed = false
		}
		},
		default: "abortbutton",
		render: html => {
			let red = document.getElementById("myRed");
			let green = document.getElementById("myGreen");
			let slider = document.getElementById("mySlider");
			let soakmod = document.getElementById("soakMod");
			let newhp = document.getElementById("newhp");
			let newstam = document.getElementById("newstam");
			
			let green1 = document.getElementById("green1");
			let green2 = document.getElementById("green2");
			let green3 = document.getElementById("green3");
			
			let red1 = document.getElementById("red1");
			let red2 = document.getElementById("red2");
			let red3 = document.getElementById("red3");
			
			
			
			let mydv = document.getElementById("myDv");
			slider.oninput = function() {
				red2.innerHTML = ( parseInt(this.value) != 0 ? parseInt(this.value) : "");
				red2.style.width = (parseInt(this.value) / actor_info.hp.max)*100 +"%";
				green2.innerHTML =  ( parseInt(this.max) - parseInt(this.value) != 0 ? parseInt(this.max) - parseInt(this.value) : "");
				green2.style.width = (parseInt(this.max) - parseInt(this.value))*100 / actor_info.stam.max + "%";
				
				
				red1.innerHTML = actor_info.hp.value - parseInt(this.value);
				red1.style.width = (actor_info.hp.value - parseInt(this.value))/actor_info.hp.max * 100 +"%";
				
				green1.innerHTML = actor_info.stam.value -parseInt(this.max) + parseInt(this.value);
				green1.style.width = (actor_info.stam.value -parseInt(this.max) + parseInt(this.value))/actor_info.stam.max * 100 + "%";
				
				//red3.style.width = (actor_info.hp.max - actor_info.hp.value) / actor_info.hp.max * 100 + "%";
				//green3.style.width = (actor_info.stam.max - actor_info.stam.value) / actor_info.stam.max * 100 + "%";
			}
			
			soakmod.oninput = function() {
				mydv.innerHTML = actor_info.dv - parseInt(this.value);
				slider.max = Math.max(0,actor_info.dv - parseInt(this.value));
				slider.min = slider.max - Math.min(actor_info.armor.value,actor_info.stam.value);
				//console.log(slider);
				
				
				let optimalhp = 0;
				let optimalwounds = 99;
				let currwound = 0;
				for (let i = parseInt(actor_info.dv) - parseInt(this.value); i>= Math.max(0,dataset.dv - parseInt(this.value) - Math.min(actor_info.armor.value, actor_info.stam.value-1)); i--){
					currwound = Math.floor((i + hpmiss)/(6+actor_info.reswound)) + Math.floor((actor_info.dv - i + stammiss)/(6+actor_info.reswound))
					////console.log("currwound",i,currwound);
					if (currwound <= optimalwounds){
						optimalwounds = currwound;
						optimalhp = i;
					}
				}
				
				slider.value = optimalhp;
				
				red2.innerHTML = ( parseInt(slider.value) != 0 ? parseInt(slider.value) : "");
				red2.style.width = (parseInt(slider.value) / actor_info.hp.max)*100 +"%";
				green2.innerHTML =  ( parseInt(slider.max) - parseInt(slider.value) != 0 ? parseInt(slider.max) - parseInt(slider.value) : "");
				green2.style.width = (parseInt(slider.max) - parseInt(slider.value))*100 / actor_info.stam.max + "%";
				
				
				red1.innerHTML = actor_info.hp.value - parseInt(slider.value);
				red1.style.width = (actor_info.hp.value - parseInt(slider.value))/actor_info.hp.max * 100 +"%";
				
				green1.innerHTML = actor_info.stam.value -parseInt(slider.max) + parseInt(slider.value);
				green1.style.width = (actor_info.stam.value -parseInt(slider.max) + parseInt(slider.value))/actor_info.stam.max * 100 + "%";
			}
		},
		close: html =>{

			//console.log("This always is logged no matter which option is chosen")
			
			if(confirmed) {
				let redbar = document.getElementById("red2").innerHTML;
				let greenbar = document.getElementById("green2").innerHTML;
				options.hp = parseInt(redbar ? redbar : 0);
				options.stam = parseInt(greenbar ? greenbar : 0);
				actor.update({"data.health.value" : actor_info.hp.value - options.hp,"data.stamina.value" : actor_info.stam.value - options.stam});
				
				let dmgSet = {
					hp: options.hp,
					stam: options.stam
				}
				confirmDamageApply(event,dmgSet);
				
				
			}
		}
	},
	{width: 300});
	d.render(true);
	
}

export async function customSkillDialog(dataset,actor,options) {
	const template = "systems/shimmeringreach/templates/dialog/skill-dialog.html";
	
	let title = "";
	
	if (dataset.itemskill){
		title = "Custom " + dataset.label + " Roll";	
	}

	else {
		title = "Custom " + actor.data.data.skills[dataset.label].name + " Roll";
	}
	
	let confirmed = false;
	let d = new Dialog({
		title: title,
		content: await renderTemplate(template,{"actor": actor}),
		buttons: {
		rollbutton: {
		icon: '<i class="fas fa-check"></i>',
		label: "Roll",
		callback: () => confirmed = true
		},
		abortbutton: {
		icon: '<i class="fas fa-times"></i>',
		label: "Cancel",
		callback: () => confirmed = false
		}
		},
		default: "abortbutton",
		//render: html => console.log("Register interactivity in the rendered dialog"),
		close: html =>{

			
			if(confirmed) {
				options.dicepoolMod = parseInt(html.find('[name=dicepoolMod]')[0].value);
				
				////console.log('wounds',html.find('[name=chk-wounds]')[0].checked);
				
				options.wounds = html.find('[name=chk-wounds]')[0].checked;
				options.explode = html.find('[name=chk-explode]')[0].checked;
				options.blind = html.find('[name=chk-blind]')[0].checked;
				
				////console.log(options);
				renderSkillChatData(dataset,actor,options);
			}
		}
	},
	{width: 300});
	d.render(true);
	
}

export async function multiSkillDialog(){
	let actors = [];
	for (let player of game.users.players){
		actors.push(player.character);
	}
	
	
	
    const template = "systems/shimmeringreach/templates/dialog/multiskill-dialog.html";
	
	
	let confirmed = false;
	let d = new Dialog({
		title: "Multi Skill Prompt",
		content: await renderTemplate(template,{"actors": actors,"adude": actors[0]}),
		buttons: {
		rollbutton: {
		icon: '<i class="fas fa-check"></i>',
		label: "Create",
		callback: () => confirmed = true
		},
		abortbutton: {
		icon: '<i class="fas fa-times"></i>',
		label: "Cancel",
		callback: () => confirmed = false
		}
		},
		default: "abortbutton",
		//render: html => console.log("Register interactivity in the rendered dialog"),
		close: async html =>{

			//console.log("This always is logged no matter which option is chosen")
			
			if(confirmed) {
				
				let defenders = [];
				
				let skillname = html.find('[id=challenged_skill]')[0].value;
				let displayname = actors[0].data.data.skills[skillname].name;
				console.log(html.find('[id=challenged_skill]'));
				
				let blind = $('input[type=radio]:checked').val() != "visible";
				
				
				let wounds = html.find('[id=wounds]')[0].checked;
				let explode = html.find('[id=explode]')[0].checked;
				
				if (html.find('[id=preroll]')[0].checked){
					for (let actor of actors){
						let search = "[name=roll_" + actor.name +"]";
						console.log(search,html.find(search)[0].checked);
						
						if(html.find(search)[0].checked){
							console.log("bloop");
							let skillDP = actor.data.data.skills[skillname].dicepool;
							let diceroll = new RollDP( skillDP , actor.data.data, explode, wounds).evaluate({async:false});
							console.log(diceroll);
							let defenderOptions = {
								actor: actor.data,
								diceroll: {...diceroll},
								dicepoolMod: 0,
								display_hits: diceroll._total
							}
							defenders.push(defenderOptions);
						}
					}
				}
				
				let attacker = {
					displayname: displayname,
					type: "multiskill_card",
					template: "systems/shimmeringreach/templates/chat/multi-skill-card.html",
					skillname: skillname,
					blind: blind
				}
				
				
				let multiSkillInfo = {
					attacker: attacker,
					defenders: defenders
				}
				console.log(multiSkillInfo);
				let template2 = "systems/shimmeringreach/templates/chat/multi-skill-card.html";
				let chatData = {
					user: game.user.id,
					content: await renderTemplate(template2, multiSkillInfo),
					flags:{ "shimmeringreach": multiSkillInfo}
				}
				
				if ($('input[type=radio]:checked').val() == "secret"){
					chatData.blind = true;
					chatData.whisper = getAllGMs();
				}
				
				console.log(multiSkillInfo);
				let msg = await ChatMessage.create(chatData);
				console.log(msg);
			}
		}
	},
	{width: 300});
	d.render(true);
	
	
	
	
	
	
}

export async function simpleDrain(event) {

	const template = "systems/shimmeringreach/templates/dialog/soak-dialog.html";
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let actor = {};

	if (dataset.token_id == "" || !(dataset.token_id)){
		actor = game.actors.get(dataset.actor_id);
	}
	else {
		actor = game.actors.tokens[dataset.token_id];
	}

	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);



	if (actor.permission == 3) {


		let dv = dataset.drain;
		let hp = actor.data.data.health.value;
		let mp = actor.data.data.mana.value;

		let newmp = Math.max(0,mp-dv);
		let newhp = hp - Math.max(0,dv-mp);

	//console.log(dv,hp,mp,newmp,newhp);


		await actor.update({"data.health.value" : newhp, "data.mana.value" : newmp});
	}
	else {
		ui.notifications.warn("You do not have permission to soak for this actor.");
	}

}

async function renderOverload(actor, overload, overload_soak, overload_explode){
	const template = "systems/shimmeringreach/templates/chat/drain-card.html";

	let newdp = (actor.data.data.drainres.value + (overload_soak ? overload_soak : 0));
	let displayname = "Drain Soak";
	let skillname = "Drain Soak";

	let diceroll = new RollDP( newdp, actor.data.data, overload_explode, true).evaluate();

	////console.log("actor",options.actor);
	let content = {
		actor: actor.data,
		displayname: displayname,
		diceroll: diceroll,
		dicepoolMod: overload_soak,
		display_hits: diceroll._total,
		overload: overload,
		overload_applied: Math.max(overload - diceroll._total,0)
	}

	if(actor.token){
		content.token_id = actor.token.id;
	}

	let chatData = {
		user: game.user.id,
		content: await renderTemplate(template,content),
		flags:{ "shimmeringreach": content}
	}

	let msg = ChatMessage.create(chatData);
	////console.log("msg",msg);

}

export async function simpleSoak(event) {

	const template = "systems/shimmeringreach/templates/dialog/soak-dialog.html";
		
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	console.log(dataset);
	let actor = {};
	if (dataset.token_id == ""){
		actor = game.actors.get(dataset.actor_id);
	}
	else {
		actor = game.actors.tokens[dataset.token_id];
	}
		
	
	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);
	console.log(message);
//console.log(dataset)
//console.log(actor)
	if (actor.permission == 3) {
		
		
		let actor_info = {
			dv: dataset.dv,
			armor: actor.data.data.abilities.bod,
			hp: actor.data.data.health,
			stam: actor.data.data.stamina,
			reswound: actor.data.data.wound_penalty.resilient_wounds
		}
		
		let stamdmg = Math.max(0,Math.min(actor_info.dv,Math.min(actor_info.armor.value,actor_info.stam.value-1)));
		let hpdmg = dataset.dv - stamdmg;
		
		if (hpdmg >= actor_info.hp.value && actor_info.armor.value >= actor_info.stam.value && actor_info.stam.value > 0){
			stamdmg +=1;
			hpdmg -=1;
		}
		
		
		
		let dmgSet = {
			hp: hpdmg,
			stam: stamdmg
		}
		confirmDamageApply(event,dmgSet);
		
		await actor.update({"data.health.value" : actor_info.hp.value - hpdmg,"data.stamina.value" : actor_info.stam.value - stamdmg});
	}
	else {
		ui.notifications.warn("You do not have permission to soak for this actor.");
	}
			
}

function getSelectedActors() {
	let actor_list = [];
		
		if(canvas.tokens.controlled.length == 0 && game.users.current.data.character)
		{
			let result = game.actors.map(x => x).filter(actor => {
				return actor.data.id == game.users.current.data.character;
			});
			actor_list.push(result);
		}
		else if(canvas.tokens.controlled.length > 0) {
			
			//fix this for tokens that are NOT linked to actors
			Object.entries({...canvas.tokens.controlled}).forEach(token => {
				actor_list.push(token[1].actor);
			});
			////console.log("actor list",actor_list);
			////console.log("Selecting at least one token",);
		}
		else{
			ui.notifications.warn("Select a token to use this function.");
		}
		return actor_list;
}

export async function renderAttackChatData(dataset, actor, options) {

	const template = "systems/shimmeringreach/templates/chat/attack-card.html";
	let weapon_id = dataset.weapon;
	let weapon = actor.data.items.get(weapon_id);

	let newdp = (weapon.data.data.dicepool + (options.dicepoolMod ? options.dicepoolMod : 0))
	let diceroll = new RollDP(newdp, actor.data.data, (options.explode != undefined ? options.explode : false), (options.wounds != undefined ? options.wounds : true))
	await diceroll.evaluate({async: true});
	
	let attacker_info = {
		actor: actor.data,
		weapon: weapon,
		diceroll: {...diceroll},
		dicepoolMod: (options.dicepoolMod ? options.dicepoolMod : 0),
		dvMod: (options.dvMod ? options.dvMod : 0),
		display_dv: weapon.data.data.dv + (options.dvMod ? options.dvMod : 0),
		display_hits: diceroll._total,
		type: "combat_card",
		template: template
	}
	
	let combatInfo = {
		attacker: attacker_info
	}
	
	let chatData = {
		user: game.user.id,
		content: await renderTemplate(template, combatInfo),
		flags:{ "shimmeringreach": combatInfo}
	}
	console.log(combatInfo);
	let msg = ChatMessage.create(chatData);
}

export async function renderSkillChatData(dataset, actor, options){
		/*
		Expects dataset to contain:
			dataset.label
			dataset.itemskill is OPTIONAL but signifies that this is an item skill and should be rolled accordingly
		*/
	
		const template = "systems/shimmeringreach/templates/chat/skill-card.html";

		console.log(getAllGMs());
		let newdp = 0;
		let displayname = "";
		let skillname = "";
		
		if (dataset.itemskill){
			
			newdp = (parseInt(dataset.dicepool) + (options.dicepoolMod ? options.dicepoolMod : 0));
			displayname = dataset.label;
			skillname = $(displayname).replaceAll(' ', '_');
		}
		else {
			newdp = (actor.data.data.skills[dataset.label].dicepool + (options.dicepoolMod ? options.dicepoolMod : 0));
			displayname = actor.data.data.skills[dataset.label].name;
			skillname = dataset.label;
		}
		
		
		let diceroll = new game.shimmeringreach.RollDP( newdp, actor.data.data, (options.explode != undefined ? options.explode : false), (options.wounds != undefined ? options.wounds : true))
		
		await diceroll.evaluate({async: true});
		
		////console.log("actor",options.actor);
		let content = {
			actor: actor.data,
			skillname: dataset.label,
			displayname: displayname,
			diceroll: diceroll,
			dicepoolMod: (options.dicepoolMod ? options.dicepoolMod : 0),
			display_hits: diceroll._total,
			blind: options.blind
		}

		let chatData = {
			user: game.user.id,
			content: await renderTemplate(template, content),
			flags:{ "shimmeringreach": content}
		}
		
		if (options.blind){
			chatData.whisper = getAllGMs();
			chatData.blind = true;
		}
		let msg = ChatMessage.create(chatData);
		////console.log("msg",msg);
}

export async function addDefenseMessages(event,options){
	
	let target = event.currentTarget ? event.currentTarget : event.delegateTarget;
	let dataset = target.dataset;
	dataset.icon =  target.src ? "/modules" + target.src.split("modules")[1] : "";
	let messageId = target.closest('[data-message-id]').dataset.messageId;
	//let message = game.messages.get(target.closest('[data-message-id]').dataset.messageId);
	let actors = {};
	
	if(game.users.current.data.role != 4){
		actors = [game.users.current.data.character];
		//console.log(actors);
		game.socket.emit('system.shimmeringreach', {type: "addDefenseMessages", dataset: dataset, actors: actors, messageId: messageId, options})
		//console.log("you're not a gm!");
	}
	else {
	actors = getSelectedActors();
		//console.log("you are a gm!");
		dataset.gm = true;
		gmAddDefenseMessages(dataset,actors,messageId,options);
	}
	
}

async function gmAddDefenseMessages(dataset,actors,messageId,options){
	
	let sound_folder = game.settings.get("shimmeringreach","miss_sfx_directory");
	console.log(sound_folder);
	
	let defender_list = [];
	if (dataset.gm){
		defender_list = actors;
	}
	else{
		for ( let d of actors ){
			defender_list.push( game.actors.get(d));
		}
	}
	
	
	let message = game.messages.get(messageId);
	
	
	
	let sounds = [];
	let template = "";
	let old_defenders = (message.getFlag("shimmeringreach","defenders") ? message.getFlag("shimmeringreach","defenders") : {});
	let attacker = message.getFlag("shimmeringreach","attacker");
		
	let defenders = [];
	
	if (old_defenders.length !=0){
		Object.entries(old_defenders).forEach(defender => {
			defenders.push(defender[1]);
		});
	}
	
	Object.assign(defenders, old_defenders);
	console.log(dataset.type);
	
	switch(dataset.type){
		
		case "attack-card":
			template = "systems/shimmeringreach/templates/chat/attack-card.html";
			let hue = 0;
			if (dataset.state == "passive"){
				hue = -50
			}
			else{
				hue = 150
			}
			for (let actor of defender_list){
				console.log(actor);
				let present = false;
				Object.entries(old_defenders).forEach(old_actor => {
					console.log(old_actor[1]);
					// If Token already rolled, don't roll
					if (actor.parent && actor.parent.id == old_actor[1].token_id) {
					console.log("skip")
						present = true;
					}
					// Else If Actor already rolled, don't roll
					else if (!(old_actor[1].token_id) && actor.id == old_actor[1].actor._id) {
					console.log("skip2")
						present = true;
					};
					// Necessary to check both actor and token for unlinked token handling (i.e. orc actor sheet with 10 tokens on map)
					// token_id attribute is added to the old_actor[1] object below
				});
				
				if (!present){
					console.log(actor);
					let roll = true;

					
					let defenseDP = actor.data.data.defenses[dataset.defense][dataset.state];
					
					if (dataset.state == "active"){
						let found = false;
						for (let e of actor.data.effects){
							if ((e.data.label == "Total Defense" || (e.data.label == "Active " + dataset.defense) && !(options.total_defense))){
								found = true;
							}
							console.log(e.name, "Active " + dataset.defense);
						}
						
						if (!(found)){
							
							
							for (let c of game.combats.active.combatants){
									console.log(c,actor.token,actor.id,actor.token);
								if ((c.token.id == (actor.token == null ? false : actor.token.id)) || (c.actor.id == actor.id && c.token.id == null)){
									let initcost = options.total_defense ? 10 : 5;
									
									if (c.initiative <=0){
										roll = false;
										console.log("not enough init");
									}
									else {
										c.update({initiative: c.initiative - initcost});
										
										await actor.createEmbeddedDocuments("ActiveEffect", [{
										label: options.total_defense ? "Total Defense" : "Active " + dataset.defense,
										icon: options.total_defense ? "modules/game-icons-net/whitetransparent/white-tower.svg": dataset.icon,
										tint: "#00FFFF",
										origin: actor.uuid,
										"duration.rounds":  1,
										disabled: false
										}]);
									}
								}
							}
							
							
							
							console.log(game.combats.active.combatants);
							
						}
					}

					if (roll){
						let diceroll = new RollDP( defenseDP + (options.dicepoolMod ? options.dicepoolMod : 0), actor.data.data, (options.explode != undefined ? options.explode : false), (options.wounds != undefined ? options.wounds : true)).evaluate({async:false});
						console.log(diceroll);
						
						let defenderOptions = {
							actor: actor.data,
							defense_type: dataset.defense,
							defense_state: dataset.state,
							dicepoolMod: (options.dicepoolMod ? options.dicepoolMod : 0),
							diceroll: {...diceroll},
							icon: dataset.icon,
								hue: hue,
								percentile: diceroll.percentileText 
						};
						
						if(actor.isToken){
							defenderOptions.token_id = actor.token.id;
						}
						defenders.push(defenderOptions);
						
						if (attacker.display_hits > diceroll.result){
							sounds.push(attacker.weapon.data.sound);
						}
						else {
							console.log(dataset.defense);
							switch(dataset.defense){
								case("dodge"):
									sounds.push(sound_folder + "/miss-sfx.mp3");
								break;
								case("block"):
									sounds.push(sound_folder + "/block-sfx.mp3");
								break;
								case("parry"):
									sounds.push(sound_folder + "/parry-sfx.mp3");
								break;
								case("physical"):
									sounds.push(sound_folder + "/physical-sfx.mp3");
								break;
								case("mental"):
									sounds.push(sound_folder + "/mental-sfx.mp3");
								break;
							}
						}
					}
				}
			}
		break;
		
		case "multiskill-card":
		template = "systems/shimmeringreach/templates/chat/multi-skill-card.html";
			for (let actor of defender_list){
				console.log(actor);
				let present = false;
				Object.entries(old_defenders).forEach(old_actor => {
					console.log(old_actor[1]);
					// If Token already rolled, don't roll
					if (actor.parent && actor.parent.id == old_actor[1].token_id) {
					console.log("skip")
						present = true;
					}
					// Else If Actor already rolled, don't roll
					else if (!(old_actor[1].token_id) && actor.id == old_actor[1].actor._id) {
					console.log("skip2")
						present = true;
					};
					// Necessary to check both actor and token for unlinked token handling (i.e. orc actor sheet with 10 tokens on map)
					// token_id attribute is added to the old_actor[1] object below
				});
				
				if (!present){
					console.log(actor);
					let roll = true;

					let skillDP = actor.data.data.skills[dataset.skillname].dicepool;
					
					if (roll){
						let diceroll = new RollDP( skillDP + (options.dicepoolMod ? options.dicepoolMod : 0), actor.data.data, (options.explode != undefined ? options.explode : false), (options.wounds != undefined ? options.wounds : true)).evaluate({async:false});
						console.log(diceroll);
																		
						let defenderOptions = {
							actor: actor.data,
							diceroll: {...diceroll},
							dicepoolMod: (options.dicepoolMod ? options.dicepoolMod : 0),
							display_hits: diceroll._total,
							blind: attacker.blind
						}
						
						if(actor.isToken){
							defenderOptions.token_id = actor.token.id;
						}
						defenders.push(defenderOptions);
					}
				}
			}
			
		
		
		
		break;
	}
	let new_defenders = {};
	
	let i = 0;
	
	Object.entries(defenders).forEach(defender => {
		
		let q = i + "";
		
		new_defenders[q] = defender[1];
		i++;
		
	});
	
	console.log("new defenders",new_defenders);
	
	await message.setFlag("shimmeringreach","defenders",new_defenders);
	
	await updateRollcardFlags(message);
	
	for (let i = 0; i < sounds.length; i++){
		setTimeout(() => { if(sounds[i] != null){AudioHelper.play({src: sounds[i], volume: 0.8, autoplay: true, loop: false}, true)}}, 500*i);
		
		
	}
	
}

async function updateCombatContent(message){
	const combatInfo = 
		{
			attacker: await message.getFlag("shimmeringreach","attacker"),
			defenders: await message.getFlag("shimmeringreach","defenders")
		}
	message.update({"content": await renderTemplate(combatInfo.attacker.template,combatInfo)});
}

async function updateRollcardFlags(message) {
	////console.log("UCF message",message);
	let attacker = message.getFlag("shimmeringreach","attacker");
	let defenders = message.getFlag("shimmeringreach","defenders");
	let combatInfo = {};
	let template = "";
	let d_display_hits = 0;
	let display_hits = 0;
	
	let defender_holder = [];
	let new_defenders = {};
	//console.log(attacker);
	switch(attacker.type){
		case "combat_card":
		
			template = "systems/shimmeringreach/templates/chat/attack-card.html";
			let display_dv = attacker.weapon.data.power + attacker.dvMod + (attacker.actor.data.abilities[attacker.weapon.data.attr] ? attacker.actor.data.abilities[attacker.weapon.data.attr].value : 0);
			console.log(attacker.diceroll);
			display_hits = attacker.diceroll._total + (attacker.reroll ? attacker.reroll._total : 0); //Future proofing for when abilities can add free hits
			console.log("test",display_dv,display_hits);
			attacker.display_dv = display_dv;
			attacker.display_hits = display_hits;
			
			
			
			if (defenders != undefined){
				
				let i = 0;
				
				Object.entries(defenders).forEach(defender => {
					
					console.log(defender);
					d_display_hits = defender[1].diceroll._total + (defender[1].reroll ? defender[1].reroll._total : 0); //Future proofing for when abilities can add free hits
					defender[1].display_hits = d_display_hits;
					
					if ( display_hits > d_display_hits) {
						defender[1].avoided = false;
						defender[1].net_hits = display_hits - d_display_hits;
						const damage = display_hits - d_display_hits + display_dv - defender[1].actor.data.soaks[attacker.weapon.data.soak].value;
						if ( damage > 0){
							defender[1].damage = damage;
						}
						else {
							defender[1].damage = null;
						}
					}
					else{
						defender[1].avoided = true;
						defender[1].net_hits = null;
					}
					
					defender_holder.push(defender[1]);
				});
				
				Object.entries(defender_holder).forEach(defender => {
					let q = i + "";
					new_defenders[q] = defender[1];
					i++;
				});
				////console.log("latest new defenders",new_defenders);
				await message.setFlag("shimmeringreach","defenders",null);
				await message.setFlag("shimmeringreach","defenders",new_defenders);
			}
			
			
			
			message.setFlag("shimmeringreach","attacker", attacker);
			
			
			//await message.update({"data.flags.shimmeringreach.defenders" : new_defenders});
			
			combatInfo = 
				{
					attacker: attacker,
					defenders: defenders
				}
			
		break;
	case "dv_card":
		
		template = "systems/shimmeringreach/templates/chat/nodef-attack-card.html";
		combatInfo = 
				{
					attacker: attacker,
					defenders: defenders
				}
		
		
		
		break;
	
	case "multiskill_card":
		template = "systems/shimmeringreach/templates/chat/multi-skill-card.html"
		
		
			display_hits = attacker.diceroll ? (attacker.diceroll._total + (attacker.reroll ? attacker.reroll._total : 0)) : 0; //Future proofing for when abilities can add free hits
			attacker.display_hits = display_hits;
			
						
			if (defenders != undefined){
				
				let i = 0;
				
				Object.entries(defenders).forEach(defender => {
					console.log(defender);
					d_display_hits = defender[1].diceroll._total + (defender[1].reroll ? defender[1].reroll._total : 0); //Future proofing for when abilities can add free hits
					defender[1].display_hits = d_display_hits;
					
					defender[1].avoided = display_hits > d_display_hits
					defender[1].net_hits = display_hits - d_display_hits;
					
					defender_holder.push(defender[1]);
				});
				
				Object.entries(defender_holder).forEach(defender => {
					let q = i + "";
					new_defenders[q] = defender[1];
					i++;
				});
				////console.log("latest new defenders",new_defenders);
				await message.setFlag("shimmeringreach","defenders",null);
				await message.setFlag("shimmeringreach","defenders",new_defenders);
			}
			
			
			
			message.setFlag("shimmeringreach","attacker", attacker);
		
		combatInfo = 
			{
				attacker: attacker,
				defenders: defenders
			}
		break;
	
	default:
			console.log("Error: Unhandled chat card type");
		return;
	}
    //console.log(combatInfo);
	
					
	await message.update({"content": await renderTemplate(attacker.template,combatInfo)});
	
}

export function toggleDicerollDisplay(event){
	
	let message = getMessageFromEvent(event);
	if (!((message.data.blind || message.data.flags.shimmeringreach.attacker.blind) && !(game.users.current.isGM))){
		let targets = $(event.currentTarget).parentsUntil('.block').parent().find('.dice-roll-content');
		
		Object.entries(targets).forEach(target => {
			if (!isNaN(target[0])){
				if(target[1].style.display == "flex"){
					target[1].style.display = "none";
				}
				else {
					target[1].style.display = "flex";
				}
			}
		});
	}
}

export async function deleteDefenderMessage(event){
	
	let target = event.currentTarget ? event.currentTarget : event.delegateTarget;
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let messageId = target.closest('[data-message-id]').dataset.messageId;
	
	if(game.users.current.data.role != 4){
		game.socket.emit('system.shimmeringreach', {type: "deleteDefenderMessage", dataset: dataset, messageId: messageId})
	//console.log("you're not a gm!");
	//console.log(dataset);
	}
	else {
	//console.log("you are a gm!");
		dataset.gm = true;
		gmDeleteDefenderMessage(dataset,messageId);
	}
	
}

async function gmDeleteDefenderMessage(dataset,messageId){
	////console.log(event);
	////console.log(event.currentTarget.dataset);
	////console.log($(event.currentTarget));
		let message = game.messages.get(messageId);
		
		//console.log(dataset);
		//console.log(messageId);
		//console.log(message);
		
		let defenders = [];
		const old_defenders = message.getFlag("shimmeringreach","defenders");
	//console.log("dataset",dataset);
		Object.entries(old_defenders).forEach(defender => {
			//console.log(defender[1]);
			
				////console.log(defender[1].hasOwnProperty('token_id'));
			
			if (defender[1].hasOwnProperty('token_id')){
				if (defender[1].token_id != dataset.token_id){
					defenders.push(defender[1]);
				}
			}
			else {
				if (defender[1].actor._id != dataset.actor_id){
					defenders.push(defender[1]);
				}
			}
			
		});
		
		let new_defenders = {};
		
		let i = 0;
		
		Object.entries(defenders).forEach(defender => {
			
			let q = i + "";
			
			new_defenders[q] = defender[1];
			i++;
			
		});
		
		await message.setFlag("shimmeringreach","defenders",null);
		
		await message.setFlag("shimmeringreach","defenders",new_defenders);
		
		await updateCombatContent(message);
	
}

export async function rerollChatCard(event){
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);
	
	if(message.getFlag("shimmeringreach","attacker")){
		rerollCombatCard(event);
	}
	else if(message.getFlag("shimmeringreach","skillname")){
		rerollSkillCard(event);
	}
	else if(message.getFlag("shimmeringreach","overload")){
		rerollDrainCard(event);
	}
}

async function rerollCombatCard(event){
	
	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let messageId = event.currentTarget.closest('[data-message-id]').dataset.messageId;
	
	let message = game.messages.get(messageId);
	
	let defenders = message.getFlag("shimmeringreach","defenders");
	let attacker = message.getFlag("shimmeringreach","attacker");
	//console.log(dataset);
	if (game.users.current.data.role != 4){
		if (!(game.users.current.data.character == dataset.actor_id)){
			ui.notifications.warn("You do not have permission to reroll this actor.");
			return
		}
			let rr = true;
			if(dataset.hasOwnProperty('attacker')){
				if (attacker.hasOwnProperty('reroll')){
					ui.notifications.warn("This reroll has already been used.");
					rr = false;
				}
			}
			else if (!dataset.hasOwnProperty('attacker')){
				Object.entries(defenders).forEach(async function (defender) {
					if ((defender[1].token_id == null && defender[1].actor.id == dataset.actor_id) || (defender[1].token_id == dataset.token_id)){
							
						if (defender[1].hasOwnProperty('reroll')){
							ui.notifications.warn("This reroll has already been used.");
							rr = false;
						}
					}
				});	
			}
			if (rr){
				game.socket.emit('system.shimmeringreach', {type: "rerollCombatCard", dataset: dataset, messageId: messageId})
			}
	}
	else {
		gmRerollCombatCard(dataset,messageId);
	}
	
	
}
	
async function gmRerollCombatCard(dataset,messageId){

	let message = game.messages.get(messageId);
	
	let defenders = message.getFlag("shimmeringreach","defenders");
	let attacker = message.getFlag("shimmeringreach","attacker");
	
	////console.log(dataset);
	let new_defenders = [];
	let i = 0;
	if(dataset.hasOwnProperty('attacker')){
		if (!attacker.hasOwnProperty('reroll')){
			console.log(attacker.diceroll);
			let dicepool = attacker.diceroll.terms[0].number - attacker.diceroll._total;
			let reroll = new RollDP( dicepool, attacker.actor, false, false).evaluate();
			
			console.log("test1",dicepool,reroll);
			
			
			const fullreroll = {...reroll};
			console.log("fullreroll",fullreroll);
			await message.update({"flags.shimmeringreach.attacker.reroll": fullreroll});
		}
		else {
			ui.notifications.warn("This reroll has already been used.");
		}
	}
	else if (!dataset.hasOwnProperty('attacker')){
		Object.entries(defenders).forEach(async function (defender) {
				
				
			if ((defender[1].token_id == null && defender[1].actor._id == dataset.actor_id) || (defender[1].token_id == dataset.token_id)){
					
				if (!defender[1].hasOwnProperty('reroll')){
					////console.log('rerolling defender');
					let dicepool = defender[1].diceroll.terms[0].number - defender[1].diceroll._total ;
					console.log(dicepool);
					console.log(defender);
					//////console.log(dicepool);
					
					let reroll = new RollDP( dicepool, defender[1].actor, false, false).evaluate();
					console.log(reroll);
					let fullreroll = {...reroll};
					/*
					let fullreroll = {
						class: "RollDP",
						dice: [],
						formula: reroll._formula,
						total: reroll._total,
						results: reroll.results ? reroll.results : reroll.result,
						terms: [{...reroll.terms[0]}]
					};*/
					console.log(fullreroll);
					defender[1].reroll= fullreroll;
					
					let str = "data.flags.shimmeringreach.defenders." + i + ".reroll";
					//////console.log(message);
					//////console.log("full reroll",fullreroll);
					//////console.log("blooperd");
					//await message.update({str : fullreroll});
				}
				else {
					ui.notifications.warn("This reroll has already been used.");
				}
			}
			i++;
		});
		
		//////console.log("defenders",defenders);
		
	await message.setFlag("shimmeringreach","defenders",null);
	
	await message.setFlag("shimmeringreach","defenders",defenders);
		
	}
	await updateRollcardFlags(message);
	
	//await updateCombatContent(message);
	////console.log(message);
}

async function rerollSkillCard(event){
	const template = "systems/shimmeringreach/templates/chat/skill-card.html";

	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);
	
	let old_content = message.data.flags.shimmeringreach;

	if (!old_content.hasOwnProperty('reroll')){
		let dicepool = old_content.diceroll.terms[0].number - old_content.diceroll.total;
		let reroll = new RollDP( dicepool, old_content.actor, false, false).evaluate();

		const fullreroll = {
			class: "RollDP",
			dice: [],
			formula: reroll._formula,
			total: reroll._total,
			results: reroll.results,
			terms: [{...reroll.terms[0]}]
		};

		old_content.reroll = fullreroll;

		old_content.display_hits = old_content.diceroll.total + fullreroll.total;

		await message.update({"flags.shimmeringreach": old_content});
		await message.update({"content": await renderTemplate(template,old_content)});

	}
	else {
		ui.notifications.warn("This reroll has already been used.");
	}
	
	
	
	////console.log(dataset);
	////console.log(message.data.flags.shimmeringreach);
}

async function rerollDrainCard(event){
	const template = "systems/shimmeringreach/templates/chat/drain-card.html";

	let dataset = $(event.currentTarget).parentsUntil('.block').parent()[0].dataset;
	let message = game.messages.get(event.currentTarget.closest('[data-message-id]').dataset.messageId);
	let old_content = message.data.flags.shimmeringreach;
	
	if (!old_content.hasOwnProperty('reroll')){
		let dicepool = old_content.diceroll.terms[0].number - old_content.diceroll.total;
		let reroll = new RollDP( dicepool, old_content.actor, false, false).evaluate();
		
		const fullreroll = {
			class: "RollDP",
			dice: [],
			formula: reroll._formula,
			total: reroll._total,
			results: reroll.results,
			terms: [{...reroll.terms[0]}]
		};
		
		old_content.reroll = fullreroll;
		
		old_content.display_hits = old_content.diceroll.total + fullreroll.total;
		old_content.overload_applied = Math.max(old_content.overload_applied - fullreroll.total,0);
		
		await message.update({"flags.shimmeringreach": old_content});
		await message.update({"content": await renderTemplate(template,old_content)});
		
	}
	else {
		ui.notifications.warn("This reroll has already been used.");
	}
	
}

export async function customDvDialog(){
	const template = "systems/shimmeringreach/templates/dialog/nodef-attack-dialog.html";
	
	let title = "Custom no defense DV";	
	
	let confirmed = false;
	let d = new Dialog({
		title: title,
		content: await renderTemplate(template,{}),
		buttons: {
		rollbutton: {
		icon: '<i class="fas fa-check"></i>',
		label: "Create",
		callback: () => confirmed = true
		},
		abortbutton: {
		icon: '<i class="fas fa-times"></i>',
		label: "Cancel",
		callback: () => confirmed = false
		}
		},
		default: "abortbutton",
		//render: html => console.log("Register interactivity in the rendered dialog"),
		close: html =>{

			
			if(confirmed) {
				let title = html.find('[name=displayname]')[0].value;
				let dv = parseInt(html.find('[name=dvMod]').length > 0 ? html.find('[name=dvMod]')[0].value : 0);
				var soakType = $('input[type=radio]:checked').val();
				
				console.log(title);
				console.log(dv);
				let dataset = {
					
					title: title,
					dv: dv,
					soakType: soakType
				};
				
				
				
				renderDvChatData(dataset,{},{});
			}
		}
	},
	{width: 300});
	d.render(true);
	
}

export async function renderDvChatData(dataset, actor, options){
	const template = "systems/shimmeringreach/templates/chat/nodef-attack-card.html";
	////console.log("actor",options.actor);
	//console.log(actor);
		let damageTypeIcon = "";
		let damageTypeLabel = "";
	switch(dataset.soakType){
		case "armor":
			damageTypeIcon = "/modules/game-icons-net/whitetransparent/heavy-helm.svg";
			damageTypeLabel = "Armor Soak";
		break;
		case "physical":
			damageTypeIcon = "/modules/game-icons-net/whitetransparent/abdominal-armor.svg";
			damageTypeLabel = "Physical Soak";
		break;
		case "mental":
			damageTypeIcon = "/modules/game-icons-net/whitetransparent/brain.svg";
			damageTypeLabel = "Mental Soak";
		break;
	}
	
	
	let attacker_info = {
		actor: actor,
		displayname: dataset.title,
		weapon: dataset.weapon,
		display_dv: dataset.dv,
		type: "dv_card",
		damageTypeIcon: damageTypeIcon,
		damageTypeLabel: damageTypeLabel,
		soak: dataset.soakType,
		template: template
	}
	console.log(attacker_info);
	console.log(dataset);
	let combatInfo = {
		attacker: attacker_info
	}
		
	let chatData = {
		user: game.user.id,
		content: await renderTemplate(template, combatInfo),
		flags:{ "shimmeringreach": combatInfo}
	}
	
	let msg = ChatMessage.create(chatData);
	//console.log("msg", msg);
}

export async function addSoakMessage(event,options){
	let target = event.currentTarget ? event.currentTarget : event.delegateTarget;
	let dataset = target.dataset;
	let messageId = target.closest('[data-message-id]').dataset.messageId;
	let actors = {};
	
	if(game.users.current.data.role != 4){
		actors = [game.users.current.data.character];
		//console.log(actors);
		game.socket.emit('system.shimmeringreach', {type: "addSoakMessages", dataset: dataset, actors: actors, messageId: messageId, options})
		console.log("you're not a gm!");
	}
	else {
	actors = getSelectedActors();
		//console.log("you are a gm!");
		dataset.gm = true;
		gmAddSoakMessage(dataset,actors,messageId,options);
	}
}

async function gmAddSoakMessage(dataset,actors,messageId,options){
	
	console.log("ping");
	
	let defender_list = [];
	if (dataset.gm){
		defender_list = actors;
	}
	else{
		for ( let d of actors ){
			defender_list.push = game.actors.get(d);
		}
	}
//console.log(defender_list);
	
	let message = game.messages.get(messageId);
	console.log("message",message,messageId);
	console.log(game.messages.get(messageId));
	//const template = "systems/shimmeringreach/templates/chat/attack-card.html";
	//console.log(message);
	let old_defenders = (message.getFlag("shimmeringreach","defenders") ? message.getFlag("shimmeringreach","defenders") : {});
	
	let attacker = message.getFlag("shimmeringreach","attacker");
	
	let defenders = [];
	
	if (old_defenders.length !=0){
		Object.entries(old_defenders).forEach(defender => {
			defenders.push(defender[1]);
		});
	}
	
	Object.assign(defenders, old_defenders);
	
	Object.entries(defender_list).forEach(actor => {
		console.log(actor[1]);
		let present = false;
		Object.entries(old_defenders).forEach(old_actor => {
			console.log(old_actor[1]);
			// If Token already rolled, don't roll
			if (actor[1].parent && actor[1].parent.id == old_actor[1].token_id) {
			console.log("skip")
				present = true;
			}
			// Else If Actor already rolled, don't roll
			else if (!(old_actor[1].token_id) && actor[1].id == old_actor[1].actor._id) {
			console.log("skip2")
				present = true;
			};
			// Necessary to check both actor and token for unlinked token handling (i.e. orc actor sheet with 10 tokens on map)
			// token_id attribute is added to the old_actor[1] object below
		});
		
		if (!present){
			console.log(actor);
			
			console.log("test",dataset.icon);
			let defenderOptions = {
				actor: actor[1].data,
				icon: dataset.icon,
				damage: Math.max(attacker.display_dv - actor[1].data.data.soaks[attacker.soak].value,0)
			};
			
			if(actor[1].isToken){
				defenderOptions.token_id = actor[1].token.id;
			}
			defenders.push(defenderOptions);
		}
	});
	
	let new_defenders = {};
	
	let i = 0;
	
	Object.entries(defenders).forEach(defender => {
		
		let q = i + "";
		
		new_defenders[q] = defender[1];
		i++;
		
	});
	
	console.log(new_defenders);
	////console.log("new defenders",new_defenders);
	
	await message.setFlag("shimmeringreach","defenders",new_defenders);
	
	console.log(message);
	await updateRollcardFlags(message);
	
	//await updateCombatContent(options.message);
	////console.log(options.message);
}
