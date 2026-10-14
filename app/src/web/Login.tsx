// S01 — Entrar
import { useState } from "react";
import { server } from "../data/server";
import { Icon } from "../ui/icons";
import { Button, Callout, TextField } from "../ui/primitives";
import { navigate } from "../ui/router";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: { preventDefault(): void }) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const m = await server.entrar(email, senha);
      navigate(m.acoes.includes("gerenciar_formularios") || m.is_master ? "/web/inspecoes" : "/campo", { replace: true });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <div className="card stack">
        <div className="brand" style={{ padding: 0 }}><span className="mark"><Icon n="checkSquare" size="sm" /></span>Inspeta</div>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", lineHeight: "var(--text-xl--line-height)" }}>Entrar</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Use o e-mail cadastrado pela sua empresa.</p>
        </div>
        <form className="stack" onSubmit={entrar} noValidate>
          <TextField label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="username" required />
          <TextField label="Senha" type="password" value={senha} onChange={setSenha} autoComplete="current-password" required
            error={erro} />
          <Button type="submit" size="lg" block loading={enviando}>{enviando ? "Entrando…" : "Entrar"}</Button>
        </form>
        <Callout tone="info">
          <b>Ambiente de demonstração.</b> Dono: <span className="mono">rogerio@exemplo.com</span> · Supervisor: <span className="mono">carlos@exemplo.com</span> · Aplicadora: <span className="mono">ana@exemplo.com</span> · qualquer senha com 4+ caracteres.
        </Callout>
      </div>
    </main>
  );
}
