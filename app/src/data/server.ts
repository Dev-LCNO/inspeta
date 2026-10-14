// Ponto único que as telas importam. Com INSPETA_API definido no build, fala com o backend real;
// sem ele, roda o núcleo no próprio navegador (modo demonstração).
import { ambienteNavegador } from "./ambienteNavegador";
import { criarServidor, type ServerApi } from "./nucleo";
import { criarServidorRemoto } from "./remoto";

export { pode, podeVerInspecao } from "./nucleo";
export type { ServerApi } from "./nucleo";

const API = process.env.INSPETA_API ?? "";
/** true quando o app roda sem backend (dados só neste navegador). */
export const MODO_DEMO = !API;

export const server: ServerApi = API ? criarServidorRemoto(API) : criarServidor(ambienteNavegador);
