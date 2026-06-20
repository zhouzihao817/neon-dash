import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import { audio } from "../game/audio";
import {
  SKINS,
  POWERUPS,
  RARITY_NAMES,
  RARITY_COLORS,
  type PowerUpType,
} from "../game/config";

export default function Shop() {
  const navigate = useNavigate();
  const gold = useGameStore((s) => s.gold);
  const diamond = useGameStore((s) => s.diamond);
  const skins = useGameStore((s) => s.skins);
  const equippedId = useGameStore((s) => s.equippedId);
  const buySkin = useGameStore((s) => s.buySkin);
  const equipSkin = useGameStore((s) => s.equipSkin);
  const powerUpLevels = useGameStore((s) => s.powerUpLevels);
  const upgradePowerUp = useGameStore((s) => s.upgradePowerUp);

  const handleBack = () => {
    audio.sfxClick();
    navigate("/");
  };

  const handleBuy = (skinId: string, useGold: boolean, useDiamond: boolean) => {
    const skin = SKINS.find((s) => s.id === skinId)!;
    if (useGold && gold < skin.priceGold) {
      audio.sfxComboBreak();
      return;
    }
    if (useDiamond && diamond < skin.priceDiamond) {
      audio.sfxComboBreak();
      return;
    }
    if (buySkin(skinId)) {
      audio.sfxLegendary();
      equipSkin(skinId);
    }
  };

  const handleEquip = (skinId: string) => {
    audio.sfxClick();
    equipSkin(skinId);
  };

  const handleUpgrade = (type: PowerUpType) => {
    const level = powerUpLevels[type];
    const cost = level * 500;
    if (gold < cost) {
      audio.sfxComboBreak();
      return;
    }
    if (upgradePowerUp(type)) audio.sfxPowerUp();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines flex flex-col">
      <div className="absolute inset-0 grid-bg opacity-20" />

      {/* 顶栏 */}
      <div className="relative z-10 flex items-center justify-between p-4 border-b border-neon-blue/30">
        <button
          onClick={handleBack}
          className="px-4 py-2 rounded-lg holo-button font-orbitron text-sm neon-text-blue"
        >
          ← 返回
        </button>
        <h2 className="font-orbitron text-2xl font-black neon-text-blue">
          商 城
        </h2>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg holo-button flex items-center gap-2">
            <span className="text-neon-gold">●</span>
            <span className="font-orbitron text-sm neon-text-gold tabular-nums">
              {gold.toLocaleString()}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg holo-button flex items-center gap-2">
            <span className="text-neon-blue">◆</span>
            <span className="font-orbitron text-sm neon-text-blue tabular-nums">
              {diamond}
            </span>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6">
        {/* 皮肤区 */}
        <section>
          <h3 className="font-orbitron text-lg neon-text-purple mb-3">
            ▸ 角色皮肤
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {SKINS.map((skin) => {
              const owned = skins.includes(skin.id);
              const equipped = equippedId === skin.id;
              const rarityColor = RARITY_COLORS[skin.rarity];
              return (
                <div
                  key={skin.id}
                  className="relative p-3 rounded-xl bg-neon-gray/30 backdrop-blur-sm transition-all hover:scale-105"
                  style={{
                    border: `1px solid ${rarityColor}`,
                    boxShadow: `0 0 12px ${rarityColor}40`,
                  }}
                >
                  {/* 稀有度标签 */}
                  <div
                    className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-mono"
                    style={{
                      background: `${rarityColor}30`,
                      color: rarityColor,
                    }}
                  >
                    {RARITY_NAMES[skin.rarity]}
                  </div>

                  {/* 皮肤预览 */}
                  <div className="flex justify-center my-3">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{
                        background: `radial-gradient(circle, ${skin.color}40, transparent)`,
                        boxShadow: `0 0 20px ${skin.color}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full"
                        style={{
                          background: skin.color,
                          boxShadow: `0 0 15px ${skin.color}`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="font-orbitron text-sm text-center mb-1" style={{ color: skin.color }}>
                    {skin.name}
                  </div>
                  <div className="font-mono text-xs text-neon-blue/50 text-center mb-2 h-8 overflow-hidden">
                    {skin.description}
                  </div>

                  {/* 操作按钮 */}
                  {owned ? (
                    <button
                      onClick={() => handleEquip(skin.id)}
                      disabled={equipped}
                      className={`w-full py-1.5 rounded-lg font-orbitron text-xs transition-all ${
                        equipped
                          ? "bg-neon-gold/20 text-neon-gold/50 cursor-default"
                          : "holo-button neon-text-blue"
                      }`}
                    >
                      {equipped ? "已装备" : "装备"}
                    </button>
                  ) : skin.rarity === 3 ? (
                    <div className="w-full py-1.5 rounded-lg font-orbitron text-xs text-center neon-text-gold bg-neon-gold/10">
                      仅限抽奖
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {skin.priceGold > 0 && (
                        <button
                          onClick={() => handleBuy(skin.id, true, false)}
                          className="w-full py-1 rounded-lg font-mono text-xs neon-text-gold bg-neon-gold/10 hover:bg-neon-gold/20 transition-all"
                        >
                          ● {skin.priceGold}
                        </button>
                      )}
                      {skin.priceDiamond > 0 && (
                        <button
                          onClick={() => handleBuy(skin.id, false, true)}
                          className="w-full py-1 rounded-lg font-mono text-xs neon-text-blue bg-neon-blue/10 hover:bg-neon-blue/20 transition-all"
                        >
                          ◆ {skin.priceDiamond}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 道具升级区 */}
        <section>
          <h3 className="font-orbitron text-lg neon-text-purple mb-3">
            ▸ 道具升级
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Object.keys(POWERUPS) as PowerUpType[]).map((type) => {
              const config = POWERUPS[type];
              const level = powerUpLevels[type];
              const cost = level * 500;
              return (
                <div
                  key={type}
                  className="p-3 rounded-xl bg-neon-gray/30 backdrop-blur-sm flex items-center gap-3"
                  style={{
                    border: `1px solid ${config.color}40`,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{
                      background: `${config.color}20`,
                      boxShadow: `0 0 10px ${config.color}40`,
                    }}
                  >
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-orbitron text-sm" style={{ color: config.color }}>
                      {config.name}
                    </div>
                    <div className="font-mono text-xs text-neon-blue/60">
                      Lv.{level} · 时长{config.duration + (level - 1) * 0.5}s
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade(type)}
                    className="px-3 py-1.5 rounded-lg font-mono text-xs neon-text-gold bg-neon-gold/10 hover:bg-neon-gold/20 transition-all"
                  >
                    ● {cost}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
