import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { AlertRecord, AppSettings, AppState, Contact, TreeNode, UserRecord } from "../types";
import { newId, now } from "../helpers";

const STORAGE_KEY = "abisotrack-app-v1";

export const emptyState: AppState = {
  contacts: [], treeNodes: [], alerts: [], smsLogs: [], users: [], audit: [],
  settings: { institutionName: "", smsFallback: false, emailCopy: false, escalationMinutes: 15 },
  adminSession: null, mobileContactId: null
};

type Action =
  | { type: "ADMIN_LOGIN"; name: string; email: string }
  | { type: "ADMIN_LOGOUT" }
  | { type: "MOBILE_LOGIN"; contactId: string }
  | { type: "MOBILE_LOGOUT" }
  | { type: "ADD_CONTACT"; contact: Omit<Contact, "id"> }
  | { type: "DELETE_CONTACT"; id: string }
  | { type: "ADD_NODE"; node: Omit<TreeNode, "id"> }
  | { type: "DELETE_NODE"; id: string }
  | { type: "SAVE_ALERT"; alert: Omit<AlertRecord, "id" | "createdAt" | "sentAt" | "acknowledgedContactIds">; send: boolean }
  | { type: "CLOSE_ALERT"; id: string }
  | { type: "ACK_ALERT"; alertId: string; contactId: string }
  | { type: "ADD_USER"; user: Omit<UserRecord, "id"> }
  | { type: "UPDATE_SETTINGS"; settings: AppSettings }
  | { type: "RESET" };

function actor(state: AppState) {
  if (state.adminSession) return state.adminSession.name;
  const contact = state.contacts.find((item) => item.id === state.mobileContactId);
  return contact?.name || "Local user";
}

function audit(state: AppState, action: string): AppState {
  return { ...state, audit: [{ id: newId(), at: now(), actor: actor(state), action }, ...state.audit] };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADMIN_LOGIN": return audit({ ...state, adminSession: { name: action.name, email: action.email } }, "Signed in to the administrator workspace");
    case "ADMIN_LOGOUT": return { ...state, adminSession: null };
    case "MOBILE_LOGIN": return { ...state, mobileContactId: action.contactId };
    case "MOBILE_LOGOUT": return { ...state, mobileContactId: null };
    case "ADD_CONTACT": return audit({ ...state, contacts: [...state.contacts, { ...action.contact, id: newId() }] }, `Added contact: ${action.contact.name}`);
    case "DELETE_CONTACT": {
      const item = state.contacts.find((contact) => contact.id === action.id);
      return audit({ ...state, contacts: state.contacts.filter((contact) => contact.id !== action.id), treeNodes: state.treeNodes.map((node) => node.contactId === action.id ? { ...node, contactId: null } : node) }, `Removed contact: ${item?.name || "Unknown"}`);
    }
    case "ADD_NODE": return audit({ ...state, treeNodes: [...state.treeNodes, { ...action.node, id: newId() }] }, `Added call-tree node: ${action.node.name}`);
    case "DELETE_NODE": {
      const item = state.treeNodes.find((node) => node.id === action.id);
      return audit({ ...state, treeNodes: state.treeNodes.filter((node) => node.id !== action.id && node.parentId !== action.id) }, `Removed call-tree node: ${item?.name || "Unknown"}`);
    }
    case "SAVE_ALERT": {
      const id = newId();
      const sentAt = action.send ? now() : null;
      const record: AlertRecord = { ...action.alert, id, createdAt: now(), sentAt, acknowledgedContactIds: [], status: action.send ? "active" : "draft" };
      const scopedNames = new Set(state.treeNodes.filter((node) => record.scopeNodeIds.includes(node.id)).map((node) => node.name));
      const recipients = state.contacts.filter((contact) => record.allContacts || scopedNames.has(contact.unit));
      const logs = action.send && record.channels.includes("sms") ? recipients.filter((contact) => contact.phone).map((contact) => ({ id: newId(), alertId: id, contactId: contact.id, status: "queued" as const, createdAt: now() })) : [];
      return audit({ ...state, alerts: [record, ...state.alerts], smsLogs: [...logs, ...state.smsLogs] }, `${action.send ? "Sent" : "Saved draft"} alert: ${record.title}`);
    }
    case "CLOSE_ALERT": return audit({ ...state, alerts: state.alerts.map((item) => item.id === action.id ? { ...item, status: "closed" } : item) }, "Closed an alert");
    case "ACK_ALERT": {
      const alerts = state.alerts.map((item) => item.id === action.alertId && !item.acknowledgedContactIds.includes(action.contactId) ? { ...item, acknowledgedContactIds: [...item.acknowledgedContactIds, action.contactId] } : item);
      return audit({ ...state, alerts }, "Acknowledged an alert");
    }
    case "ADD_USER": return audit({ ...state, users: [...state.users, { ...action.user, id: newId() }] }, `Added user: ${action.user.name}`);
    case "UPDATE_SETTINGS": return audit({ ...state, settings: action.settings }, "Updated system settings");
    case "RESET": return emptyState;
  }
}

function loadState(): AppState {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? { ...emptyState, ...JSON.parse(value) } : emptyState;
  } catch { return emptyState; }
}

interface Store {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  recipientsForAlert(alert: AlertRecord): Contact[];
}

const AppStateContext = createContext<Store | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);
  const value = useMemo<Store>(() => ({
    state, dispatch,
    recipientsForAlert(alert) {
      const scopedNames = new Set(state.treeNodes.filter((node) => alert.scopeNodeIds.includes(node.id)).map((node) => node.name));
      return state.contacts.filter((contact) => alert.allContacts || scopedNames.has(contact.unit));
    }
  }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
