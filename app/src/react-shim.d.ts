// Declaração mínima do React 19 para checagem de tipos SEM @types/react
// (o registro do npm não está acessível neste ambiente). Cobre só o que o app usa.
// Ao instalar as dependências de verdade, apague este arquivo.

declare module "react" {
  export type ReactNode = ReactElement | string | number | boolean | null | undefined | Iterable<ReactNode>;
  export interface ReactElement { type: unknown; props: unknown; key: string | null }
  export type FC<P = {}> = (props: P) => ReactNode;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export interface RefObject<T> { current: T }
  export interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }> }

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(cb: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): RefObject<T>;
  export function useId(): string;
  export function createContext<T>(value: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export const Fragment: FC<{ children?: ReactNode; key?: string | number }>;
  export const StrictMode: FC<{ children?: ReactNode }>;

  export interface SyntheticEvent<T = Element> { currentTarget: T; target: EventTarget; preventDefault(): void; stopPropagation(): void }
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> { target: EventTarget & T }
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
  export interface PointerEvent<T = Element> extends SyntheticEvent<T> { clientX: number; clientY: number; pointerId: number; pressure: number }
  export interface MouseEvent<T = Element> extends SyntheticEvent<T> { clientX: number; clientY: number }
  export interface CSSProperties { [k: string]: string | number | undefined }
}

declare module "react-dom/client" {
  import type { ReactNode } from "react";
  export function createRoot(el: Element): { render(node: ReactNode): void; unmount(): void };
}

declare module "react/jsx-runtime" {
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
}

// JSX: atributos livres nos elementos nativos, mas componentes próprios são
// checados pelas suas props (é onde mora a lógica do app).
declare namespace JSX {
  type Element = import("react").ReactElement;
  // como no React 18+: componentes podem devolver qualquer ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ElementType = string | ((props: any) => import("react").ReactNode);
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: string | number | null }
  interface IntrinsicElements { [tag: string]: Record<string, unknown> }
}

// Variáveis injetadas pelo build (scripts/build.sh --define). Ver backend/.env.example.
declare const process: { env: { NODE_ENV?: string; INSPETA_API?: string; INSPETA_AUTH?: string; INSPETA_ANON_KEY?: string } };
