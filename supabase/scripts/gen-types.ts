/**
 * Sinh kiểu TypeScript cho Supabase client từ schema thật trong database.
 *   npm run supabase:types        (từ thư mục gốc dự án)
 *
 * Đọc DATABASE_URL trong .env gốc, truy vấn catalog Postgres và ghi frontend/src/types/supabase.ts.
 * Chỉ ghi file khi mọi bước thành công, nên lỗi kết nối không làm mất file cũ.
 * Không cần Docker hay Supabase CLI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const OUTPUT = path.join(repoRoot, 'frontend', 'src', 'types', 'supabase.ts');
const SCHEMA = 'public';

/** postgresql://USER:MẬT_KHẨU@HOST:PORT/DB ; mật khẩu có thể chứa '@' nên tách theo '@' cuối cùng */
function parseDatabaseUrl(raw: string) {
  const match = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error('DATABASE_URL không đúng dạng postgresql://user:matkhau@host:port/db');
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: Number(port), database };
}

const SCALAR_TYPES: Record<string, string> = {
  text: 'string',
  citext: 'string',
  uuid: 'string',
  'character varying': 'string',
  character: 'string',
  name: 'string',
  inet: 'string',
  date: 'string',
  'time without time zone': 'string',
  'timestamp without time zone': 'string',
  'timestamp with time zone': 'string',
  interval: 'string',
  bytea: 'string',
  smallint: 'number',
  integer: 'number',
  bigint: 'number',
  numeric: 'number',
  real: 'number',
  'double precision': 'number',
  boolean: 'boolean',
  json: 'Json',
  jsonb: 'Json',
  void: 'undefined',
};

function mapType(pgType: string, enums: Set<string>): string {
  if (pgType.endsWith('[]')) return `${mapType(pgType.slice(0, -2), enums)}[]`;
  const base = pgType.replace(/\(.*\)$/, '');
  if (SCALAR_TYPES[base]) return SCALAR_TYPES[base];
  if (enums.has(base)) return `Database["${SCHEMA}"]["Enums"]["${base}"]`;
  return 'unknown';
}

const quote = (name: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : JSON.stringify(name));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Thiếu DATABASE_URL trong .env');
  const client = new pg.Client({ ...parseDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const enumRows = (
      await client.query<{ name: string; labels: string[] }>(
        `SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = $1 GROUP BY t.typname ORDER BY t.typname`,
        [SCHEMA],
      )
    ).rows;
    const enums = new Set(enumRows.map((e) => e.name));

    const columnRows = (
      await client.query<{ table: string; column: string; nullable: boolean; has_default: boolean; type: string }>(
        `SELECT c.relname AS "table", a.attname AS "column", NOT a.attnotnull AS nullable,
                (a.atthasdef OR a.attidentity <> '' OR a.attgenerated <> '') AS has_default,
                format_type(a.atttypid, NULL) AS type
           FROM pg_attribute a
           JOIN pg_class c ON c.oid = a.attrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY c.relname, a.attnum`,
        [SCHEMA],
      )
    ).rows;

    const fkRows = (
      await client.query<{ name: string; table: string; columns: string[]; ref_table: string; ref_columns: string[]; unique_fk: boolean }>(
        `SELECT con.conname AS name, cl.relname AS "table",
                (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS columns,
                fcl.relname AS ref_table,
                (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum) AS ref_columns,
                EXISTS (SELECT 1 FROM pg_constraint u WHERE u.conrelid = con.conrelid AND u.contype IN ('u', 'p')
                          AND u.conkey = con.conkey) AS unique_fk
           FROM pg_constraint con
           JOIN pg_class cl ON cl.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = cl.relnamespace
           JOIN pg_class fcl ON fcl.oid = con.confrelid
           JOIN pg_namespace fn ON fn.oid = fcl.relnamespace
          WHERE con.contype = 'f' AND n.nspname = $1 AND fn.nspname = $1
          ORDER BY cl.relname, con.conname`,
        [SCHEMA],
      )
    ).rows;

    const functionRows = (
      await client.query<{ name: string; arg_names: string[] | null; arg_types: string[]; return_type: string; returns_set: boolean; default_count: number }>(
        `SELECT p.proname AS name, p.proargnames AS arg_names,
                COALESCE((SELECT array_agg(format_type(t.oid, NULL) ORDER BY o.ord)
                            FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY o(oid, ord)
                            JOIN pg_type t ON t.oid = o.oid), ARRAY[]::text[]) AS arg_types,
                format_type(p.prorettype, NULL) AS return_type, p.proretset AS returns_set,
                p.pronargdefaults AS default_count
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = $1 AND p.prokind = 'f' AND p.prorettype <> 'trigger'::regtype
            AND p.prorettype <> 'event_trigger'::regtype
            AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
          ORDER BY p.proname`,
        [SCHEMA],
      )
    ).rows;

    // ---- Dựng nội dung file
    const lines: string[] = [];
    lines.push('/* Tự sinh bởi supabase/scripts/gen-types.ts, đừng sửa tay. Chạy lại: npm run supabase:types */');
    lines.push('export type Json =');
    lines.push('  | string');
    lines.push('  | number');
    lines.push('  | boolean');
    lines.push('  | null');
    lines.push('  | { [key: string]: Json | undefined }');
    lines.push('  | Json[];');
    lines.push('');
    lines.push('export type Database = {');
    lines.push(`  ${SCHEMA}: {`);
    lines.push('    Tables: {');

    const tables = [...new Set(columnRows.map((c) => c.table))];
    for (const table of tables) {
      const columns = columnRows.filter((c) => c.table === table);
      const field = (c: (typeof columns)[number]) => {
        const type = mapType(c.type, enums);
        return c.nullable ? `${type} | null` : type;
      };
      lines.push(`      ${quote(table)}: {`);
      lines.push('        Row: {');
      for (const c of columns) lines.push(`          ${quote(c.column)}: ${field(c)};`);
      lines.push('        };');
      lines.push('        Insert: {');
      for (const c of columns) {
        const optional = c.nullable || c.has_default ? '?' : '';
        lines.push(`          ${quote(c.column)}${optional}: ${field(c)};`);
      }
      lines.push('        };');
      lines.push('        Update: {');
      for (const c of columns) lines.push(`          ${quote(c.column)}?: ${field(c)};`);
      lines.push('        };');
      const relationships = fkRows.filter((fk) => fk.table === table);
      if (relationships.length === 0) {
        lines.push('        Relationships: [];');
      } else {
        lines.push('        Relationships: [');
        for (const fk of relationships) {
          lines.push('          {');
          lines.push(`            foreignKeyName: ${JSON.stringify(fk.name)};`);
          lines.push(`            columns: ${JSON.stringify(fk.columns)};`);
          lines.push(`            isOneToOne: ${fk.unique_fk};`);
          lines.push(`            referencedRelation: ${JSON.stringify(fk.ref_table)};`);
          lines.push(`            referencedColumns: ${JSON.stringify(fk.ref_columns)};`);
          lines.push('          },');
        }
        lines.push('        ];');
      }
      lines.push('      };');
    }
    lines.push('    };');
    lines.push('    Views: {');
    lines.push('      [_ in never]: never;');
    lines.push('    };');
    lines.push('    Functions: {');
    if (functionRows.length === 0) lines.push('      [_ in never]: never;');
    for (const fn of functionRows) {
      const names = fn.arg_names ?? [];
      const firstDefault = fn.arg_types.length - fn.default_count;
      const args = fn.arg_types.map((type, i) => {
        const name = names[i] || `arg${i + 1}`;
        return `${quote(name)}${i >= firstDefault ? '?' : ''}: ${mapType(type, enums)}`;
      });
      const returnType = mapType(fn.return_type, enums);
      lines.push(`      ${quote(fn.name)}: {`);
      lines.push(args.length ? `        Args: { ${args.join('; ')} };` : '        Args: Record<PropertyKey, never>;');
      lines.push(`        Returns: ${fn.returns_set ? `${returnType}[]` : returnType};`);
      lines.push('      };');
    }
    lines.push('    };');
    lines.push('    Enums: {');
    if (enumRows.length === 0) lines.push('      [_ in never]: never;');
    for (const e of enumRows) lines.push(`      ${quote(e.name)}: ${e.labels.map((l) => JSON.stringify(l)).join(' | ')};`);
    lines.push('    };');
    lines.push('    CompositeTypes: {');
    lines.push('      [_ in never]: never;');
    lines.push('    };');
    lines.push('  };');
    lines.push('};');
    lines.push('');

    fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');
    console.log(`Đã ghi ${path.relative(repoRoot, OUTPUT)}: ${tables.length} bảng, ${functionRows.length} hàm, ${enumRows.length} kiểu liệt kê.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Sinh kiểu thất bại (file cũ giữ nguyên):', error instanceof Error ? error.message : error);
  process.exit(1);
});
