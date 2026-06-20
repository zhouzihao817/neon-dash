import { Router } from "express";
import { store } from "../db";
import { authRequired } from "../jwt";

const router = Router();

const PACKAGES: Record<
  string,
  { price: number; diamond: number; bonus: number }
> = {
  rc_6: { price: 6, diamond: 60, bonus: 0 },
  rc_30: { price: 30, diamond: 300, bonus: 30 },
  rc_68: { price: 68, diamond: 680, bonus: 100 },
  rc_128: { price: 128, diamond: 1280, bonus: 280 },
  rc_328: { price: 328, diamond: 3280, bonus: 800 },
  rc_648: { price: 648, diamond: 6480, bonus: 2000 },
};

router.post("/order", authRequired, (req, res) => {
  const { packageId } = req.body;
  const pkg = PACKAGES[packageId];
  if (!pkg) {
    res.status(400).json({ error: "无效的套餐" });
    return;
  }

  const orderId = "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  store.createOrder(
    orderId,
    req.user!.userId,
    packageId,
    pkg.price,
    pkg.diamond,
    pkg.bonus,
  );

  res.json({
    orderId,
    packageId,
    amount: pkg.price,
    diamond: pkg.diamond,
    bonus: pkg.bonus,
    payParams: {
      mock: true,
      message: "模拟支付 - 直接调用 /confirm 完成支付",
    },
  });
});

router.post("/confirm", authRequired, (req, res) => {
  const { orderId } = req.body;
  const userId = req.user!.userId;

  if (!orderId) {
    res.status(400).json({ error: "缺少订单ID" });
    return;
  }

  const order = store.findOrder(orderId, userId);
  if (!order) {
    res.status(404).json({ error: "订单不存在" });
    return;
  }

  if (order.status === "confirmed") {
    res.status(400).json({ error: "订单已确认" });
    return;
  }

  store.confirmOrder(orderId);

  const save = store.getSave(userId);
  if (!save) {
    res.status(500).json({ error: "存档不存在" });
    return;
  }
  const data = save.data;
  const diamondBefore = data.diamond as number;
  const totalDiamond = order.diamond + order.bonus;

  const membership = data.membership as { tier: string } | undefined;
  const memberMultMap: Record<string, number> = {
    bronze: 1.1,
    silver: 1.2,
    gold: 1.3,
    diamond: 1.5,
  };
  const memberMult =
    membership && membership.tier !== "none"
      ? memberMultMap[membership.tier] || 1
      : 1;
  const memberBonus = Math.floor(totalDiamond * (memberMult - 1));

  data.diamond = diamondBefore + totalDiamond + memberBonus;
  data.totalCharged = (data.totalCharged as number) + order.amount;
  store.upsertSave(userId, data);

  res.json({
    success: true,
    diamondGained: totalDiamond + memberBonus,
    memberBonus,
    newDiamond: data.diamond,
  });
});

router.get("/orders", authRequired, (req, res) => {
  const orders = store.getUserOrders(req.user!.userId);
  res.json({ orders });
});

export default router;
