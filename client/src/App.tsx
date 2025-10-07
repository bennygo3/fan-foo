import { NavLink, Outlet } from "react-router-dom";

export default function App() {
  const link = ({ isActive }: {isActive: boolean }) =>
    isActive ? "underline" : undefined;

  return (
    <div style={{ padding: 16 }}>
      <header style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <NavLink to="/" className={link}>Home</NavLink>
        <NavLink to="/players" className={link}>Players</NavLink>
      </header>
      <Outlet />
    </div>
  );
}
