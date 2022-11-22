from flask import Flask
from  splendor import *
from time import sleep

GM = GameManager("Aircraft")
#GM.start_game()
#game = GM.game
#game.reset()

#print(game.decks["level1"])

#sleep(5)
#game.reset()
#print("reset")

#game.start_game()
app.run(host='127.0.0.1', port=8000, threaded=True)