const WebSocket = require("ws");
const crypto = require("crypto");

const { enqueueOrMatch, removeWaitingPlayer } = require("./battleMatcher");

const {
  SUBJECTS,
  findQuestionListBySubject,
  buildBattleQuestions,
  judgeAnswer,
  getCorrectAnswerText,
} = require("./battleQuestionRepository");

const {
  createAnswerList,
  recordCorrectId,
} = require("./battleAnswerRepository");

const activeRooms = new Map();

function initBattleWebSocket(server) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/battle",
  });

  wss.on("connection", ws => {
    const player = {
      id: crypto.randomUUID(),
      name: "ゲスト",
      age: null,
      subject: null,
      ws,
      roomId: null,
    };

    send(ws, "connected", {
      playerId: player.id,
      message: "WebSocketに接続しました。",
    });

    ws.on("message", raw => {
      let data;

      try {
        data = JSON.parse(raw.toString());
      } catch {
        sendError(ws, "JSONの形式が正しくありません。");
        return;
      }

      handleMessage(player, data);
    });

    ws.on("close", () => {
      cleanupPlayer(player);
    });

    ws.on("error", () => {
      cleanupPlayer(player);
    });
  });

  console.log("Battle WebSocket is ready: /ws/battle");
}

function handleMessage(player, data) {
  switch (data.type) {
    case "join":
      handleJoin(player, data);
      break;

    case "buzz":
      handleBuzz(player);
      break;

    case "submitAnswer":
      handleSubmitAnswer(player, data);
      break;

    case "leave":
      cleanupPlayer(player);
      break;

    default:
      sendError(player.ws, "不明なメッセージタイプです。");
      break;
  }
}

function handleJoin(player, data) {
  const name = sanitizeName(data.name);
  const subject = data.subject;
  const age = Number(data.age);

  if (!SUBJECTS[subject]) {
    sendError(player.ws, "教科が正しくありません。");
    return;
  }

  if (!Number.isInteger(age) || age < 1 || age > 120) {
    sendError(player.ws, "年齢が正しくありません。");
    return;
  }

  removeWaitingPlayer(player.id);

  if (player.roomId) {
    leaveRoom(player);
  }

  player.name = name;
  player.subject = subject;
  player.age = age;

  send(player.ws, "joined", {
    playerId: player.id,
    name: player.name,
    subject,
    subjectLabel: SUBJECTS[subject],
    age,
  });

  const result = enqueueOrMatch(player);

  if (result.status === "waiting") {
    send(player.ws, "waiting", {
      message: "同じ教科・同じ年齢の相手を待っています。",
      subject,
      subjectLabel: SUBJECTS[subject],
      age,
    });
    return;
  }

  createRoom(player, result.opponent);
}

function createRoom(playerA, playerB) {
  const questionList = findQuestionListBySubject(playerA.subject);

  if (!questionList) {
    sendError(playerA.ws, "問題リストが見つかりません。");
    sendError(playerB.ws, "問題リストが見つかりません。");
    return;
  }

  const roomId = crypto.randomUUID();

  const answerListA = createAnswerList({
    questionListId: questionList.questionListId,
    userId: playerA.id,
  });

  const answerListB = createAnswerList({
    questionListId: questionList.questionListId,
    userId: playerB.id,
  });

  const room = {
    id: roomId,
    subject: playerA.subject,
    age: playerA.age,
    questionListId: questionList.questionListId,
    players: [playerA, playerB],
    answerListIds: {
      [playerA.id]: answerListA.answerListId,
      [playerB.id]: answerListB.answerListId,
    },
    scores: {
      [playerA.id]: 0,
      [playerB.id]: 0,
    },
    questions: buildBattleQuestions(playerA, playerB, playerA.subject),
    currentIndex: -1,
    lockedBy: null,
    finished: false,
  };

  playerA.roomId = roomId;
  playerB.roomId = roomId;

  activeRooms.set(roomId, room);

  broadcast(room, "matched", {
    roomId,
    subject: room.subject,
    subjectLabel: SUBJECTS[room.subject],
    age: room.age,
    players: room.players.map(player => {
      return {
        id: player.id,
        name: player.name,
      };
    }),
    answerListIds: room.answerListIds,
    message: "対戦相手が見つかりました。",
  });

  setTimeout(() => {
    nextQuestion(roomId);
  }, 1000);
}

function nextQuestion(roomId) {
  const room = activeRooms.get(roomId);

  if (!room || room.finished) {
    return;
  }

  room.currentIndex += 1;
  room.lockedBy = null;

  if (room.currentIndex >= room.questions.length) {
    finishRoom(room);
    return;
  }

  const question = room.questions[room.currentIndex];

  broadcast(room, "question", {
    index: room.currentIndex + 1,
    total: room.questions.length,
    question: toPublicQuestion(question),
    scores: room.scores,
  });
}

function handleBuzz(player) {
  const room = getPlayerRoom(player);

  if (!room) {
    sendError(player.ws, "対戦ルームに参加していません。");
    return;
  }

  if (room.finished) {
    sendError(player.ws, "この対戦は終了しています。");
    return;
  }

  if (room.currentIndex < 0 || room.currentIndex >= room.questions.length) {
    sendError(player.ws, "現在回答できる問題がありません。");
    return;
  }

  if (room.lockedBy) {
    send(player.ws, "buzzRejected", {
      message: "相手が先に早押ししました。",
      lockedBy: room.lockedBy,
    });
    return;
  }

  room.lockedBy = player.id;

  broadcast(room, "buzzed", {
    playerId: player.id,
    playerName: player.name,
    message: `${player.name}さんが早押ししました。`,
  });

  send(player.ws, "canAnswer", {
    message: "回答してください。",
  });
}

function handleSubmitAnswer(player, data) {
  const room = getPlayerRoom(player);

  if (!room) {
    sendError(player.ws, "対戦ルームに参加していません。");
    return;
  }

  if (room.lockedBy !== player.id) {
    sendError(player.ws, "あなたは現在回答権を持っていません。");
    return;
  }

  const question = room.questions[room.currentIndex];

  if (!question) {
    sendError(player.ws, "問題が見つかりません。");
    return;
  }

  const userAnswer = String(data.answer || "").trim();

  if (!userAnswer) {
    sendError(player.ws, "回答を入力してください。");
    return;
  }

  const isCorrect = judgeAnswer(userAnswer, question);

  if (isCorrect) {
    room.scores[player.id] += 1;

    const answerListId = room.answerListIds[player.id];

    recordCorrectId({
      answerListId,
      questionNumber: room.currentIndex + 1,
      questionId: question.questionId,
    });
  }

  broadcast(room, "answerResult", {
    playerId: player.id,
    playerName: player.name,
    userAnswer,
    isCorrect,
    correctAnswer: getCorrectAnswerText(question),
    explanation: "",
    scores: room.scores,
  });

  setTimeout(() => {
    nextQuestion(room.id);
  }, 2500);
}

function finishRoom(room) {
  room.finished = true;

  const players = room.players;
  const scoreA = room.scores[players[0].id];
  const scoreB = room.scores[players[1].id];

  let winner = null;

  if (scoreA > scoreB) {
    winner = {
      id: players[0].id,
      name: players[0].name,
    };
  } else if (scoreB > scoreA) {
    winner = {
      id: players[1].id,
      name: players[1].name,
    };
  }

  broadcast(room, "finished", {
    scores: room.scores,
    winner,
    answerListIds: room.answerListIds,
    message: winner ? `${winner.name}さんの勝ちです。` : "引き分けです。",
  });

  for (const player of room.players) {
    player.roomId = null;
  }

  activeRooms.delete(room.id);
}

function cleanupPlayer(player) {
  removeWaitingPlayer(player.id);

  if (player.roomId) {
    leaveRoom(player);
  }
}

function leaveRoom(player) {
  const room = activeRooms.get(player.roomId);

  if (!room) {
    player.roomId = null;
    return;
  }

  const opponent = room.players.find(p => {
    return p.id !== player.id;
  });

  if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
    send(opponent.ws, "opponentLeft", {
      message: `${player.name}さんが退出しました。`,
    });

    opponent.roomId = null;
  }

  activeRooms.delete(room.id);
  player.roomId = null;
}

function getPlayerRoom(player) {
  if (!player.roomId) {
    return null;
  }

  return activeRooms.get(player.roomId) || null;
}

function toPublicQuestion(question) {
  return {
    id: question.id,
    questionId: question.questionId,
    questionListId: question.questionListId,
    type: "text",
    text: question.text,
    choices: [],
    ownerId: question.ownerId,
    ownerName: question.ownerName,
  };
}

function sanitizeName(name) {
  const value = String(name || "").trim();

  if (!value) {
    return "ゲスト";
  }

  return value.slice(0, 20);
}

function send(ws, type, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(
    JSON.stringify({
      type,
      ...payload,
    })
  );
}

function sendError(ws, message) {
  send(ws, "error", {
    message,
  });
}

function broadcast(room, type, payload = {}) {
  for (const player of room.players) {
    send(player.ws, type, payload);
  }
}

module.exports = {
  initBattleWebSocket,
};