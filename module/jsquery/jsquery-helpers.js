


export async function findMessageRelatives(message,topLevel,relative) {

	let q = $(message).parentsUntil(topLevel).find(relative);
	//let v = $(q).find(relative);
	
	/*
	Object.entries(v).forEach(k =>{
		
			console.log("a k",typeof(k[1]),k[1].innerHTML);
	});*/
	console.log("jsquery helper",q);

	

}

async function childrenUntil(messages,child,depth) {
	
	
	var result = new jQuery();
	
	
	Object.entries(messages.children()).forEach(message => {
		
		
	
		var thisObject = jQuery(message);
		result.push(thisObject);
		console.log("this object",thisObject);
	});
	
	console.log("all objects",result);
	console.log(result.find(child));
	console.log(messages.find(child));
	
	
	
	
	
	
	
	
	
	
	/*
	if(depth <= 0){
		return;
	}
	else{
		console.log("entered", $(messages));
		console.log("stuff", messages);
		Object.entries(messages).forEach(message => {
			
			
			let kids = $(message).children;
			
			if (kids.length == 0){
				console.log("no kids",kids.length);
				return;
			}
			else if ($(message).children(child).length != 0){
				console.log("found kids");
				return $(message).children(child);
			}
			else {
				console.log("looking for kids",message);
				console.log("kids length",(kids[1] == undefined));
				
				return childrenUntil(message[1],child,depth-1);
			}
		});
	}*/
}