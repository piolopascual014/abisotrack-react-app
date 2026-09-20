export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
export const percent = (part: number, whole: number) => whole ? Math.round((part / whole) * 100) : 0;
