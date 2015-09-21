import requests
import cmd
import argparse
import json
import readline

gid = None
uuid = None
pid = None
start_key = None
server = 'http://localhost:5000'
curr_state = None
card_hash = {}
reverse_hash = {}

def create():
    global gid, start_key
    resp = requests.post(server + '/create')
    gid = resp.json()['game']
    start_key = resp.json()['start']
    handle_resp(resp, False)
    print 'created game {0} with start_key {1}'.format(gid, start_key)

def join(game=None):
    global gid, uuid, pid, start_key
    if game is None:
        game = gid
    else:
        gid = game
    resp = requests.post(server + '/join/{0}'.format(gid))
    j = resp.json()
    uuid = j['uuid']
    pid = j['id']
    print 'joined as player {0}'.format(pid)
    if not start_key:
        poll()

def start():
    resp = requests.post(server + '/start/{0}/{1}'.format(gid, start_key))
    if not resp.json():
        print 'started'
        poll()
    else:
        print resp.json()

def print_card(card):
    print '{0}> ({1})--[{2}] | b:{3} u:{4} w:{5} g:{6} r:{7}'.format(
        reverse_hash[card['uuid']],
        card['color'],
        card['points'],
        card['cost']['b'],
        card['cost']['u'],
        card['cost']['w'],
        card['cost']['g'],
        card['cost']['r']
    )

def print_nobles(nobles):
    print '  << Nobles >>'
    for noble in nobles:
        print '   [{0}] b:{1} u:{2} w:{3} g:{4} r:{5}'.format(
            noble['points'],
            noble['requirement']['b'],
            noble['requirement']['u'],
            noble['requirement']['w'],
            noble['requirement']['g'],
            noble['requirement']['r'],
        )

def print_gems(target):
    print 'Gems <> b:{0} u:{1} w:{2} g:{3} r:{4} *:{5}'.format(
        target['gems'].get('b', '-'),
        target['gems'].get('u', '-'),
        target['gems'].get('w', '-'),
        target['gems'].get('g', '-'),
        target['gems'].get('r', '-'),
        target['gems'].get('*', '-'),
    )

def print_player(player):
    print 'Player {0} :: [{1}]'.format(player['id'], player['score'])
    print '================'
    print_gems(player)
    print 'Cards <> b:{0} u:{1} w:{2} g:{3} r:{4}'.format(
        len(player['cards']['b']),
        len(player['cards']['u']),
        len(player['cards']['w']),
        len(player['cards']['g']),
        len(player['cards']['r']),
    )
    print_nobles(player['nobles'])

def print_state():
    global card_hash, reverse_hash

    if not curr_state:
        return
    card_hash = {}
    reverse_hash = {}
    count = 1

    print 'Gems'
    print '----'
    print_gems(curr_state)
    print ''
    print_nobles(curr_state['nobles'])
    print ''
    for k, v in curr_state['cards'].iteritems():
        print '{0} -> {1} remaining'.format(k, curr_state['decks'][k])
        print '-----------------------'
        for card in v:
            card_hash[count] = card['uuid']
            reverse_hash[card['uuid']] = count
            count += 1
            print_card(card)
        print ''
    for player in curr_state['players'].values():
        print_player(player)

def set_state():
    global curr_state
    resp = requests.get(server + '/poll/{0}?uuid={1}&pid={2}'.format(gid, uuid, pid))
    handle_resp(resp)

def poll():
    while not curr_state or curr_state['turn'] != pid:
        set_state()

def handle_resp(resp, do_poll=True):
    global curr_state

    if 'result' in resp.json():
        if resp.json()['result'].get('error'):
            print resp.json()['result']['error']
            return
        else:
            print resp.json()['result']

    curr_state = resp.json()['state']
    print_state()
    if do_poll:
        poll()

def act(action, target):
    resp = requests.post(server + '/game/{0}/{1}/{2}?uuid={3}&pid={4}'.format(gid, action, target, uuid, pid))
    handle_resp(resp)

def next():
    resp = requests.post(server + '/game/next?uuid={3}&pid={4}'.format(gid, uuid, pid))
    handle_resp(resp)

def list_games():
    resp = requests.get(server + '/list')
    print 'Games:'
    print '------'
    for game in resp.json()['games']:
        active = 'waiting'
        if game['in_progress']:
            active = 'in progress'
        print '{0} -> {1} player(s) | {2}'.format(game['uuid'], game['players'], active)
    print ''

class Client(cmd.Cmd):
    prompt = '> '

    def do_create(self, line):
        """Create a new game"""
        create()

    def do_start(self, line):
        """Starts the created game"""
        start()

    def do_join(self, game):
        """Joins game"""
        if game:
            join(game)
        else:
            join()

    def do_buy(self, card):
        """Buys the specified card"""
        act('buy', card_hash.get(int(card)))

    def do_take(self, color):
        """Takes the specified color"""
        act('take', color)

    def do_reserve(self, card):
        """Reserves the specified card"""
        try:
            act('reserve', card_hash.get(int(card)))
        except Exception:
            act('reserve', card)

    def do_discard(self, color):
        """Discards the specified gem"""
        act('discard', color)


    def do_print(self, line):
        """Prints the current state of the game"""
        print_state()

    def do_EOF(self, line):
        print ''
        return True

    def do_list(self, line):
        """List active games"""
        list_games()

    def do_next(self, line):
        """Pass turn"""
        next()

    def do_resume(self, line):
        """Go back into a game in case it crashes"""
        global gid, uuid, pid

        gid, uuid, pid = line.split(' ')
        pid = int(pid)

if __name__ == "__main__":
    readline.parse_and_bind("bind ^I rl_complete")

    parser = argparse.ArgumentParser(description='Client for splendor server.')
    parser.add_argument('server', type=str, nargs='?', help='server to connect to.', default=server)
    args = parser.parse_args()
    server = args.server

    Client().cmdloop()
