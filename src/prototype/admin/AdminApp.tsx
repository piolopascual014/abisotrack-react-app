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
  const { adminLogin, busy, error, clearError } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    await adminLogin(name.trim(), email.trim(), password);
  };
  return <main className="auth-layout"><section className="auth-brand"><Brand /><div><h1>Coordinate every alert from one place.</h1><p>Build the call tree, reach the right people, and see who has acknowledged—all without seeded records.</p></div><small>Shared demo system · Secure cloud database</small></section><section className="auth-panel"><form className="auth-form" onSubmit={submit}><span className="auth-icon"><ShieldCheck /></span><h2>Administrator sign in</h2><p>Use the administrator account created in Supabase Authentication.</p><Field label="Display name" value={name} onChange={(e) => { setName(e.target.value); clearError(); }} placeholder="Your name" required /><Field label="School email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }} placeholder="name@school.edu" required /><Field label="Password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }} placeholder="Account password" required />{error && <div className="form-error">{error}</div>}<Button type="submit" disabled={busy || !name.trim() || !email.trim() || !password}>{busy ? "Signing in…" : "Sign in"}</Button><Button type="button" variant="ghost" onClick={onSwitch}>Open mobile app</Button></form></section></main>;
}

export function AdminApp({ onSwitch }: { onSwitch(): void }) {
  const { state, dispatch } = useAppState();
  const [page, setPage] = useState<AdminPage>("Dashboard");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  if (!state.adminSession) return <AdminLogin onSwitch={onSwitch} />;
  const Screen = { Dashboard: DashboardPage, Alerts: AlertsPage, "Call Tree": CallTreePage, Reports: ReportsPage, Contacts: ContactsPage, "SMS Logs": SmsLogsPage, Settings: SettingsPage, Users: UsersPage, "Audit Trail": AuditPage, Help: HelpPage }[page];
  const activeCount = state.alerts.filter((alert) => alert.status === "active").length;
  const failedSms = state.smsLogs.filter((log) => log.status === "failed").length;
  return <div className="admin-shell"><aside className="sidebar"><Brand /><div className="profile-chip"><span>{state.adminSession.name.slice(0, 1).toUpperCase()}</span><div><strong>{state.adminSession.name}</strong><small>{state.adminSession.email}</small></div></div><nav>{navigation.map(({ page: item, icon: Icon }) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}><Icon size={19} /><span>{item}</span>{item === "Alerts" && activeCount > 0 && <em>{activeCount}</em>}</button>)}</nav><div className="sidebar-actions"><button onClick={onSwitch}><MessageSquareText size={18} />Mobile app</button><button onClick={() => dispatch({ type: "ADMIN_LOGOUT" })}><LogOut size={18} />Sign out</button></div></aside><main className="workspace"><header className="workspace-header"><div><small>{state.settings.institutionName || "Institution not configured"}</small><h1>{page}</h1></div><div className="header-tools"><div className="header-indicator"><span></span>Synced online</div><button className="notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications"><Bell size={20}/>{activeCount + failedSms > 0 && <em>{activeCount + failedSms}</em>}</button>{notificationsOpen && <section className="notification-menu"><header><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)}>×</button></header>{activeCount > 0 && <button onClick={() => { setPage("Alerts"); setNotificationsOpen(false); }}><Bell size={18}/><span><strong>{activeCount} active alert{activeCount === 1 ? "" : "s"}</strong><small>Open the live acknowledgement status.</small></span></button>}{failedSms > 0 && <button onClick={() => { setPage("SMS Logs"); setNotificationsOpen(false); }}><MessageSquareText size={18}/><span><strong>{failedSms} failed SMS attempt{failedSms === 1 ? "" : "s"}</strong><small>Review the gateway error details.</small></span></button>}{activeCount + failedSms === 0 && <p>Everything is clear. There are no new operational notices.</p>}</section>}</div></header><div className="workspace-body"><Screen navigate={setPage} /></div></main></div>;
}
