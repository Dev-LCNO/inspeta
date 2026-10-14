// Estado de rede do aparelho: navigator.onLine + um "modo avião" do app
// (para testar offline sem desligar o Wi-Fi). Só o app de campo depende disso.
import { emitChange } from "./kv";

const KEY = "inspeta:modo-aviao";

export const net = {
  get airplane(): boolean {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  },
  set airplane(v: boolean) {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* sem storage */ }
    emitChange("net");
  },
  get online(): boolean {
    return navigator.onLine && !this.airplane;
  },
};

window.addEventListener("online", () => emitChange("net"));
window.addEventListener("offline", () => emitChange("net"));
