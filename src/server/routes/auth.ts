import { Router } from "express";
import bcrypt from "bcryptjs";
import { store } from "../db";
import { signToken, authRequired } from "../jwt";

const router = Router();

router.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" });
    return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: "用户名长度需3-20个字符" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "密码至少6个字符" });
    return;
  }

  if (store.findUserByName(username)) {
    res.status(409).json({ error: "用户名已存在" });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = store.createUser(username, hash);

  const initialSave = {
    gold: 1000,
    diamond: 50,
    keys: 1,
    highScore: 0,
    totalRuns: 0,
    totalDistance: 0,
    skins: ["default"],
    equippedId: "default",
    powerUpLevels: {
      jetpack: 1,
      magnet: 1,
      superShoes: 1,
      scoreMultiplier: 1,
      shield: 1,
    },
    pityCounter: { rare: 0, epic: 0, legendary: 0 },
    fragments: {},
    dailySignDays: 0,
    lastSignDate: "",
    membership: { tier: "none", expireAt: 0, dailyDiamondClaimed: "" },
    totalCharged: 0,
  };
  store.upsertSave(user.id, initialSave);

  const token = signToken({ userId: user.id, username: user.username });
  res.json({
    token,
    user: { id: user.id, username: user.username },
  });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "用户名和密码不能为空" });
    return;
  }

  const user = store.findUserByName(username);
  if (!user) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }

  store.updateUserLogin(user.id);

  const token = signToken({ userId: user.id, username: user.username });
  res.json({
    token,
    user: { id: user.id, username: user.username },
  });
});

router.get("/me", authRequired, (req, res) => {
  res.json({
    user: { id: req.user!.userId, username: req.user!.username },
  });
});

export default router;
