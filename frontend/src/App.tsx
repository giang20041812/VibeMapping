import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { ShellLayout } from './components/layout/ShellLayout';
import { GuestOnly, RequireAuth, RequireRole, RequireSession } from './components/layout/RouteGuards';
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
import { CompleteProfilePage } from './modules/profile/pages/CompleteProfilePage';
import { PersonalAssessmentPage } from './modules/personal_assessment/pages/PersonalAssessmentPage';
import { GuestTestPage } from './modules/personal_assessment/pages/GuestTestPage';
import { SchoolExplorerPage } from './modules/school_explorer/pages/SchoolExplorerPage';
import { AssessmentRunPage } from './modules/assessment_session/pages/AssessmentRunPage';
import { GuestLayout } from './components/layout/GuestLayout';
import { GuestAssessmentPage } from './modules/guest_assessment/pages/GuestAssessmentPage';
import { Assessment360Page } from './modules/assessment_360/pages/Assessment360Page';
import { Assessment360SamplePage } from './modules/assessment_360/pages/Assessment360SamplePage';
import { SchoolsPage } from './modules/class_management/pages/SchoolsPage';
import { ClassListPage } from './modules/class_management/pages/ClassListPage';
import { ClassDetailPage } from './modules/class_management/pages/ClassDetailPage';
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

        {/* Thanh điều hướng ngang, không có thanh bên: giới thiệu, khám phá trường, khách làm bài test và khai báo thông tin sau bài */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/kham-pha-truong" element={<SchoolExplorerPage />} />
          <Route path="/lam-bai" element={<GuestTestPage />} />
          <Route element={<RequireSession />}>
            <Route path="/hoan-tat-ho-so" element={<CompleteProfilePage />} />
          </Route>
        </Route>

        {/* Làm bài: khách (tài khoản ẩn danh) thấy thanh ngang, người có tài khoản thấy thanh bên */}
        <Route element={<RequireSession />}>
          <Route element={<ShellLayout />}>
            <Route path="/danh-gia-ca-nhan/:sessionId" element={<AssessmentRunPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/ho-so" element={<ProfilePage />} />
            <Route path="/danh-gia-ca-nhan" element={<PersonalAssessmentPage />} />
            <Route path="/danh-gia-360" element={<Assessment360Page />} />

            <Route element={<RequireRole roles={['student', 'university_student', 'teacher', 'school_admin']} />}>
              <Route path="/lop-hoc" element={<ClassListPage />} />
            </Route>
            <Route element={<RequireRole roles={['teacher', 'school_admin', 'system_admin']} />}>
              <Route path="/lop-hoc/:classId" element={<ClassDetailPage />} />
            </Route>
            <Route element={<RequireRole roles={['teacher']} />}>
            </Route>

            <Route element={<RequireRole roles={['system_admin']} />}>
              <Route path="/quan-tri/truong" element={<SchoolsPage />} />
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
