var fs=require('fs'); //Biblioteka za pristup fajlovima
var py = require('python-shell'); //izvrsavanje python skripti unutar node skripte
var pb = require('pushbullet');
var gpio = require("pi-gpio"); //Pristup gpio portovima za kontrolu dioda
var urllib = require('urllib'); //Prosledjivanje zahteva serveru
var PUSHER = new pb('pDr61ZoqkVJ0D5Ze4Sg2xyuUg6cEBwOS'); //Jedinstevni API kljuc za pushbullet
var SERIAL='D8BS-L3V1-0915'; //Jedinstveni serial odredjen SmartAlarm-u
 
var SERVER="http://think.in.rs/board_control.php"; //Putanja servera
var CALIBRATION = 500; //Donja kalibracija
var THRESHOLD=10000; //Gornja kalibracija, ukoliko korisnik nije postavio sensitivity
var STEP=200; //Korak za kalibraciju koji mnozi sensitivity.
var SLEEP=500; //Vremenski interval izmedju svakog uzorka zvuka

//Dodatne funkcije za manipulisanje nizova
Array.prototype.shiftpush=function(item){ //Umece novi element dok stari izbacuje
        this.shift();
        this.push(item);
};
Array.prototype.sum=function(){ //Sabira sve elemente niza
        var sum=0;
        for(var i=0;i<this.length;i++){
                sum+=this[i];
        }
        return sum;
};
Array.prototype.print=function(){ //Stampa niz u komandni panel
        var output="";
        for(var i=0;i<this.length;i++){
                output+=this[i];
                i==(this.length-1) ? output+="" : output+=", ";
        }
        console.log("data: "+output+". sum: "+this.sum());
};

var LED={ //Objekat koji sadrzi funkcije koje manipulisu LED diode povezane na SmartAlarm
	yellow:15,
	red:16,
	green:18,

	blink:{
		isBlinking:[false,false,false],
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
        var res=urllib.request(SERVER,{ //Prosledi serveru poruku za ispis na dashboard terminalu
                method:"GET",
                data:{
                        action:'addLog',
                        log:message,
                        serial:SERIAL
                }
        });
}
 
function setup(){ //Startup funkcija
	LED.on(LED.red);
    log("SmartAlarm upaljen");  
}
function loop(){ //Glavna petlja
        urllib.request(SERVER,{ //Zahtev serveru za podatke o SmartAlarmu
                method:"GET",
                data:{
                        action:'getData',
                        serial:SERIAL
                },
                dataType:'json'
        },main); //Poziva funkciju main
}
 
function main(err,data,res){
        if( typeof main.counter == 'undefined' || main.counter>10){ //Pozivamo glavnu petlju tek na desetoj iteraciji
                main.counter=0;
        }
        if(typeof data !=='undefined'){ //Ukoliko novi podaci nisu prosledjeni, koristi stare
                main.data=data;
        }
        if(main.data.status == 1){ //Ukoliko je SmartAlarm ukljucen kroz dashboard
        		LED.on(LED.green); LED.off(LED.red);
                if( typeof main.buffer == 'undefined' )
                    main.buffer=new Array(0,0,0,0,0,0,0,0,0,0);
                if( typeof main.data.sensitivity !== 'undefined')
       				THRESHOLD=CALIBRATION+main.data.sensitivity*100;
                var getdB=new py('getdB.py',{mode:'text',scriptPath:"/home/pi/alarm/"}); //Skripta koja meri intenzitet zvuka
                var startDate = new Date();

                getdB.on('message',function(dB){
                        dB=parseInt(dB);
                        main.buffer.shiftpush(dB); //Umece novi element dok stari izbacuje
                        main.buffer.print(); //Ispis bafera na komandom panelu SmartAlarm-a za potrebe debagovanja
       
                        if( main.buffer.sum() > THRESHOLD ){
                        	log("Beba je budna");
                            for(var i=0;i<main.data.users.length;i++){ //Posalji PushBullet svakom registrovanom korisniku sa istim serialom
                                PUSHER.note(main.data.users[i].email,'SmartAlarm: ' + main.data.name, 'Beba je budna.');
                            }
                            urllib.request(SERVER,{ //Zahtev serveru za promenu statusa
                            	method:"GET",
                            	data:{
                            		action:'setStatus',
                            		value:'0',
                            		serial: SERIAL
                            	}
                            },function(err,data,res){
                            	if(data.status){ //Uspesno promenjen status
                            		LED.on(LED.red); LED.off(LED.green); //Pali odgovarajuce diode
                            		main.counter = 0; main.buffer = new Array(0,0,0,0,0,0,0,0,0,0); //Resetuj vrednosti
                            		loop(); //Zapocni novu instancu
                            	}else{
                            		log("Doslo je do greske u promeni statusa. SmartAlarm se gasi...");
                            	}
                            });
                        }else{
                            var stopDate=new Date(); 
                            var diff=SLEEP-(stopDate-startDate); //Meri vremenski razmak u izvrsavanju koda zarad vremenski konstantnog uzimanja uzoraka
                            console.log("SLEEPING: " + diff);
 
                            main.counter++;
                            if(main.counter>10){ //Tek na desetoj iteraciji pozivamo glavnu petlju
                            		log('Buffer iznosi: '+ JSON.stringify(main.buffer));
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