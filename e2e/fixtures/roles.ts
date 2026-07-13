import path from 'node:path';
import type { Browser, BrowserContext } from '@playwright/test';

/** Roles sembrados por scripts/seed.sh (SPECS §1.2). */
export type Role = 'admin' | 'teacher' | 'teacher2' | 'student1' | 'student2' | 'student3';

export const ROLES: readonly Role[] = [
  'admin',
  'teacher',
  'teacher2',
  'student1',
  'student2',
  'student3',
];

/** Credenciales desde .env — mismos defaults que .env.example y seed.sh. */
export const CREDS: Record<Role, { username: string; password: string }> = {
  admin: {
    username: process.env.MOODLE_ADMIN_USER ?? 'admin',
    password: process.env.MOODLE_ADMIN_PASS ?? 'Admin123!',
  },
  teacher: {
    username: process.env.TEACHER_USER ?? 'teacher1',
    password: process.env.TEACHER_PASS ?? 'Teacher123!',
  },
  teacher2: {
    username: process.env.TEACHER2_USER ?? 'teacher2',
    password: process.env.TEACHER2_PASS ?? 'Teacher123!',
  },
  student1: {
    username: process.env.STUDENT1_USER ?? 'student1',
    password: process.env.STUDENT1_PASS ?? 'Student123!',
  },
  student2: {
    username: process.env.STUDENT2_USER ?? 'student2',
    password: process.env.STUDENT2_PASS ?? 'Student123!',
  },
  student3: {
    username: process.env.STUDENT3_USER ?? 'student3',
    password: process.env.STUDENT3_PASS ?? 'Student123!',
  },
};

/** storageState por rol, generado por auth.setup.ts. Directorio ignorado por git (cookies de sesión). */
const AUTH_DIR = path.resolve(__dirname, '..', '.auth');
export const STORAGE: Record<Role, string> = {
  admin: path.join(AUTH_DIR, 'admin.json'),
  teacher2: path.join(AUTH_DIR, 'teacher2.json'),
  teacher: path.join(AUTH_DIR, 'teacher.json'),
  student1: path.join(AUTH_DIR, 'student1.json'),
  student2: path.join(AUTH_DIR, 'student2.json'),
  student3: path.join(AUTH_DIR, 'student3.json'),
};

/**
 * Contexto autenticado adicional dentro de un mismo test — para flujos multi-rol
 * (estudiante rinde → profesor califica) sin logout/login por UI (SPECS §4.2).
 * El caller es responsable de cerrarlo (o usar try/finally).
 */
export async function newContextAs(browser: Browser, role: Role): Promise<BrowserContext> {
  return browser.newContext({ storageState: STORAGE[role] });
}
