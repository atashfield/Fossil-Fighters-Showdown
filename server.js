const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the public folder (our HTML/CSS/JS files)
app.use(express.static(path.join(__dirname, "public")));

// Keep track of waiting players and active battles
let waitingPlayer = null;
const battles = {}; // battleId -> { player1, player2 }

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // When a player wants to find a match
  socket.on("find_match", (playerName) => {
    socket.playerName = playerName;
    console.log(`${playerName} is looking for a match...`);

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      // We have two players — start a battle!
      const battleId = `battle_${Date.now()}`;
      const player1 = waitingPlayer;
      const player2 = socket;

      battles[battleId] = { player1, player2 };
      player1.battleId = battleId;
      player2.battleId = battleId;

      // Tell both players the match is found
      player1.emit("match_found", {
        battleId,
        opponent: player2.playerName,
        yourTurn: true,
      });
      player2.emit("match_found", {
        battleId,
        opponent: player1.playerName,
        yourTurn: false,
      });

      console.log(`Battle started: ${player1.playerName} vs ${player2.playerName}`);
      waitingPlayer = null;
    } else {
      // No one waiting yet — this player waits
      waitingPlayer = socket;
      socket.emit("waiting_for_opponent");
    }
  });

  // When a player sends a move
  socket.on("send_move", ({ move }) => {
    const battleId = socket.battleId;
    if (!battleId || !battles[battleId]) return;

    const battle = battles[battleId];
    const opponent =
      battle.player1.id === socket.id ? battle.player2 : battle.player1;

    // Forward the move to the opponent
    opponent.emit("opponent_moved", {
      move,
      moverName: socket.playerName,
    });

    // Tell the mover it's now the opponent's turn
    socket.emit("your_move_sent", { move });

    console.log(`${socket.playerName} used ${move}`);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // If they were waiting, clear the waiting slot
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    // If they were in a battle, tell the opponent
    if (socket.battleId && battles[socket.battleId]) {
      const battle = battles[socket.battleId];
      const opponent =
        battle.player1.id === socket.id ? battle.player2 : battle.player1;
      opponent.emit("opponent_disconnected");
      delete battles[socket.battleId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Fossil Fighters server running on port ${PORT}`);
});
