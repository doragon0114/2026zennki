const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const USERS_DB_PATH = path.join(__dirname, "../../data/users.json");
const TAGS_DB_PATH = path.join(__dirname, "../../data/tags.json");

async function ensureJsonFile(filePath, initialData) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

async function readUsersDatabase() {
  await ensureJsonFile(USERS_DB_PATH, { users: [] });

  const text = await fs.readFile(USERS_DB_PATH, "utf-8");
  return JSON.parse(text);
}

async function writeUsersDatabase(data) {
  await fs.writeFile(USERS_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function readTagsDatabase() {
  await ensureJsonFile(TAGS_DB_PATH, { tags: [] });

  const text = await fs.readFile(TAGS_DB_PATH, "utf-8");
  return JSON.parse(text);
}

async function writeTagsDatabase(data) {
  await fs.writeFile(TAGS_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function createRandomId(prefix, byteLength = 5) {
  return `${prefix}_${crypto.randomBytes(byteLength).toString("hex")}`;
}

function createUniqueUserId(users) {
  let userId = createRandomId("user", 5);

  while (users.some((user) => user.userId === userId)) {
    userId = createRandomId("user", 5);
  }

  return userId;
}

function createUniqueTagId(tags) {
  let tagId = createRandomId("tag", 4);

  while (tags.some((tag) => tag.tagId === tagId)) {
    tagId = createRandomId("tag", 4);
  }

  return tagId;
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return {
    salt,
    passwordHash: hash
  };
}

function verifyPassword(password, salt, passwordHash) {
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return hash === passwordHash;
}

function normalizeUserTags(userTags) {
  if (!Array.isArray(userTags)) {
    return [];
  }

  const normalizedTags = userTags
    .map((tag) => String(tag).trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => tag.length <= 20);

  const uniqueTags = [...new Set(normalizedTags)];

  if (uniqueTags.length > 10) {
    throw new Error("タグは10個まで登録できます");
  }

  return uniqueTags;
}

async function upsertTags(tagNames) {
  const tagsDb = await readTagsDatabase();
  const now = new Date().toISOString();

  const resultTags = [];

  for (const tagName of tagNames) {
    const existingTag = tagsDb.tags.find((tag) => {
      return tag.name.toLowerCase() === tagName.toLowerCase();
    });

    if (existingTag) {
      resultTags.push(existingTag);
      continue;
    }

    const newTag = {
      tagId: createUniqueTagId(tagsDb.tags),
      name: tagName,
      createdAt: now
    };

    tagsDb.tags.push(newTag);
    resultTags.push(newTag);
  }

  await writeTagsDatabase(tagsDb);

  return resultTags;
}

function getTagNamesFromUser(user, allTags) {
  if (!Array.isArray(user.userTagIds)) {
    return [];
  }

  return user.userTagIds
    .map((tagId) => {
      const tag = allTags.find((tag) => tag.tagId === tagId);
      return tag ? tag.name : null;
    })
    .filter(Boolean);
}

function toPublicUser(user, allTags) {
  return {
    userId: user.userId,
    username: user.username,
    profile: user.profile,
    userTags: getTagNamesFromUser(user, allTags),
    email: user.email,
    createdAt: user.createdAt
  };
}

function validateUserInput({
  username,
  email,
  password
}) {
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

function validateProfileInput({
  username,
  email
}) {
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

  const usersDb = await readUsersDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedTags = normalizeUserTags(userTags);

  const existsEmail = usersDb.users.some((user) => {
    return user.email.toLowerCase() === normalizedEmail;
  });

  if (existsEmail) {
    throw new Error("このメールアドレスは既に使われています");
  }

  const tagRecords = await upsertTags(normalizedTags);

  const { salt, passwordHash } = createPasswordHash(password);

  const newUser = {
    userId: createUniqueUserId(usersDb.users),
    username: username.trim(),
    profile: profile ? profile.trim() : "",
    userTagIds: tagRecords.map((tag) => tag.tagId),
    email: normalizedEmail,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  usersDb.users.push(newUser);
  await writeUsersDatabase(usersDb);

  const tagsDb = await readTagsDatabase();

  return toPublicUser(newUser, tagsDb.tags);
}

async function loginUser({ loginId, password }) {
  if (!loginId || !password) {
    throw new Error("ユーザーIDまたはメールアドレスとパスワードを入力してください");
  }

  const usersDb = await readUsersDatabase();
  const tagsDb = await readTagsDatabase();

  const normalizedLoginId = loginId.trim();
  const normalizedLoginIdLower = normalizedLoginId.toLowerCase();

  const user = usersDb.users.find((user) => {
    return (
      user.userId === normalizedLoginId ||
      user.email.toLowerCase() === normalizedLoginIdLower
    );
  });

  if (!user) {
    throw new Error("ログイン情報が違います");
  }

  const isValid = verifyPassword(password, user.salt, user.passwordHash);

  if (!isValid) {
    throw new Error("ログイン情報が違います");
  }

  return toPublicUser(user, tagsDb.tags);
}

async function findPublicUserByUserId(userId) {
  const usersDb = await readUsersDatabase();
  const tagsDb = await readTagsDatabase();

  const user = usersDb.users.find((user) => {
    return user.userId === userId;
  });

  if (!user) {
    return null;
  }

  return toPublicUser(user, tagsDb.tags);
}

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

  const usersDb = await readUsersDatabase();

  const targetUser = usersDb.users.find((user) => {
    return user.userId === currentUserId;
  });

  if (!targetUser) {
    throw new Error("ユーザーが見つかりません");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existsEmail = usersDb.users.some((user) => {
    return (
      user.userId !== currentUserId &&
      user.email.toLowerCase() === normalizedEmail
    );
  });

  if (existsEmail) {
    throw new Error("このメールアドレスは既に使われています");
  }

  const normalizedTags = normalizeUserTags(userTags);
  const tagRecords = await upsertTags(normalizedTags);

  targetUser.username = username.trim();
  targetUser.profile = profile ? profile.trim() : "";
  targetUser.email = normalizedEmail;
  targetUser.userTagIds = tagRecords.map((tag) => tag.tagId);
  targetUser.updatedAt = new Date().toISOString();

  await writeUsersDatabase(usersDb);

  const tagsDb = await readTagsDatabase();

  return toPublicUser(targetUser, tagsDb.tags);
}

module.exports = {
  createUser,
  loginUser,
  findPublicUserByUserId,
  updateUserProfile
};