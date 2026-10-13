export class SRCombatant extends Combatant {


	constructor(...args) {
		super(...args);
		if (!(this.getFlag("shimmeringreach","order"))){
			this.setFlag("shimmeringreach", "order",0);
		}
  	}

	get order(){
		return this.getFlag("shimmeringreach","order");;
	}

}