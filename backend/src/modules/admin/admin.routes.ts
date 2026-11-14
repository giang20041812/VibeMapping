import { Router } from 'express';
import { auditLogsRouter } from './audit_logs.routes.js';
import { criteriaRouter } from './criteria.routes.js';
import { operationParametersRouter } from './operation_parameters.routes.js';
import { packageAssignmentsRouter } from './package_assignments.routes.js';
import { questionsRouter } from './questions.routes.js';

/** Quyền quản trị do RLS và hàm RPC trong database kiểm theo JWT của người gọi */
export const adminRouter = Router();

adminRouter.use(criteriaRouter);
adminRouter.use('/questions', questionsRouter);
adminRouter.use('/operation_parameters', operationParametersRouter);
adminRouter.use('/audit_logs', auditLogsRouter);
adminRouter.use('/package_assignments', packageAssignmentsRouter);
