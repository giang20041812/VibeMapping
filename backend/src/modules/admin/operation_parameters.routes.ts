import { Router } from 'express';
import { z } from 'zod';
import { unwrap } from '../../lib/errors.js';
import { getAuth } from '../../middleware/auth.js';
import type { Json } from '../../types/supabase.js';
import { displayPersonName } from './admin.logic.js';

export const operationParametersRouter = Router();

const PARAMETER_COLUMNS =
  'id, param_code, param_name, param_value, is_current, effective_from, changed_by, changer:user_profiles!operation_parameters_changed_by_fkey(full_name, display_name)';

type ParameterRow = {
  id: string;
  param_code: string;
  param_name: string;
  param_value: Json;
  is_current: boolean;
  effective_from: string;
  changed_by: string | null;
  changer: { full_name: string | null; display_name: string | null } | null;
};

function toParameter(row: ParameterRow) {
  const { changer, ...rest } = row;
  return { ...rest, changed_by_name: displayPersonName(changer) };
}

const paramCodeParams = z.object({ paramCode: z.string().min(1).max(100) });

const saveSchema = z.object({
  param_code: z.string().trim().min(1).max(100),
  param_name: z.string().trim().min(1).max(300),
  param_value: z.json(),
});

operationParametersRouter.get('/', async (req, res) => {
  const { db } = getAuth(req);
  const rows = unwrap(
    await db.from('operation_parameters').select(PARAMETER_COLUMNS).eq('is_current', true).order('param_code').limit(200),
  );
  res.json((rows as unknown as ParameterRow[]).map(toParameter));
});

operationParametersRouter.get('/:paramCode/history', async (req, res) => {
  const { db } = getAuth(req);
  const { paramCode } = paramCodeParams.parse(req.params);
  const rows = unwrap(
    await db
      .from('operation_parameters')
      .select(PARAMETER_COLUMNS)
      .eq('param_code', paramCode)
      .order('effective_from', { ascending: false })
      .limit(50),
  );
  res.json((rows as unknown as ParameterRow[]).map(toParameter));
});

/** Mỗi lần đổi là một bản ghi mới; bản đang hiệu lực trước đó được hệ thống đóng lại */
operationParametersRouter.post('/', async (req, res) => {
  const { db, userId } = getAuth(req);
  const input = saveSchema.parse(req.body);
  unwrap(
    await db.from('operation_parameters').insert({
      param_code: input.param_code,
      param_name: input.param_name,
      param_value: input.param_value as Json,
      is_current: true,
      changed_by: userId,
    }),
  );
  res.status(201).end();
});
