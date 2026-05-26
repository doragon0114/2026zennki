const waitingQueues = new Map();

/**
 * 今は「教科 + 年齢」が完全一致した人だけマッチングする。
 * 後で「学年」「レート」「地域」「プロフィール年齢」などに変更する場合はここを差し替える。
 */
function buildMatchKey(player) {
  return `${player.subject}:${player.age}`;
}

function enqueueOrMatch(player) {
  const key = buildMatchKey(player);

  if (!waitingQueues.has(key)) {
    waitingQueues.set(key, []);
  }

  const queue = waitingQueues.get(key);

  while (queue.length > 0) {
    const opponent = queue.shift();

    const isOpponentAlive =
      opponent &&
      opponent.ws &&
      opponent.ws.readyState === 1 &&
      opponent.id !== player.id;

    if (isOpponentAlive) {
      return {
        status: 'matched',
        opponent,
        key,
      };
    }
  }

  queue.push(player);

  return {
    status: 'waiting',
    key,
  };
}

function removeWaitingPlayer(playerId) {
  for (const [key, queue] of waitingQueues.entries()) {
    const filtered = queue.filter((player) => player.id !== playerId);

    if (filtered.length === 0) {
      waitingQueues.delete(key);
    } else {
      waitingQueues.set(key, filtered);
    }
  }
}

module.exports = {
  enqueueOrMatch,
  removeWaitingPlayer,
  buildMatchKey,
};