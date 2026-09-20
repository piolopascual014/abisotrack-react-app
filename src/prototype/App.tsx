import { useState } from "react";
import { AdminApp } from "./admin/AdminApp";
import { MobileApp } from "./mobile/MobileApp";

export function App() {
  const [mode, setMode] = useState<"admin" | "mobile">(() => (sessionStorage.getItem("abisotrack-mode") as "admin" | "mobile") || "admin");
  const switchMode = (next: "admin" | "mobile") => { sessionStorage.setItem("abisotrack-mode", next); setMode(next); };
  return mode === "admin" ? <AdminApp onSwitch={() => switchMode("mobile")}/> : <MobileApp onSwitch={() => switchMode("admin")}/>;
}
