const express = require("express");
const materialsService = require("./materialsService");

const router = express.Router();

// GET /api/materials
// studyData.json から問題セット一覧と問題一覧を返す
router.get("/", (req, res) => {
  const payload = materialsService.getMaterialsPayload();

  res.json({
    ok: true,
    ...payload
  });
});

// GET /api/materials/:materialId
// 特定の問題セット詳細を返す
router.get("/:materialId", (req, res) => {
  const detail = materialsService.getMaterialDetail(req.params.materialId);

  if (!detail) {
    return res.status(404).json({
      ok: false,
      message: "問題セットが見つかりません"
    });
  }

  res.json({
    ok: true,
    ...detail
  });
});

// PATCH /api/materials/:materialId/share
// 問題セットの公開状態を変更する
router.patch("/:materialId/share", (req, res) => {
  const result = materialsService.shareMaterial(req.params.materialId, req.body.shared);

  if (!result.ok) {
    return res.status(404).json(result);
  }

  res.json(result);
});

// POST /api/materials/:materialId/questions
// 問題を追加する
router.post("/:materialId/questions", (req, res) => {
  const result = materialsService.createQuestion(req.params.materialId, req.body);

  if (!result.ok) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// PUT /api/materials/:materialId/questions/:questionId
// 問題を編集する
router.put("/:materialId/questions/:questionId", (req, res) => {
  const result = materialsService.updateQuestion(
    req.params.materialId,
    req.params.questionId,
    req.body
  );

  if (!result.ok) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// DELETE /api/materials/:materialId/questions/:questionId
// 問題を削除する
router.delete("/:materialId/questions/:questionId", (req, res) => {
  const result = materialsService.removeQuestion(
    req.params.materialId,
    req.params.questionId
  );

  if (!result.ok) {
    return res.status(404).json(result);
  }

  res.json(result);
});

module.exports = router;