var fs=require('fs');
var py = require('python-shell');
var pb = require('pushbullet');
var gpio = require("pi-gpio");
var urllib = require('urllib');
var urllib_sync = require('urllib-sync');
var PUSHER = new pb('pDr61ZoqkVJ0D5Ze4Sg2xyuUg6cEBwOS');
var SERIAL=fs.readFile('serial');

var SERVER="http://smartalarm.net84.net/";
var CALIBRATION = 500;
var THRESHOLD=10000;
var SLEEP=500;

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


var LED={
	yellow:15,
	red:16,
	green:18,

	blink:{
		start:function(pin, time, times){
			if(typeof time=='undefined')
				var time=250;
			LED.blink.isBlinking=true;
			gpio.write(pin, 1);
			setTimeout(function(){
				gpio.write(pin, 0);
				setTimeout(function(){
					if(typeof times=='undefined' && LED.isBlinking==true){		
						LED.blink.call(pin,time);
					}else if(times>0 && LED.isBlinking==true){
						LED.blink.call(pin,time,times-1);
					}
				},time);
			},time);
		},
		stop:function(pin){
			LED.blink.isBlinking=false;
		}
	},
	on:function(pin){
		gpio.write(pin, 1);
	},
	off:function(pin){
		gpio.write(pin, 0);
	}
}

function getData(){
	LED.blink.start(LED.yellow);
	var res=urllib_sync.request(SERVER,{
		method:"GET",
		data:{
			action:'getData',
			serial:SERIAL
		}
	});
	LED.blink.stop(LED.yellow);
	var data=JSON.parse(res.data.toString());
	console.log("status: "+data.status);
	return data;
}
function log(data){
	console.log(data);
	LED.blink.start(LED.yellow);
	var res=urllib.request(SERVER,{
		method:"GET",
		data:{
			action:'addLog',
			log:data,
			serial:SERIAL
		}
	},function(){
		LED.blink.stop(LED.yellow);
	});
}
function toggleStatus(){
	var urllib = require('urllib-sync');
	var res=request(SERVER+'isActive.php?serial='+SERIAL);
}

function main(){
	gpio.open(LED.yellow, "output");
	gpio.open(LED.red, "output");
	gpio.open(LED.green, "output");

	log("SmartAlarm upaljen");
	LED.on(LED.red);

	if( typeof counter == 'undefined' || counter>10){
		var counter=0;
		var data=getData();
	}
	if(data.status == 1){
		LED.on(LED.green); LED.off(LED.red);
		log("SmartAlarm skenira");
		if( typeof buffer == 'undefined' )
			buffer=new Array(0,0,0,0,0,0,0,0,0,0);

		var getdB=new PY('getdB.py',{mode:'text',scriptPath:"/home/pi/"});
		var startDate = new Date();

		getdB.on('message',function(dB){
			dB=parseInt(dB);
			log("Trenutno: "+dB);
			buffer.shiftpush(dB);
			buffer.print();

			if( buffer.sum() > THRESHOLD ){ //beba budna
				for(var i=0;i<data.users.length;i++){ //Send Pushbullet note to every user
					log("Beba je budna");
					PUSHER.note(data.users[i].email,'SmartAlarm Status','BEBA JE BUDNA!');
				}
			}else{
				var stopDate=new Date();
				var diff=SLEEP-(stopDate+startDate);
				counter++;

				diff>0 ? setTimeout(main,diff) : setTimeout(main,0);
				console.log("SLEEPING " + diff);
			}
		});
	}else{
		LED.off(LED.green); LED.on(LED.red);
		console.log("SLEEPING 10s");
		setTimeout(main,10000);
	}
}

main(); 