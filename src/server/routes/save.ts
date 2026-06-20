import { Router } from "express";
import { store } from "../db";
import { authRequired } from "../jwt";

const router = Router();

router.get("/", authRequired, (req, res) => {
  const userId = req.user!.userId;
  const save = store.getSave(userId);
  if (!save) {
    res.status(404).json({ error: "存档不存在" });
    return;
  }
  res.json({
    data: save.data,
    updatedAt: save.updatedAt,
  });
});

router.post("/", authRequired, (req, res) => {
  const userId = req.user!.userId;
  const { data } = req.body;

  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "存档数据无效" });
    return;
  }

  store.upsertSave(userId, data);
  res.json({ success: true, updatedAt: Date.now() });
});

export default router;
