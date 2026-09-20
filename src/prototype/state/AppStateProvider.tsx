import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { AlertRecord, AppSettings, AppState, Contact, TreeNode, UserRecord } from "../types";

const STUDENT_TOKEN_KEY = "abisotrack-student-session";
const ADMIN_NAME_KEY = "abisotrack-admin-name";

export const emptyState: AppState = {
  contacts: [], treeNodes: [], alerts: [], smsLogs: [], users: [], audit: [],
  settings: { institutionName: "", smsFallback: false, emailCopy: false, escalationMinutes: 15 },
  adminSession: null, mobileContactId: null
};

export type Action =
  | { type: "ADMIN_LOGOUT" }
  | { type: "MOBILE_LOGOUT" }
  | { type: "ADD_CONTACT"; contact: Omit<Contact, "id"> }
  | { type: "DELETE_CONTACT"; id: string }
  | { type: "ADD_NODE"; node: Omit<TreeNode, "id"> }
  | { type: "DELETE_NODE"; id: string }
  | { type: "SAVE_ALERT"; alert: Omit<AlertRecord, "id" | "createdAt" | "sentAt" | "acknowledgedContactIds" | "recipientContactIds">; send: boolean }
  | { type: "CLOSE_ALERT"; id: string }
  | { type: "ACK_ALERT"; alertId: string; contactId: string }
  | { type: "REMIND_PENDING"; alertId: string }
  | { type: "ADD_USER"; user: Omit<UserRecord, "id"> }
  | { type: "UPDATE_SETTINGS"; settings: AppSettings }
  | { type: "RESET" };

type AdminIdentity = { name: string; email: string };

interface Store {
  state: AppState;
  dispatch(action: Action): void;
  recipientsForAlert(alert: AlertRecord): Contact[];
  adminLogin(name: string, email: string, password: string): Promise<boolean>;
  mobileLogin(phone: string, pin: string): Promise<boolean>;
  restoreAdmin(): Promise<void>;
  loading: boolean;
  busy: boolean;
  error: string;
  configured: boolean;
  clearError(): void;
}

const AppStateContext = createContext<Store | null>(null);

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function identityFor(user: User, preferredName?: string): AdminIdentity {
  const savedName = preferredName || sessionStorage.getItem(ADMIN_NAME_KEY) || "Administrator";
  return { name: savedName, email: user.email || "admin" };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadAdminData = useCallback(async (identity: AdminIdentity) => {
    if (!supabase) return;
    const [contacts, nodes, alerts, scopes, channels, recipients, sms, users, audit, settings] = await Promise.all([
      supabase.from("contacts").select("id,name,phone,email,role,unit,consent,app_installed").order("created_at"),
      supabase.from("tree_nodes").select("id,name,level,parent_id,contact_id").order("created_at"),
      supabase.from("alerts").select("id,title,type,message,all_contacts,status,created_at,sent_at").order("created_at", { ascending: false }),
      supabase.from("alert_scopes").select("alert_id,node_id"),
      supabase.from("alert_channels").select("alert_id,channel"),
      supabase.from("alert_recipients").select("alert_id,contact_id,acknowledged_at"),
      supabase.from("sms_logs").select("id,alert_id,contact_id,status,created_at,updated_at,attempts,gateway_id,sent_at,delivered_at,error_message").order("created_at", { ascending: false }),
      supabase.from("app_users").select("id,name,email,role").order("created_at"),
      supabase.from("audit_entries").select("id,at,actor,action").order("at", { ascending: false }).limit(300),
      supabase.from("app_settings").select("institution_name,sms_fallback,email_copy,escalation_minutes").eq("id", 1).maybeSingle()
    ]);
    const failed = [contacts, nodes, alerts, scopes, channels, recipients, sms, users, audit, settings].find((result) => result.error);
    if (failed?.error) throw failed.error;

    const contactRecords: Contact[] = (contacts.data || []).map((row) => ({
      id: row.id, name: row.name, phone: row.phone, email: row.email, role: row.role,
      unit: row.unit, consent: row.consent, appInstalled: row.app_installed
    }));
    const nodeRecords: TreeNode[] = (nodes.data || []).map((row) => ({
      id: row.id, name: row.name, level: row.level, parentId: row.parent_id, contactId: row.contact_id
    }));
    const alertRecords: AlertRecord[] = (alerts.data || []).map((row) => ({
      id: row.id, title: row.title, type: row.type, message: row.message,
      scopeNodeIds: (scopes.data || []).filter((item) => item.alert_id === row.id).map((item) => item.node_id),
      allContacts: row.all_contacts,
      channels: (channels.data || []).filter((item) => item.alert_id === row.id).map((item) => item.channel) as AlertRecord["channels"],
      status: row.status as AlertRecord["status"], createdAt: row.created_at, sentAt: row.sent_at,
      acknowledgedContactIds: (recipients.data || []).filter((item) => item.alert_id === row.id && item.acknowledged_at).map((item) => item.contact_id),
      recipientContactIds: (recipients.data || []).filter((item) => item.alert_id === row.id).map((item) => item.contact_id)
    }));
    const currentSettings = settings.data;
    setState({
      contacts: contactRecords,
      treeNodes: nodeRecords,
      alerts: alertRecords,
      smsLogs: (sms.data || []).map((row) => ({
        id: row.id, alertId: row.alert_id, contactId: row.contact_id,
        status: row.status as "queued" | "sending" | "sent" | "delivered" | "failed",
        createdAt: row.created_at, updatedAt: row.updated_at, attempts: row.attempts,
        gatewayId: row.gateway_id, sentAt: row.sent_at, deliveredAt: row.delivered_at,
        errorMessage: row.error_message
      })),
      users: (users.data || []) as UserRecord[],
      audit: (audit.data || []).map((row) => ({ id: row.id, at: row.at, actor: row.actor, action: row.action })),
      settings: currentSettings ? {
        institutionName: currentSettings.institution_name,
        smsFallback: currentSettings.sms_fallback,
        emailCopy: currentSettings.email_copy,
        escalationMinutes: currentSettings.escalation_minutes
      } : emptyState.settings,
      adminSession: identity,
      mobileContactId: null
    });
  }, []);

  const loadStudentData = useCallback(async (token: string) => {
    if (!supabase) return false;
    const { data, error: requestError } = await supabase.rpc("student_snapshot", { p_token: token });
    if (requestError) throw requestError;
    if (!data) return false;
    const snapshot = data as { contact: Contact; alerts: AlertRecord[]; treeNodes: TreeNode[]; settings: AppSettings };
    setState({
      ...emptyState,
      contacts: [snapshot.contact], alerts: snapshot.alerts || [], treeNodes: snapshot.treeNodes || [],
      settings: snapshot.settings || emptyState.settings, mobileContactId: snapshot.contact.id
    });
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!supabase) { setLoading(false); return; }
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (data.session?.user) await loadAdminData(identityFor(data.session.user));
        else {
          const token = sessionStorage.getItem(STUDENT_TOKEN_KEY);
          if (token && !(await loadStudentData(token))) sessionStorage.removeItem(STUDENT_TOKEN_KEY);
        }
      } catch (initialError) {
        if (active) setError(messageOf(initialError));
      } finally { if (active) setLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [loadAdminData, loadStudentData]);

  useEffect(() => {
    if (!supabase || !state.adminSession) return;
    const client = supabase;
    const identity = state.adminSession;
    const channel = client.channel("abisotrack-admin-live")
      .on("postgres_changes", { event: "*", schema: "public" }, () => { void loadAdminData(identity); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [state.adminSession?.email, loadAdminData]);

  useEffect(() => {
    if (!state.mobileContactId || state.adminSession) return;
    const timer = window.setInterval(() => {
      const token = sessionStorage.getItem(STUDENT_TOKEN_KEY);
      if (token) void loadStudentData(token).catch((refreshError) => setError(messageOf(refreshError)));
    }, 10000);
    return () => window.clearInterval(timer);
  }, [state.mobileContactId, state.adminSession, loadStudentData]);

  const adminLogin = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) return false;
    setBusy(true); setError("");
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      if (!data.user) throw new Error("The administrator account could not be loaded.");
      sessionStorage.setItem(ADMIN_NAME_KEY, name);
      const identity = identityFor(data.user, name);
      await supabase.from("audit_entries").insert({ actor: identity.name, action: "Signed in to the administrator workspace" });
      await loadAdminData(identity);
      return true;
    } catch (loginError) {
      setError(messageOf(loginError));
      return false;
    } finally { setBusy(false); }
  }, [loadAdminData]);

  const mobileLogin = useCallback(async (phone: string, pin: string) => {
    if (!supabase) return false;
    setBusy(true); setError("");
    try {
      const { data, error: loginError } = await supabase.rpc("student_login", { p_phone: phone, p_pin: pin });
      if (loginError) throw loginError;
      const result = data as { token?: string } | null;
      if (!result?.token) throw new Error("The phone number or PIN is incorrect.");
      sessionStorage.setItem(STUDENT_TOKEN_KEY, result.token);
      if (!(await loadStudentData(result.token))) throw new Error("The student session could not be started.");
      return true;
    } catch (loginError) {
      setError(messageOf(loginError));
      return false;
    } finally { setBusy(false); }
  }, [loadStudentData]);

  const restoreAdmin = useCallback(async () => {
    if (!supabase) return;
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) { setError(messageOf(sessionError)); return; }
    if (data.session?.user) {
      setLoading(true);
      try { await loadAdminData(identityFor(data.session.user)); }
      catch (restoreError) { setError(messageOf(restoreError)); }
      finally { setLoading(false); }
    }
  }, [loadAdminData]);

  const runAction = useCallback(async (action: Action) => {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      if (action.type === "ADMIN_LOGOUT") {
        await supabase.auth.signOut();
        sessionStorage.removeItem(ADMIN_NAME_KEY);
        setState(emptyState);
        return;
      }
      if (action.type === "MOBILE_LOGOUT") {
        sessionStorage.removeItem(STUDENT_TOKEN_KEY);
        setState((current) => ({ ...emptyState, adminSession: current.adminSession }));
        return;
      }
      if (action.type === "ACK_ALERT") {
        const token = sessionStorage.getItem(STUDENT_TOKEN_KEY);
        if (!token) throw new Error("Your student session has expired. Please sign in again.");
        const { error: ackError } = await supabase.rpc("student_acknowledge", { p_token: token, p_alert_id: action.alertId });
        if (ackError) throw ackError;
        await loadStudentData(token);
        return;
      }
      if (action.type === "REMIND_PENDING" && !state.adminSession) {
        const token = sessionStorage.getItem(STUDENT_TOKEN_KEY);
        if (!token) throw new Error("Your student session has expired. Please sign in again.");
        const { error: reminderError } = await supabase.rpc("student_queue_reminders", { p_token: token, p_alert_id: action.alertId });
        if (reminderError) throw reminderError;
        await loadStudentData(token);
        return;
      }

      if (!state.adminSession) throw new Error("Administrator sign-in required.");
      const actor = state.adminSession.name;
      let result: { error: unknown } | null = null;
      switch (action.type) {
        case "ADD_CONTACT":
          result = await supabase.rpc("create_contact", {
            p_name: action.contact.name, p_phone: action.contact.phone, p_email: action.contact.email,
            p_role: action.contact.role, p_unit: action.contact.unit, p_consent: action.contact.consent,
            p_app_installed: action.contact.appInstalled, p_pin: action.contact.demoPin || ""
          });
          break;
        case "DELETE_CONTACT":
          result = await supabase.from("contacts").delete().eq("id", action.id);
          if (!result.error) await supabase.from("audit_entries").insert({ actor, action: "Removed a contact" });
          break;
        case "ADD_NODE":
          result = await supabase.from("tree_nodes").insert({ name: action.node.name, level: action.node.level, parent_id: action.node.parentId, contact_id: action.node.contactId });
          if (!result.error) await supabase.from("audit_entries").insert({ actor, action: `Added call-tree node: ${action.node.name}` });
          break;
        case "DELETE_NODE":
          result = await supabase.from("tree_nodes").delete().eq("id", action.id);
          if (!result.error) await supabase.from("audit_entries").insert({ actor, action: "Removed a call-tree node" });
          break;
        case "SAVE_ALERT":
          result = await supabase.rpc("save_alert", {
            p_title: action.alert.title, p_type: action.alert.type, p_message: action.alert.message,
            p_all_contacts: action.alert.allContacts, p_scope_node_ids: action.alert.scopeNodeIds,
            p_channels: action.alert.channels, p_send: action.send
          });
          break;
        case "CLOSE_ALERT":
          result = await supabase.from("alerts").update({ status: "closed" }).eq("id", action.id);
          if (!result.error) await supabase.from("audit_entries").insert({ actor, action: "Closed an alert" });
          break;
        case "REMIND_PENDING":
          result = await supabase.rpc("queue_alert_reminders", { p_alert_id: action.alertId });
          break;
        case "ADD_USER":
          result = await supabase.from("app_users").insert(action.user);
          if (!result.error) await supabase.from("audit_entries").insert({ actor, action: `Added user: ${action.user.name}` });
          break;
        case "UPDATE_SETTINGS":
          result = await supabase.from("app_settings").upsert({
            id: 1, institution_name: action.settings.institutionName, sms_fallback: action.settings.smsFallback,
            email_copy: action.settings.emailCopy, escalation_minutes: action.settings.escalationMinutes
          });
          if (!result.error) await supabase.from("audit_entries").insert({ actor, action: "Updated system settings" });
          break;
        case "RESET":
          result = await supabase.rpc("reset_demo_data");
          break;
      }
      if (result?.error) throw result.error;
      await loadAdminData(state.adminSession);
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally { setBusy(false); }
  }, [state.adminSession, loadAdminData, loadStudentData]);

  const dispatch = useCallback((action: Action) => { void runAction(action); }, [runAction]);
  const value = useMemo<Store>(() => ({
    state, dispatch, adminLogin, mobileLogin, restoreAdmin, loading, busy, error,
    configured: isSupabaseConfigured,
    clearError: () => setError(""),
    recipientsForAlert(alert) {
      const ids = new Set(alert.recipientContactIds || []);
      return state.contacts.filter((contact) => ids.has(contact.id));
    }
  }), [state, dispatch, adminLogin, mobileLogin, restoreAdmin, loading, busy, error]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
