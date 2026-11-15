/**
 * Nạp danh mục công thức vào thư viện công thức (nhóm, ký hiệu, công thức, phiên bản, ca thử).
 *   npm run seed:formulas          (từ thư mục gốc dự án)
 *   npm run seed:formulas:dry      chỉ kiểm tra danh mục, không ghi gì
 *   npm run seed:formulas:verify   nạp rồi, sau khi nạp, đọc lại bản hiệu lực và ca thử từ DB rồi tính thử
 *
 * Chạy lại an toàn: công thức đã có bản hiệu lực cùng nội dung thì giữ nguyên, khác nội dung thì thêm
 * phiên bản mới (bản cũ chuyển ngừng dùng). Ca thử của mỗi công thức được ghi lại theo danh mục.
 * Đọc DATABASE_URL trong .env gốc. Cần đã áp dụng migration thư viện công thức.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { FORMULAS, GROUPS, SYMBOLS, SYMBOLS_BY_CODE } from '../../frontend/src/domain/formula/catalog';
import { evaluate, findCycle, collectDependencies, validateExpression, valuesMatch, type EvalContext, type Expr, type Value } from '../../frontend/src/domain/formula';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const dryRun = process.argv.includes('--dry-run');
const verify = process.argv.includes('--verify');

/** postgresql://USER:MẬT_KHẨU@HOST:PORT/DB ; mật khẩu có thể chứa '@' nên tách theo '@' cuối cùng */
function parseDatabaseUrl(raw: string) {
  const match = raw.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error('DATABASE_URL không đúng dạng postgresql://user:matkhau@host:port/db');
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: Number(port), database };
}

function validateCatalog(): void {
  const formulaCodes = new Set(FORMULAS.map((f) => f.code));
  const problems: string[] = [];
  for (const f of FORMULAS) {
    for (const issue of validateExpression(f.expression, { symbols: SYMBOLS_BY_CODE, formulaCodes })) {
      problems.push(`${f.code}: ${issue.message}`);
    }
  }
  const cycle = findCycle(Object.fromEntries(FORMULAS.map((f) => [f.code, collectDependencies(f.expression).formulas])));
  if (cycle) problems.push(`Vòng lặp: ${cycle.join(' → ')}`);
  if (problems.length > 0) throw new Error(`Danh mục công thức chưa hợp lệ:\n- ${problems.join('\n- ')}`);
}

/** Tính lại mọi ca thử bằng bản hiệu lực đang lưu trong DB, để chắc dữ liệu đi vòng qua jsonb vẫn đúng */
async function verifyStored(client: pg.Client): Promise<void> {
  const rows = await client.query<{ formula_code: string; expression: Expr; case_name: string; inputs: EvalContext; expected: Value; tolerance: string }>(
    `SELECT f.formula_code, v.expression, t.case_name, t.inputs, t.expected, t.tolerance
       FROM public.formula_test_cases t
       JOIN public.formulas f ON f.id = t.formula_id
       JOIN public.formula_versions v ON v.formula_id = f.id AND v.status = 'active'`,
  );
  const failures: string[] = [];
  for (const r of rows.rows) {
    const actual = evaluate(r.expression, r.inputs);
    if (!valuesMatch(actual, r.expected, Number(r.tolerance))) {
      failures.push(`${r.formula_code} – ${r.case_name}: ${JSON.stringify(actual)} khác ${JSON.stringify(r.expected)}`);
    }
  }
  if (failures.length > 0) throw new Error(`Ca thử lệch sau khi đọc lại từ DB:\n- ${failures.join('\n- ')}`);
  console.log(`Đã đọc lại từ DB và tính thử: ${rows.rows.length} ca thử đều khớp`);
}

async function main(): Promise<void> {
  validateCatalog();
  const testCount = FORMULAS.reduce((total, f) => total + f.tests.length, 0);
  console.log(`Danh mục hợp lệ: ${GROUPS.length} nhóm, ${SYMBOLS.length} ký hiệu, ${FORMULAS.length} công thức, ${testCount} ca thử`);
  if (dryRun) return;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL trong .env gốc');
  const client = new pg.Client({ ...parseDatabaseUrl(url), ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');

    for (const [index, group] of GROUPS.entries()) {
      await client.query(
        `INSERT INTO public.formula_groups (group_code, group_name, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (group_code) DO UPDATE SET group_name = EXCLUDED.group_name, sort_order = EXCLUDED.sort_order, updated_at = now()`,
        [group.code, group.name, index + 1],
      );
    }

    for (const s of SYMBOLS) {
      await client.query(
        `INSERT INTO public.formula_symbols (symbol_code, display_latex, symbol_name, source_kind, source_ref, unit, value_min, value_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (symbol_code) DO UPDATE SET display_latex = EXCLUDED.display_latex, symbol_name = EXCLUDED.symbol_name,
           source_kind = EXCLUDED.source_kind, source_ref = EXCLUDED.source_ref, unit = EXCLUDED.unit,
           value_min = EXCLUDED.value_min, value_max = EXCLUDED.value_max, updated_at = now()`,
        [s.code, s.latex, s.name, s.kind, s.ref ?? null, s.unit ?? null, s.min ?? null, s.max ?? null],
      );
    }

    for (const [index, f] of FORMULAS.entries()) {
      await client.query(
        `INSERT INTO public.formulas (formula_code, formula_name, group_id, output_symbol, output_unit, verification_level, spec_ref, sort_order)
         VALUES ($1, $2, (SELECT id FROM public.formula_groups WHERE group_code = $3), $4, $5, $6, $7, $8)
         ON CONFLICT (formula_code) DO UPDATE SET formula_name = EXCLUDED.formula_name, group_id = EXCLUDED.group_id,
           output_symbol = EXCLUDED.output_symbol, output_unit = EXCLUDED.output_unit,
           verification_level = EXCLUDED.verification_level, spec_ref = EXCLUDED.spec_ref,
           sort_order = EXCLUDED.sort_order, updated_at = now()`,
        [f.code, f.name, f.group, f.output.symbol, f.output.unit ?? null, f.verification, f.specRef ?? null, index + 1],
      );
    }

    // Phiên bản chỉ thêm sau khi mọi công thức đã có, vì cây biểu thức có thể tham chiếu công thức khác
    let added = 0;
    let unchanged = 0;
    for (const f of FORMULAS) {
      const expression = JSON.stringify(f.expression);
      const same = await client.query(
        `SELECT 1 FROM public.formula_versions v JOIN public.formulas fo ON fo.id = v.formula_id
          WHERE fo.formula_code = $1 AND v.status = 'active' AND v.expression = $2::jsonb`,
        [f.code, expression],
      );
      if (same.rowCount && same.rowCount > 0) {
        unchanged += 1;
        continue;
      }
      await client.query(
        `INSERT INTO public.formula_versions (formula_id, expression, status, note)
         SELECT id, $2::jsonb, 'active', 'Nạp từ danh mục công thức' FROM public.formulas WHERE formula_code = $1`,
        [f.code, expression],
      );
      added += 1;
    }

    for (const f of FORMULAS) {
      await client.query(`DELETE FROM public.formula_test_cases WHERE formula_id = (SELECT id FROM public.formulas WHERE formula_code = $1)`, [f.code]);
      for (const t of f.tests) {
        await client.query(
          `INSERT INTO public.formula_test_cases (formula_id, case_name, inputs, expected, tolerance, engine_fn, engine_args)
           SELECT id, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb FROM public.formulas WHERE formula_code = $1`,
          [f.code, t.name, JSON.stringify(t.inputs), JSON.stringify(t.expected), t.tolerance ?? 0.0001, t.engineFn ?? null, t.engineArgs === undefined ? null : JSON.stringify(t.engineArgs)],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Đã nạp: ${added} phiên bản mới, ${unchanged} phiên bản giữ nguyên, ${testCount} ca thử`);
    if (verify) await verifyStored(client);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
