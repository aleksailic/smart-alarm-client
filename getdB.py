#!/usr/bin/python
import alsaaudio, time, audioop

card_info={}
for device_number, card_name in enumerate (alsaaudio.cards()):
	card_info[card_name] = "hw:%s,0" % device_number

inp=alsaaudio.PCM(alsaaudio.PCM_CAPTURE,alsaaudio.PCM_NONBLOCK,card_info["Device"]) #Selektuj USB zvucnu karticu

inp.setchannels(1) #Mono
inp.setrate(8000) #8000Hz
inp.setformat(alsaaudio.PCM_FORMAT_S16_LE) #16bit
inp.setperiodsize(160)

while True:
	l,data=inp.read()
	if l:
		print audioop.max(data, 2)
		break