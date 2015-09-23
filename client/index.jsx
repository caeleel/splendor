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

  function mapColors(gems, game, callback, symbol) {
    return gemColors.map(function(color) {
      var cName = color + "chip";
      if (color == '*') cName = "schip";
      return (
        <div className={"gem " + cName}>
          <div className="bubble">{gems[color]}</div>
          <div className="underlay" onClick={callback.bind(game, color)}>{symbol}</div>
        </div>
      );
    });
  }

  function mapNobles(nobles, game) {
    return nobles.map(function(noble) {
      return (
        <div>
          <Noble key={noble.uuid} noble={noble} game={game}/>
        </div>
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

    handleClick: function(game) {
      this.props.joinFunc(game);
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
                    onClick   = {self.handleClick.bind(self, g.uuid)}
                    className = "game-title"
                  >
                    {g.title}
                  </span>
                  <span className="game-playerCount">
                    ({g.n_players} players)
                  </span>
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
            className = {"card card-" + card.color}
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
                      <div className={"cost " + color}>{card.cost[color]}</div>
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
                    <div className={"requires " + color}>{noble.requirement[color]}</div>
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
            <div className="colorSetInner">
              <Card key={card.uuid} card={card} game={game}/>
            </div>
          );
        });
        return (
          <div className="colorSet">
            {cards}
            <div className={cards.length > 0 ? "spacer" : "smallspacer"}></div>
          </div>
        );
      });
      var you = (game.props.pid == self.props.pid ? " you" : "");
      var youName = (game.props.pid == self.props.pid ? " (you)" : "");
      var gems = mapColors(self.props.gems, game, game.discard, 'X');
      var reserved = [];
      var reservedCount = 0;
      if (self.props.reserved) {
        reserved = self.props.reserved.map(function(card) {
          return (
            <div className="reserved">
              <Card key={card.uuid} card={card} game={game}/>
            </div>
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
        var scroller = document.getElementById("log-scroller");
        scroller.scrollTop = scroller.scrollHeight;
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

    render: function() {
      var self = this;
      var players = self.state.players.map(function(player) {
        return (
          <div>
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
          </div>
        );
      });
      var gems = mapColors(self.state.gems, self, self.take, '+');
      var nobles = mapNobles(self.state.nobles, self);
      var log = self.state.log.map(function(logLine) {
        return (
          <div className="log-line">{logLine}</div>
        );
      });
      var levels = levelNames.map(function(level) {
        return (
          <div className="level">
            <Level
              key = {level}
              game = {self}
              name = {level}
              cards = {self.state.cards[level]}
              remaining = {self.state.decks[level]}
            />
          </div>
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
            <div id="log-title">::Log</div>
            <div id="log-scroller">
              {log}
            </div>
          </div>
          <div id="pass-turn" onClick={self.nextTurn.bind(self)}>Pass turn</div>
          <div id="log-toggle">Press 'L' to toggle log</div>
          <div id="error-box"><div id="error-box-inner"></div></div>
        </div>
      );
    }
  });

  var GameCreator = React.createClass({
    join: function(game) {
      var self = this;
      $.post('/join/' + game, JSON.stringify({
          name: self.state.userName,
        }), function(resp) {
          if (!showError(resp)) {
            self.setState({
              joined: true,
              pid: resp.id,
              uuid: resp.uuid,
              gid: game,
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

    componentDidMount: function() {
      var session = window.localStorage.getItem('session');
      if (session === null) return;
      session = JSON.parse(session);
      this.setState(session);
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
        window.localStorage['session'] = JSON.stringify(self.state);
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
    console.log(e.which);
    if (e.which == 108) {
      $("#log-box").toggle();
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
