import { useState } from "react";
import { AdminApp } from "./admin/AdminApp";
import { MobileApp } from "./mobile/MobileApp";
import { Brand } from "./components/Brand";
import { useAppState } from "./state/AppStateProvider";

export function App() {
  const { configured, loading, error, clearError, restoreAdmin } = useAppState();
  const [mode, setMode] = useState<"admin" | "mobile">(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return requested === "mobile" ? "mobile" : (sessionStorage.getItem("abisotrack-mode") as "admin" | "mobile") || "admin";
  });
  const switchMode = (next: "admin" | "mobile") => { sessionStorage.setItem("abisotrack-mode", next); setMode(next); if (next === "admin") void restoreAdmin(); };
  if (!configured) return <main className="setup-screen"><section><Brand/><span className="setup-label">BACKEND SETUP REQUIRED</span><h1>Connect AbisoTrack to Supabase</h1><p>The interface is ready, but it needs the shared database connection before it can run.</p><ol><li>Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.</li><li>Create an administrator in Authentication → Users.</li><li>Add the project URL and publishable key to <code>.env.local</code> or GitHub repository variables.</li></ol><p className="setup-note">See <code>SETUP.md</code> for the exact steps.</p></section></main>;
  if (loading) return <main className="loading"><div><Brand/><p>Connecting to the shared system…</p></div></main>;
  return <>{mode === "admin" ? <AdminApp onSwitch={() => switchMode("mobile")}/> : <MobileApp onSwitch={() => switchMode("admin")}/>} {error && <button className="global-error" onClick={clearError}>{error}<span>Dismiss</span></button>}</>;
}
