import { Router } from 'express';
import { z } from 'zod';
import { unwrap } from '../../lib/errors.js';
import { getAuth } from '../../middleware/auth.js';
import { RATER_GROUPS } from './admin.logic.js';

export const criteriaRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const groupPatchSchema = z.object({
  name: z.string().trim().min(1).max(300),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

const criteriaPatchSchema = z.object({
  name: z.string().trim().min(1).max(300),
  definition: z.string().nullable(),
  behavior_indicator: z.string().nullable(),
  reference_source: z.string().nullable(),
  holland_code: z.string().max(10).nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  is_short_set: z.boolean(),
});

const visibilitySchema = z.object({
  items: z
    .array(
      z.object({
        raterGroup: z.enum(RATER_GROUPS),
        isVisible: z.boolean(),
        scaleMethod: z.string().nullable(),
      }),
    )
    .min(1)
    .max(RATER_GROUPS.length),
});

criteriaRouter.get('/criteria_groups', async (req, res) => {
  const { db } = getAuth(req);
  res.json(unwrap(await db.from('criteria_groups').select('id, group_code, name, sort_order, is_active').order('sort_order')));
});

criteriaRouter.put('/criteria_groups/:id', async (req, res) => {
  const { db } = getAuth(req);
  const { id } = idParams.parse(req.params);
  unwrap(await db.from('criteria_groups').update(groupPatchSchema.parse(req.body)).eq('id', id));
  res.status(204).end();
});

criteriaRouter.get('/criteria', async (req, res) => {
  const { db } = getAuth(req);
  res.json(
    unwrap(
      await db
        .from('criteria')
        .select('id, group_id, dimension_code, name, definition, behavior_indicator, reference_source, holland_code, sort_order, is_active, is_short_set')
        .order('sort_order')
        .limit(500),
    ),
  );
});

criteriaRouter.put('/criteria/:id', async (req, res) => {
  const { db } = getAuth(req);
  const { id } = idParams.parse(req.params);
  unwrap(await db.from('criteria').update(criteriaPatchSchema.parse(req.body)).eq('id', id));
  res.status(204).end();
});

criteriaRouter.get('/holland_codes', async (req, res) => {
  const { db } = getAuth(req);
  res.json(unwrap(await db.from('holland_codes').select('holland_code, name').order('holland_code')));
});

criteriaRouter.get('/criteria_rater_visibility', async (req, res) => {
  const { db } = getAuth(req);
  res.json(unwrap(await db.from('criteria_rater_visibility').select('id, criteria_id, rater_group, is_visible, scale_method').limit(2000)));
});

/** Ghi lại toàn bộ hiển thị của một tiêu chí theo từng nhóm người đánh giá */
criteriaRouter.put('/criteria/:id/rater_visibility', async (req, res) => {
  const { db } = getAuth(req);
  const { id } = idParams.parse(req.params);
  const { items } = visibilitySchema.parse(req.body);
  unwrap(
    await db.from('criteria_rater_visibility').upsert(
      items.map((item) => ({
        criteria_id: id,
        rater_group: item.raterGroup,
        is_visible: item.isVisible,
        scale_method: item.scaleMethod,
      })),
      { onConflict: 'criteria_id,rater_group' },
    ),
  );
  res.status(204).end();
});
