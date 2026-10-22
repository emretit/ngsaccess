export function deviceConnectionBadge(status?: "online" | "offline" | "never") {
  return {
    tone: status === "online" ? "success" : status === "offline" ? "warning" : "neutral",
    label: status === "online" ? "Çevrimiçi" : status === "never" ? "Henüz bağlanmadı" : "Çevrimdışı",
  } as const;
}
