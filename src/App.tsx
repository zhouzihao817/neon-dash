import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Play from "./pages/Play";
import Result from "./pages/Result";
import Shop from "./pages/Shop";
import Lottery from "./pages/Lottery";
import Test from "./pages/Test";
import Login from "./pages/Login";
import Membership from "./pages/Membership";
import Recharge from "./pages/Recharge";
import Leaderboard from "./pages/Leaderboard";

export default function App() {
  return (
    <HashRouter>
      <div className="w-screen h-screen overflow-hidden bg-neon-bg">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/result" element={<Result />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/lottery" element={<Lottery />} />
          <Route path="/test" element={<Test />} />
          <Route path="/login" element={<Login />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/recharge" element={<Recharge />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
