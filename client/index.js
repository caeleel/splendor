'use strict';

(function () {
  $.ajaxSetup({ contentType: 'application/json' });
  var errorTimeout;
  var colors = ['b', 'u', 'w', 'g', 'r'];
  var gemColors = colors.concat(['*']);
  var levelNames = ['level1', 'level2', 'level3'];

  function showError(resp) {
    var msg;
    if (!resp) {
      msg = "Request failed";
      return true;
    } else if (!resp.error && (!resp.result || !resp.result.error)) return false;else msg = resp.error || resp.result.error;

    $('#error-box-inner').text(msg);

    clearTimeout(errorTimeout);
    $('#error-box').show();
    errorTimeout = setTimeout(function () {
      $('#error-box').hide();
    }, 4000);
    return true;
  }

  function mapColors(gems, game, callback, symbol, uuid) {
    return gemColors.map(function (color) {
      var cName = color + "chip";
      if (color == '*') cName = "schip";
      return React.createElement(
        'div',
        { className: "gem " + cName, key: color + "_colors_" + uuid },
        React.createElement(
          'div',
          { className: 'bubble' },
          gems[color]
        ),
        React.createElement(
          'div',
          { className: 'underlay', onClick: callback.bind(game, color) },
          symbol
        )
      );
    });
  }

  function mapNobles(nobles, game) {
    return nobles.map(function (noble) {
      return React.createElement(Noble, { key: noble.uuid, noble: noble, game: game });
    });
  }

  var AvailableGames = React.createClass({
    displayName: 'AvailableGames',

    getInitialState: function getInitialState() {
      return {
        games: []
      };
    },

    componentDidMount: function componentDidMount() {
      var self = this;
      $.get('/list', function (r) {
        self.setState(r);
      });
    },

    join: function join(game) {
      this.props.joinFunc(game, 'join');
    },

    spectate: function spectate(game) {
      this.props.joinFunc(game, 'spectate');
    },

    render: function render() {
      var self = this;
      return React.createElement(
        'div',
        { id: 'games-list' },
        React.createElement(
          'h2',
          null,
          'Available Games'
        ),
        React.createElement(
          'ul',
          null,
          this.state.games.map(function (g) {
            return React.createElement(
              'li',
              { key: g.uuid },
              React.createElement(
                'span',
                {
                  onClick: self.join.bind(self, g.uuid),
                  className: 'game-title'
                },
                g.title
              ),
              React.createElement(
                'span',
                { className: 'game-playerCount' },
                '(',
                g.n_players,
                ' players)'
              ),
              React.createElement(
                'span',
                {
                  onClick: self.spectate.bind(self, g.uuid),
                  className: 'spectate-button'
                },
                '(spectate)'
              )
            );
          })
        )
      );
    }
  });

  var Card = React.createClass({
    displayName: 'Card',

    render: function render() {
      var self = this;
      var card = self.props.card;
      var game = self.props.game;
      var buyer = game.buy.bind(game, card.uuid);;
      var reserver = game.reserve.bind(game, card.uuid);

      if (card.color) {
        return React.createElement(
          'div',
          {
            className: "card card-" + card.color + " card-" + card.level,
            id: card.uuid
          },
          React.createElement(
            'div',
            { className: 'overlay' },
            React.createElement(
              'div',
              { className: 'act buy', onClick: buyer },
              React.createElement(
                'div',
                { className: 'plus' },
                '+'
              )
            ),
            React.createElement(
              'div',
              { className: 'act reserve', onClick: reserver },
              React.createElement('img', { className: 'floppy', src: 'client/img/floppy.png' })
            )
          ),
          React.createElement(
            'div',
            { className: 'underlay' },
            React.createElement(
              'div',
              { className: 'header' },
              React.createElement('div', { className: "color " + card.color + "gem" }),
              React.createElement(
                'div',
                { className: 'points' },
                card.points > 0 && card.points
              )
            ),
            React.createElement(
              'div',
              { className: 'costs' },
              colors.map(function (color) {
                if (card.cost[color] > 0) {
                  return React.createElement(
                    'div',
                    {
                      key: card.uuid + "_cost_" + color,
                      className: "cost " + color
                    },
                    card.cost[color]
                  );
                }
              })
            )
          )
        );
      } else {
        return React.createElement('div', { className: "deck " + card.level });
      }
    }
  });

  var Noble = React.createClass({
    displayName: 'Noble',

    render: function render() {
      var noble = this.props.noble;
      var game = this.props.game;
      var visit = game.noble.bind(game, noble.uuid);

      return React.createElement(
        'div',
        { className: 'noble', onClick: visit, id: noble.uuid },
        React.createElement(
          'div',
          { className: 'side-bar' },
          React.createElement(
            'div',
            { className: 'points' },
            noble.points > 0 && noble.points
          ),
          React.createElement(
            'div',
            { className: 'requirement' },
            colors.map(function (color) {
              if (noble.requirement[color] > 0) {
                return React.createElement(
                  'div',
                  {
                    key: noble.uuid + "_req_" + color,
                    className: "requires " + color
                  },
                  noble.requirement[color]
                );
              }
            })
          )
        )
      );
    }
  });

  var Player = React.createClass({
    displayName: 'Player',

    render: function render() {
      var self = this;
      var game = self.props.game;
      var set = colors.map(function (color) {
        var cards = self.props.cards[color].map(function (card) {
          return React.createElement(
            'div',
            {
              key: self.props.pid + "_card_" + card.uuid,
              className: 'colorSetInner'
            },
            React.createElement(Card, { key: card.uuid, card: card, game: game })
          );
        });
        return React.createElement(
          'div',
          { key: self.props.pid + "_set_" + color, className: 'colorSet' },
          cards,
          React.createElement('div', { className: cards.length > 0 ? "spacer" : "smallspacer" })
        );
      });
      var you = game.props.pid == self.props.pid ? " you" : "";
      var youName = game.props.pid == self.props.pid ? " (you)" : "";
      var gems = mapColors(self.props.gems, game, game.discard, 'X', self.props.pid);
      var reserved = [];
      var reservedCount = 0;
      if (self.props.reserved) {
        reserved = self.props.reserved.map(function (card) {
          return React.createElement(Card, { key: card.uuid + "_inner", card: card, game: game });
        });
        reservedCount = reserved.length;
      } else {
        reservedCount = self.props.nreserved;
      }
      var nobles = mapNobles(self.props.nobles, game);
      return React.createElement(
        'div',
        { className: "player" + you },
        game.state.turn == self.props.pid && React.createElement(
          'div',
          { className: 'turnIndicator' },
          '▶'
        ),
        React.createElement(
          'div',
          { className: 'playerName' },
          self.props.name + youName
        ),
        React.createElement(
          'div',
          { className: 'playerPoints' },
          self.props.points
        ),
        React.createElement('div', { className: 'breaker' }),
        React.createElement(
          'div',
          { className: 'floater' },
          React.createElement(
            'div',
            { className: 'cards' },
            set,
            React.createElement('div', { className: 'breaker' })
          ),
          React.createElement(
            'div',
            { className: 'gems' },
            gems,
            React.createElement('div', { className: 'breaker' })
          ),
          React.createElement(
            'div',
            { className: 'reserveArea' },
            reservedCount > 0 && React.createElement(
              'div',
              null,
              React.createElement(
                'div',
                { className: 'reserveText' },
                'reserved'
              ),
              React.createElement(
                'div',
                { className: 'reserveCards' },
                reserved,
                React.createElement('div', { className: 'breaker' })
              ),
              React.createElement('div', { className: 'breaker' })
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'nobles' },
          nobles
        ),
        React.createElement('div', { className: 'breaker' })
      );
    }
  });

  var Level = React.createClass({
    displayName: 'Level',

    render: function render() {
      var cards = [];
      var self = this;
      var game = self.props.game;
      if (self.props.cards) {
        cards = self.props.cards.map(function (card) {
          return React.createElement(Card, { key: card.uuid, card: card, game: game });
        });
      }

      return React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { className: "deck " + self.props.name },
          React.createElement(
            'div',
            { className: 'remaining' },
            self.props.remaining
          ),
          React.createElement(
            'div',
            { className: 'overlay' },
            React.createElement(
              'div',
              { className: 'act reserve', onClick: game.reserve.bind(game, self.props.name) },
              React.createElement('img', { className: 'floppy', src: 'client/img/floppy.png' })
            )
          )
        ),
        React.createElement(
          'div',
          { className: "c_" + self.props.name },
          React.createElement(
            'div',
            { className: 'cards-inner' },
            cards,
            React.createElement('div', { className: 'breaker' })
          )
        )
      );
    }
  });

  var Game = React.createClass({
    displayName: 'Game',

    getInitialState: function getInitialState() {
      return {
        players: [],
        gems: {},
        cards: {},
        chat: [],
        decks: {},
        nobles: [],
        log: [],
        turn: -1,
        phase: "pregame"
      };
    },

    isMyTurn: function isMyTurn(turn) {
      return turn == this.props.pid;
    },

    updateState: function updateState(r) {
      if (r.state) {
        var myTurn = this.isMyTurn(r.state.turn);
        if (!myTurn) this.setState({ mode: "waiting" });else {
          this.setState({ mode: "normal" });
        }

        this.setState({
          log: r.state.log,
          cards: r.state.cards,
          decks: r.state.decks,
          players: r.state.players,
          gems: r.state.gems,
          nobles: r.state.nobles,
          turn: r.state.turn
        });

        if (r.chat) {
          this.setState({ chat: r.chat });
        }

        var scrollers = $('.scroller');
        scrollers.map(function (scroller) {
          scrollers[scroller].scrollTop = scrollers[scroller].scrollHeight;
        });
      }
    },

    loginArgs: function loginArgs() {
      return '?pid=' + this.props.pid + '&uuid=' + this.props.uuid;
    },

    take: function take(color) {
      this.act('take', color);
    },

    discard: function discard(color) {
      if (confirm("Are you sure you want to discard a gem?")) {
        this.act('discard', color);
      }
    },

    buy: function buy(uuid) {
      this.act('buy', uuid);
    },

    reserve: function reserve(uuid) {
      this.act('reserve', uuid);
    },

    noble: function noble(uuid) {
      this.act('noble_visit', uuid);
    },

    act: function act(action, target) {
      var self = this;
      this.request = $.post('/game/' + this.props.gid + '/' + action + '/' + target + this.loginArgs(), function (resp) {
        if (!showError(resp)) self.updateState(resp);
      });
    },

    nextTurn: function nextTurn() {
      var self = this;
      this.request = $.post('/game/' + this.props.gid + '/next' + this.loginArgs(), function (resp) {
        if (!showError(resp)) self.updateState(resp);
      });
    },

    poll: function poll() {
      var self = this;
      this.request = $.get('/poll/' + this.props.gid + this.loginArgs(), function (resp) {
        if (!showError(resp)) {
          self.updateState(resp);
          self.poll();
        }
      });
    },

    stat: function stat() {
      var self = this;
      $.get('/stat/' + self.props.gid + self.loginArgs(), function (resp) {
        if (!showError(resp)) self.updateState(resp);
      });
    },

    componentDidMount: function componentDidMount() {
      this.stat();
      this.poll();
    },

    componentWillUnmount: function componentWillUnmount() {
      this.request.abort();
    },

    chat: function chat(e) {
      if (e.which == 13) {
        var self = this;
        this.request = $.post('/game/' + this.props.gid + '/chat' + this.loginArgs(), JSON.stringify({ msg: $('#chat-inner').val() }), function (resp) {
          if (!showError(resp)) self.updateState(resp);
        });
        $('#chat-inner').val('');
      }
    },

    render: function render() {
      var self = this;
      var players = self.state.players.map(function (player) {
        return React.createElement(Player, {
          key: player.uuid,
          pid: player.id,
          name: player.name,
          points: player.score,
          game: self,
          cards: player.cards,
          nobles: player.nobles,
          gems: player.gems,
          reserved: player.reserved,
          nreserved: player.n_reserved
        });
      });
      var gems = mapColors(self.state.gems, self, self.take, '+', 'game');
      var nobles = mapNobles(self.state.nobles, self);
      var log = self.state.log.map(function (logLine, i) {
        return React.createElement(
          'div',
          { key: "log-line-" + i, className: 'line' },
          React.createElement(
            'span',
            { className: 'pid' },
            "[" + logLine.pid + "] "
          ),
          React.createElement(
            'span',
            { className: 'msg' },
            logLine.msg
          )
        );
      });
      var chat = self.state.chat.map(function (chatLine, i) {
        return React.createElement(
          'div',
          { key: "chat-line-" + i, className: 'line' },
          React.createElement(
            'span',
            { className: 'name' },
            chatLine.name + ": "
          ),
          React.createElement(
            'span',
            { className: 'msg' },
            chatLine.msg
          )
        );
      });
      var levels = levelNames.map(function (level) {
        return React.createElement(Level, {
          key: level,
          game: self,
          name: level,
          cards: self.state.cards[level],
          remaining: self.state.decks[level]
        });
      });
      return React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { id: 'game-board' },
          React.createElement(
            'div',
            { id: 'common-area' },
            React.createElement(
              'div',
              { id: 'noble-area' },
              nobles,
              React.createElement('div', { className: 'breaker' })
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'div',
                { id: 'level-area' },
                levels
              ),
              React.createElement(
                'div',
                { id: 'gem-area', className: 'you' },
                gems
              ),
              React.createElement('div', { className: 'breaker' })
            )
          ),
          React.createElement(
            'div',
            { id: 'player-area' },
            players
          )
        ),
        React.createElement(
          'div',
          { id: 'log-box' },
          React.createElement(
            'div',
            { className: 'title' },
            '::Log'
          ),
          React.createElement(
            'div',
            { className: 'scroller' },
            log
          )
        ),
        React.createElement(
          'div',
          { id: 'chat-box' },
          React.createElement(
            'div',
            { className: 'title' },
            '::Chat'
          ),
          React.createElement(
            'div',
            { className: 'scroller' },
            chat
          ),
          React.createElement(
            'div',
            { id: 'chat' },
            React.createElement(
              'span',
              { id: 'prompt' },
              '>'
            ),
            React.createElement('input', { id: 'chat-inner', type: 'text', onKeyPress: this.chat })
          )
        ),
        React.createElement(
          'div',
          { id: 'pass-turn', onClick: self.nextTurn },
          'Pass turn'
        ),
        React.createElement(
          'div',
          { id: 'log-toggle' },
          'Press \'L\' to toggle log'
        ),
        React.createElement(
          'div',
          { id: 'chat-toggle' },
          'Press \'C\' to toggle chat'
        ),
        React.createElement(
          'div',
          { id: 'error-box' },
          React.createElement('div', { id: 'error-box-inner' })
        )
      );
    }
  });

  var GameCreator = React.createClass({
    displayName: 'GameCreator',

    join: function join(game, act) {
      if (act === undefined) {
        act = 'join';
      }
      var self = this;
      var session = self.readSession();
      if (session[game]) {
        session[game]['joined'] = true;
        self.setState(session[game]);
        self.save();
        return;
      }
      $.post('/' + act + '/' + game, JSON.stringify({
        name: self.state.userName
      }), function (resp) {
        if (!showError(resp)) {
          self.setState({
            joined: true,
            pid: resp.id,
            uuid: resp.uuid,
            gid: game,
            mode: act,
            title: resp.title,
            name: self.state.userName
          });
          self.save();
        }
      });
    },

    submit: function submit(evt) {
      evt.preventDefault();
      var self = this;
      $.post('/create', JSON.stringify(this.state), function (game) {
        self.join(game.game);
        self.setState({ startKey: game.start });
      });
    },

    readSession: function readSession() {
      var session = window.localStorage.getItem('splendor');
      if (session === null) return {};
      return JSON.parse(session);
    },

    componentDidMount: function componentDidMount() {
      var session = this.readSession();
      if (session['default']) {
        this.setState(session['default']);
      }
    },

    getInitialState: function getInitialState() {
      return {
        title: 'My cool game!',
        joined: false,
        userName: "Joe"
      };
    },

    handleChange: function handleChange(event) {
      this.setState({ title: event.target.value });
    },

    handleName: function handleName(event) {
      this.setState({ userName: event.target.value });
    },

    save: function save() {
      var self = this;
      setTimeout(function () {
        var session = self.readSession();
        session['default'] = self.state;
        session[self.state.gid] = self.state;
        window.localStorage['splendor'] = JSON.stringify(session);
      }, 500);
    },

    leaveGame: function leaveGame() {
      this.setState({ joined: false });
      this.save();
    },

    startGame: function startGame() {
      var self = this;
      $.post('/start/' + this.state.gid + '/' + this.state.startKey, function (resp) {
        if (!showError(resp)) {
          self.setState({ startKey: null });
          self.save();
        }
      });
    },

    render: function render() {
      if (this.state.joined) {
        return React.createElement(
          'div',
          { id: 'game' },
          React.createElement(
            'div',
            { id: 'game-title' },
            React.createElement(
              'span',
              { id: 'game-title-span' },
              this.state.title
            ),
            React.createElement(
              'button',
              { id: 'leave-game', onClick: this.leaveGame },
              'Leave'
            ),
            this.state.startKey && React.createElement(
              'button',
              { id: 'start-game', onClick: this.startGame },
              'Start'
            )
          ),
          React.createElement(Game, { gid: this.state.gid, pid: this.state.pid, uuid: this.state.uuid })
        );
      } else {
        return React.createElement(
          'div',
          { id: 'game-manager' },
          React.createElement(
            'h1',
            { id: 'title' },
            'Splendor!'
          ),
          React.createElement(AvailableGames, { joinFunc: this.join }),
          React.createElement(
            'div',
            { id: 'create-game' },
            React.createElement(
              'div',
              null,
              React.createElement(
                'h2',
                null,
                'Your name'
              ),
              React.createElement('input', {
                type: 'text',
                name: 'my-name',
                value: this.state.userName,
                onChange: this.handleName })
            ),
            React.createElement(
              'h2',
              null,
              'New Game'
            ),
            React.createElement(
              'form',
              { onSubmit: this.submit },
              React.createElement(
                'div',
                null,
                React.createElement('input', {
                  type: 'text',
                  name: 'title',
                  value: this.state.title,
                  onChange: this.handleChange })
              ),
              React.createElement(
                'div',
                null,
                React.createElement('input', { className: 'inputButton', type: 'submit', value: 'Let\'s play!' })
              )
            )
          ),
          React.createElement(
            'div',
            { id: 'error-box' },
            React.createElement('div', { id: 'error-box-inner' })
          )
        );
      }
    }
  });

  $(document).on("keypress", function (e) {
    if ($('#chat-inner').is(':focus')) {
      return;
    } else if (e.which == 108) {
      $("#log-box").toggle();
    } else if (e.which == 99) {
      $("#chat-box").toggle();
    }
  });

  React.render(React.createElement(
    'div',
    null,
    React.createElement(GameCreator, null)
  ), document.getElementById('content'));
})();

