import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Check, ChevronRight, Download, ExternalLink, FileText, Home, LogOut, MessageSquareText, Network, Send, Settings, ShieldCheck, Smartphone, User, Volume2 } from "lucide-react";
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
  return <main className="mobile-auth"><section><Brand/><div className="mobile-auth-copy"><span><Smartphone/></span><h1>Receive and confirm official alerts.</h1><p>Install AbisoTrack on your phone, receive app and SMS notices, and report that you are safe.</p></div></section>{step === "phone" ? <form onSubmit={continueToVerification}><small className="step-label">STEP 1 OF 2</small><h2>Student sign in</h2><p>Enter the mobile number registered by your administrator.</p><Field label="Mobile number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" autoComplete="tel" required/><Button type="submit" disabled={!phone.trim()}>Send verification code</Button><Button type="button" variant="ghost" onClick={onSwitch}>Open admin workspace</Button></form> : <form onSubmit={verify}><small className="step-label">STEP 2 OF 2</small><h2>Verify your number</h2><p>For this demo, enter the private PIN assigned to <strong>{phone}</strong>.</p><Field label="Verification code" type="password" inputMode="numeric" minLength={4} maxLength={8} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "")); clearError(); }} placeholder="4–8 digits" autoFocus required/>{error && <div className="form-error">{error}</div>}<Button type="submit" disabled={busy || pin.length < 4}>{busy ? "Verifying…" : "Verify and continue"}</Button><Button type="button" variant="ghost" onClick={() => { setStep("phone"); setPin(""); clearError(); }}>Use a different number</Button></form>}</main>;
}

function alertLink(message: string) { return message.match(/https?:\/\/[^\s]+/i)?.[0] || ""; }

function AlertSummary({ alert }: { alert: AlertRecord }) {
  return <div className="wire-alert-summary"><StatusBadge status={alert.status}/><h2>{alert.title}</h2><small>{alert.type} · {formatDate(alert.sentAt)}</small></div>;
}

function AlertDetail({ alert, contactId, contactName, contactUnit, isOfficer, onBack }: { alert: AlertRecord; contactId: string; contactName: string; contactUnit: string; isOfficer: boolean; onBack(): void }) {
  const { dispatch, recipientsForAlert } = useAppState();
  const acknowledged = alert.acknowledgedContactIds.includes(contactId);
  const pending = recipientsForAlert(alert).filter((contact) => !alert.acknowledgedContactIds.includes(contact.id));
  const link = alertLink(alert.message);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [reminded, setReminded] = useState(false);
  if (acknowledged) return <section className="acknowledged-screen"><div className="acknowledged-mark"><Check/></div><h1>Received. Thank you, {contactName.split(" ")[0]}.</h1><p>Your school now knows you received this alert.</p><Card className="acknowledged-receipt"><div><span>Alert</span><strong>{alert.title}</strong></div><div><span>Confirmed</span><strong>{formatDate(new Date().toISOString())}</strong></div><div><span>Section</span><strong>{contactUnit || "Not assigned"}</strong></div></Card><Card className="what-next"><strong>What to do now</strong><p>{alert.message}</p></Card><Button onClick={onBack}>View alert details</Button><Button variant="secondary" onClick={onBack}>Back to alerts</Button></section>;
  return <><button className="mobile-back" onClick={onBack}>← My Alerts</button><Card className="mobile-alert-detail"><AlertSummary alert={alert}/><section className="wire-message"><strong>Message</strong><p>{alert.message}</p></section><div className="delivery-timeline"><div className="done"><span><BellRing/></span><div><strong>App notification</strong><small>Available in AbisoTrack</small></div></div>{alert.channels.includes("sms") && <div className="done"><span><MessageSquareText/></span><div><strong>SMS fallback</strong><small>Sent through the Android gateway</small></div></div>}</div>{link ? <Button variant="secondary" onClick={() => setAttachmentOpen(!attachmentOpen)}><FileText size={17}/> {attachmentOpen ? "Hide attachment" : "View attachments"}</Button> : <div className="attachment-empty">No attachment was included with this alert.</div>}</Card>{attachmentOpen && link && <Card className="attachment-viewer"><div><strong>Alert attachment</strong><small>External document linked in the message</small></div><a className="button primary" href={link} target="_blank" rel="noreferrer">Open document <ExternalLink size={16}/></a></Card>}<Card className="pending-ack"><small>Your status</small><strong>Pending acknowledgement</strong><p>Please confirm that you have received this alert.</p></Card><Button className="mobile-primary-action" variant="danger" onClick={() => dispatch({ type: "ACK_ALERT", alertId: alert.id, contactId })}>I have received this alert</Button>{isOfficer && <Card className="relay-card"><div><small>CLASS OFFICER VIEW</small><h3>Relay to classmates</h3><p>Confirm receipt, then remind classmates who are still pending.</p></div><Button variant="secondary" disabled={reminded || alert.status !== "active"} onClick={() => { dispatch({ type: "REMIND_PENDING", alertId: alert.id }); setReminded(true); }}><Send size={16}/>{reminded ? "Reminders queued" : "Message pending classmates"}</Button>{pending.length > 0 && <ul>{pending.slice(0, 5).map((person) => <li key={person.id}>{person.name}<small>{person.unit || "No unit"}</small></li>)}</ul>}</Card>}</>;
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
  const treeNodes = useMemo(
    () => state.treeNodes.filter((node) => node.name === contact?.unit || node.contactId === contact?.id),
    [state.treeNodes, contact?.id, contact?.unit]
  );
  if (!contact) return <MobileLogin onSwitch={onSwitch}/>;
  const relevantAlerts = state.alerts.filter((alert) => alert.status !== "draft" && recipientsForAlert(alert).some((item) => item.id === contact.id));
  const activeAlerts = relevantAlerts.filter((alert) => alert.status === "active");
  const historyAlerts = relevantAlerts.filter((alert) => alert.status === "closed");
  const selected = relevantAlerts.find((alert) => alert.id === selectedAlertId) || null;
  const isOfficer = /officer|dean|faculty|administrator/i.test(contact.role);
  const acknowledgedCount = relevantAlerts.filter((alert) => alert.acknowledgedContactIds.includes(contact.id)).length;
  const showNotification = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    if (permission === "granted") new Notification("AbisoTrack notifications enabled", { body: "Official alerts can now appear as phone notifications.", icon: "./favicon.svg" });
  };
  const install = async () => { if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); } };

  let content: React.ReactNode;
  if (selected) content = <AlertDetail alert={selected} contactId={contact.id} contactName={contact.name} contactUnit={contact.unit} isOfficer={isOfficer} onBack={() => setSelectedAlertId(null)}/>;
  else if (page === "Home") content = <><header className="mobile-greeting"><div><small>Good morning</small><h1>{contact.name}</h1></div><button className="notification-button" onClick={() => setPage("Alerts")}><Bell size={20}/>{activeAlerts.length > 0 && <em>{activeAlerts.length}</em>}</button></header>{activeAlerts[0] ? <Card className="mobile-active-alert" onClick={() => setSelectedAlertId(activeAlerts[0].id)}><StatusBadge status="active"/><h2>{activeAlerts[0].title}</h2><small>{activeAlerts[0].type} · {formatDate(activeAlerts[0].sentAt)}</small><p>{activeAlerts[0].message}</p><Button variant="danger">I have received this alert</Button></Card> : <Card><EmptyState title="You're up to date" description="When your school sends an alert, it appears here and as a phone notification."/></Card>}<Card className="reach-path"><div className="mobile-section-heading"><h2>How this reached you</h2><small>My Tree</small></div><div className="path-steps"><span className="done"><Check/>Admin</span><i/><span className="done"><Check/>Unit</span><i/><span className={activeAlerts.length ? "pending" : "done"}>{activeAlerts.length ? "○" : <Check/>}You</span></div></Card><div className="mobile-section-heading"><h2>Recent alerts</h2><button onClick={() => { setPage("Alerts"); setTab("history"); }}>See all</button></div>{relevantAlerts.length ? <div className="mobile-list">{relevantAlerts.slice(0, 3).map((alert) => <button key={alert.id} onClick={() => setSelectedAlertId(alert.id)}><span className={alert.acknowledgedContactIds.includes(contact.id) ? "closed" : alert.status}><Bell size={18}/></span><div><strong>{alert.title}</strong><small>{formatDate(alert.sentAt)} · {alert.acknowledgedContactIds.includes(contact.id) ? "Acknowledged" : "Pending"}</small></div><ChevronRight size={17}/></button>)}</div> : <EmptyState title="No alert history" description="Past alerts will appear here."/>}</>;
  else if (page === "Alerts") {
    const alerts = tab === "active" ? activeAlerts : historyAlerts;
    content = <><header className="mobile-page-header"><h1>My Alerts</h1></header><div className="mobile-tabs"><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button></div>{alerts.length ? <div className="wire-alert-list">{alerts.map((alert) => <Card key={alert.id} className="wire-alert-card" onClick={() => setSelectedAlertId(alert.id)}><div><h2>{alert.title}</h2>{tab === "active" && <em>NEW</em>}<ChevronRight size={17}/></div><small>{alert.type}<br/>{formatDate(alert.sentAt)}</small>{tab === "active" && <><hr/><strong>Message</strong><p>{alert.message}</p><section className={alert.acknowledgedContactIds.includes(contact.id) ? "received" : "pending"}><small>Your status</small><b>{alert.acknowledgedContactIds.includes(contact.id) ? "Acknowledged" : "Pending acknowledgement"}</b></section></>}</Card>)}</div> : <Card><EmptyState title={tab === "active" ? "You're up to date" : "No previous alerts"} description={tab === "active" ? "When your school sends an alert, it appears here." : "Closed alerts will appear in your history."}/></Card>}</>;
  } else if (page === "My Tree") content = <><header className="mobile-page-header"><h1>My Tree</h1></header><Card className="tree-person"><span>{initials(contact.name)}</span><div><h2>{contact.name}</h2><small>{contact.role} · {contact.unit || "Not assigned"}</small></div><b>RELAYS ALERTS</b></Card><Card className="tree-route"><div><i/><span><strong>{state.settings.institutionName || "School administration"}</strong><small>Alert source</small></span></div>{treeNodes.map((node) => <div key={node.id}><i/><span><strong>{node.name}</strong><small>{node.level}</small></span></div>)}<div className="current"><i/><span><strong>{contact.unit || "Your section"}</strong><small>You receive alerts here</small></span></div></Card><Card className="tree-progress"><div className="progress-ring">{relevantAlerts.length ? Math.round(acknowledgedCount / relevantAlerts.length * 100) : 100}%</div><div><h2>Your confirmations</h2><strong>{acknowledgedCount} of {relevantAlerts.length}</strong><small>{activeAlerts.filter((alert) => !alert.acknowledgedContactIds.includes(contact.id)).length} still pending</small></div></Card>{isOfficer && activeAlerts.length > 0 && <Button variant="danger" onClick={() => dispatch({ type: "REMIND_PENDING", alertId: activeAlerts[0].id })}><Send size={16}/> Message pending classmates</Button>}</>;
  else content = <><header className="mobile-page-header"><h1>Profile</h1></header><Card className="profile-identity"><span>{initials(contact.name)}</span><div><h2>{contact.name}</h2><p>{contact.unit || "No unit"} · {contact.role}</p><small>{contact.phone}</small></div></Card><Card className="profile-toggles"><h2>Alerts</h2><div><span><strong>Push notifications</strong><small>Get alerts in the app</small></span><i className={notificationState === "granted" ? "on" : ""}/></div><div><span><strong>Play sound on silent</strong><small>Urgent alerts only</small></span><i className="on"><Volume2/></i></div><div><span><strong>SMS backup</strong><small>Text me if the app cannot reach me</small></span><i className={state.settings.smsFallback ? "on" : ""}/></div></Card><Card className="profile-links"><button><ShieldCheck/> Privacy & consent <ChevronRight/></button><button onClick={onSwitch}><Settings/> Administrator workspace <ChevronRight/></button></Card>{installPrompt ? <Button onClick={install}><Download size={17}/> Install AbisoTrack</Button> : <div className="setup-ok"><Check size={17}/> AbisoTrack is installed or available from your browser menu.</div>}<Button variant="secondary" disabled={notificationState === "granted"} onClick={showNotification}><BellRing size={17}/> {notificationState === "granted" ? "Notifications enabled" : "Enable notifications"}</Button><Button variant="danger" onClick={() => dispatch({ type: "MOBILE_LOGOUT" })}><LogOut size={17}/> Sign out</Button></>;
  const nav: Array<{ page: MobilePage; icon: typeof Home }> = [{ page: "Home", icon: Home }, { page: "Alerts", icon: Bell }, { page: "My Tree", icon: Network }, { page: "Profile", icon: User }];
  return <div className="mobile-app"><main className="mobile-content">{content}</main><nav className="mobile-bottom-nav">{nav.map(({ page: item, icon: Icon }) => <button className={page === item && !selected ? "active" : ""} key={item} onClick={() => { setPage(item); setSelectedAlertId(null); }}><Icon size={21}/><span>{item}</span>{item === "Alerts" && activeAlerts.length > 0 && <em>{activeAlerts.length}</em>}</button>)}</nav></div>;
}
