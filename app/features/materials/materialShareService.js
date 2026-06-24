const crypto = require("crypto");
const materialShareRepository =
  require("./materialShareRepository");

const SHARE_CODE_LENGTH = 8;

/*
 * 0・1・I・Oなど、見間違えやすい文字を除外する。
 */
const SHARE_CODE_CHARS =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createShareError(
  message,
  statusCode = 400
) {
  const err = new Error(message);
  err.statusCode = statusCode;

  return err;
}

function normalizeShareCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function generateShareCode() {
  let code = "";

  for (
    let i = 0;
    i < SHARE_CODE_LENGTH;
    i++
  ) {
    const index = crypto.randomInt(
      0,
      SHARE_CODE_CHARS.length
    );

    code += SHARE_CODE_CHARS[index];
  }

  return code;
}

function buildCopiedMaterialName(sourceName) {
  const suffix = "（共有）";
  const maxBaseLength = 255 - suffix.length;

  const baseName = String(
    sourceName || "問題セット"
  ).slice(0, maxBaseLength);

  return `${baseName}${suffix}`;
}

/**
 * 問題セットの公開・非公開を切り替える。
 *
 * 公開:
 *   is_shared = 1
 *   コードがなければ作成
 *
 * 非公開:
 *   is_shared = 0
 *   コードを削除
 */
async function setShareStatus({
  materialId,
  userId,
  shared
}) {
  const safeMaterialId = String(
    materialId || ""
  ).trim();

  const safeUserId = String(
    userId || ""
  ).trim();

  const shouldShare = Boolean(shared);

  if (!safeMaterialId || !safeUserId) {
    throw createShareError(
      "問題セットまたはユーザー情報が不足しています"
    );
  }

  const conn =
    await materialShareRepository.getConnection();

  try {
    await conn.beginTransaction();

    const material =
      await materialShareRepository
        .findOwnedMaterialForUpdate(
          conn,
          safeMaterialId,
          safeUserId
        );

    if (!material) {
      throw createShareError(
        "問題セットが見つからないか、管理権限がありません",
        404
      );
    }

    const updated =
      await materialShareRepository
        .updateMaterialShareStatus(
          conn,
          safeMaterialId,
          safeUserId,
          shouldShare
        );

    if (!updated) {
      throw createShareError(
        "公開状態を更新できませんでした",
        500
      );
    }

    /*
     * 非公開時は共有コードも削除する。
     */
    if (!shouldShare) {
      await materialShareRepository
        .deleteShareCodeByMaterialId(
          conn,
          safeMaterialId
        );

      await conn.commit();

      return {
        materialId: safeMaterialId,
        materialName: material.material_name,
        shared: false,
        shareCode: null
      };
    }

    /*
     * すでに共有コードがあれば同じコードを返す。
     */
    const existing =
      await materialShareRepository
        .findShareCodeByMaterialId(
          conn,
          safeMaterialId
        );

    if (existing) {
      await conn.commit();

      return {
        materialId: safeMaterialId,
        materialName: material.material_name,
        shared: true,
        shareCode: existing.share_code
      };
    }

    /*
     * 新しい共有コードを作る。
     */
    let shareCode = "";

    for (
      let attempt = 0;
      attempt < 30;
      attempt++
    ) {
      const candidate = generateShareCode();

      try {
        await materialShareRepository
          .insertShareCode(
            conn,
            safeMaterialId,
            candidate
          );

        shareCode = candidate;
        break;
      } catch (err) {
        /*
         * コードが偶然重複した場合は再生成する。
         */
        if (err.code === "ER_DUP_ENTRY") {
          continue;
        }

        throw err;
      }
    }

    if (!shareCode) {
      throw createShareError(
        "共有コードを生成できませんでした",
        500
      );
    }

    await conn.commit();

    return {
      materialId: safeMaterialId,
      materialName: material.material_name,
      shared: true,
      shareCode
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 公開中の問題セットを共有コードからコピーする。
 *
 * コードは何人でも使用できる。
 * コードを使用済みにはしない。
 */
async function receiveByCode({
  code,
  userId
}) {
  const safeCode = normalizeShareCode(code);

  const safeUserId = String(
    userId || ""
  ).trim();

  if (!safeCode) {
    throw createShareError(
      "共有コードを入力してください"
    );
  }

  if (safeCode.length !== SHARE_CODE_LENGTH) {
    throw createShareError(
      "共有コードは8文字で入力してください"
    );
  }

  if (!safeUserId) {
    throw createShareError(
      "ログインユーザーが確認できません",
      401
    );
  }

  const conn =
    await materialShareRepository.getConnection();

  try {
    await conn.beginTransaction();

    /*
     * コードから問題セットIDを取得する。
     */
    const shareCodeRow =
      await materialShareRepository
        .findShareCodeByCode(
          conn,
          safeCode
        );

    if (!shareCodeRow) {
      throw createShareError(
        "共有コードが見つかりません",
        404
      );
    }

    /*
     * materialsをロックし、公開中か確認する。
     */
    const sourceMaterial =
      await materialShareRepository
        .findMaterialByIdForUpdate(
          conn,
          shareCodeRow.material_id
        );

    if (
      !sourceMaterial ||
      Number(sourceMaterial.is_shared) !== 1
    ) {
      throw createShareError(
        "共有コードが見つからないか、この問題セットは現在非公開です",
        404
      );
    }

    /*
     * 公開状態確認後にコード行もロックして再確認する。
     * 非公開処理との競合対策。
     */
    const lockedCodeRow =
      await materialShareRepository
        .findShareCodeByCodeForUpdate(
          conn,
          safeCode,
          sourceMaterial.material_id
        );

    if (!lockedCodeRow) {
      throw createShareError(
        "共有コードが見つからないか、この問題セットは現在非公開です",
        404
      );
    }

    const user =
      await materialShareRepository.findUserById(
        conn,
        safeUserId
      );

    if (!user) {
      throw createShareError(
        "受取ユーザーが見つかりません",
        404
      );
    }

    /*
     * 元問題を取得する。
     */
    const sourceQuestions =
      await materialShareRepository
        .findQuestionsByMaterialId(
          conn,
          sourceMaterial.material_id
        );

    const sourceQuestionIds =
      sourceQuestions.map(question => {
        return question.question_id;
      });

    const sourceChoices =
      await materialShareRepository
        .findChoicesByQuestionIds(
          conn,
          sourceQuestionIds
        );

    const choicesByQuestionId = new Map();

    for (const choice of sourceChoices) {
      if (
        !choicesByQuestionId.has(
          choice.question_id
        )
      ) {
        choicesByQuestionId.set(
          choice.question_id,
          []
        );
      }

      choicesByQuestionId
        .get(choice.question_id)
        .push(choice);
    }

    /*
     * 受取人用の新しい問題セットを作る。
     */
    const newMaterialId =
      `mat_${crypto.randomUUID()}`;

    const newMaterialName =
      buildCopiedMaterialName(
        sourceMaterial.material_name
      );

    await materialShareRepository
      .insertCopiedMaterial(
        conn,
        {
          materialId: newMaterialId,
          userId: safeUserId,
          categoryId:
            sourceMaterial.category_id,
          materialName: newMaterialName,
          imageText:
            sourceMaterial.image_text
        }
      );

    /*
     * 問題・選択肢・タグをコピーする。
     */
    for (
      const sourceQuestion of sourceQuestions
    ) {
      const newQuestionId =
        `q_${crypto.randomUUID()}`;

      await materialShareRepository
        .insertCopiedQuestion(
          conn,
          {
            questionId: newQuestionId,
            materialId: newMaterialId,
            questionText:
              sourceQuestion.question_text,
            explanation:
              sourceQuestion.explanation
          }
        );

      const choices =
        choicesByQuestionId.get(
          sourceQuestion.question_id
        ) || [];

      for (const sourceChoice of choices) {
        await materialShareRepository
          .insertCopiedChoice(
            conn,
            {
              choiceId: crypto.randomUUID(),
              questionId: newQuestionId,
              choiceLabel:
                sourceChoice.choice_label,
              choiceText:
                sourceChoice.choice_text,
              isCorrect:
                Number(
                  sourceChoice.is_correct
                ) === 1
            }
          );
      }

      await materialShareRepository
        .copyQuestionTags(
          conn,
          sourceQuestion.question_id,
          newQuestionId
        );
    }

    /*
     * 受取人の問題数を実データから再計算する。
     */
    await materialShareRepository
      .recalculateUserQuestionCount(
        conn,
        safeUserId
      );

    await conn.commit();

    return {
      id: newMaterialId,
      name: newMaterialName,
      questionCount: sourceQuestions.length,
      sourceMaterialId:
        sourceMaterial.material_id
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  normalizeShareCode,
  setShareStatus,
  receiveByCode
};