import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Inbox, LoaderCircle } from "lucide-react";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" | "secondary" | "ghost" }) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span><Inbox size={26} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

export function SelectField({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>;
}

export function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="field"><span>{label}</span><textarea rows={5} {...props} /></label>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Close">×</Button></header>{children}</section></div>;
}

export function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <Card className="stat-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</Card>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>;
}

export function Loading() { return <main className="loading"><LoaderCircle className="spin" /> Loading…</main>; }
