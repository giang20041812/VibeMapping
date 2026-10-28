/**
 * Nhập danh sách trường từ file research của team BA vào bảng schools.
 *
 *   RESEARCH NGÀNH NGHỀ TRƯỜNG.xlsx  -> schools (school_name, address, city)
 *
 * Chạy:   npm run import:schools        (cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong .env gốc)
 *         npm run import:schools:dry    (chỉ đọc và báo cáo, không ghi DB)
 *
 * Đọc các sheet có cột "Tên trường" (trường độc lập và trường thành viên); bỏ qua sheet đại học chủ quản.
 * Idempotent: bỏ qua trường đã có trong DB (so tên không phân biệt hoa thường).
 * Service role key chỉ dùng ở script này, không bao giờ đưa vào frontend.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env') });

const SCHOOLS_FILE = path.join(repoRoot, 'TEAM BA', 'RESEARCH NGÀNH NGHỀ TRƯỜNG.xlsx');
const BATCH_SIZE = 200;
/** Cột tỉnh/thành có sheet ghi địa chỉ đầy đủ; giá trị dài hơn mức này được coi là địa chỉ */
const MAX_CITY_LENGTH = 30;

interface SchoolRow {
  school_name: string;
  address: string | null;
  city: string | null;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim();
    if ('result' in value && value.result !== undefined) return String(value.result).trim();
    if ('text' in value) return String(value.text).trim();
    return '';
  }
  return String(value).trim();
}

const normalizeName = (name: string) => name.replace(/\s+/g, ' ').trim();
const nameKey = (name: string) => normalizeName(name).toLowerCase();

function readSchools(workbook: ExcelJS.Workbook): Map<string, SchoolRow> {
  const schools = new Map<string, SchoolRow>();
  for (const sheet of workbook.worksheets) {
    const header = sheet.getRow(1);
    let nameCol = 0;
    let placeCol = 0;
    header.eachCell((cell, col) => {
      const label = cellText(cell);
      if (label === 'Tên trường') nameCol = col;
      if (label.startsWith('Tỉnh/TP (sau sáp nhập')) placeCol = col;
    });
    if (!nameCol) continue; // sheet hướng dẫn, đại học chủ quản

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const schoolName = normalizeName(cellText(row.getCell(nameCol)));
      if (!schoolName) return;
      const place = placeCol ? normalizeName(cellText(row.getCell(placeCol))) : '';
      const isAddress = place.length > MAX_CITY_LENGTH;
      const key = nameKey(schoolName);
      const existing = schools.get(key);
      // Cùng một trường lặp nhiều dòng (mỗi dòng một khoa/ngành): giữ dòng đầu, bổ sung nơi còn trống
      if (existing) {
        if (!existing.city && place && !isAddress) existing.city = place;
        if (!existing.address && place && isAddress) existing.address = place;
        return;
      }
      schools.set(key, {
        school_name: schoolName,
        address: isAddress ? place : null,
        city: place && !isAddress ? place : null,
      });
    });
  }
  return schools;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SCHOOLS_FILE);
  const schools = readSchools(workbook);
  console.log(`Trường đọc được (đã lọc trùng tên): ${schools.size}`);
  console.log(`  có tỉnh/thành: ${[...schools.values()].filter((s) => s.city).length}`);
  console.log(`  có địa chỉ:    ${[...schools.values()].filter((s) => s.address).length}`);

  if (dryRun) {
    console.log('\nDry-run: không ghi vào cơ sở dữ liệu.');
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes('your_service_role_key')) {
    throw new Error('Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY trong .env');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existing, error: readError } = await supabase.from('schools').select('school_name').limit(10000);
  if (readError) throw readError;
  const existingKeys = new Set((existing ?? []).map((row) => nameKey(row.school_name)));

  const pending = [...schools.entries()].filter(([key]) => !existingKeys.has(key)).map(([, row]) => row);
  console.log(`Đã có trong DB: ${schools.size - pending.length}; sẽ thêm: ${pending.length}`);

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const { error } = await supabase.from('schools').insert(pending.slice(start, start + BATCH_SIZE));
    if (error) throw error;
  }
  console.log('Hoàn tất.');
}

main().catch((error) => {
  console.error('Lỗi nhập danh sách trường:', error instanceof Error ? error.message : error);
  process.exit(1);
});
