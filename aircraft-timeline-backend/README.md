Beihang Uni Open Experiment 20250621

The disruption including airport closing, aircraft disruption, flight delay.

The recovery method including exchange, replace, delete, add and delay the flight.

Input is a flight schedule with some data and disruption.csv 
Output is a new schedule

disruption.csv explanation

dis: disruption type, 1 for flight delay, 2 for aircraft disruption, 3 for airport closen

dis_time: when we know the disruption happened

ind_dis: if dis = 1: witch flight; dis = 2: witch aircraft; dis = 3: witch airport

dis_value: if dis = 1: delay time (min); dis = 2: none; dis = 3: hhmm-hhmm

use recovery621.py to calculate
