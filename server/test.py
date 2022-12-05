from flask import Flask
from  splendor import *
from  splendor import GameManager

#Player 2명이 참가하는 게임 생성
GM = GameManager("Aircraft")
GM.join_game()
GM.join_game()
GM.start_game()
game = GM.game

#reset 메소드 테스트
game.reset()


#step 메소드 테스트
#game.step([1,1,0,1,0,0,0])
#game.step([0,0,0,0,0,1,3])

app.run(host='127.0.0.1', port=8000, threaded=True, debug=True)