import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, MEMBERSHIP_CONFIG, type MembershipTier } from "../game/store";
import { audio } from "../game/audio";

const TIER_ORDER: MembershipTier[] = ["bronze", "silver", "gold", "diamond"];
const DURATION_OPTIONS = [
  { days: 30, label: "1个月", discount: 1 },
  { days: 90, label: "3个月", discount: 0.9 },
  { days: 365, label: "1年", discount: 0.75 },
  { days: 0, label: "永久", discount: 5 },
];

export default function Membership() {
  const navigate = useNavigate();
  const membership = useGameStore((s) => s.membership);
  const activateMembership = useGameStore((s) => s.activateMembership);
  const isMembershipActive = useGameStore((s) => s.isMembershipActive);
  const canClaimDailyMemberDiamond = useGameStore((s) => s.canClaimDailyMemberDiamond);
  const claimDailyMemberDiamond = useGameStore((s) => s.claimDailyMemberDiamond);
  const diamond = useGameStore((s) => s.diamond);

  const [selectedTier, setSelectedTier] = useState<MembershipTier>("bronze");
  const [selectedDays, setSelectedDays] = useState(30);
  const [showConfirm, setShowConfirm] = useState<MembershipTier | null>(null);
  const [toast, setToast] = useState("");

  const active = isMembershipActive();
  const currentConfig = MEMBERSHIP_CONFIG[membership.tier];

  const calcPrice = (tier: MembershipTier, days: number) => {
    const base = MEMBERSHIP_CONFIG[tier].price;
    const opt = DURATION_OPTIONS.find((o) => o.days === days);
    const discount = opt?.discount || 1;
    return Math.floor(base * discount);
  };

  const handleClaim = () => {
    if (claimDailyMemberDiamond()) {
      const amount = MEMBERSHIP_CONFIG[membership.tier].dailyDiamond;
      setToast(`领取成功! +${amount}钻石`);
      audio.sfxPowerUp();
      setTimeout(() => setToast(""), 2000);
    }
  };

  const handleActivate = (tier: MembershipTier) => {
    setShowConfirm(tier);
    audio.sfxClick();
  };

  const confirmActivate = () => {
    if (!showConfirm) return;
    // 模拟支付: 实际项目应调用支付SDK
    activateMembership(showConfirm, selectedDays);
    audio.sfxLegendary();
    setToast(`开通成功! 获得${MEMBERSHIP_CONFIG[showConfirm].diamondBonus}钻石`);
    setShowConfirm(null);
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg holo-button">
          <span className="text-neon-blue">◆</span>
          <span className="font-orbitron text-sm neon-text-blue tabular-nums">{diamond}</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto pt-20 pb-8 px-6 overflow-y-auto h-full">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="font-orbitron text-4xl font-black neon-text-gold mb-2">
            会员中心
          </h1>
          <p className="font-mono text-xs text-neon-blue/60 tracking-widest">
            MEMBERSHIP · 尊享特权
          </p>
        </div>

        {/* 当前会员状态 */}
        <div
          className="mb-8 px-6 py-5 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${currentConfig.color}20, transparent)`,
            border: `2px solid ${active ? currentConfig.color : "#2A2A3E"}`,
            boxShadow: active ? `0 0 30px ${currentConfig.color}40` : "none",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">{currentConfig.icon}</div>
              <div>
                <div className="font-orbitron text-2xl font-bold" style={{ color: currentConfig.color }}>
                  {currentConfig.name}
                </div>
                {active ? (
                  <div className="font-mono text-xs text-neon-blue/70 mt-1">
                    {membership.expireAt === 0
                      ? "永久有效"
                      : `到期: ${new Date(membership.expireAt).toLocaleDateString("zh-CN")}`}
                  </div>
                ) : (
                  <div className="font-mono text-xs text-neon-blue/50 mt-1">
                    未开通会员
                  </div>
                )}
              </div>
            </div>
            {active && canClaimDailyMemberDiamond() && (
              <button
                onClick={handleClaim}
                className="px-5 py-2.5 rounded-xl font-orbitron text-sm font-bold neon-text-gold animate-pulse-glow"
                style={{ background: "rgba(255, 215, 0, 0.1)", border: "2px solid #FFD700" }}
              >
                领取每日 ◆{currentConfig.dailyDiamond}
              </button>
            )}
            {active && !canClaimDailyMemberDiamond() && (
              <div className="font-mono text-xs text-neon-blue/50">
                今日已领取
              </div>
            )}
          </div>
        </div>

        {/* 会员套餐选择 */}
        <div className="mb-6">
          <h2 className="font-orbitron text-lg neon-text-blue mb-4">选择会员等级</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TIER_ORDER.map((tier) => {
              const cfg = MEMBERSHIP_CONFIG[tier];
              const isCurrent = membership.tier === tier && active;
              const isSelected = selectedTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => { setSelectedTier(tier); audio.sfxClick(); }}
                  className={`relative px-4 py-4 rounded-xl transition-all ${
                    isSelected ? "scale-105" : "opacity-70"
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${cfg.color}20, transparent)`,
                    border: `2px solid ${isSelected ? cfg.color : "#2A2A3E"}`,
                    boxShadow: isSelected ? `0 0 20px ${cfg.color}60` : "none",
                  }}
                >
                  {isCurrent && (
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-neon-gold text-xs font-bold text-neon-bg">
                      当前
                    </div>
                  )}
                  <div className="text-3xl mb-2">{cfg.icon}</div>
                  <div className="font-orbitron text-sm font-bold" style={{ color: cfg.color }}>
                    {cfg.name}
                  </div>
                  <div className="font-mono text-xs text-neon-blue/60 mt-1">
                    ¥{cfg.price}/月
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 时长选择 */}
        <div className="mb-6">
          <h2 className="font-orbitron text-lg neon-text-blue mb-4">选择时长</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DURATION_OPTIONS.map((opt) => {
              const isSelected = selectedDays === opt.days;
              const price = calcPrice(selectedTier, opt.days);
              return (
                <button
                  key={opt.days}
                  onClick={() => { setSelectedDays(opt.days); audio.sfxClick(); }}
                  className={`px-4 py-3 rounded-xl transition-all ${
                    isSelected ? "holo-button scale-105" : "opacity-70 border border-neon-gray/50"
                  }`}
                >
                  <div className="font-orbitron text-sm neon-text-blue">{opt.label}</div>
                  <div className="font-mono text-xs text-neon-gold mt-1">¥{price}</div>
                  {opt.discount < 1 && (
                    <div className="font-mono text-xs text-neon-pink mt-0.5">
                      {(opt.discount * 10).toFixed(1)}折
                    </div>
                  )}
                  {opt.days === 0 && (
                    <div className="font-mono text-xs text-neon-gold mt-0.5">永久</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 特权展示 */}
        <div className="mb-6 px-6 py-5 rounded-2xl holo-button">
          <h2 className="font-orbitron text-lg neon-text-blue mb-3">
            {MEMBERSHIP_CONFIG[selectedTier].name} 特权
          </h2>
          <ul className="space-y-2">
            {MEMBERSHIP_CONFIG[selectedTier].perks.map((perk, i) => (
              <li key={i} className="font-mono text-sm text-neon-blue/80 flex items-start gap-2">
                <span className="text-neon-gold">▸</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-neon-blue/20 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-mono text-xs text-neon-blue/60">开通即送</div>
              <div className="font-orbitron text-lg neon-text-blue">
                ◆{MEMBERSHIP_CONFIG[selectedTier].diamondBonus}
              </div>
            </div>
            <div>
              <div className="font-mono text-xs text-neon-blue/60">每日领取</div>
              <div className="font-orbitron text-lg neon-text-gold">
                ◆{MEMBERSHIP_CONFIG[selectedTier].dailyDiamond}
              </div>
            </div>
            <div>
              <div className="font-mono text-xs text-neon-blue/60">获取倍率</div>
              <div className="font-orbitron text-lg neon-text-pink">
                ×{MEMBERSHIP_CONFIG[selectedTier].multiplier}
              </div>
            </div>
          </div>
        </div>

        {/* 开通按钮 */}
        <button
          onClick={() => handleActivate(selectedTier)}
          className="w-full py-4 rounded-xl font-orbitron text-xl font-bold neon-text-gold animate-pulse-glow"
          style={{
            background: "rgba(255, 215, 0, 0.1)",
            border: "2px solid #FFD700",
          }}
        >
          立即开通 · ¥{calcPrice(selectedTier, selectedDays)}
        </button>
      </div>

      {/* 确认弹窗 */}
      {showConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="px-8 py-6 rounded-2xl holo-button max-w-sm w-full mx-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">{MEMBERSHIP_CONFIG[showConfirm].icon}</div>
              <div className="font-orbitron text-xl neon-text-gold mb-1">
                确认开通{MEMBERSHIP_CONFIG[showConfirm].name}
              </div>
              <div className="font-mono text-xs text-neon-blue/70">
                {DURATION_OPTIONS.find((o) => o.days === selectedDays)?.label} · ¥{calcPrice(showConfirm, selectedDays)}
              </div>
            </div>
            <div className="px-4 py-3 rounded-lg bg-neon-gold/10 mb-4 font-mono text-xs text-neon-gold/80 text-center">
              开通即送 ◆{MEMBERSHIP_CONFIG[showConfirm].diamondBonus} 钻石
              {showConfirm === "diamond" && " + 🔑3 钥匙"}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(null); audio.sfxClick(); }}
                className="flex-1 py-3 rounded-xl holo-button font-orbitron text-sm neon-text-blue"
              >
                取消
              </button>
              <button
                onClick={confirmActivate}
                className="flex-1 py-3 rounded-xl font-orbitron text-sm font-bold neon-text-gold"
                style={{ background: "rgba(255, 215, 0, 0.1)", border: "2px solid #FFD700" }}
              >
                确认支付
              </button>
            </div>
            <div className="mt-3 font-mono text-xs text-neon-blue/40 text-center">
              (模拟支付 · 实际项目接入支付SDK)
            </div>
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
