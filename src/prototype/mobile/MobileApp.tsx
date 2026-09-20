import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Check, ChevronRight, Download, ExternalLink, Home, LogOut, MessageSquareText, Network, Settings, Smartphone, User } from "lucide-react";
import { Brand } from "../components/Brand";
import { Button, Card, EmptyState, Field, StatusBadge } from "../components/UI";
import { formatDate, initials } from "../helpers";
import { useAppState } from "../state/AppStateProvider";
import type { AlertRecord } from "../types";

type MobilePage = "Home" | "Alerts" | "My Tree" | "Profile";
type AlertTab = "active" | "history";
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

function MobileLogin({ onSwitch }: { onSwitch(): void }) {
  const { mobileLogin, busy, error, clearError } = useAppState();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const continueToVerification = (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) return;
    clearError();
    setStep("verify");
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.length < 4) return;
    await mobileLogin(phone, pin);
  };
  return <main className="mobile-auth"><section><Brand/><div className="mobile-auth-copy"><span><Smartphone/></span><h1>Receive and confirm official alerts.</h1><p>Install AbisoTrack on your phone, receive app and SMS notices, and report that you are safe.</p></div></section>{step === "phone" ? <form onSubmit={continueToVerification}><small className="step-label">STEP 1 OF 2</small><h2>Student sign in</h2><p>Enter the mobile number registered by your administrator.</p><Field label="Mobile number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" autoComplete="tel" required/><Button type="submit" disabled={!phone.trim()}>Send verification code</Button><Button type="button" variant="ghost" onClick={onSwitch}>Open admin workspace</Button></form> : <form onSubmit={verify}><small className="step-label">STEP 2 OF 2</small><h2>Verify your number</h2><p>For this demo, enter the private PIN assigned to <strong>{phone}</strong>. It works as your verification code.</p><Field label="Verification code" type="password" inputMode="numeric" minLength={4} maxLength={8} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "")); clearError(); }} placeholder="4–8 digits" autoFocus required/>{error && <div className="form-error">{error}</div>}<Button type="submit" disabled={busy || pin.length < 4}>{busy ? "Verifying…" : "Verify and continue"}</Button><Button type="button" variant="ghost" onClick={() => { setStep("phone"); setPin(""); clearError(); }}>Use a different number</Button></form>}</main>;
}

function alertLink(message: string) {
  return message.match(/https?:\/\/[^\s]+/i)?.[0] || "";
}

function AlertDetail({ alert, contactId, isOfficer, onBack }: { alert: AlertRecord; contactId: string; isOfficer: boolean; onBack(): void }) {
  const { dispatch, recipientsForAlert } = useAppState();
  const acknowledged = alert.acknowledgedContactIds.includes(contactId);
  const recipients = recipientsForAlert(alert);
  const pending = recipients.filter((contact) => !alert.acknowledgedContactIds.includes(contact.id));
  const link = alertLink(alert.message);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [reminded, setReminded] = useState(false);
  return <><button className="mobile-back" onClick={onBack}>← Back to alerts</button><Card className="mobile-alert-detail"><div className="alert-detail-title"><StatusBadge status={alert.status}/><small>{alert.type} · {formatDate(alert.sentAt)}</small></div><h2>{alert.title}</h2><p>{alert.message}</p><div className="delivery-timeline"><div className="done"><span><BellRing/></span><div><strong>App notification</strong><small>Available in AbisoTrack</small></div></div>{alert.channels.includes("sms") && <div className="done"><span><MessageSquareText/></span><div><strong>SMS fallback</strong><small>Sent through the Android gateway</small></div></div>}</div>{link ? <Button variant="secondary" onClick={() => setAttachmentOpen(!attachmentOpen)}><ExternalLink size={17}/> {attachmentOpen ? "Hide attachment" : "View attachment"}</Button> : <div className="attachment-empty">No attachment was included with this alert.</div>}</Card>{attachmentOpen && link && <Card className="attachment-viewer"><div><strong>Alert attachment</strong><small>External document linked in the message</small></div><a className="button primary" href={link} target="_blank" rel="noreferrer">Open document <ExternalLink size={16}/></a></Card>}{acknowledged ? <Card className="ack-success"><span><Check/></span><div><strong>Acknowledged</strong><small>Your confirmation is visible to the administrator.</small></div></Card> : <Button className="mobile-primary-action" variant="danger" onClick={() => dispatch({ type: "ACK_ALERT", alertId: alert.id, contactId })}>I have received this alert</Button>}{isOfficer && <Card className="relay-card"><div><small>CLASS OFFICER VIEW</small><h3>Relay to classmates</h3><p>Queue an SMS reminder for classmates in your unit who have not yet acknowledged.</p></div><Button variant="secondary" disabled={reminded || alert.status !== "active"} onClick={() => { dispatch({ type: "REMIND_PENDING", alertId: alert.id }); setReminded(true); }}>{reminded ? "Reminders queued" : "Remind pending classmates"}</Button>{pending.length > 0 && <ul>{pending.slice(0, 5).map((contact) => <li key={contact.id}>{contact.name}<small>{contact.unit || "No unit"}</small></li>)}</ul>}</Card>}</>;
}

export function MobileApp({ onSwitch }: { onSwitch(): void }) {
  const { state, dispatch, recipientsForAlert } = useAppState();
  const [page, setPage] = useState<MobilePage>("Home");
  const [tab, setTab] = useState<AlertTab>("active");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [notificationState, setNotificationState] = useState(typeof Notification === "undefined" ? "denied" : Notification.permission);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  const contact = state.contacts.find((item) => item.id === state.mobileContactId);
  if (!contact) return <MobileLogin onSwitch={onSwitch}/>;
  const relevantAlerts = state.alerts.filter((alert) => alert.status !== "draft" && recipientsForAlert(alert).some((item) => item.id === contact.id));
  const activeAlerts = relevantAlerts.filter((alert) => alert.status === "active");
  const historyAlerts = relevantAlerts.filter((alert) => alert.status === "closed");
  const selected = relevantAlerts.find((alert) => alert.id === selectedAlertId) || null;
  const isOfficer = /officer|dean|faculty|administrator/i.test(contact.role);
  const treeNodes = useMemo(() => state.treeNodes.filter((node) => node.name === contact.unit || node.contactId === contact.id), [state.treeNodes, contact]);
  const showNotification = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    if (permission === "granted") new Notification("AbisoTrack notifications enabled", { body: "Official alerts can now appear as phone notifications.", icon: "./favicon.svg" });
  };
  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  let content: React.ReactNode;
  if (selected) content = <AlertDetail alert={selected} contactId={contact.id} isOfficer={isOfficer} onBack={() => setSelectedAlertId(null)}/>;
  else if (page === "Home") content = <><header className="mobile-greeting"><div><small>{state.settings.institutionName || "AbisoTrack"}</small><h1>Hello, {contact.name.split(" ")[0]}</h1></div><span>{initials(contact.name)}</span></header>{activeAlerts[0] ? <Card className="mobile-active-alert" onClick={() => setSelectedAlertId(activeAlerts[0].id)}><StatusBadge status="active"/><h2>{activeAlerts[0].title}</h2><p>{activeAlerts[0].message}</p><Button variant="danger">Open alert <ChevronRight size={17}/></Button></Card> : <Card><EmptyState title="No active alerts" description="You are safe and up to date. Official alerts for you will appear here."/></Card>}<div className="mobile-section-heading"><h2>Recent alerts</h2><button onClick={() => { setPage("Alerts"); setTab("history"); }}>See history</button></div>{relevantAlerts.length ? <div className="mobile-list">{relevantAlerts.slice(0, 3).map((alert) => <button key={alert.id} onClick={() => setSelectedAlertId(alert.id)}><span className={alert.status}><Bell size={18}/></span><div><strong>{alert.title}</strong><small>{formatDate(alert.sentAt)} · {alert.acknowledgedContactIds.includes(contact.id) ? "Acknowledged" : "Pending"}</small></div><ChevronRight size={17}/></button>)}</div> : <EmptyState title="No alert history" description="Past alerts will appear here."/>}</>;
  else if (page === "Alerts") {
    const alerts = tab === "active" ? activeAlerts : historyAlerts;
    content = <><header className="mobile-page-header"><h1>My Alerts</h1><p>Review active messages and acknowledgement history.</p></header><div className="mobile-tabs"><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active <em>{activeAlerts.length}</em></button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History <em>{historyAlerts.length}</em></button></div>{alerts.length ? <div className="mobile-list cards">{alerts.map((alert) => <button key={alert.id} onClick={() => setSelectedAlertId(alert.id)}><span className={alert.status}><Bell size={18}/></span><div><strong>{alert.title}</strong><small>{formatDate(alert.sentAt)} · {alert.acknowledgedContactIds.includes(contact.id) ? "Acknowledged" : "Pending"}</small></div><ChevronRight size={17}/></button>)}</div> : <Card><EmptyState title={tab === "active" ? "Nothing active" : "No previous alerts"} description={tab === "active" ? "There are no active alerts for you." : "Closed alerts will appear in your history."}/></Card>}</>;
  } else if (page === "My Tree") content = <><header className="mobile-page-header"><h1>My Tree</h1><p>Your place in the institutional alert path.</p></header>{treeNodes.length ? treeNodes.map((node) => <Card className="tree-assignment" key={node.id}><span><Network/></span><div><small>{node.level}</small><h2>{node.name}</h2><p>{node.contactId === contact.id ? "You are the assigned relay contact." : "You receive alerts through this unit."}</p></div></Card>) : <Card><EmptyState title="No call-tree assignment" description="Ask an administrator to assign your contact to a unit."/></Card>}<Card className="mobile-summary"><h2>Alert responsibility</h2><div><span>Active alerts</span><strong>{activeAlerts.length}</strong></div><div><span>Pending acknowledgement</span><strong>{activeAlerts.filter((alert) => !alert.acknowledgedContactIds.includes(contact.id)).length}</strong></div><div><span>Role</span><strong>{contact.role}</strong></div></Card></>;
  else content = <><header className="mobile-page-header"><h1>Profile</h1><p>Your contact record and phone settings.</p></header><Card className="mobile-profile"><span>{initials(contact.name)}</span><h2>{contact.name}</h2><p>{contact.role} · {contact.unit || "No unit"}</p><dl><div><dt>Phone</dt><dd>{contact.phone}</dd></div><div><dt>Email</dt><dd>{contact.email || "—"}</dd></div><div><dt>Consent</dt><dd>{contact.consent ? "Recorded" : "Pending"}</dd></div><div><dt>App status</dt><dd>{contact.appInstalled ? "Installed" : "Web access"}</dd></div></dl></Card><Card className="profile-actions"><h2>Phone setup</h2><p>Install the web app for a full-screen mobile experience and allow notifications for on-screen alert previews.</p>{installPrompt ? <Button onClick={install}><Download size={17}/> Install AbisoTrack</Button> : <div className="setup-ok"><Check size={17}/> App is installed or installation is available from the browser menu.</div>}<Button variant="secondary" disabled={notificationState === "granted"} onClick={showNotification}><BellRing size={17}/> {notificationState === "granted" ? "Notifications enabled" : "Enable notifications"}</Button><div className="setup-ok"><MessageSquareText size={17}/> SMS fallback: {state.settings.smsFallback ? "enabled" : "available when selected by admin"}</div></Card><Button variant="secondary" onClick={onSwitch}><Settings size={17}/> Admin workspace</Button><Button variant="danger" onClick={() => dispatch({ type: "MOBILE_LOGOUT" })}><LogOut size={17}/> Sign out</Button></>;

  const nav: Array<{ page: MobilePage; icon: typeof Home }> = [{ page: "Home", icon: Home }, { page: "Alerts", icon: Bell }, { page: "My Tree", icon: Network }, { page: "Profile", icon: User }];
  return <div className="mobile-app"><main className="mobile-content">{content}</main><nav className="mobile-bottom-nav">{nav.map(({ page: item, icon: Icon }) => <button className={page === item && !selected ? "active" : ""} key={item} onClick={() => { setPage(item); setSelectedAlertId(null); }}><Icon size={21}/><span>{item}</span>{item === "Alerts" && activeAlerts.length > 0 && <em>{activeAlerts.length}</em>}</button>)}</nav></div>;
}
