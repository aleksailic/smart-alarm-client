var SERIAL="D8BS-L3V1-0915";
var SERVER="http://smartalarm.net84.net/";
var THRESHOLD=10000;
var PB = require('pushbullet');
var PUSHER = new PB('pDr61ZoqkVJ0D5Ze4Sg2xyuUg6cEBwOS');
var PY = require('python-shell');

function getData(){
	var request = require('urllib-sync').request;
	var res=request(SERVER+'getData.php?serial='+SERIAL);
	var data=JSON.parse(res.data.toString());
	console.log("status: "+data.status);
	return data;
	}
function toggleStatus(){
	var urllib = require('urllib-sync');
	var res=request(SERVER+'isActive.php?serial='+SERIAL);
}

Array.prototype.shiftpush=function(item){
	this.shift();
	this.push(item);
};
Array.prototype.sum=function(){
	var sum=0;
	for(var i=0;i<this.length;i++){
		sum+=this[i];
	}
	return sum;
};
Array.prototype.print=function(){
	var output="";
	for(var i=0;i<this.length;i++){
		output+=this[i];
		i==(this.length-1) ? output+="" : output+=", ";
	}
	console.log("data: "+output+". sum: "+this.sum());
};

function main(){
	if( typeof counter == 'undefined'){
		var counter=0;
		var data=getData();
	}
	if(counter>10){
		data=getData();
		counter=0;
	}
	if(data.status == 1){
		if( typeof buffer == 'undefined' )
			buffer=new Array(0,0,0,0,0,0,0,0,0,0);

		var getdB=new PY('getdB.py',{mode:'text',scriptPath:"/home/pi/"});

		getdB.on('message',function(dB){
			dB=parseInt(dB);
			buffer.shiftpush(dB);
			buffer.print();

			if( buffer.sum() > THRESHOLD ){ //beba budna
				for(var i=0;i<data.users.length;i++){ //Send Pushbullet note to every user
					PUSHER.note(data.users[i].email,'SmartAlarm Status','BEBA JE BUDNA!');
				}
			}else{
				console.log("SLEEPING 500ms");
				counter++;
				setTimeout(main,500);
			}
		});
	}else{
		console.log("SLEEPING 10s");
		setTimeout(main,10000);
	}
}

main(); 