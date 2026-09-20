import { useState } from "react";
import { Bell, ChartColumn, CircleHelp, ContactRound, FileClock, LayoutDashboard, LogOut, MessageSquareText, Network, Settings, ShieldCheck, Users } from "lucide-react";
import { useAppState } from "../state/AppStateProvider";
import { Brand } from "../components/Brand";
import { Button, Field } from "../components/UI";
import { AlertsPage, AuditPage, CallTreePage, ContactsPage, DashboardPage, HelpPage, ReportsPage, SettingsPage, SmsLogsPage, UsersPage } from "./AdminScreens";

export type AdminPage = "Dashboard" | "Alerts" | "Call Tree" | "Reports" | "Contacts" | "SMS Logs" | "Settings" | "Users" | "Audit Trail" | "Help";

const navigation: Array<{ page: AdminPage; icon: typeof Bell }> = [
  { page: "Dashboard", icon: LayoutDashboard }, { page: "Alerts", icon: Bell }, { page: "Call Tree", icon: Network },
  { page: "Reports", icon: ChartColumn }, { page: "Contacts", icon: ContactRound }, { page: "SMS Logs", icon: MessageSquareText },
  { page: "Settings", icon: Settings }, { page: "Users", icon: Users }, { page: "Audit Trail", icon: FileClock }, { page: "Help", icon: CircleHelp }
];

function AdminLogin({ onSwitch }: { onSwitch(): void }) {
  const { dispatch } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    dispatch({ type: "ADMIN_LOGIN", name: name.trim(), email: email.trim() });
  };
  return <main className="auth-layout"><section className="auth-brand"><Brand /><div><h1>Coordinate every alert from one place.</h1><p>Build the call tree, reach the right people, and see who has acknowledged—all without seeded records.</p></div><small>Local-only application · Data stays in this browser</small></section><section className="auth-panel"><form className="auth-form" onSubmit={submit}><span className="auth-icon"><ShieldCheck /></span><h2>Administrator sign in</h2><p>This local build accepts credentials only to create a browser session. It does not contact a server.</p><Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /><Field label="School email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.edu" required /><Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter any local password" required /><Button type="submit" disabled={!name.trim() || !email.trim() || !password}>Sign in</Button><Button type="button" variant="ghost" onClick={onSwitch}>Open mobile app</Button></form></section></main>;
}

export function AdminApp({ onSwitch }: { onSwitch(): void }) {
  const { state, dispatch } = useAppState();
  const [page, setPage] = useState<AdminPage>("Dashboard");
  if (!state.adminSession) return <AdminLogin onSwitch={onSwitch} />;
  const Screen = { Dashboard: DashboardPage, Alerts: AlertsPage, "Call Tree": CallTreePage, Reports: ReportsPage, Contacts: ContactsPage, "SMS Logs": SmsLogsPage, Settings: SettingsPage, Users: UsersPage, "Audit Trail": AuditPage, Help: HelpPage }[page];
  return <div className="admin-shell"><aside className="sidebar"><Brand /><div className="profile-chip"><span>{state.adminSession.name.slice(0, 1).toUpperCase()}</span><div><strong>{state.adminSession.name}</strong><small>{state.adminSession.email}</small></div></div><nav>{navigation.map(({ page: item, icon: Icon }) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}><Icon size={19} /><span>{item}</span>{item === "Alerts" && state.alerts.filter((alert) => alert.status === "active").length > 0 && <em>{state.alerts.filter((alert) => alert.status === "active").length}</em>}</button>)}</nav><div className="sidebar-actions"><button onClick={onSwitch}><MessageSquareText size={18} />Mobile app</button><button onClick={() => dispatch({ type: "ADMIN_LOGOUT" })}><LogOut size={18} />Sign out</button></div></aside><main className="workspace"><header className="workspace-header"><div><small>{state.settings.institutionName || "Institution not configured"}</small><h1>{page}</h1></div><div className="header-indicator"><span></span>Stored locally</div></header><div className="workspace-body"><Screen navigate={setPage} /></div></main></div>;
}
