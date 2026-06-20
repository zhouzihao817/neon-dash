import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, RECHARGE_PACKAGES } from "../game/store";
import { audio } from "../game/audio";
import { api } from "../game/api";

export default function Recharge() {
  const navigate = useNavigate();
  const diamond = useGameStore((s) => s.diamond);
  const totalCharged = useGameStore((s) => s.totalCharged);
  const getMembershipMultiplier = useGameStore((s) => s.getMembershipMultiplier);
  const syncFromServer = useGameStore((s) => s.syncFromServer);
  const account = useGameStore((s) => s.account);

  const [confirmPkg, setConfirmPkg] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [processing, setProcessing] = useState(false);

  const memberMult = getMembershipMultiplier();

  const handleRecharge = (pkgId: string) => {
    setConfirmPkg(pkgId);
    audio.sfxClick();
  };

  const confirmRecharge = async () => {
    if (!confirmPkg) return;
    setProcessing(true);

    // 正式账号走后端订单流程
    if (!account.isGuest && account.isLoggedIn) {
      try {
        const order = await api.recharge.createOrder(confirmPkg);
        const result = await api.recharge.confirm(order.orderId);
        // 从服务器同步最新存档
        await syncFromServer();
        setToast(`充值成功! 获得 ◆${result.diamondGained}`);
        audio.sfxLegendary();
      } catch (e) {
        setToast("充值失败: " + (e as Error).message);
        audio.sfxError();
      }
    } else {
      // 游客账号走本地模拟
      const ok = useGameStore.getState().recharge(confirmPkg);
      if (ok) {
        const pkg = RECHARGE_PACKAGES.find((p) => p.id === confirmPkg);
        const total = (pkg?.diamond || 0) + (pkg?.bonus || 0);
        const memberBonus = Math.floor(total * (memberMult - 1));
        setToast(`充值成功! 获得 ◆${total + memberBonus} (本地)`);
        audio.sfxLegendary();
      } else {
        setToast("充值失败");
        audio.sfxError();
      }
    }

    setProcessing(false);
    setConfirmPkg(null);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* 顶部栏 */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between">
        <button
          onClick={() => { audio.sfxClick(); navigate("/"); }}
          className="px-4 py-2 rounded-lg holo-button font-mono text-xs neon-text-blue/70"
        >
          ← 返回
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg holo-button">
            <span className="text-neon-blue">◆</span>
            <span className="font-orbitron text-sm neon-text-blue tabular-nums">{diamond}</span>
          </div>
          {memberMult > 1 && (
            <div className="px-3 py-1.5 rounded-lg neon-border-gold bg-neon-gold/10 font-mono text-xs neon-text-gold">
              会员×{memberMult}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto pt-20 pb-8 px-6 overflow-y-auto h-full">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="font-orbitron text-4xl font-black neon-text-blue mb-2">
            钻石充值
          </h1>
          <p className="font-mono text-xs text-neon-pink/70 tracking-widest">
            RECHARGE · 即刻拥有
          </p>
          {account.isGuest && (
            <div className="mt-3 inline-block px-4 py-1.5 rounded-lg neon-border-gold bg-neon-gold/10 font-mono text-xs text-neon-gold">
              💡 游客模式: 充值仅本地生效，建议登录正式账号
            </div>
          )}
        </div>

        {/* 累计充值 */}
        <div className="mb-8 px-6 py-4 rounded-xl holo-button flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-neon-blue/60">累计充值</div>
            <div className="font-orbitron text-2xl neon-text-gold tabular-nums">
              ¥{totalCharged}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-neon-blue/60">当前钻石</div>
            <div className="font-orbitron text-2xl neon-text-blue tabular-nums">
              ◆{diamond}
            </div>
          </div>
        </div>

        {/* 套餐网格 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {RECHARGE_PACKAGES.map((pkg) => {
            const total = pkg.diamond + pkg.bonus;
            const memberBonus = Math.floor(total * (memberMult - 1));
            return (
              <button
                key={pkg.id}
                onClick={() => handleRecharge(pkg.id)}
                className={`relative px-4 py-5 rounded-2xl transition-all hover:scale-105 ${
                  pkg.popular ? "neon-border-gold" : "holo-button"
                }`}
                style={
                  pkg.popular
                    ? { background: "rgba(255, 215, 0, 0.08)" }
                    : {}
                }
              >
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-neon-pink text-xs font-bold text-white">
                    🔥 热销
                  </div>
                )}
                <div className="text-4xl mb-2">{pkg.icon}</div>
                <div className="font-orbitron text-base neon-text-blue mb-1">
                  {pkg.name}
                </div>
                <div className="font-mono text-xs text-neon-blue/60 mb-3">
                  ◆{pkg.diamond}
                  {pkg.bonus > 0 && (
                    <span className="text-neon-gold"> +{pkg.bonus}</span>
                  )}
                </div>
                {memberBonus > 0 && (
                  <div className="font-mono text-xs text-neon-gold mb-2">
                    会员加成 +{memberBonus}
                  </div>
                )}
                <div
                  className="font-orbitron text-xl font-bold neon-text-gold tabular-nums"
                >
                  ¥{pkg.price}
                </div>
              </button>
            );
          })}
        </div>

        {/* 充值说明 */}
        <div className="mt-8 px-6 py-4 rounded-xl bg-neon-gray/20 border border-neon-blue/20">
          <div className="font-orbitron text-sm neon-text-blue mb-2">充值说明</div>
          <ul className="space-y-1 font-mono text-xs text-neon-blue/60">
            <li>• 钻石可用于购买皮肤、抽奖、解锁特权等</li>
            <li>• 会员用户充值享受额外钻石加成</li>
            <li>• 正式账号充值后存档自动云端同步</li>
            <li>• 本页面为模拟支付，实际项目需接入支付SDK</li>
          </ul>
        </div>
      </div>

      {/* 确认弹窗 */}
      {confirmPkg && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="px-8 py-6 rounded-2xl holo-button max-w-sm w-full mx-6">
            {(() => {
              const pkg = RECHARGE_PACKAGES.find((p) => p.id === confirmPkg)!;
              const total = pkg.diamond + pkg.bonus;
              const memberBonus = Math.floor(total * (memberMult - 1));
              return (
                <>
                  <div className="text-center mb-4">
                    <div className="text-5xl mb-2">{pkg.icon}</div>
                    <div className="font-orbitron text-xl neon-text-gold mb-1">
                      {pkg.name}
                    </div>
                    <div className="font-mono text-xs text-neon-blue/70">
                      支付 ¥{pkg.price}
                    </div>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-neon-blue/10 mb-4">
                    <div className="font-mono text-xs text-neon-blue/80 space-y-1">
                      <div className="flex justify-between">
                        <span>基础钻石</span>
                        <span className="neon-text-blue">◆{pkg.diamond}</span>
                      </div>
                      {pkg.bonus > 0 && (
                        <div className="flex justify-between">
                          <span>额外赠送</span>
                          <span className="neon-text-gold">◆{pkg.bonus}</span>
                        </div>
                      )}
                      {memberBonus > 0 && (
                        <div className="flex justify-between">
                          <span>会员加成(×{memberMult})</span>
                          <span className="neon-text-gold">◆{memberBonus}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-neon-blue/20">
                        <span className="font-bold">实际获得</span>
                        <span className="font-orbitron neon-text-gold">◆{total + memberBonus}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setConfirmPkg(null); audio.sfxClick(); }}
                      disabled={processing}
                      className="flex-1 py-3 rounded-xl holo-button font-orbitron text-sm neon-text-blue disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmRecharge}
                      disabled={processing}
                      className="flex-1 py-3 rounded-xl font-orbitron text-sm font-bold neon-text-gold disabled:opacity-50"
                      style={{ background: "rgba(255, 215, 0, 0.1)", border: "2px solid #FFD700" }}
                    >
                      {processing ? "处理中..." : "确认支付"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Toast提示 */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl neon-border-gold bg-neon-gold/10 font-orbitron text-sm neon-text-gold animate-float">
          {toast}
        </div>
      )}
    </div>
  );
}
