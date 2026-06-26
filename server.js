const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let waitingPlayer = null;
const battles = {};

// ── Formation timer: 75 seconds ──
const FORMATION_TIMER = 75;

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  // ── Matchmaking ──
  socket.on("find_match", ({ playerName, team }) => {
    socket.playerName = playerName;
    socket.team = team; // full team of 5 vivosaurs from client

    console.log(`${playerName} looking for match...`);

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const battleId = `battle_${Date.now()}`;
      const p1 = waitingPlayer;
      const p2 = socket;

      battles[battleId] = {
        p1, p2,
        p1Ready: false, p2Ready: false,
        p1Formation: null, p2Formation: null,
        timerStart: Date.now(),
        battleStarted: false,
        turnOf: "p1", // p1 goes first
      };

      p1.battleId = battleId;
      p2.battleId = battleId;
      p1.role = "p1";
      p2.role = "p2";

      // Tell both to go to formation screen
      p1.emit("enter_formation", {
        battleId,
        opponent: p2.playerName,
        opponentTeam: p2.team,
        timerSeconds: FORMATION_TIMER,
        yourTurn: true,
      });
      p2.emit("enter_formation", {
        battleId,
        opponent: p1.playerName,
        opponentTeam: p1.team,
        timerSeconds: FORMATION_TIMER,
        yourTurn: false,
      });

      console.log(`Formation phase: ${p1.playerName} vs ${p2.playerName}`);
      waitingPlayer = null;

      // Auto-start timer — if a player hasn't readied after 75s, lock in their current formation
      setTimeout(() => {
        const battle = battles[battleId];
        if (!battle || battle.battleStarted) return;
        // Force-ready anyone who hasn't locked in yet
        if (!battle.p1Ready) {
          battle.p1Ready = true;
          p1.emit("formation_auto_locked");
        }
        if (!battle.p2Ready) {
          battle.p2Ready = true;
          p2.emit("formation_auto_locked");
        }
        tryStartBattle(battleId);
      }, FORMATION_TIMER * 1000);

    } else {
      waitingPlayer = socket;
      socket.emit("waiting_for_opponent");
    }
  });

  // ── Player locks in formation ──
  socket.on("lock_formation", ({ formation }) => {
    const battleId = socket.battleId;
    if (!battleId || !battles[battleId]) return;
    const battle = battles[battleId];
    const role = socket.role;

    battle[`${role}Formation`] = formation; // { azSlots: [...vivoObjs], szSlots: [...vivoObjs] }
    battle[`${role}Ready`] = true;

    const opponent = role === "p1" ? battle.p2 : battle.p1;
    opponent.emit("opponent_ready");

    console.log(`${socket.playerName} locked formation`);
    tryStartBattle(battleId);
  });

  // ── Try to start battle once both are ready ──
  function tryStartBattle(battleId) {
    const battle = battles[battleId];
    if (!battle || battle.battleStarted) return;
    if (!battle.p1Ready || !battle.p2Ready) return;

    battle.battleStarted = true;

    // Apply support effects and set up battle state
    const p1State = buildBattleState(battle.p1Formation);
    const p2State = buildBattleState(battle.p2Formation);

    battle.p1State = p1State;
    battle.p2State = p2State;

    // Determine who goes first based on combined SPD of all 3 vivosaurs
    const totalSpd = (state) => {
      const all = [...(state.azSlots || []), ...(state.szSlots || [])];
      return all.reduce((sum, v) => sum + (v.spd || v.speed || 0), 0);
    };
    const p1Spd = totalSpd(p1State);
    const p2Spd = totalSpd(p2State);
    let p1GoesFirst;
    if (p1Spd > p2Spd)       p1GoesFirst = true;
    else if (p2Spd > p1Spd)  p1GoesFirst = false;
    else                       p1GoesFirst = Math.random() < 0.5; // 50/50 on tie

    console.log(`Speed: ${battle.p1.playerName}=${p1Spd} vs ${battle.p2.playerName}=${p2Spd} → ${p1GoesFirst ? battle.p1.playerName : battle.p2.playerName} goes first`);

    battle.p1.emit("battle_start", {
      yourFormation: battle.p1Formation,
      oppFormation: battle.p2Formation,
      yourState: p1State,
      oppState: p2State,
      yourTurn: p1GoesFirst,
    });
    battle.p2.emit("battle_start", {
      yourFormation: battle.p2Formation,
      oppFormation: battle.p1Formation,
      yourState: p2State,
      oppState: p1State,
      yourTurn: !p1GoesFirst,
    });

    console.log(`Battle started: ${battle.p1.playerName} vs ${battle.p2.playerName}`);
  }

  // ── Build battle state: apply support effects ──
  function buildBattleState(formation) {
    // formation = { azSlots: [vivo, ...], szSlots: [vivo, ...] }
    const azCount = formation.azSlots.length;
    const szVivos = formation.szSlots;

    // Start with base stats for AZ vivosaurs
    const azStates = formation.azSlots.map(v => ({
      ...v,
      currentLp: v.lp,
      effectiveAtk: v.atk,
      effectiveDef: v.def,
      effectiveAcc: v.acc,
      effectiveSpd: v.spd,
    }));

    // Apply Own AZ support effects from SZ vivosaurs
    szVivos.forEach(sv => {
      if (sv.support_target === "Own AZ") {
        // Split if 2 in AZ, round down
        const divisor = azCount;
        const atkBuff = Math.floor(sv.atk_mod * 100 / divisor) / 100;
        const defBuff = Math.floor(sv.def_mod * 100 / divisor) / 100;
        const accBuff = Math.floor(sv.acc_mod * 100 / divisor) / 100;
        const spdBuff = Math.floor(sv.spd_mod * 100 / divisor) / 100;

        azStates.forEach(az => {
          az.effectiveAtk = Math.max(1, Math.round(az.atk * (1 + atkBuff)));
          az.effectiveDef = Math.max(0, Math.round(az.def * (1 + defBuff)));
          az.effectiveAcc = Math.max(1, Math.round(az.acc * (1 + accBuff)));
          az.effectiveSpd = Math.max(1, Math.round(az.spd * (1 + spdBuff)));
        });
      }
    });

    return {
      azSlots: azStates,
      szSlots: szVivos.map(v => ({ ...v, currentLp: v.lp })),
    };
  }

  // ── Relay rotation to opponent ──
  socket.on('player_rotated', ({ azSlots, szSlots }) => {
    const battleId = socket.battleId;
    if (!battleId || !battles[battleId]) return;
    const battle = battles[battleId];
    const oppRole = socket.role === 'p1' ? 'p2' : 'p1';
    battle[oppRole].emit('opponent_rotated', { azSlots, szSlots });
    console.log(`${socket.playerName} rotated formation`);
  });

  // ── Move handling ──
  socket.on("send_move", ({ moveName, movePower, isCrit, elemMult, tiles, attackerName, attackerPos, targetName, targetPos }) => {
    const battleId = socket.battleId;
    if (!battleId || !battles[battleId]) return;
    const battle = battles[battleId];
    const oppRole = socket.role === "p1" ? "p2" : "p1";
    const opponent = battle[oppRole];
    socket.emit("your_move_sent", { moveName, movePower, isCrit, elemMult, tiles, attackerName, attackerPos, targetName, targetPos });
    opponent.emit("opponent_moved", { moveName, movePower, isCrit, elemMult, tiles, attackerName, attackerPos, targetName, targetPos });
    console.log(`${socket.playerName}: ${attackerName} used ${moveName} (DMG:${movePower}${isCrit?' CRIT':''}) on ${targetName}`);
  });

  // ── Forfeit ──
  socket.on('forfeit_battle', () => {
    const battleId = socket.battleId;
    if (!battleId || !battles[battleId]) return;
    const battle = battles[battleId];
    const oppRole = socket.role === 'p1' ? 'p2' : 'p1';
    battle[oppRole].emit('opponent_forfeited', { forfeiterName: socket.playerName });
    delete battles[battleId];
    console.log(`${socket.playerName} forfeited`);
  });

  // ── End turn ──
  socket.on("end_turn", () => {
    const battleId = socket.battleId;
    if (!battleId || !battles[battleId]) return;
    const battle = battles[battleId];
    const oppRole = socket.role === "p1" ? "p2" : "p1";
    battle[oppRole].emit("turn_ended");
    console.log(`${socket.playerName} ended their turn`);
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
    if (socket.battleId && battles[socket.battleId]) {
      const battle = battles[socket.battleId];
      const oppRole = socket.role === "p1" ? "p2" : "p1";
      if (battle[oppRole]) battle[oppRole].emit("opponent_disconnected");
      delete battles[socket.battleId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Fossil Fighters server running on port ${PORT}`);
});
