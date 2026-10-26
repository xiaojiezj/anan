import { createContext, useContext } from 'react';
import type { AppData, Session } from './domain/state';
export type Tab = 'home' | 'literacy' | 'math' | 'mall' | 'settings';
export type GameRoute = { kind: 'literacy' | 'count' | 'calculate'; id: string };
export type AppContextValue = { data: AppData; commit(change: (current: AppData) => AppData): Promise<void>; notify(message: string): void; navigate(tab: Tab): void; start(kind: GameRoute['kind']): void; read(text: string, automatic?: boolean): void; finish(session: Session): void };
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const context = useContext(AppContext); if (!context) throw Error('App context missing'); return context; }
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请重试';
