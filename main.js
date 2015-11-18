var py = require('python-shell'); //izvrsavanje python skripti unutar node skripte
var pb = require('pushbullet');
var gpio = require("pi-gpio"); //Pristup gpio portovima za kontrolu dioda
var urllib = require('urllib'); //Prosledjivanje zahteva serveru
var PUSHER = new pb('pDr61ZoqkVJ0D5Ze4Sg2xyuUg6cEBwOS'); //Jedinstevni API kljuc za pushbullet
var SERIAL='D8BS-L3V1-0915'; //Jedinstveni serial odredjen SmartAlarm-u
 
var SERVER="http://think.in.rs/board_control.php"; //Putanja servera
var CALIBRATION = 200; //Donja kalibracija
var THRESHOLD=2000; //Gornja kalibracija, ukoliko korisnik nije postavio sensitivity
var STEP=100; //Korak za kalibraciju koji mnozi sensitivity.
var SLEEP=250; //Vremenski interval izmedju svakog uzorka zvuka
 
//Dodatne funkcije za manipulisanje nizova
Array.prototype.shiftpush=function(item){ //Umece novi element dok stari izbacuje
    this.shift();
    this.push(item);
};
Array.prototype.check=function(num){ //Proverava da li svi elementi buffera prelaze THRESHOLD 
    for(var i=0;i<(this.length-1);i++){
            if(this[i] < num)
                    return false
    }
    return true;
};
Array.prototype.print=function(){ //Stampa niz u komandni panel
    var output="";
    for(var i=0;i<(this.length-1);i++){
            output+=this[i];
            i==(this.length-1) ? output+="" : output+=", ";
    }
    console.log("data: "+output);
};
Array.prototype.max = function (){ //Vraca najveci element niza
    return Math.max.apply(null,this);
};
Array.prototype.isFull = function(){ //Proverava da li je niz popunjen
    for(var i=0;i<(this.length-1);i++){
            if (this[i]== 0)
                    return false;  
    }
    return true;
};
 
var LED={ //Objekat koji sadrzi funkcije koje manipulisu LED diode povezane na SmartAlarm
    yellow:15,
    red:16,
    green:18,
 
    blink:{
        isBlinking:false,
        start:function(pin, time){
            if(typeof time=='undefined')
                var time=100;
            LED.blink.isBlinking=true;
            LED.on(pin);
            setTimeout(function(){
                LED.off(pin);
                setTimeout(function(){
                    if(LED.blink.isBlinking){         
                        LED.blink.start(pin,time);
                    }
                },time);
            },time);
        },
        stop:function(pin){
            LED.blink.isBlinking=false;
        }
    },
    on:function(pin){
        if(typeof pin=='undefined'){
            gpio.write(LED.yellow,1);
            gpio.write(LED.red,1);
            gpio.write(LED.green,1);
        }else{
           gpio.write(pin, 1); 
        } 
    },
    off:function(pin){
        if(typeof pin=='undefined'){
            gpio.write(LED.yellow,0);
            gpio.write(LED.red,0);
            gpio.write(LED.green,0);
        }else{
           gpio.write(pin, 0); 
        }      
    }
}
function log(message){
    console.log(message);
    LED.blink.start(LED.yellow);
    var res=urllib.request(SERVER,{ //Prosledi serveru poruku za ispis na dashboard terminalu
        method:"GET",
        data:{
            action:'addLog',
            log:message,
            serial:SERIAL
        }
    },function(){
        LED.blink.stop(LED.yellow);
    });
}
function setup(){ //Startup funkcija
    gpio.open(LED.red,"output",function(err){
        LED.on(LED.red);
    });
    gpio.open(LED.yellow, "output",function(){
        LED.blink.start(LED.yellow,500);
    });
    gpio.open(LED.green, "output",function(){
        LED.off(LED.green);
    });
    log("SmartAlarm upaljen"); 
    loop();
}
function loop(){ //Glavna petlja
    LED.blink.start(LED.yellow);
    urllib.request(SERVER,{ //Zahtev serveru za podatke o SmartAlarmu
        method:"GET",
        data:{
            action:'getData',
            serial:SERIAL
        },
        dataType:'json'
    },function(err,data,res){
        LED.blink.stop(LED.yellow);
        main(err,data,res);            
    }); //Poziva funkciju main
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
            main.buffer=new Array(0,0,0,0,0);
        if( typeof main.prebuffer == 'undefined')
            main.prebuffer = new Array (0,0,0,0,0);
        if( typeof main.data.sensitivity !== 'undefined')
            THRESHOLD=CALIBRATION+main.data.sensitivity*STEP;

        var getdB=new py('getdB.py',{mode:'text',scriptPath:"/home/pi/alarm/"}); //Skripta koja meri intenzitet zvuka
        var startDate = new Date();
 
        getdB.on('message',function(dB){
            dB=parseInt(dB);
            main.prebuffer.shiftpush(dB); //Umece novi element dok stari izbacuje

            if(main.prebuffer.isFull()){ //Ukoliko je prebuffer pun
                main.buffer.shiftpush(main.prebuffer.max()); //U glavni buffer unosi maksimalnu vrednost prebuffer-a
                main.prebuffer= new Array (0,0,0,0,0); //Resetujemo prebuffer
                log('Buffer iznosi: '+ JSON.stringify(main.buffer));                    
            }
            main.buffer.print(); //Stampa buffer za potrebe debagovanja
            if( main.buffer.check(THRESHOLD) ){
                log("Beba je budna");
                LED.on(LED.red); LED.off(LED.green);
                for(var i=0;i<main.data.users.length;i++){ //Posalji PushBullet svakom registrovanom korisniku sa istim serialom
                    PUSHER.note(main.data.users[i].email,'SmartAlarm: ' + main.data.name, 'Beba je budna.');
                }
                LED.blink.start(LED.yellow);
                urllib.request(SERVER,{ //Zahtev serveru za promenu statusa
                    method:"GET",
                    data:{
                        action:'setStatus',
                        value:'0',
                        serial: SERIAL
                    },
                    dataType:'json'
                },function(err,data,res){
                    LED.blink.stop(LED.yellow);
                    if(data.passed){ //Uspesno promenjen status
                        main.counter = 0; main.buffer = new Array(0,0,0,0,0); //Resetuj vrednosti
                        loop(); //Zapocni novu instancu
                    }else{
                        log("Doslo je do greske u promeni statusa. SmartAlarm se gasi...");
                        LED.off();
                    }
                });
            }else{
                var stopDate=new Date();
                var diff=SLEEP-(stopDate-startDate); //Meri vremenski razmak u izvrsavanju koda zarad vremenski konstantnog uzimanja uzoraka
 
                main.counter++;
                if(main.counter>10){ //Tek na desetoj iteraciji pozivamo glavnu petlju
                    diff>0 ? setTimeout(loop,diff) : setTimeout(loop,0);  
                }else{
                    diff>0 ? setTimeout(main,diff) : setTimeout(main,0);
                }
            }
        });
    }else{
        LED.on(LED.red); LED.off(LED.green);
        log("SmartAlarm je neaktivan. Pauza 10sekunde");
        setTimeout(loop,10000);
    }
}
 
setup();