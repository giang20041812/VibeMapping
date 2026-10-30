import { Router } from 'express';
import { z } from 'zod';
import { unwrap, unwrapRows } from '../../lib/errors.js';
import { getAuth } from '../../middleware/auth.js';
import { PACKAGE_SIZES, type PackageSize } from './admin.logic.js';
import { questionFilterQuerySchema } from './questions.routes.js';
import { listQuestions } from './questions.service.js';

export const packageAssignmentsRouter = Router();

const setSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1).max(500),
  package_size: z.union([z.literal(35), z.literal(50), z.literal(75)]),
  assigned: z.boolean(),
});

/** Chỉ câu hỏi góc nhìn bản thân (self) được gán vào gói tự đánh giá */
packageAssignmentsRouter.get('/', async (req, res) => {
  const { db } = getAuth(req);
  const { page, ...filter } = questionFilterQuerySchema.parse(req.query);
  const result = await listQuestions(db, { ...filter, raterGroup: 'self' }, page);
  if (result.rows.length === 0) {
    res.json({ rows: [], total: result.total });
    return;
  }

  const assignments = unwrapRows(
    await db.from('question_package_assignments').select('question_id, package_size').in('question_id', result.rows.map((row) => row.id)),
  );
  const byQuestion = new Map<string, PackageSize[]>();
  for (const item of assignments) {
    const list = byQuestion.get(item.question_id) ?? [];
    list.push(item.package_size as PackageSize);
    byQuestion.set(item.question_id, list);
  }
  res.json({
    rows: result.rows.map((row) => ({ ...row, packages: byQuestion.get(row.id) ?? [] })),
    total: result.total,
  });
});

packageAssignmentsRouter.get('/counts', async (req, res) => {
  const { db } = getAuth(req);
  const counts = await Promise.all(
    PACKAGE_SIZES.map(async (size) => {
      const result = await db.from('question_package_assignments').select('id', { count: 'exact', head: true }).eq('package_size', size);
      unwrap(result);
      return [size, result.count ?? 0] as const;
    }),
  );
  res.json(Object.fromEntries(counts));
});

/** Thêm hoặc gỡ một lô câu hỏi khỏi một gói; trả về số dòng đã đổi */
packageAssignmentsRouter.post('/', async (req, res) => {
  const { db } = getAuth(req);
  const input = setSchema.parse(req.body);
  const changed = unwrap(
    await db.rpc('set_package_assignments', {
      p_question_ids: input.question_ids,
      p_package_size: input.package_size,
      p_assigned: input.assigned,
    }),
  );
  res.json({ changed: changed ?? 0 });
});
