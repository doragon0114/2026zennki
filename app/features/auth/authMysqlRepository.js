const crypto = require("crypto");
const db = require("../../db/mysqlPool");

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

async function createUniqueTagId(connection) {
  while (true) {
    const tagId = createRandomId("tag", 4);

    const [rows] = await connection.query(
      `
      SELECT tag_id
      FROM tags
      WHERE tag_id = ?
      LIMIT 1
      `,
      [tagId]
    );

    if (rows.length === 0) {
      return tagId;
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
   タグ処理
   tagsテーブルに存在しないタグはINSERTする。
   users側には user_tag_ids_json として tagId 配列を保存する。
============================================================ */

function parseTagIds(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function upsertTags(connection, tagNames) {
  const tagRecords = [];

  for (const tagName of tagNames) {
    const normalizedName = String(tagName).trim();

    const [existingRows] = await connection.query(
      `
      SELECT
        tag_id AS tagId,
        name
      FROM tags
      WHERE LOWER(name) = LOWER(?)
      LIMIT 1
      `,
      [normalizedName]
    );

    if (existingRows.length > 0) {
      tagRecords.push(existingRows[0]);
      continue;
    }

    const tagId = await createUniqueTagId(connection);

    await connection.query(
      `
      INSERT INTO tags
        (
          tag_id,
          name,
          created_at
        )
      VALUES
        (?, ?, NOW())
      `,
      [
        tagId,
        normalizedName
      ]
    );

    tagRecords.push({
      tagId,
      name: normalizedName
    });
  }

  return tagRecords;
}

async function getTagNamesByIds(tagIds) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return [];
  }

  const placeholders = tagIds.map(() => "?").join(",");

  const [rows] = await db.query(
    `
    SELECT
      tag_id AS tagId,
      name
    FROM tags
    WHERE tag_id IN (${placeholders})
    `,
    tagIds
  );

  const tagMap = new Map(
    rows.map(tag => [tag.tagId, tag.name])
  );

  return tagIds
    .map(tagId => tagMap.get(tagId))
    .filter(Boolean);
}

/* ============================================================
   公開ユーザー形式
============================================================ */

async function toPublicUser(userRow) {
  if (!userRow) {
    return null;
  }

  const tagIds = parseTagIds(userRow.userTagIdsJson);
  const userTags = await getTagNamesByIds(tagIds);

  return {
    userId: userRow.userId,
    username: userRow.username,
    profile: userRow.profile || "",
    userTags,
    email: userRow.email,
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
    const normalizedTags = normalizeUserTags(userTags);

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
    const tagRecords = await upsertTags(connection, normalizedTags);
    const userTagIds = tagRecords.map(tag => tag.tagId);

    const { salt, passwordHash } = createPasswordHash(password);

    await connection.query(
      `
      INSERT INTO users
        (
          user_id,
          username,
          profile,
          user_tag_ids_json,
          email,
          salt,
          password_hash,
          created_at,
          updated_at
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        userId,
        username.trim(),
        profile ? profile.trim() : "",
        JSON.stringify(userTagIds),
        normalizedEmail,
        salt,
        passwordHash
      ]
    );

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
      user_tag_ids_json AS userTagIdsJson,
      email,
      salt,
      password_hash AS passwordHash,
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
   ログイン状態確認用
============================================================ */

async function findPublicUserByUserId(userId) {
  const [rows] = await db.query(
    `
    SELECT
      user_id AS userId,
      username,
      profile,
      user_tag_ids_json AS userTagIdsJson,
      email,
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
    const normalizedTags = normalizeUserTags(userTags);

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

    const tagRecords = await upsertTags(connection, normalizedTags);
    const userTagIds = tagRecords.map(tag => tag.tagId);

    await connection.query(
      `
      UPDATE users
      SET
        username = ?,
        profile = ?,
        user_tag_ids_json = ?,
        email = ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [
        username.trim(),
        profile ? profile.trim() : "",
        JSON.stringify(userTagIds),
        normalizedEmail,
        currentUserId
      ]
    );

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