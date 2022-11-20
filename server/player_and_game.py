import random
import uuid
import time

MAX_PLAYERS = 2
COLORS = ('b', 'u', 'w', 'g', 'r')
LEVELS = ('level1', 'level2', 'level3')
COLOR_DICT = {
    'b': 'chocolate',
    'u': 'sapphire',
    'w': 'diamond',
    'g': 'emerald',
    'r': 'ruby',
}

class Player(object):
    def __init__(self, game, id, name=None):
        self.id = id
        self.name = name
        self.game = game
        self.nobles = []
        self.uuid = uuid.uuid4().hex
        self.reserved = []
        self.cards = {
            'b': [],
            'u': [],
            'w': [],
            'g': [],
            'r': [],
        }
        self.gems = {
            'b': 0,
            'u': 0,
            'w': 0,
            'g': 0,
            'r': 0,
            '*': 0,
        }
        self.start_turn()

    def dict(self):
        cards = {}
        for k, v in self.cards.items():
            cards[k] = array_dict(v)
        return {
            'id': self.id,
            'name': self.name,
            'uuid': self.uuid,
            'reserved': array_dict(self.reserved),
            'nobles': array_dict(self.nobles),
            'cards': cards,
            'gems': self.gems,
            'score': self.score(),
        }

    def power(self, color):
        return self.gems[color] + len(self.cards[color])

    def total_gems(self):
        return sum(self.gems.values())

    def score(self):
        result = 0
        for cards in self.cards.values():
            result += sum([c.points for c in cards])
        result += sum([n.points for n in self.nobles])
        return result

    def tiebreak_score(self):
        return self.score()*100 - sum([len(cards) for cards in self.cards.values()])

    def buy(self, uuid):
        if self.acted:
            return {'error': "You've already used your action"}
        if self.taken:
            return {'error': "You've already taken gems, cheater"}
        owed = 0

        card = find_uuid(uuid, self.reserved)
        found_level = None
        if not card:
            for level in LEVELS:
                card = find_uuid(uuid, self.game.cards[level])
                if card:
                    found_level = level
                    break
        if not card:
            return {'error': "No such uuid"}

        for c in COLORS:
            if self.power(c) < card.cost[c]:
                owed += card.cost[c] - self.power(c)
                if owed > self.gems['*']:
                    return {'error': 'Not enough gems'}

        if card in self.reserved:
            self.reserved.remove(card)
        else:
            self.game.cards[found_level].remove(card)

        self.acted = True
        self.gems['*'] -= owed
        self.game.gems['*'] += owed
        payed = []
        if owed:
            payed.append("{0} gold".format(owed))
        for c in COLORS:
            if card.cost[c] > len(self.cards[c]):
                pay = min(card.cost[c] - len(self.cards[c]), self.gems[c])
                if pay > 0:
                    payed.append("{0} {1}".format(pay, COLOR_DICT[c]))
                self.gems[c] -= pay
                self.game.gems[c] += pay
        pay_string = ', '.join(payed)
        if pay_string == '':
            pay_string = 'nothing'
        self.game.log("{0} paid {1} for a {2}".format(self.name, pay_string, card))
        self.cards[card.color].append(card)

        return {}

    def discard(self, color):
        if not self.gems[color]:
            return {'error': "You don't have any of that gem"}
        self.gems[color] -= 1
        self.game.gems[color] += 1
        self.game.log("{0} discarded 1 {1}".format(self.name, COLOR_DICT[color]))
        if color in self.taken:
            self.taken.remove(color)
        return {}

    def reserve(self, uuid):
        if len(self.reserved) > 2:
            return {'error': "Already have 3 cards in reserve"}
        if self.game.gems['*'] > 0:
            if self.total_gems() > 9:
                return {'error': "Return a gem before reserving a card"}
            self.game.gems['*'] -= 1
            self.gems['*'] += 1
        if uuid in LEVELS:
            if not self.game.decks[uuid]:
                return {'error': "No more cards in pile to reserve"}
            self.game.log("{0} reserved a {1} card".format(self.name, uuid))
            self.reserved.append(self.game.decks[uuid].pop())
            return {}

        for level in LEVELS:
            card = find_uuid(uuid, self.game.cards[level])
            if card:
                self.game.log("{0} reserved a {1}".format(self.name, card))
                self.reserved.append(card)
                self.game.cards[level].remove(card)
                return {}
        return {'error': "No such uuid"}

    def take(self, color):
        if self.acted:
            return {'error': "You've already used your action"}
        if color not in COLORS:
            return {'error': "That's not a valid color"}
        if not self.game.gems[color]:
            return {'error': "No gems remaining"}
        if len(self.taken) > 2:
            return {'error': "Cannot take more than 3 gems"}
        if len(self.taken) > 1 and color in self.taken:
            return {'error': "Cannot take the same color on the 3rd gem"}
        if len(self.taken) == 1 and color in self.taken and self.game.gems[color] < 3:
            return {'error': "Cannot take 2 gems from the same pile of less than 4"}
        if self.total_gems() > 9:
            return {'error': "Already have 10 gems"}
        self.game.gems[color] -= 1
        self.gems[color] += 1
        self.taken.append(color)
        self.game.log("{0} took 1 {1}".format(self.name, COLOR_DICT[color]))
        if len(self.taken) == 2 and self.taken[0] == self.taken[1] or len(self.taken) == 3:
            self.acted = True
        return {}

    def noble_visit(self, uuid):
        noble = find_uuid(uuid, self.game.nobles)
        if not noble:
            return {'error': "No such noble"}
        if not self.check_noble(noble):
            return {'error': "Cannot take that noble"}
        if self.visited:
            return {'error': "Cannot accommodate two nobles on the same turn"}
        self.visited = True
        self.nobles.append(noble)
        self.game.nobles.remove(noble)
        self.game.log("{0} was visited by a {1}".format(self.name, noble))
        return {}

    def check_noble(self, noble):
        for c in COLORS:
            if len(self.cards[c]) < noble.requirement[c]:
                return False
        return True

    def check_nobles(self):
        return [noble for noble in self.game.nobles if self.check_noble(noble)]

    def start_turn(self):
        self.taken = []
        self.visited = False
        self.acted = False
        nobles = self.check_nobles()
        if len(nobles) == 1:
            self.noble_visit(nobles[0].uuid)

def player_from_dict(obj, game):
    self = Player(game, obj['id'], obj['name'])
    self.game = game
    self.uuid = obj['uuid']
    self.reserved = [card_from_dict(x) for x in obj['reserved']]
    self.gems = obj['gems']
    for k, v in obj['cards'].iteritems():
        self.cards[k] = [card_from_dict(x) for x in v]
    self.nobles = [noble_from_dict(x) for x in v]
    return self

class DummyPlayer(object):
    def dict(self):
        return {'reserved': []}

    def score(self):
        return 0

    def error_msg(self):
        return {'error': "Game not started or invalid"}

    def buy(self, uuid):
        return self.error_msg()

    def discard(self, color):
        return self.error_msg()

    def reserve(self, uuid):
        return self.error_msg()

    def take(self, color):
        return self.error_msg()

    def noble_visit(self, uuid):
        return self.error_msg()

    def check_nobles(self):
        pass

    def start_turn(self):
        pass

DUMMY_PLAYER = DummyPlayer()

class Card(object):
    def __init__(self, c, p, w=0, u=0, g=0, r=0, b=0):
        self.color = c
        self.level = None
        self.points = p
        self.uuid = uuid.uuid4().hex
        self.cost = {
            'w': w,
            'u': u,
            'g': g,
            'b': b,
            'r': r,
        }

    def __str__(self):
        result = "{0} card worth {1}, costing ".format(COLOR_DICT[self.color], self.points)
        costs = ["{0} {1}".format(v, COLOR_DICT[k]) for k, v in self.cost.iteritems() if v > 0]
        return result + ', '.join(costs)

    def dict(self):
        return {
            'color': self.color,
            'points': self.points,
            'uuid': self.uuid,
            'cost': self.cost,
            'level': self.level,
        }

def card_from_dict(obj):
    self = Card(obj['color'], obj['points'], 0, 0, 0, 0, 0)
    self.level = obj['level']
    self.uuid = obj['uuid']
    self.cost = obj['cost']
    return self

def find_uuid(uuid, cards):
    for card in cards:
        if card.uuid == uuid:
            return card
    return None

def array_dict(cards):
    return [c.dict() for c in cards]

def shuffle_deck(deck):
    n = len(deck)
    for i in range(n):
        j = random.randint(i, n-1)
        x = deck[j]
        deck[j] = deck[i]
        deck[i] = x

class Noble(object):
    def __init__(self, nid, p, w=0, u=0, g=0, r=0, b=0):
        self.points = p
        self.id = nid
        self.uuid = uuid.uuid4().hex
        self.requirement = {
            'w': w,
            'u': u,
            'g': g,
            'r': r,
            'b': b,
        }

    def __str__(self):
        result = "noble worth {0}, seeking ".format(self.points)
        costs = ["{0} {1}".format(v, COLOR_DICT[k]) for k, v in self.requirement.iteritems() if v > 0]
        return result + ', '.join(costs)

    def dict(self):
        return {
            'id': self.id,
            'points': self.points,
            'uuid': self.uuid,
            'requirement': self.requirement,
        }

def noble_from_dict(obj):
    self = Noble(obj['id'], obj['points'], 0, 0, 0, 0, 0)
    self.requirement = obj['requirement']
    self.uuid = obj['uuid']
    return self

class Game(object):
    def __init__(self):
        level_1 = [
            Card('b', 0, 1, 1, 1, 1, 0),
            Card('b', 0, 1, 2, 1, 1, 0),
            Card('b', 0, 2, 2, 0, 1, 0),
            Card('b', 0, 0, 0, 1, 3, 1),
            Card('b', 0, 0, 0, 2, 1, 0),
            Card('b', 0, 2, 0, 2, 0, 0),
            Card('b', 0, 0, 0, 3, 0, 0),
            Card('b', 1, 0, 4, 0, 0, 0),
            Card('u', 0, 1, 0, 1, 1, 1),
            Card('u', 0, 1, 0, 1, 2, 1),
            Card('u', 0, 1, 0, 2, 2, 0),
            Card('u', 0, 0, 1, 3, 1, 0),
            Card('u', 0, 1, 0, 0, 0, 2),
            Card('u', 0, 0, 0, 2, 0, 2),
            Card('u', 0, 0, 0, 0, 0, 3),
            Card('u', 1, 0, 0, 0, 4, 0),
            Card('w', 0, 0, 1, 1, 1, 1),
            Card('w', 0, 0, 1, 2, 1, 1),
            Card('w', 0, 0, 2, 2, 0, 1),
            Card('w', 0, 3, 1, 0, 0, 1),
            Card('w', 0, 0, 0, 0, 2, 1),
            Card('w', 0, 0, 2, 0, 0, 2),
            Card('w', 0, 0, 3, 0, 0, 0),
            Card('w', 1, 0, 0, 4, 0, 0),
            Card('g', 0, 1, 1, 0, 1, 1),
            Card('g', 0, 1, 1, 0, 1, 2),
            Card('g', 0, 0, 1, 0, 2, 2),
            Card('g', 0, 1, 3, 1, 0, 0),
            Card('g', 0, 2, 1, 0, 0, 0),
            Card('g', 0, 0, 2, 0, 2, 0),
            Card('g', 0, 0, 0, 0, 3, 0),
            Card('g', 1, 0, 0, 0, 0, 4),
            Card('r', 0, 1, 1, 1, 0, 1),
            Card('r', 0, 2, 1, 1, 0, 1),
            Card('r', 0, 2, 0, 1, 0, 2),
            Card('r', 0, 1, 0, 0, 1, 3),
            Card('r', 0, 0, 2, 1, 0, 0),
            Card('r', 0, 2, 0, 0, 2, 0),
            Card('r', 0, 3, 0, 0, 0, 0),
            Card('r', 1, 4, 0, 0, 0, 0),
        ]
        level_2 = [
            Card('b', 1, 3, 2, 2, 0, 0),
            Card('b', 1, 3, 0, 3, 0, 2),
            Card('b', 2, 0, 1, 4, 2, 0),
            Card('b', 2, 0, 0, 5, 3, 0),
            Card('b', 2, 5, 0, 0, 0, 0),
            Card('b', 3, 0, 0, 0, 0, 6),
            Card('u', 1, 0, 2, 2, 3, 0),
            Card('u', 1, 0, 2, 3, 0, 3),
            Card('u', 2, 5, 3, 0, 0, 0),
            Card('u', 2, 2, 0, 0, 1, 4),
            Card('u', 2, 0, 5, 0, 0, 0),
            Card('u', 3, 0, 6, 0, 0, 0),
            Card('w', 1, 0, 0, 3, 2, 2),
            Card('w', 1, 2, 3, 0, 3, 0),
            Card('w', 2, 0, 0, 1, 4, 2),
            Card('w', 2, 0, 0, 0, 5, 3),
            Card('w', 2, 0, 0, 0, 5, 0),
            Card('w', 3, 6, 0, 0, 0, 0),
            Card('g', 1, 3, 0, 2, 3, 0),
            Card('g', 1, 2, 3, 0, 0, 2),
            Card('g', 2, 4, 2, 0, 0, 1),
            Card('g', 2, 0, 5, 3, 0, 0),
            Card('g', 2, 0, 0, 5, 0, 0),
            Card('g', 3, 0, 0, 6, 0, 0),
            Card('r', 1, 2, 0, 0, 2, 3),
            Card('r', 1, 0, 3, 0, 2, 3),
            Card('r', 2, 1, 4, 2, 0, 0),
            Card('r', 2, 3, 0, 0, 0, 5),
            Card('r', 2, 0, 0, 0, 0, 5),
            Card('r', 3, 0, 0, 0, 6, 0),
        ]
        level_3 = [
            Card('b', 3, 3, 3, 5, 3, 0),
            Card('b', 4, 0, 0, 0, 7, 0),
            Card('b', 4, 0, 0, 3, 6, 3),
            Card('b', 5, 0, 0, 0, 7, 3),
            Card('u', 3, 3, 0, 3, 3, 5),
            Card('u', 4, 7, 0, 0, 0, 0),
            Card('u', 4, 6, 3, 0, 0, 3),
            Card('u', 5, 7, 3, 0, 0, 0),
            Card('w', 3, 0, 3, 3, 5, 3),
            Card('w', 4, 0, 0, 0, 0, 7),
            Card('w', 4, 3, 0, 0, 3, 6),
            Card('w', 5, 3, 0, 0, 0, 7),
            Card('g', 3, 5, 3, 0, 3, 3),
            Card('g', 4, 0, 7, 0, 0, 0),
            Card('g', 4, 3, 6, 3, 0, 0),
            Card('g', 5, 0, 7, 3, 0, 0),
            Card('r', 3, 3, 5, 3, 0, 3),
            Card('r', 4, 0, 0, 7, 0, 0),
            Card('r', 4, 0, 3, 6, 3, 0),
            Card('r', 5, 0, 0, 7, 3, 0),
        ]
        self.noble_pool = [
            Noble(0, 3, 0, 0, 0, 4, 4),
            Noble(1, 3, 0, 0, 3, 3, 3),
            Noble(2, 3, 0, 4, 4, 0, 0),
            Noble(3, 3, 4, 4, 0, 0, 0),
            Noble(4, 3, 3, 3, 0, 0, 3),
            Noble(5, 3, 0, 0, 4, 4, 0),
            Noble(6, 3, 0, 3, 3, 3, 0),
            Noble(7, 3, 4, 0, 0, 0, 4),
            Noble(8, 3, 3, 3, 3, 0, 0),
            Noble(9, 3, 3, 0, 0, 3, 3),
        ]
        shuffle_deck(self.noble_pool)
        self.nobles = self.noble_pool[:1]

        self.num_players = 0
        self.state = 'pregame'
        self.players = [None] * MAX_PLAYERS
        self.pids = []
        self.logs = []
        self.winner = None
        self.active_player_index = -1
        self.spectator_index = MAX_PLAYERS
        self.is_last_round = False
        self.gems = {'*': 5}
        self.cards = {}
        self.decks = {
            'level1': level_1,
            'level2': level_2,
            'level3': level_3,
        }

        for level in LEVELS:
            self.cards[level] = []
            shuffle_deck(self.decks[level])
            for card in self.decks[level]:
                card.level = level

        self.updated_at = time.time()

    def dict(self, player_id=None):
        if player_id is None:
            player_id = self.active_player_index
        if player_id not in self.pids:
            return {}

        result = {
            'players': [],
            'cards': {},
            'log': self.logs,
            'gems': self.gems,
            'nobles': array_dict(self.nobles),
            'decks': {},
            'winner': self.winner,
            'turn': self.active_player_index,
        }
        for level in LEVELS:
            result['cards'][level] = array_dict(self.cards[level])
            result['decks'][level] = len(self.decks[level])

        players = result['players']
        for player in self.players[:self.num_players]:
            toDict = player.dict()
            if player.id != player_id:
                for reserved in toDict['reserved']:
                    restricted = [k for k in reserved if k not in ('level', 'uuid')]
                    for k in restricted:
                        del reserved[k]
            players.append(toDict)
        return result

    def private_dict(self):
        cards = {}
        decks = {}
        for k, v in self.cards.iteritems():
            cards[k] = array_dict(v)
        for k, v in self.decks.iteritems():
            decks[k] = array_dict(v)

        return {
            'players': [p.dict() if p else None for p in self.players],
            'num_players': self.num_players,
            'cards': cards,
            'pids': self.pids,
            'logs': self.logs,
            'gems': self.gems,
            'nobles': array_dict(self.nobles),
            'decks': decks,
            'winner': self.winner,
            'state': self.state,
            'turn': self.active_player_index,
        }

    def log(self, msg):
        self.logs.append({
            'pid': self.active_player_index,
            'time': int(time.time()),
            'msg': msg,
        })

    def refill(self):
        for level in LEVELS:
            while len(self.cards[level]) < 4 and self.decks[level]:
                self.cards[level].append(self.decks[level].pop())

    def add_player(self, name):
        player = Player(self, self.num_players, name)
        self.pids.append(player.id)
        self.players[player.id] = player
        self.num_players += 1
        self.nobles.append(self.noble_pool[self.num_players])
        if self.num_players == 2:
            for c in COLORS:
                self.gems[c] = 4
        if self.num_players == 3:
            for c in COLORS:
                self.gems[c] = 5
        if self.num_players == 4:
            for c in COLORS:
                self.gems[c] = 7
        return (player.id, player.uuid)

    def rename_player(self, pid, name):
        self.players[pid].name = name

    def add_spectator(self):
        player = Player(self, self.spectator_index, "Player {}".format(self.spectator_index + 1))
        self.pids.append(player.id)
        self.players.append(player)
        self.spectator_index += 1
        return (player.id, player.uuid)

    def start_game(self):
        if self.num_players < 2:
            return False
        self.state = 'game'
        self.next_turn()
        return True

    def active_player(self):
        if self.active_player_index >= 0 and self.active_player_index < self.num_players:
            return self.players[self.active_player_index]
        return DUMMY_PLAYER

    def next_turn(self):
        if self.active_player().score() >= 15:
            self.last_round()
        self.active_player_index = (self.active_player_index + 1) % self.num_players
        if self.is_last_round and self.active_player_index == 0:
            self.state = 'postgame'
            self.winner = self.determine_winner()
            self.active_player_index = -1
        else:
            self.active_player().start_turn()
            self.refill()
        return {}

    def determine_winner(self):
        players = [(p.tiebreak_score(), p.id) for p in self.players[:self.num_players]]
        return sorted(players)[-1][1]

    def last_round(self):
        self.is_last_round = True

    def buy(self, uuid):
        player = self.active_player()
        result = player.buy(uuid)
        if 'error' not in result:
            nobles = player.check_nobles()
            if not nobles:
                self.next_turn()
            elif len(nobles) == 1:
                player.noble_visit(nobles[0].uuid)
                self.next_turn()
            else:
                result['nobles'] = [n.uuid for n in nobles]
        return result

    def take(self, color):
        player = self.active_player()
        result = player.take(color)
        if player.acted and not player.check_nobles():
            self.next_turn()
        return result

    def next(self):
        self.next_turn()
        return {}

    def noble_visit(self, uuid):
        player = self.active_player()
        result = player.noble_visit(uuid)
        if 'error' not in result and player.acted:
            self.next_turn()
        return result

    def discard(self, color):
        return self.active_player().discard(color)

    def reserve(self, uuid):
        result = self.active_player().reserve(uuid)
        if 'error' not in result:
            self.next_turn()
        return result

def game_from_dict(obj):
    self = Game()
    self.logs = obj['logs']
    self.gems = obj['gems']
    self.winner = obj['winner']
    self.pids = obj['pids']
    self.state = obj['state']
    self.active_player_index = obj['turn']
    self.num_players = obj['num_players']
    self.players = [player_from_dict(p, self) if p else None for p in obj['players']]
    for k, v in obj['cards'].iteritems():
        self.cards[k] = [card_from_dict(c) for c in v]
    for k, v in obj['decks'].iteritems():
        self.decks[k] = [card_from_dict(c) for c in v]
    self.nobles = [noble_from_dict(n) for n in obj['nobles']]
    return self

