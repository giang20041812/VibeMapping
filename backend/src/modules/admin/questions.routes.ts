import { Router } from 'express';
import { z } from 'zod';
import { unwrap } from '../../lib/errors.js';
import { getAuth } from '../../middleware/auth.js';
import { ANSWER_OPTION_COUNT, RATER_GROUPS } from './admin.logic.js';
import { listQuestions } from './questions.service.js';

export const questionsRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

export const questionFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  keyword: z.string().max(200).optional(),
  groupId: z.string().uuid().optional(),
  criteriaId: z.string().uuid().optional(),
  raterGroup: z.enum(RATER_GROUPS).optional(),
  assessmentPart: z.coerce.number().int().min(1).max(4).optional(),
  detailLevel: z.string().max(40).optional(),
  activeState: z.enum(['active', 'inactive']).optional(),
});

const questionInputSchema = z.object({
  question_code: z.string().trim().min(1).max(60),
  criteria_id: z.string().uuid(),
  rater_group: z.enum(RATER_GROUPS),
  respondent_segment: z.string().trim().min(1).max(40),
  question_type: z.string().max(60).nullable(),
  content: z.string().trim().min(1),
  answer_options: z.array(z.string()).length(ANSWER_OPTION_COUNT),
  assessment_part: z.number().int().min(1).max(4).nullable(),
  detail_level: z.string().max(40).nullable(),
  is_active: z.boolean(),
});

const activeSchema = z.object({ is_active: z.boolean() });

questionsRouter.get('/', async (req, res) => {
  const { db } = getAuth(req);
  const { page, ...filter } = questionFilterQuerySchema.parse(req.query);
  res.json(await listQuestions(db, filter, page));
});

questionsRouter.post('/', async (req, res) => {
  const { db } = getAuth(req);
  unwrap(await db.from('questions').insert(questionInputSchema.parse(req.body)));
  res.status(201).end();
});

questionsRouter.put('/:id', async (req, res) => {
  const { db } = getAuth(req);
  const { id } = idParams.parse(req.params);
  unwrap(await db.from('questions').update(questionInputSchema.parse(req.body)).eq('id', id));
  res.status(204).end();
});

questionsRouter.patch('/:id/active', async (req, res) => {
  const { db } = getAuth(req);
  const { id } = idParams.parse(req.params);
  unwrap(await db.from('questions').update(activeSchema.parse(req.body)).eq('id', id));
  res.status(204).end();
});
