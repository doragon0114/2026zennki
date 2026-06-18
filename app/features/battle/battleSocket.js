const WebSocket = require("ws");
const crypto = require("crypto");
const db = require("../DB/dbRoutes");
const battleHistoryRepository = require("./battleHistoryRepository");

const {
  BATTLE_QUESTION_COUNT,
  getSubjectLabel,
  canUserBattleSubject,
  buildBattleQuestionsForPlayers,
  toPublicQuestion
} = require("./battleQuestionRepository");

const waitingPlayers = new Map();
const playerRooms = new Map();
const activeRooms = new Map();

const BATTLE_POINT_WIN = 30;
const BATTLE_POINT_DRAW = 10;
const BATTLE_TIME_LIMIT = 15;

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function send(ws, type, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify({
    type,
    ...payload
  }));
}

function broadcast(room, type, payload = {}) {
  room.players.forEach(player => {
    send(player.ws, type, payload);
  });
}

function getMatchKey(player) {
  return `${player.subject}:${player.age}`;
}

function initBattleWebSocket(server) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/battle"
  });

  wss.on("connection", ws => {
    const player = {
      id: createId("player"),
      ws,
      name: "ゲスト",
      age: 15,
      subject: "math",
      avatar: "🐧",
      userId: null
    };

    send(ws, "connected", {
      playerId: player.id
    });

    ws.on("message", async raw => {
      try {
        const data = JSON.parse(raw.toString());
        await handleMessage(player, data);
      } catch (err) {
        console.error("battle websocket message error:", err);

        send(ws, "error", {
          message: err.message || "通信データの処理に失敗しました"
        });
      }
    });

    ws.on("close", () => {
      handleLeave(player);
    });
  });

  console.log("Battle WebSocket is ready: /ws/battle");
}

async function handleMessage(player, data) {
  switch (data.type) {
    case "join":
      await handleJoin(player, data);
      break;

    case "submitAnswer":
      handleSubmitAnswer(player, data);
      break;

    case "readyNext":
      handleReadyNext(player);
      break;

    case "leave":
      handleLeave(player);
      break;

    default:
      send(player.ws, "error", {
        message: "未対応の操作です"
      });
      break;
  }
}

async function handleJoin(player, data) {
  player.name = String(data.name || "ゲスト").trim().slice(0, 20);
  player.age = Number(data.age || 15);
  player.subject = data.subject || "math";
  player.avatar = data.avatar || "🐧";
  player.userId = String(data.userId || "").trim();

  if (!player.userId) {
    send(player.ws, "error", {
      message: "ログインユーザーが確認できないため、対戦できません。"
    });
    return;
  }

  if (!Number.isInteger(player.age) || player.age < 1 || player.age > 120) {
    send(player.ws, "error", {
      message: "年齢が正しくありません"
    });
    return;
  }

  const subjectLabel = getSubjectLabel(player.subject);

  if (!subjectLabel) {
    send(player.ws, "error", {
      message: "教科が正しくありません。"
    });
    return;
  }

  const ownCheck = await canUserBattleSubject({
    subject: player.subject,
    userId: player.userId
  });

  if (!ownCheck.ok) {
    send(player.ws, "error", {
      message: `${subjectLabel}の問題をまだ持っていないため、対戦できません。資料アップロードから${subjectLabel}の問題を作成してください。`
    });
    return;
  }

  const key = getMatchKey(player);
  const waiting = waitingPlayers.get(key);

  send(player.ws, "joined", {
    playerId: player.id,
    name: player.name,
    age: player.age,
    subject: player.subject,
    subjectLabel,
    ownQuestionCount: ownCheck.count
  });

  if (waiting && waiting.ws.readyState === WebSocket.OPEN && waiting.id !== player.id) {
    waitingPlayers.delete(key);
    await createRoom(waiting, player);
    return;
  }

  waitingPlayers.set(key, player);

  send(player.ws, "waiting", {
    message: `${subjectLabel} / ${player.age}歳で相手を探しています。`
  });
}

async function createRoom(playerA, playerB) {
  const roomId = createId("room");

  const result = await buildBattleQuestionsForPlayers({
    subject: playerA.subject,
    playerAUserId: playerA.userId,
    playerBUserId: playerB.userId
  });

  if (!result.ok) {
    send(playerA.ws, "error", {
      message: result.message || `${getSubjectLabel(playerA.subject)}の対戦用問題が不足しています。`
    });

    send(playerB.ws, "error", {
      message: result.message || `${getSubjectLabel(playerA.subject)}の対戦用問題が不足しています。`
    });

    return;
  }

  const questions = result.questions;

  if (questions.length < BATTLE_QUESTION_COUNT) {
    send(playerA.ws, "error", {
      message: `${getSubjectLabel(playerA.subject)}の対戦用問題が5問未満のため、対戦できません。`
    });

    send(playerB.ws, "error", {
      message: `${getSubjectLabel(playerA.subject)}の対戦用問題が5問未満のため、対戦できません。`
    });

    return;
  }

  const room = {
    id: roomId,
    subject: playerA.subject,
    age: playerA.age,
    players: [playerA, playerB],
    questions,
    current: -1,
    scores: {
      [playerA.id]: 0,
      [playerB.id]: 0
    },
    answers: {},
    readyNext: new Set(),
    timer: null,
    finished: false
  };

  activeRooms.set(roomId, room);
  playerRooms.set(playerA.id, roomId);
  playerRooms.set(playerB.id, roomId);

  broadcast(room, "matched", {
    roomId,
    subject: room.subject,
    subjectLabel: getSubjectLabel(room.subject),
    age: room.age,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar
    }))
  });

  setTimeout(() => {
    nextQuestion(room);
  }, 800);
}

function nextQuestion(room) {
  if (!room || room.finished) {
    return;
  }

  clearQuestionTimer(room);

  room.current += 1;
  room.answers = {};
  room.readyNext = new Set();

  if (room.current >= room.questions.length) {
    finishRoom(room);
    return;
  }

  const question = room.questions[room.current];

  broadcast(room, "question", {
    index: room.current + 1,
    total: room.questions.length,
    question: toPublicQuestion(question),
    scores: room.scores,
    timeLimit: BATTLE_TIME_LIMIT
  });

  room.timer = setTimeout(() => {
    closeQuestion(room, "時間切れです。");
  }, BATTLE_TIME_LIMIT * 1000);
}

function handleSubmitAnswer(player, data) {
  const room = getPlayerRoom(player);

  if (!room || room.finished) {
    return;
  }

  const question = room.questions[room.current];

  if (!question) {
    return;
  }

  if (room.answers[player.id]) {
    return;
  }

  const chosen = Number(data.answer);
  const correct = Number.isInteger(chosen) && chosen === question.correct;

  room.answers[player.id] = {
    chosen,
    correct,
    questionId: question.id
  };

  if (correct) {
    room.scores[player.id] += 1;
  }

  const allAnswered = room.players.every(p => room.answers[p.id]);

  if (allAnswered) {
    closeQuestion(room, "回答がそろいました。");
  } else {
    send(player.ws, "answerAccepted", {
      message: "回答を送信しました。相手の回答を待っています。"
    });
  }
}

function closeQuestion(room, message) {
  if (!room || room.finished) {
    return;
  }

  clearQuestionTimer(room);

  const question = room.questions[room.current];

  room.players.forEach(player => {
    if (!room.answers[player.id]) {
      room.answers[player.id] = {
        chosen: -1,
        correct: false,
        questionId: question.id
      };
    }
  });

  broadcast(room, "answerResult", {
    message,
    index: room.current + 1,
    total: room.questions.length,
    correctIndex: question.correct,
    correctAnswer: question.choices[question.correct],
    explanation: question.explanation || "",
    answers: room.answers,
    scores: room.scores,
    isLast: room.current + 1 >= room.questions.length
  });
}

function handleReadyNext(player) {
  const room = getPlayerRoom(player);

  if (!room || room.finished) {
    return;
  }

  room.readyNext.add(player.id);

  const allReady = room.players.every(p => room.readyNext.has(p.id));

  if (!allReady) {
    send(player.ws, "waitingNext", {
      message: "相手を待っています。"
    });
    return;
  }

  if (room.current + 1 >= room.questions.length) {
    finishRoom(room);
  } else {
    nextQuestion(room);
  }
}

function formatHistoryDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}/${m}/${d}`;
}

function buildHistoryRecord({ room, player, opponent, myScore, oppScore }) {
  let result = "draw";
  let pts = BATTLE_POINT_DRAW;

  if (myScore > oppScore) {
    result = "win";
    pts = BATTLE_POINT_WIN;
  } else if (myScore < oppScore) {
    result = "lose";
    pts = 0;
  }

  return {
    id: `bh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: room.id,
    userId: player.userId || player.id,
    playerName: player.name,
    opponentUserId: opponent.userId || opponent.id,
    opponent: opponent.name,
    avatar: opponent.avatar || "🤖",
    result,
    myScore,
    oppScore,
    pts,
    subject: room.subject,
    age: room.age,
    date: formatHistoryDate(),
    createdAt: new Date().toISOString()
  };
}

async function saveRoomHistory(room) {
  const [playerA, playerB] = room.players;

  const scoreA = room.scores[playerA.id] || 0;
  const scoreB = room.scores[playerB.id] || 0;

  const records = [
    buildHistoryRecord({
      room,
      player: playerA,
      opponent: playerB,
      myScore: scoreA,
      oppScore: scoreB
    }),
    buildHistoryRecord({
      room,
      player: playerB,
      opponent: playerA,
      myScore: scoreB,
      oppScore: scoreA
    })
  ];

  await battleHistoryRepository.saveBattleHistory(records);
}

async function applyWinnerStats(room) {
  const [playerA, playerB] = room.players;

  const scoreA = room.scores[playerA.id] || 0;
  const scoreB = room.scores[playerB.id] || 0;

  if (scoreA === scoreB) {
    return null;
  }

  const winner = scoreA > scoreB ? playerA : playerB;

  if (!winner.userId) {
    return null;
  }

  return await db.addUserBattleWinStats(
    winner.userId,
    BATTLE_POINT_WIN
  );
}

async function finishRoom(room) {
  if (!room || room.finished) {
    return;
  }

  clearQuestionTimer(room);

  room.finished = true;

  const [playerA, playerB] = room.players;
  const scoreA = room.scores[playerA.id] || 0;
  const scoreB = room.scores[playerB.id] || 0;

  let message = "引き分けです。";

  if (scoreA > scoreB) {
    message = `${playerA.name}さんの勝利です。`;
  } else if (scoreB > scoreA) {
    message = `${playerB.name}さんの勝利です。`;
  }

  try {
    await saveRoomHistory(room);
  } catch (err) {
    console.error("saveRoomHistory error:", err);
  }

  try {
    await applyWinnerStats(room);
  } catch (err) {
    console.error("applyWinnerStats error:", err);
  }

  broadcast(room, "finished", {
    message,
    scores: room.scores
  });

  cleanupRoom(room);
}

function handleLeave(player) {
  const waitingKey = getMatchKey(player);

  if (waitingPlayers.get(waitingKey)?.id === player.id) {
    waitingPlayers.delete(waitingKey);
  }

  const room = getPlayerRoom(player);

  if (!room || room.finished) {
    return;
  }

  broadcast(room, "opponentLeft", {
    message: "相手が退出しました。"
  });

  cleanupRoom(room);
}

function getPlayerRoom(player) {
  const roomId = playerRooms.get(player.id);
  return roomId ? activeRooms.get(roomId) : null;
}

function clearQuestionTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function cleanupRoom(room) {
  clearQuestionTimer(room);

  room.players.forEach(player => {
    playerRooms.delete(player.id);
  });

  activeRooms.delete(room.id);
}

module.exports = {
  initBattleWebSocket
};