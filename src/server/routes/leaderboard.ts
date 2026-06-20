import { Router } from "express";
import { store } from "../db";
import { authRequired } from "../jwt";

const router = Router();

router.post("/submit", authRequired, (req, res) => {
  const { score, distance, maxCombo, perfectDodges } = req.body;
  if (
    typeof score !== "number" ||
    typeof distance !== "number" ||
    typeof maxCombo !== "number" ||
    typeof perfectDodges !== "number"
  ) {
    res.status(400).json({ error: "参数无效" });
    return;
  }

  const { rank } = store.submitScore(
    req.user!.userId,
    req.user!.username,
    score,
    distance,
    maxCombo,
    perfectDodges,
  );

  res.json({ success: true, rank });
});

router.get("/", (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit)) || 100, 200);
  const rows = store.getLeaderboard(limit);
  res.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      score: r.score,
      distance: r.distance,
      maxCombo: r.maxCombo,
      perfectDodges: r.perfectDodges,
      createdAt: r.createdAt,
    })),
  });
});

router.get("/me", authRequired, (req, res) => {
  const { rank, bestScore } = store.getUserRank(req.user!.userId);
  res.json({ rank, bestScore });
});

export default router;
