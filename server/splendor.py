from flask import Flask, Response, request, send_from_directory
from functools import wraps
from player_and_game import *
import signal
import random
import time
import json
import os
import sys

app = Flask(__name__)
game_map = {}
POLL_INTERVAL = 0.4
client_dir = os.path.join(os.getcwd(), 'client')
words = []
num_created = 0

def json_response(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        r = f(*args, **kwargs)
        return Response(json.dumps(r), content_type='application/json; charset=utf-8')
    return decorated_function

class GameManager(object):
    def __init__(self, name):
        global game_map

        self.uuid = name
        self.starter = uuid.uuid4().hex
        game_map[self.uuid] = self
        self.game = Game()
        self.changed = {}
        self.chats = []
        self.ended = {}
        self.created = time.time()
        self.started = False

    def dict(self):
        return {
            'uuid': self.uuid,
            'n_players': self.game.num_players,
            'in_progress': self.game.state != 'pregame',
        }

    def private_dict(self):
       return {
            'uuid': self.uuid,
            'starter': self.starter,
            'game': self.game.private_dict(),
            'changed': self.changed,
            'chats': self.chats,
            'ended': self.ended,
            'created': self.created,
            'started': self.started
        }

    def poll(self, pid):
        global game_map

        while not self.changed[pid]:
            time.sleep(POLL_INTERVAL)
            yield " "

        if self.ended.get(pid):
            del self.ended[pid]
            if not self.ended:
                del game_map[self.uuid]

        self.changed[pid] = False
        yield json.dumps({'state': self.game.dict(pid), 'result': {}, 'chat': self.chats})

    def num_players(self):
        return self.game.num_players

    def chat(self, pid, msg):
        name = self.game.players[pid].name
        self.chats.append({
            'time': time.time(),
            'pid': pid,
            'name': name,
            'msg': msg,
        })
        self.has_changed()
        return {'state': self.game.dict(pid), 'result': {}, 'chat': self.chats}

    def has_changed(self):
        global game_map

        if self.game.state == 'postgame':
            for pid in self.ended:
                self.ended[pid] = True
        for p in self.changed:
            self.changed[p] = True

    def join_game(self):
        if self.game.num_players >= 4:
            return {'error': 'Already at max players'}
        if self.game.state != 'pregame':
            return {'error': 'Game already in progress'}

        pid, uuid = self.game.add_player("Player {}".format(self.game.num_players + 1))
        self.changed[pid] = False
        self.ended[pid] = False
        self.has_changed()

        return {'id': pid, 'uuid': uuid}

    def spectate_game(self):
        pid, uuid = self.game.add_spectator()
        self.changed[pid] = False
        self.has_changed()

        return {'id': pid, 'uuid': uuid}

    def start_game(self):
        if self.game.start_game():
            self.has_changed()
            
            self.started = True
            return {}
        else:
            return {'error': 'Could not start game'}

def game_manager_from_dict(obj):
    self = GameManager(obj['uuid'])
    self.starter = obj['starter']
    self.game = game_from_dict(obj['game'])
    for k, v in obj['changed'].iteritems():
        self.changed[int(k)] = v
    self.chats = obj['chats']
    self.ended = obj['ended']
    self.created = obj['created']
    self.started = obj['started']
    return self

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

@app.route('/create/<game>', methods=['POST'])
@json_response
def create_game(game):
    global num_created

    if game in game_map:
        return {'result': {'error': 'Game already exists, try another name'}}
    new_game = GameManager(game)
    num_created += 1
    return {'game': new_game.uuid, 'start': new_game.starter, 'state': new_game.game.dict()}

@app.route('/join/<game>', methods=['POST'])
@json_response
def join_game(game):
    global game_map
    if game not in game_map:
        return {'error': 'No such game'}
    return game_map[game].join_game()

@app.route('/spectate/<game>', methods=['POST'])
@json_response
def spectate_game(game):
    global game_map
    if game not in game_map:
        return {'error': 'No such game', 'status': 404}
    return game_map[game].spectate_game()

@app.route('/start/<game>/<starter>', methods=['POST'])
@json_response
def start_game(game, starter):
    global game_map
    if game not in game_map:
        return {'error': 'No such game'}
    if game_map[game].starter != starter:
        return {'error': 'Incorrect starter key'}
    return game_map[game].start_game()

@app.route('/suggest', methods=['GET'])
@json_response
def suggest_game():
    global game_map, words
    n = len(words)
    idx = random.choice(range(n))
    start = idx
    while words[idx] in game_map:
        idx = (idx + 1) % n
        if idx == start:
            return {'error': 'No available games'}
    return {'result': {'game': words[idx]}}

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

@app.route('/game/<game>/chat', methods=['POST'])
@json_response
def chat(game):
    pid, game_manager = validate_player(game)
    if game_manager is None:
        return {'error': 'Invalid game / pid / uuid'}
    payload = {}
    if request.data:
        payload = request.get_json(force=True)
    if not payload.get('msg'):
        return {'error': 'Need "msg" parameter'}
    if not isinstance(payload['msg'], str) and not isinstance(payload['msg'], unicode):
        return {'error': 'msg parameter must be string'}
    return game_manager.chat(pid, payload['msg'])

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
    delete_games = []
    for k, v in game_map.iteritems():
        if not v.started and time.time() - v.created > 600:
            delete_games.append(k)
        elif v.started and time.time() - v.created > 24*60*60:
            delete_games.append(k)
    for game in delete_games:
        del game_map[game]
    return {'games': [x.dict() for x in game_map.values()]}

@app.route('/rename/<game>/<name>', methods=['POST'])
@json_response
def rename_player(game, name):
    pid, game_manager = validate_player(game)
    if game_manager is None:
        return {'error': 'Invalid game / pid / uuid'}
    game_manager.game.rename_player(pid, name)
    game_manager.has_changed()
    return {'result': {'status': 'ok'}}

@app.route('/stat/<game>', methods=['GET'])
@json_response
def stat_game(game):
    pid, game_manager = validate_player(game)
    if game_manager is None:
        return {'error': 'Invalid game / pid / uuid', 'status': 404}
    return {'state': game_manager.game.dict(pid), 'chat': game_manager.chats}

@app.route('/poll/<game>', methods=['GET'])
def poll_game(game):
    pid, game = validate_player(game)
    if game is None:
        return Response(json.dumps({'error': 'Invalid game / pid / uuid', 'status': 404}),
                        content_type='application/json',
                        status=404)
    return Response(game.poll(pid), content_type='application/json')

@app.route('/')
def index():
    return static_proxy('index.html')

@app.route('/favicon.ico')
def favicon():
    return static_proxy('favicon.ico')

@app.route('/client/<path:filename>')
def static_proxy(filename):
    return send_from_directory(client_dir, filename)

@app.route('/<game>')
def existing_game(game):
    return static_proxy('index.html')

@app.route('/stats')
@json_response
def get_stats():
    games = game_map.keys()
    num_games = len(games)
    return {'games': games, 'num_games': num_games, 'num_created': num_created}

def save_and_exit(number, frame):
    global game_map

    games = {}
    for k, v in game_map.iteritems():
        games[k] = v.private_dict()
    with open('server/save.json', 'w') as f:
        f.write(json.dumps(games))
    sys.exit()

with open('server/words.txt') as f:
    words = f.read().split('\n')[:-1]
    random.shuffle(words)

try:
    with open('server/save.json') as f:
        save = json.loads(f.read())
        for k, v in save.iteritems():
            game_map[k] = game_manager_from_dict(v)
except IOError:
    pass

#signal.signal(signal.SIGHUP, save_and_exit)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000, threaded=True, debug=True)
