/** Sinh supabase/tests/formula_catalog_fixture.sql từ danh mục công thức: npm run gen:formula-fixture */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFormulaFixtureSql } from '../../frontend/domain-checks/formula-fixture';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '..', 'tests', 'formula_catalog_fixture.sql');
fs.writeFileSync(target, buildFormulaFixtureSql(), 'utf8');
console.log(`Đã ghi ${target}`);
