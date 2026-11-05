"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("job-radar-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("job-radar-theme", callback);
  };
}
export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme || "dark",
    () => "dark",
  );
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem("job-radar-theme", next);
    } catch {}
    window.dispatchEvent(new Event("job-radar-theme"));
  }
  return (
    <button
      className="theme-toggle secondary"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"
      }
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
