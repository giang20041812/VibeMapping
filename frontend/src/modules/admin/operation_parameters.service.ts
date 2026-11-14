import { supabase } from '../../lib/supabase';
import type { Json } from '../../types/supabase';
import { displayPersonName } from './admin.logic';
import type { OperationParameter } from './admin.types';

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

function toParameter(row: ParameterRow): OperationParameter {
  return {
    id: row.id,
    param_code: row.param_code,
    param_name: row.param_name,
    param_value: row.param_value,
    is_current: row.is_current,
    effective_from: row.effective_from,
    changed_by: row.changed_by,
    changed_by_name: displayPersonName(row.changer),
  };
}

export async function listCurrentParameters(): Promise<OperationParameter[]> {
  const { data, error } = await supabase
    .from('operation_parameters')
    .select(PARAMETER_COLUMNS)
    .eq('is_current', true)
    .order('param_code')
    .limit(200);
  if (error) {
    console.error('Lỗi đọc tham số vận hành:', error.message);
    throw error;
  }
  return (data as ParameterRow[]).map(toParameter);
}

export async function listParameterHistory(paramCode: string): Promise<OperationParameter[]> {
  const { data, error } = await supabase
    .from('operation_parameters')
    .select(PARAMETER_COLUMNS)
    .eq('param_code', paramCode)
    .order('effective_from', { ascending: false })
    .limit(50);
  if (error) {
    console.error('Lỗi đọc lịch sử tham số:', error.message);
    throw error;
  }
  return (data as ParameterRow[]).map(toParameter);
}

/** Mỗi lần đổi là một bản ghi mới; bản đang hiệu lực trước đó được hệ thống đóng lại */
export async function saveParameter(
  paramCode: string,
  paramName: string,
  value: unknown,
  changedBy: string,
): Promise<void> {
  const { error } = await supabase.from('operation_parameters').insert({
    param_code: paramCode,
    param_name: paramName,
    param_value: value as Json,
    is_current: true,
    changed_by: changedBy,
  });
  if (error) {
    console.error('Lỗi lưu tham số vận hành:', error.message);
    throw error;
  }
}
