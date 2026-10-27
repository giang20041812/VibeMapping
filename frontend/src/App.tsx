import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { GuestOnly, RequireAuth, RequireRole } from './components/layout/RouteGuards';
import { PackageAssignmentsPage } from './modules/admin/pages/PackageAssignmentsPage';
import { QuestionBankPage } from './modules/admin/pages/QuestionBankPage';
import { CriteriaPage } from './modules/admin/pages/CriteriaPage';
import { OperationParametersPage } from './modules/admin/pages/OperationParametersPage';
import { AuditLogsPage } from './modules/admin/pages/AuditLogsPage';
import { LoginPage } from './modules/auth/pages/LoginPage';
import { RegisterPage } from './modules/auth/pages/RegisterPage';
import { ForgotPasswordPage } from './modules/auth/pages/ForgotPasswordPage';
import { AssessmentResultSamplePage } from './modules/assessment_result/pages/AssessmentResultSamplePage';
import { NotFoundPage } from './modules/not_found/NotFoundPage';
import { HomePage } from './modules/home/HomePage';
import { ProfilePage } from './modules/profile/pages/ProfilePage';
import { PersonalAssessmentPage } from './modules/personal_assessment/pages/PersonalAssessmentPage';
import { AssessmentRunPage } from './modules/assessment_session/pages/AssessmentRunPage';
import { GuestLayout } from './components/layout/GuestLayout';
import { GuestAssessmentPage } from './modules/guest_assessment/pages/GuestAssessmentPage';
import { Assessment360Page } from './modules/assessment_360/pages/Assessment360Page';
import { Assessment360SamplePage } from './modules/assessment_360/pages/Assessment360SamplePage';
import { SkeletonSamplePage } from './modules/dev/SkeletonSamplePage';

/** Quản trị hệ thống không dùng trang chủ của học sinh: vào thẳng khu quản trị */
const HomeRoute: React.FC = () => {
  const { profile, isProfileLoading } = useAuth();
  if (!isProfileLoading && profile?.role === 'system_admin') return <Navigate to="/quan-tri" replace />;
  return <HomePage />;
};

/** Đường dẫn cũ của phiên làm bài */
const LegacySessionRedirect: React.FC = () => {
  const { sessionId } = useParams();
  return <Navigate to={`/danh-gia-ca-nhan/${sessionId}`} replace />;
};

export const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route element={<AuthLayout />}>
            <Route path="/dang-nhap" element={<LoginPage />} />
            <Route path="/dang-ky" element={<RegisterPage />} />
            <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/ho-so" element={<ProfilePage />} />
            <Route path="/danh-gia-ca-nhan" element={<PersonalAssessmentPage />} />
            <Route path="/danh-gia-ca-nhan/:sessionId" element={<AssessmentRunPage />} />
            <Route path="/danh-gia-360" element={<Assessment360Page />} />

            <Route element={<RequireRole roles={['system_admin']} />}>
              <Route path="/quan-tri" element={<Navigate to="/quan-tri/goi-cau-hoi" replace />} />
              <Route path="/quan-tri/goi-cau-hoi" element={<PackageAssignmentsPage />} />
              <Route path="/quan-tri/cau-hoi" element={<QuestionBankPage />} />
              <Route path="/quan-tri/tieu-chi" element={<CriteriaPage />} />
              <Route path="/quan-tri/tham-so" element={<OperationParametersPage />} />
              <Route path="/quan-tri/nhat-ky" element={<AuditLogsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Đường dẫn cũ đã gộp trang */}
        <Route path="/danh-gia" element={<Navigate to="/danh-gia-ca-nhan" replace />} />
        <Route path="/danh-gia/:sessionId" element={<LegacySessionRedirect />} />
        <Route path="/ket-qua" element={<Navigate to="/danh-gia-ca-nhan" replace />} />
        <Route path="/moi-danh-gia" element={<Navigate to="/danh-gia-360" replace />} />
        <Route path="/bai-danh-gia" element={<Navigate to="/danh-gia-360" replace />} />

        <Route element={<GuestLayout />}>
          <Route path="/moi/:token" element={<GuestAssessmentPage />} />
        </Route>

        {import.meta.env.DEV && (
          <Route element={<AppLayout />}>
            <Route path="/dev/ket-qua-mau" element={<AssessmentResultSamplePage />} />
            <Route path="/dev/danh-gia-360-mau" element={<Assessment360SamplePage />} />
            <Route path="/dev/khung-cho" element={<SkeletonSamplePage />} />
          </Route>
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
