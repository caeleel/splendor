(function() {
  $.ajaxSetup({contentType: 'application/json'});
  var errorTimeout;
  var colors = ['b', 'u', 'w', 'g', 'r'];
  var gemColors = colors.concat(['*']);
  var levelNames = ['level1', 'level2', 'level3'];

  function showError(resp) {
    var msg;
    if (!resp) {
      msg = "Request failed";
      return true;
    }
    else if (!resp.error && (!resp.result || !resp.result.error)) return false;
    else msg = resp.error || resp.result.error;

    $('#error-box-inner').text(msg);

    clearTimeout(errorTimeout);
    $('#error-box').show();
    errorTimeout = setTimeout(function() {
      $('#error-box').hide();
    }, 4000);
    return true;
  }

  function mapColors(gems, game, callback, symbol, uuid) {
    return gemColors.map(function(color) {
      var cName = color + "chip";
      if (color == '*') cName = "schip";
      return (
        <div className={"gem " + cName} key={color + "_colors_" + uuid}>
          <div className="bubble">{gems[color]}</div>
          <div className="underlay" onClick={callback.bind(game, color)}>{symbol}</div>
        </div>
      );
    });
  }

  function mapNobles(nobles, game) {
    return nobles.map(function(noble) {
      return (
        <Noble key={noble.uuid} noble={noble} game={game}/>
      );
    });
  }

  var AvailableGames = React.createClass({
    getInitialState: function() {
      return {
        games: [],
      };
    },

    componentDidMount: function() {
      var self = this;
      $.get('/list', function(r) { self.setState(r); });
    },

    join: function(game) {
      this.props.joinFunc(game, 'join');
    },

    spectate: function(game) {
      this.props.joinFunc(game, 'spectate');
    },

    render: function() {
      var self = this;
      return (
        <div id="games-list">
          <h2>Available Games</h2>
          <ul>
            {this.state.games.map(function(g) {
              return (
                <li key={g.uuid}>
                  <span
                    onClick   = {self.join.bind(self, g.uuid)}
                    className = "game-title"
                  >
                    {g.title}
                  </span>
                  <span className="game-playerCount">
                    ({g.n_players} players)
                  </span>
                  <span
                    onClick = {self.spectate.bind(self, g.uuid)}
                    className = "spectate-button"
                  >(spectate)</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
  });

  var Card = React.createClass({

    render: function() {
      var self = this;
      var card = self.props.card;
      var game = self.props.game;
      var buyer = game.buy.bind(game, card.uuid);;
      var reserver = game.reserve.bind(game, card.uuid);

      if (card.color) {
        return (
          <div
            className = {"card card-" + card.color + " card-" + card.level}
            id = {card.uuid}
          >
            <div className="overlay">
              <div className="act buy" onClick={buyer}>
                <div className="plus">+</div>
              </div>
              <div className="act reserve" onClick={reserver}>
                <img className="floppy" src="client/img/floppy.png" />
              </div>
            </div>
            <div className="underlay">
              <div className="header">
                <div className={"color " + card.color + "gem"}>
                </div>
                <div className="points">
                  {card.points > 0 && card.points}
                </div>
              </div>
              <div className="costs">
                {colors.map(function(color) {
                  if(card.cost[color] > 0) {
                    return (
                      <div
                        key={card.uuid + "_cost_" + color}
                        className={"cost " + color}
                      >
                        {card.cost[color]}
                      </div>
                    )
                  }
                })}
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div className = {"deck " + card.level}></div>
        );
      }
    }
  });

  var Noble = React.createClass({
    render: function() {
      var noble = this.props.noble;
      var game = this.props.game;
      var visit = game.noble.bind(game, noble.uuid);

      return (
        <div className="noble" onClick={visit} id={noble.uuid}>
          <div className="side-bar">
            <div className="points">
              {noble.points > 0 && noble.points}
            </div>
            <div className="requirement">
              {colors.map(function(color) {
                if(noble.requirement[color] > 0) {
                  return (
                    <div
                      key={noble.uuid + "_req_" + color}
                      className={"requires " + color}
                    >
                      {noble.requirement[color]}
                    </div>
                  )
                }
              })}
            </div>
          </div>
        </div>
      );
    }
  });

  var Player = React.createClass({
    render: function() {
      var self = this;
      var game = self.props.game;
      var set = colors.map(function(color) {
        var cards = self.props.cards[color].map(function (card) {
          return (
            <div
              key={self.props.pid + "_card_" + card.uuid}
              className="colorSetInner"
            >
              <Card key={card.uuid} card={card} game={game}/>
            </div>
          );
        });
        return (
          <div key={self.props.pid + "_set_" + color} className="colorSet">
            {cards}
            <div className={cards.length > 0 ? "spacer" : "smallspacer"}></div>
          </div>
        );
      });
      var you = (game.props.pid == self.props.pid ? " you" : "");
      var youName = (game.props.pid == self.props.pid ? " (you)" : "");
      var gems = mapColors(self.props.gems, game, game.discard, 'X', self.props.pid);
      var reserved = [];
      var reservedCount = 0;
      if (self.props.reserved) {
        reserved = self.props.reserved.map(function(card) {
          return (
            <Card key={card.uuid + "_inner"} card={card} game={game}/>
          );
        });
        reservedCount = reserved.length;
      } else {
        reservedCount = self.props.nreserved;
      }
      var nobles = mapNobles(self.props.nobles, game);
      return (
        <div className={"player" + you}>
          {game.state.turn == self.props.pid &&
            <div className="turnIndicator">&#9654;</div>
          }
          <div className="playerName">{self.props.name + youName}</div>
          <div className="playerPoints">{self.props.points}</div>
          <div className="breaker"></div>
          <div className="floater">
            <div className="cards">
              {set}
              <div className="breaker"></div>
            </div>
            <div className="gems">
              {gems}
              <div className="breaker"></div>
            </div>
            <div className="reserveArea">
              { reservedCount > 0 &&
                <div>
                  <div className="reserveText">
                    reserved
                  </div>
                  <div className="reserveCards">
                    {reserved}
                    <div className="breaker"></div>
                  </div>
                  <div className="breaker"></div>
                </div>
              }
            </div>
          </div>
          <div className="nobles">
            {nobles}
          </div>
          <div className="breaker"></div>
        </div>
      );
    }
  });

  var Level = React.createClass({
    render: function() {
      var cards = [];
      var self = this;
      var game = self.props.game;
      if (self.props.cards) {
        cards = self.props.cards.map(function(card) {
          return (
              <Card key={card.uuid} card={card} game={game}/>
          )
        });
      }

      return (
        <div>
          <div className={"deck " + self.props.name}>
            <div className="remaining">
              {self.props.remaining}
            </div>
            <div className="overlay">
              <div className="act reserve" onClick={game.reserve.bind(game, self.props.name)}>
                <img className="floppy" src="client/img/floppy.png" />
              </div>
            </div>
          </div>
          <div className={"c_" + self.props.name}>
            <div className="cards-inner">
              {cards}
              <div className="breaker"></div>
            </div>
          </div>
        </div>
      );
    }
  });

  var Game = React.createClass({
    getInitialState: function() {
      return {
        players: [],
        gems: {},
        cards: {},
        chat: [],
        decks: {},
        nobles: [],
        log: [],
        turn: -1,
        phase: "pregame",
      };
    },

    isMyTurn: function(turn) {
      return (turn == this.props.pid);
    },

    updateState: function(r) {
      if (r.state) {
        var myTurn = this.isMyTurn(r.state.turn);
        if (!myTurn) this.setState({mode: "waiting"});
        else {
          this.setState({mode: "normal"});
        }

        this.setState({
          log: r.state.log,
          cards: r.state.cards,
          decks: r.state.decks,
          players: r.state.players,
          gems: r.state.gems,
          nobles: r.state.nobles,
          turn: r.state.turn,
        });

        if (r.chat) {
          this.setState({chat: r.chat});
        }

        var scrollers = $('.scroller');
        scrollers.map(function(scroller) {
          scrollers[scroller].scrollTop = scroller[scroller].scrollHeight;
        });
      }
    },

    loginArgs: function() {
      return '?pid=' + this.props.pid + '&uuid=' + this.props.uuid;
    },

    take: function(color) {
      this.act('take', color);
    },

    discard: function(color) {
      if (confirm("Are you sure you want to discard a gem?")) {
        this.act('discard', color);
      }
    },

    buy: function(uuid) {
      this.act('buy', uuid);
    },

    reserve: function(uuid) {
      this.act('reserve', uuid);
    },

    noble: function(uuid) {
      this.act('noble_visit', uuid);
    },

    act: function(action, target) {
      var self = this;
      this.request = $.post(
        '/game/' + this.props.gid + '/' + action + '/' + target + this.loginArgs(),
        function(resp) {
          if (!showError(resp)) self.updateState(resp);
        }
      );
    },

    nextTurn: function() {
      var self = this;
      this.request = $.post(
        '/game/' + this.props.gid + '/next' + this.loginArgs(),
        function(resp) {
          if (!showError(resp)) self.updateState(resp);
        }
      );
    },

    poll: function() {
      var self = this;
      this.request = $.get(
        '/poll/' + this.props.gid + this.loginArgs(),
        function(resp) {
          if (!showError(resp)) {
            self.updateState(resp);
            self.poll();
          }
        }
      );
    },

    stat: function() {
      var self = this;
      $.get(
        '/stat/' + self.props.gid + self.loginArgs(),
        function(resp) {
          if (!showError(resp)) self.updateState(resp);
        }
      );
    },

    componentDidMount: function() {
      this.stat();
      this.poll();
    },

    componentWillUnmount: function() {
      this.request.abort();
    },

    chat: function(e) {
      if (e.which == 13) {
        var self = this;
        this.request = $.post(
          '/game/' + this.props.gid + '/chat' + this.loginArgs(),
          JSON.stringify({msg: $('#chat-inner').val()}),
          function(resp) {
            if (!showError(resp)) self.updateState(resp);
          }
        );
        $('#chat-inner').val('');
      }
    },

    render: function() {
      var self = this;
      var players = self.state.players.map(function(player) {
        return (
          <Player
            key = {player.uuid}
            pid = {player.id}
            name = {player.name}
            points = {player.score}
            game = {self}
            cards = {player.cards}
            nobles = {player.nobles}
            gems = {player.gems}
            reserved = {player.reserved}
            nreserved = {player.n_reserved}
          />
        );
      });
      var gems = mapColors(self.state.gems, self, self.take, '+', 'game');
      var nobles = mapNobles(self.state.nobles, self);
      var log = self.state.log.map(function(logLine, i) {
        return (
          <div key={"log-line-" + i} className="line">
            <span className="pid">{"[" + logLine.pid + "] "}</span>
            <span className="msg">{logLine.msg}</span>
          </div>
        );
      });
      var chat = self.state.chat.map(function(chatLine, i) {
        return (
          <div key={"chat-line-" + i} className="line">
            <span className="name">{chatLine.name + ": "}</span>
            <span className="msg">{chatLine.msg}</span>
          </div>
        );
      });
      var levels = levelNames.map(function(level) {
        return (
          <Level
            key = {level}
            game = {self}
            name = {level}
            cards = {self.state.cards[level]}
            remaining = {self.state.decks[level]}
          />
        )
      });
      return (
        <div>
          <div id="game-board">
            <div id="common-area">
              <div id="noble-area">
                {nobles}
                <div className='breaker'></div>
              </div>
              <div>
                <div id="level-area">
                  {levels}
                </div>
                <div id="gem-area" className="you">
                  {gems}
                </div>
                <div className="breaker"></div>
              </div>
            </div>
            <div id="player-area">
              {players}
            </div>
          </div>
          <div id="log-box">
            <div className="title">::Log</div>
            <div className="scroller">
              {log}
            </div>
          </div>
          <div id="chat-box">
            <div className="title">::Chat</div>
            <div className="scroller">
              {chat}
            </div>
            <div id="chat">
              <span id="prompt">&gt;</span>
              <input id="chat-inner" type="text" onKeyPress={this.chat}></input>
            </div>
          </div>
          <div id="pass-turn" onClick={self.nextTurn}>Pass turn</div>
          <div id="log-toggle">Press 'L' to toggle log</div>
          <div id="chat-toggle">Press 'C' to toggle chat</div>
          <div id="error-box"><div id="error-box-inner"></div></div>
        </div>
      );
    }
  });

  var GameCreator = React.createClass({
    join: function(game, act) {
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
          name: self.state.userName,
        }), function(resp) {
          if (!showError(resp)) {
            self.setState({
              joined: true,
              pid: resp.id,
              uuid: resp.uuid,
              gid: game,
              mode: act,
              title: resp.title,
              name: self.state.userName,
            });
            self.save();
          }
      });
    },

    submit: function(evt) {
      evt.preventDefault();
      var self = this;
      $.post('/create', JSON.stringify(this.state), function(game) {
        self.join(game.game);
        self.setState({startKey: game.start});
      });
    },

    readSession: function() {
      var session = window.localStorage.getItem('splendor');
      if (session === null) return {};
      return JSON.parse(session);
    },

    componentDidMount: function() {
      var session = this.readSession();
      if (session['default']) {
        this.setState(session['default']);
      }
    },

    getInitialState: function() {
      return {
        title: 'My cool game!',
        joined: false,
        userName: "Joe",
      };
    },

    handleChange: function(event) {
      this.setState({title: event.target.value});
    },

    handleName: function(event) {
      this.setState({userName: event.target.value});
    },

    save: function() {
      var self = this;
      setTimeout(function() {
        var session = self.readSession();
        session['default'] = self.state;
        session[self.state.gid] = self.state;
        window.localStorage['splendor'] = JSON.stringify(session);
      }, 500);
    },

    leaveGame: function() {
      this.setState({joined: false});
      this.save();
    },

    startGame: function() {
      var self = this;
      $.post('/start/' + this.state.gid + '/' + this.state.startKey, function(resp) {
        if (!showError(resp)) {
          self.setState({startKey: null});
          self.save();
        }
      });
    },

    render: function() {
      if (this.state.joined) {
        return (
          <div id="game">
            <div id="game-title">
              <span id="game-title-span">{this.state.title}</span>
              <button id="leave-game" onClick={this.leaveGame}>Leave</button>
              { this.state.startKey &&
                <button id="start-game" onClick={this.startGame}>Start</button>
              }
            </div>
            <Game gid={this.state.gid} pid={this.state.pid} uuid={this.state.uuid} />
          </div>
        );
      } else {
        return (
          <div id="game-manager">
            <h1 id="title">Splendor!</h1>
            <AvailableGames joinFunc={this.join} />
            <div id="create-game">
              <div>
                <h2>Your name</h2>
                <input
                  type     = "text"
                  name     = "my-name"
                  value    = {this.state.userName}
                  onChange = {this.handleName} />
              </div>
              <h2>New Game</h2>
              <form onSubmit={this.submit}>
                <div>
                  <input
                    type     = "text"
                    name     = "title"
                    value    = {this.state.title}
                    onChange = {this.handleChange} />
                </div>
                <div>
                  <input className="inputButton" type="submit" value="Let's play!" />
                </div>
              </form>
            </div>
            <div id="error-box"><div id="error-box-inner"></div></div>
          </div>
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

  React.render(
    (
      <div>
        <GameCreator />
      </div>
    ),
    document.getElementById('content')
  );
})();
