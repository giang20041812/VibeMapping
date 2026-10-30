import { Router } from 'express';
import { z } from 'zod';
import { unwrap } from '../../lib/errors.js';
import { getAuth } from '../../middleware/auth.js';

export const profileRouter = Router();

const PROFILE_COLUMNS =
  'id, role, full_name, display_name, date_of_birth, school_name, grade_or_major, guardian_consent_confirmed';

const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  display_name: z.string().trim().min(1).max(200),
  school_name: z.string().trim().max(300),
  grade_or_major: z.string().trim().max(200),
});

const learnerRoleSchema = z.object({ role: z.enum(['student', 'university_student']) });

profileRouter.get('/', async (req, res) => {
  const { db, userId } = getAuth(req);
  const profile = unwrap(await db.from('user_profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle());
  res.json(profile);
});

profileRouter.put('/', async (req, res) => {
  const { db, userId } = getAuth(req);
  const values = profileUpdateSchema.parse(req.body);
  unwrap(await db.from('user_profiles').update(values).eq('id', userId));
  res.status(204).end();
});

/** Đổi giữa học sinh và sinh viên; vai trò không đổi được bằng cập nhật hồ sơ thường */
profileRouter.put('/learner_role', async (req, res) => {
  const { db } = getAuth(req);
  const { role } = learnerRoleSchema.parse(req.body);
  unwrap(await db.rpc('set_my_learner_role', { p_role: role }));
  res.status(204).end();
});
