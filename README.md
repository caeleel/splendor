# Splendor

This is an homage to the board game [Splendor](https://boardgamegeek.com/boardgame/148228/splendor).

Included are a game server, a python command line client and a javascript web client. The game is hosted at [http://splendorlord.xyz](http://splendorlord.xyz).

## Differences from the official game rules

There is only one known difference between this version and the official version of the game: in this version you are not allowed to spend gold gems if you have the correct color gem you are substituting for gold. In practice this affects games extremely rarely since in the vast majority of cases you would prefer not to spend your gold gems, but spending gold gems could theoretically be strategically correct to deny a certain chip pile.

## How to run

Option 1:

Start server with [docker](https://www.docker.com/)
```
docker-compose up
```

Option 2:

Alternatively, [install virtualenv](https://virtualenv.pypa.io/en/stable/installation/) and run the installation script:

```
./install.sh
```
Then run the server with
```
ENV/bin/python server/splendor.py
```

## How to play

Open your browser [http://127.0.0.1:8000](http://127.0.0.1:8000)

Use **shrek** / **islove** for basic authentication
