import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './modules/auth/AuthContext';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { GuestOnly, RequireAuth, RequireCompleteProfile } from './components/layout/RouteGuards';
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
          <Route element={<RequireCompleteProfile />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/ho-so" element={<ProfilePage />} />
              <Route path="/danh-gia-ca-nhan" element={<PersonalAssessmentPage />} />
              <Route path="/danh-gia-ca-nhan/:sessionId" element={<AssessmentRunPage />} />
              <Route path="/danh-gia-360" element={<Assessment360Page />} />
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
          </Route>
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
