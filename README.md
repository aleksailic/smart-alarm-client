# SmartAlarm client

Ovo je kod koji se izvrsava na klijentu tj. Raspberry Pi-ju. Na isti je postavljena USB zvucna kartica sa mikrofonom, kao i 3 diode na pinove: GPIO. 3, GPIO. 4, GPIO. 5.
Klijent je u konstantnom dosluhu sa serverom i na osnovu komandi koje su prosledjene serveru izvrsava monitoring zvuka, i na osnovu toga izvodi zakljucak da li je beba budna, da bi docnije istu poruku preko PushBullet-a prosledio svim registrovanim korisnicima.