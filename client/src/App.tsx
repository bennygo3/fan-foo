import { NavLink, Outlet } from "react-router-dom";

export default function App() {
  const link = ({ isActive }: {isActive: boolean }) =>
    isActive ? "underline" : undefined;

  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <NavLink to="/" className={link}>Home</NavLink>
        <NavLink to="/players" className={link}>Players</NavLink>
        <NavLink to="/league/1/team/6" className={link}>My Team</NavLink>
        <NavLink to="/Scoreboard" className={link}>Scoreboard</NavLink>
        <NavLink to="/history" className={link}>Championships</NavLink>
      </header>
      <Outlet />
    </div>
  );
}
