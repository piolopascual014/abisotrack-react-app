export type ID = string;
export type AlertStatus = "draft" | "active" | "closed";
export type Channel = "app" | "sms" | "email";

export interface Contact {
  id: ID;
  name: string;
  phone: string;
  email: string;
  role: string;
  unit: string;
  consent: boolean;
  appInstalled: boolean;
}

export interface TreeNode {
  id: ID;
  name: string;
  level: string;
  parentId: ID | null;
  contactId: ID | null;
}

export interface AlertRecord {
  id: ID;
  title: string;
  type: string;
  message: string;
  scopeNodeIds: ID[];
  allContacts: boolean;
  channels: Channel[];
  status: AlertStatus;
  createdAt: string;
  sentAt: string | null;
  acknowledgedContactIds: ID[];
}

export interface SmsLog {
  id: ID;
  alertId: ID;
  contactId: ID;
  status: "queued" | "delivered";
  createdAt: string;
}

export interface UserRecord {
  id: ID;
  name: string;
  email: string;
  role: string;
}

export interface AuditEntry {
  id: ID;
  at: string;
  actor: string;
  action: string;
}

export interface AppSettings {
  institutionName: string;
  smsFallback: boolean;
  emailCopy: boolean;
  escalationMinutes: number;
}

export interface AppState {
  contacts: Contact[];
  treeNodes: TreeNode[];
  alerts: AlertRecord[];
  smsLogs: SmsLog[];
  users: UserRecord[];
  audit: AuditEntry[];
  settings: AppSettings;
  adminSession: { name: string; email: string } | null;
  mobileContactId: ID | null;
}
