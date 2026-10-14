// Tela aberta pelo link do e-mail (convite ou "esqueci minha senha"): a pessoa define a senha e entra.
import { useState } from "react";
import { server } from "../data/server";
import { Icon } from "../ui/icons";
import { Button, TextField } from "../ui/primitives";
import { navigate } from "../ui/router";

export function DefinirSenha({ motivo }: { motivo: "recovery" | "invite" | "signup" | null }) {
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function salvar(e: { preventDefault(): void }) {
    e.preventDefault();
    if (senha !== conf) { setErro("As duas senhas não são iguais."); return; }
    setErro(null); setEnviando(true);
    try {
      const m = await server.definirSenha(senha);
      navigate(m.is_master || m.acoes.some((a) => a !== "aplicar") ? "/web/inspecoes" : "/campo", { replace: true });
    } catch (x) { setErro((x as Error).message); }
    finally { setEnviando(false); }
  }
  return (
    <main className="login">
      <div className="card stack">
        <div className="brand" style={{ padding: 0 }}><span className="mark"><Icon n="checkSquare" size="sm" /></span>Inspeta</div>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", lineHeight: "var(--text-xl--line-height)" }}>{motivo === "invite" ? "Bem-vindo! Crie sua senha" : "Crie uma senha nova"}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Pelo menos 8 caracteres. Você vai usar esta senha no computador e no celular.</p>
        </div>
        <form className="stack" onSubmit={salvar} noValidate>
          <TextField label="Nova senha" type="password" value={senha} onChange={setSenha} autoComplete="new-password" required autoFocus />
          <TextField label="Repita a senha" type="password" value={conf} onChange={setConf} autoComplete="new-password" required error={erro} />
          <Button type="submit" size="lg" block loading={enviando}>Salvar e entrar</Button>
        </form>
      </div>
    </main>
  );
}
