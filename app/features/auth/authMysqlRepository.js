const crypto = require("crypto");

// app/features/auth/authMysqlRepository.js から app/DB/dbRoutes.js を読む場合
const db = require("../DB/dbRoutes");

/* ============================================================
   ID生成
============================================================ */

function createRandomId(prefix, byteLength = 5) {
  return `${prefix}_${crypto.randomBytes(byteLength).toString("hex")}`;
}

async function createUniqueUserId(connection) {
  while (true) {
    const userId = createRandomId("user", 5);

    const [rows] = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return userId;
    }
  }
}

async function createUniqueUserTagId(connection) {
  while (true) {
    const userTagId = createRandomId("utag", 5);

    const [rows] = await connection.query(
      `
      SELECT user_tag_id
      FROM user_tags
      WHERE user_tag_id = ?
      LIMIT 1
      `,
      [userTagId]
    );

    if (rows.length === 0) {
      return userTagId;
    }
  }
}

/* ============================================================
   パスワード
============================================================ */

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const passwordHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return {
    salt,
    passwordHash
  };
}

function verifyPassword(password, salt, passwordHash) {
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return hash === passwordHash;
}

/* ============================================================
   入力チェック
============================================================ */

function validateUserInput({ username, email, password }) {
  if (!username || !email || !password) {
    throw new Error("ユーザー名、メールアドレス、パスワードを入力してください");
  }

  if (username.trim().length < 2) {
    throw new Error("ユーザー名は2文字以上で入力してください");
  }

  if (!email.includes("@")) {
    throw new Error("メールアドレスの形式が正しくありません");
  }

  if (password.length < 6) {
    throw new Error("パスワードは6文字以上で入力してください");
  }
}

function validateProfileInput({ username, email }) {
  if (!username || !email) {
    throw new Error("ユーザー名とメールアドレスを入力してください");
  }

  if (username.trim().length < 2) {
    throw new Error("ユーザー名は2文字以上で入力してください");
  }

  if (!email.includes("@")) {
    throw new Error("メールアドレスの形式が正しくありません");
  }
}

function normalizeUserTags(userTags) {
  if (!Array.isArray(userTags)) {
    return [];
  }

  const normalizedTags = userTags
    .map(tag => String(tag).trim())
    .filter(tag => tag.length > 0)
    .filter(tag => tag.length <= 20);

  const uniqueTags = [...new Set(normalizedTags)];

  if (uniqueTags.length > 10) {
    throw new Error("タグは10個まで登録できます");
  }

  return uniqueTags;
}

/* ============================================================
   user_tags 処理
   今回は中間テーブルなし。
   user_tags に user_id を直接保存する。
============================================================ */

async function replaceUserTags(connection, userId, tagNames) {
  const normalizedTags = normalizeUserTags(tagNames);

  await connection.query(
    `
    DELETE FROM user_tags
    WHERE user_id = ?
    `,
    [userId]
  );

  for (const tagName of normalizedTags) {
    const userTagId = await createUniqueUserTagId(connection);

    await connection.query(
      `
      INSERT INTO user_tags
        (
          user_tag_id,
          user_id,
          user_tag_name,
          created_at
        )
      VALUES
        (?, ?, ?, NOW())
      `,
      [
        userTagId,
        userId,
        tagName
      ]
    );
  }
}

async function getUserTagsByUserId(userId) {
  const [rows] = await db.query(
    `
    SELECT
      user_tag_name AS userTagName
    FROM user_tags
    WHERE user_id = ?
    ORDER BY created_at ASC
    `,
    [userId]
  );

  return rows.map(row => row.userTagName);
}

/* ============================================================
   公開ユーザー形式
============================================================ */

async function toPublicUser(userRow) {
  if (!userRow) {
    return null;
  }

  const userTags = await getUserTagsByUserId(userRow.userId);

  const point = Number(userRow.point || 0);
  const battleWinCount = Number(userRow.battleWinCount || 0);
  const studyCount = Number(userRow.studyCount || 0);
  const questionCount = Number(userRow.questionCount || 0);

  return {
    userId: userRow.userId,
    username: userRow.username,
    profile: userRow.profile || "",
    userTags,
    email: userRow.email,

    // DBカラム名に近い形
    point,
    battleWinCount,
    studyCount,
    questionCount,

    // フロント既存コード互換
    points: point,
    wins: battleWinCount,
    totalStudied: studyCount,

    createdAt: userRow.createdAt
  };
}

/* ============================================================
   アカウント作成
============================================================ */

async function createUser({
  username,
  profile,
  userTags,
  email,
  password
}) {
  validateUserInput({
    username,
    email,
    password
  });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedEmail = email.trim().toLowerCase();

    const [emailRows] = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (emailRows.length > 0) {
      throw new Error("このメールアドレスは既に使われています");
    }

    const userId = await createUniqueUserId(connection);
    const { salt, passwordHash } = createPasswordHash(password);

    await connection.query(
      `
      INSERT INTO users
        (
          user_id,
          username,
          profile,
          email,
          password_hash,
          salt,
          created_at,
          updated_at
        )
      VALUES
        (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        userId,
        username.trim(),
        profile ? profile.trim() : "",
        normalizedEmail,
        passwordHash,
        salt
      ]
    );

    await replaceUserTags(connection, userId, userTags);

    await connection.commit();

    return await findPublicUserByUserId(userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* ============================================================
   ログイン
============================================================ */

async function loginUser({ loginId, password }) {
  if (!loginId || !password) {
    throw new Error("ユーザーIDまたはメールアドレスとパスワードを入力してください");
  }

  const normalizedLoginId = loginId.trim();
  const normalizedLoginIdLower = normalizedLoginId.toLowerCase();

  const [rows] = await db.query(
    `
    SELECT
      user_id AS userId,
      username,
      profile,
      email,
      password_hash AS passwordHash,
      salt,
      point,
      battle_win_count AS battleWinCount,
      study_count AS studyCount,
      question_count AS questionCount,
      created_at AS createdAt
    FROM users
    WHERE user_id = ?
      OR LOWER(email) = ?
    LIMIT 1
    `,
    [
      normalizedLoginId,
      normalizedLoginIdLower
    ]
  );

  const user = rows[0];

  if (!user) {
    throw new Error("ログイン情報が違います");
  }

  const isValid = verifyPassword(password, user.salt, user.passwordHash);

  if (!isValid) {
    throw new Error("ログイン情報が違います");
  }

  return await toPublicUser(user);
}

/* ============================================================
   ログイン状態確認
============================================================ */

async function findPublicUserByUserId(userId) {
  const [rows] = await db.query(
    `
    SELECT
      user_id AS userId,
      username,
      profile,
      email,
      point,
      battle_win_count AS battleWinCount,
      study_count AS studyCount,
      question_count AS questionCount,
      created_at AS createdAt
    FROM users
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  return await toPublicUser(rows[0] || null);
}

/* ============================================================
   プロフィール更新
============================================================ */

async function updateUserProfile(currentUserId, {
  username,
  profile,
  userTags,
  email
}) {
  validateProfileInput({
    username,
    email
  });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedEmail = email.trim().toLowerCase();

    const [targetRows] = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [currentUserId]
    );

    if (targetRows.length === 0) {
      throw new Error("ユーザーが見つかりません");
    }

    const [emailRows] = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE LOWER(email) = LOWER(?)
        AND user_id <> ?
      LIMIT 1
      `,
      [
        normalizedEmail,
        currentUserId
      ]
    );

    if (emailRows.length > 0) {
      throw new Error("このメールアドレスは既に使われています");
    }

    await connection.query(
      `
      UPDATE users
      SET
        username = ?,
        profile = ?,
        email = ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [
        username.trim(),
        profile ? profile.trim() : "",
        normalizedEmail,
        currentUserId
      ]
    );

    await replaceUserTags(connection, currentUserId, userTags);

    await connection.commit();

    return await findPublicUserByUserId(currentUserId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createUser,
  loginUser,
  findPublicUserByUserId,
  updateUserProfile
};