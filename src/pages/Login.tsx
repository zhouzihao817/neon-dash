import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import { audio } from "../game/audio";

export default function Login() {
  const navigate = useNavigate();
  const account = useGameStore((s) => s.account);
  const loginAsGuest = useGameStore((s) => s.loginAsGuest);
  const serverLogin = useGameStore((s) => s.serverLogin);
  const serverRegister = useGameStore((s) => s.serverRegister);
  const serverLogout = useGameStore((s) => s.serverLogout);
  const syncToServer = useGameStore((s) => s.syncToServer);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setSuccess("");
    if (!username || !password) {
      setError("请输入用户名和密码");
      audio.sfxError();
      return;
    }
    setLoading(true);
    const ok = await serverLogin(username, password);
    setLoading(false);
    if (!ok) {
      setError("用户名或密码错误(或后端服务未启动)");
      audio.sfxError();
      return;
    }
    audio.sfxPowerUp();
    setSuccess("登录成功! 存档已同步");
    setTimeout(() => navigate("/"), 1000);
  };

  const handleRegister = async () => {
    setError("");
    setSuccess("");
    if (!username || !password) {
      setError("请输入用户名和密码");
      audio.sfxError();
      return;
    }
    if (username.length < 3) {
      setError("用户名至少3个字符");
      audio.sfxError();
      return;
    }
    if (password.length < 6) {
      setError("密码至少6个字符");
      audio.sfxError();
      return;
    }
    if (password !== confirmPwd) {
      setError("两次密码不一致");
      audio.sfxError();
      return;
    }
    setLoading(true);
    const ok = await serverRegister(username, password);
    setLoading(false);
    if (!ok) {
      setError("注册失败(用户名已存在或后端服务未启动)");
      audio.sfxError();
      return;
    }
    audio.sfxLegendary();
    setSuccess("注册成功! 存档已上传");
    setTimeout(() => navigate("/"), 1200);
  };

  const handleGuest = () => {
    loginAsGuest();
    audio.sfxClick();
    navigate("/");
  };

  const handleLogout = () => {
    // 退出前先上传存档
    if (!account.isGuest) {
      syncToServer();
    }
    serverLogout();
    audio.sfxClick();
    setMode("login");
    setUsername("");
    setPassword("");
    setConfirmPwd("");
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neon-bg scanlines flex items-center justify-center">
      <div className="absolute inset-0 grid-bg opacity-20" />

      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="font-orbitron text-4xl font-black neon-text-blue mb-2">
            霓虹冲刺
          </h1>
          <p className="font-mono text-xs text-neon-pink/70 tracking-widest">
            NEON DASH · 账号中心
          </p>
        </div>

        {account.isLoggedIn ? (
          /* 已登录状态 */
          <div className="space-y-6">
            <div className="px-6 py-8 rounded-2xl holo-button text-center">
              <div className="text-5xl mb-3">
                {account.isGuest ? "👤" : "🎮"}
              </div>
              <div className="font-orbitron text-xl neon-text-blue mb-1">
                {account.username}
              </div>
              <div className="font-mono text-xs text-neon-blue/60">
                {account.isGuest ? "游客账号(本地存档)" : "云端账号(已同步)"} · ID: {account.userId.slice(0, 12)}
              </div>
              <div className="font-mono text-xs text-neon-blue/40 mt-2">
                登录时间: {new Date(account.loginAt).toLocaleString("zh-CN")}
              </div>
            </div>

            {account.isGuest && (
              <div className="px-4 py-3 rounded-lg neon-border-gold bg-neon-gold/10 font-mono text-xs text-neon-gold/80 text-center">
                💡 游客账号数据仅保存在本地，建议注册正式账号以云端同步
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/")}
                className="flex-1 px-6 py-3 rounded-xl holo-button font-orbitron text-lg neon-text-blue"
              >
                进入游戏
              </button>
              <button
                onClick={handleLogout}
                className="px-6 py-3 rounded-xl font-orbitron text-lg neon-text-pink"
                style={{
                  background: "rgba(255, 45, 149, 0.1)",
                  border: "2px solid #FF2D95",
                }}
              >
                退出登录
              </button>
            </div>
          </div>
        ) : (
          /* 未登录状态 */
          <div className="space-y-6">
            {/* 模式切换 */}
            <div className="flex gap-2 p-1 rounded-xl bg-neon-gray/30">
              <button
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 rounded-lg font-orbitron text-sm transition-all ${
                  mode === "login"
                    ? "neon-text-blue bg-neon-blue/10"
                    : "text-neon-blue/50"
                }`}
              >
                登录
              </button>
              <button
                onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 rounded-lg font-orbitron text-sm transition-all ${
                  mode === "register"
                    ? "neon-text-pink bg-neon-pink/10"
                    : "text-neon-blue/50"
                }`}
              >
                注册
              </button>
            </div>

            {/* 表单 */}
            <div className="space-y-4 px-6 py-8 rounded-2xl holo-button">
              <div>
                <label className="block font-mono text-xs text-neon-blue/70 mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3-20个字符"
                  maxLength={20}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-neon-bg/60 border border-neon-blue/30 font-mono text-sm text-neon-blue focus:outline-none focus:border-neon-blue disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-neon-blue/70 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6个字符"
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-neon-bg/60 border border-neon-blue/30 font-mono text-sm text-neon-blue focus:outline-none focus:border-neon-blue disabled:opacity-50"
                />
              </div>
              {mode === "register" && (
                <div>
                  <label className="block font-mono text-xs text-neon-blue/70 mb-1">
                    确认密码
                  </label>
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="再次输入密码"
                    disabled={loading}
                    className="w-full px-4 py-2 rounded-lg bg-neon-bg/60 border border-neon-blue/30 font-mono text-sm text-neon-blue focus:outline-none focus:border-neon-blue disabled:opacity-50"
                  />
                </div>
              )}

              {error && (
                <div className="px-3 py-2 rounded-lg bg-neon-pink/10 border border-neon-pink/50 font-mono text-xs text-neon-pink">
                  ⚠ {error}
                </div>
              )}
              {success && (
                <div className="px-3 py-2 rounded-lg bg-neon-gold/10 border border-neon-gold/50 font-mono text-xs text-neon-gold">
                  ✓ {success}
                </div>
              )}

              <button
                onClick={mode === "login" ? handleLogin : handleRegister}
                disabled={loading}
                className="w-full py-3 rounded-xl font-orbitron text-lg font-bold neon-text-gold animate-pulse-glow disabled:opacity-50"
                style={{
                  background: "rgba(255, 215, 0, 0.1)",
                  border: "2px solid #FFD700",
                }}
              >
                {loading ? "处理中..." : mode === "login" ? "登 录" : "注 册 并 登 录"}
              </button>
            </div>

            {/* 游客登录 */}
            <div className="text-center">
              <div className="font-mono text-xs text-neon-blue/40 mb-2">— 或者 —</div>
              <button
                onClick={handleGuest}
                disabled={loading}
                className="px-6 py-2 rounded-lg holo-button font-orbitron text-sm neon-text-purple disabled:opacity-50"
              >
                👤 游客登录
              </button>
            </div>

            <div className="text-center font-mono text-xs text-neon-blue/40">
              💡 正式账号支持云端存档、跨设备同步、全球排行榜
            </div>
          </div>
        )}

        {/* 返回按钮 */}
        <button
          onClick={() => { audio.sfxClick(); navigate("/"); }}
          className="absolute top-4 left-4 px-4 py-2 rounded-lg holo-button font-mono text-xs neon-text-blue/70"
        >
          ← 返回
        </button>
      </div>
    </div>
  );
}
