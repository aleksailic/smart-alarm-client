#!/usr/bin/python
import alsaaudio, time, audioop

card_info={}
for device_number, card_name in enumerate (alsaaudio.cards()):
	card_info[card_name] = "hw:%s,0" % device_number

inp=alsaaudio.PCM(alsaaudio.PCM_CAPTURE,alsaaudio.PCM_NONBLOCK,card_info["Device"])

inp.setchannels(1)
inp.setrate(8000)
inp.setformat(alsaaudio.PCM_FORMAT_S16_LE)
inp.setperiodsize(160)

while True:
	l,data=inp.read()
	if l:
		print audioop.max(data, 2)
		break