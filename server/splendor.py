from flask import Flask, Response, request, send_from_directory
from functools import wraps
from player_and_game import *
import uuid
import time
import json
import os

app = Flask(__name__)
game_map = {}
POLL_INTERVAL = 2
client_dir = os.path.join(os.path.dirname(os.getcwd()), 'client')

def json_response(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        r = f(*args, **kwargs)
        return Response(json.dumps(r), content_type='application/json; charset=utf-8')
    return decorated_function

class GameManager(object):
    def __init__(self, title):
        global game_map

        self.uuid = uuid.uuid4().hex
        self.starter = uuid.uuid4().hex
        game_map[self.uuid] = self
        self.game = Game()
        self.changed = {}
        self.title = title if title else self.uuid

    def dict(self):
        return {
            'title': self.title,
            'uuid': self.uuid,
            'n_players': self.game.num_players,
            'in_progress': self.game.state != 'pregame',
        }

    def poll(self, pid):
        while not self.changed[pid]:
            time.sleep(POLL_INTERVAL)
            yield " "

        self.changed[pid] = False
        yield json.dumps({'state': self.game.dict(pid), 'result': {}})

    def num_players(self):
        return self.game.num_players

    def has_changed(self):
        for p in self.changed:
            self.changed[p] = True

    def join_game(self, player_name):
        if self.game.num_players >= 4:
            return {'error': 'Already at max players'}
        if self.game.state != 'pregame':
            return {'error': 'Game already in progress'}

        pid, uuid = self.game.add_player(player_name)
        self.changed[pid] = False
        self.has_changed()

        return {'title': self.title, 'id': pid, 'uuid': uuid}

    def spectate_game(self, player_name):
        pid, uuid = self.game.add_spectator(player_name)
        self.changed[pid] = False
        self.has_changed()

        return {'title': self.title, 'id': pid, 'uuid': uuid}

    def start_game(self):
        if self.game.start_game():
            self.has_changed()
            return {}
        else:
            return {'error': 'Could not start game'}

def validate_player(game):
    global game_map

    if game not in game_map:
        return None, None

    pid = request.args.get('pid')
    uuid = request.args.get('uuid')

    try:
        pid = int(pid)
    except ValueError:
        return None, None

    game_manager = game_map[game]
    if pid not in game_manager.game.pids:
        return None, None
    if game_manager.game.players[pid].uuid != uuid:
        return None, None
    return pid, game_manager

@app.route('/create', methods=['POST'])
@json_response
def create_game():
    payload = {}
    if request.data:
        payload = request.get_json(force=True)
    new_game = GameManager(payload.get('title'))
    return {'game': new_game.uuid, 'start': new_game.starter, 'state': new_game.game.dict()}

@app.route('/join/<game>', methods=['POST'])
@json_response
def join_game(game):
    global game_map
    payload = {}
    if request.data:
        payload = request.get_json(force=True)
    if game not in game_map:
        return {'error': 'No such game'}
    return game_map[game].join_game(payload.get('name'))

@app.route('/spectate/<game>', methods=['POST'])
@json_response
def spectate_game(game):
    global game_map
    payload = {}
    if request.data:
        payload = request.get_json(force=True)
    if game not in game_map:
        return {'error': 'No such game'}
    return game_map[game].spectate_game(payload.get('name'))

@app.route('/start/<game>/<starter>', methods=['POST'])
@json_response
def start_game(game, starter):
    global game_map
    if game not in game_map:
        return {'error': 'No such game'}
    if game_map[game].starter != starter:
        return {'error': 'Incorrect starter key'}
    return game_map[game].start_game()

@app.route('/game/<game>/next', methods=['POST'])
@json_response
def next(game):
    pid, game_manager = validate_player(game)
    if game_manager is None:
        return {'error': 'Invalid game / pid / uuid'}
    game = game_manager.game
    if pid != game.active_player_index:
        return {'error': 'Not your turn'}
    result = game.next()
    if result == {}:
        game_manager.has_changed()
    return {'state': game.dict(pid), 'result': result}

@app.route('/game/<game>/<action>/<target>', methods=['POST'])
@json_response
def act(game, action, target):
    pid, game_manager = validate_player(game)
    if game_manager is None:
        return {'error': 'Invalid game / pid / uuid'}
    game = game_manager.game
    if pid != game.active_player_index:
        return {'error': 'Not your turn'}

    if action == 'take':
        result = game.take(target)
    elif action == 'buy':
        result = game.buy(target)
    elif action == 'reserve':
        result = game.reserve(target)
    elif action == 'discard':
        result = game.discard(target)
    elif action == 'noble_visit':
        result = game.noble_visit(target)
    else:
        return {'error': "{0} is not a valid action".format(action)}

    if result == {}:
        game_manager.has_changed()
    return {'state': game.dict(pid), 'result': result}

@app.route('/list', methods=['GET'])
@json_response
def list_games():
    return {'games': [x.dict() for x in game_map.values()]}

@app.route('/stat/<game>', methods=['GET'])
@json_response
def stat_game(game):
    pid, game_manager = validate_player(game)
    if game_manager is None:
        return {'error': 'Invalid game / pid / uuid'}
    return {'state': game_manager.game.dict(pid)}

@app.route('/poll/<game>', methods=['GET'])
def poll_game(game):
    pid, game = validate_player(game)
    if game is None:
        return {'error': 'Invalid game / pid / uuid'}
    return Response(game.poll(pid), content_type='application/json')

@app.route('/')
def index():
    return static_proxy('index.html')

@app.route('/client/<path:filename>')
def static_proxy(filename):
    return send_from_directory(client_dir, filename)

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=80, threaded=True)
