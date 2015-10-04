var fs=require('fs');
var py = require('python-shell');
var pb = require('pushbullet');
var gpio = require("pi-gpio");
var urllib = require('urllib');
var PUSHER = new pb('pDr61ZoqkVJ0D5Ze4Sg2xyuUg6cEBwOS');
var SERIAL='D8BS-L3V1-0915';
 
var SERVER="http://192.168.42.23:8080/alarm/board_control.php";
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

function log(message){
        console.log(message);
        var res=urllib.request(SERVER,{
                method:"GET",
                data:{
                        action:'addLog',
                        log:message,
                        serial:SERIAL
                }
        });
}
 
function setup(){
	gpio.open(LED.yellow, "output");
	gpio.open(LED.red, "output");
	gpio.open(LED.green, "output");

	LED.on(LED.red);
    log("SmartAlarm upaljen");  
}
function loop(){
        urllib.request(SERVER,{
                method:"GET",
                data:{
                        action:'getData',
                        serial:SERIAL
                },
                dataType:'json'
        },main);
}
 
function main(err,data,res){
        if( typeof main.counter == 'undefined' || main.counter>10){
                main.counter=0;
        }
        if(typeof data !=='undefined'){
                main.data=data;
        }
        if(main.data.status == 1){
        		LED.on(LED.green); LED.off(LED.red);
                if( typeof main.buffer == 'undefined' )
                        main.buffer=new Array(0,0,0,0,0,0,0,0,0,0);
       
                var getdB=new py('getdB.py',{mode:'text',scriptPath:"/home/pi/alarm/"});
                var startDate = new Date();
       
                getdB.on('message',function(dB){
                        dB=parseInt(dB);
                        main.buffer.shiftpush(dB);
                        main.buffer.print();
       
                        if( main.buffer.sum() > THRESHOLD ){ //beba budna
                                for(var i=0;i<main.data.users.length;i++){ //Send Pushbullet note to every user
                                        log("Beba je budna");
                                        PUSHER.note(main.data.users[i].email,'SmartAlarm Status','BEBA JE BUDNA!');
                                }
                        }else{
                                var stopDate=new Date();
                                var diff=SLEEP-(stopDate-startDate);
                                console.log("SLEEPING " + diff);
 
                                main.counter++;
                                if(main.counter>10){
                                		log('Buffer iznosi: '+JSON.stringify(main.buffer));
                                        diff>0 ? setTimeout(loop,diff) : setTimeout(loop,0);  
                                }else{
                                        diff>0 ? setTimeout(main,diff) : setTimeout(main,0);
                                }
                        }
                });
        }else{
                log("SmartAlarm je neaktivan. Pauza 10sekunde");
                setTimeout(loop,10000);
        }
}
 
setup();
loop();