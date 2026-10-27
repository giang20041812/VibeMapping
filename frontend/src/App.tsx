import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { GuestOnly, RequireAuth, RequireCompleteProfile, RequireRole, RequireSession } from './components/layout/RouteGuards';
import { LoginPage } from './modules/auth/pages/LoginPage';
import { RegisterPage } from './modules/auth/pages/RegisterPage';
import { ForgotPasswordPage } from './modules/auth/pages/ForgotPasswordPage';
import { ProfilePage } from './modules/profile/pages/ProfilePage';



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

        <Route element={<AuthLayout />}>
        </Route>

        {/* Thanh điều hướng ngang, không có thanh bên: giới thiệu, ngành nghề, khám phá trường, khách làm bài test và khai báo thông tin sau bài */}
        <Route element={<PublicLayout />}>
          <Route element={<RequireSession />}>
          </Route>
        </Route>

        {/* Làm bài: khách (tài khoản ẩn danh) thấy thanh ngang, người có tài khoản thấy thanh bên */}
        <Route element={<RequireSession />}>
          <Route element={<ShellLayout />}>
            <Route element={<RequireCompleteProfile />}>
            </Route>
          </Route>
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/ho-so" element={<ProfilePage />} />
            <Route element={<RequireCompleteProfile />}>
              <Route element={<RequireRole roles={['student', 'university_student']} />}>
              </Route>
              <Route element={<RequireRole roles={['parent']} />}>
              </Route>
              <Route element={<RequireRole roles={['university_student']} />}>
              </Route>
              <Route element={<RequireRole roles={['student', 'university_student', 'teacher', 'school_admin']} />}>
              </Route>
            </Route>
            <Route element={<RequireRole roles={['teacher', 'school_admin', 'system_admin']} />}>
            </Route>

            <Route element={<RequireRole roles={['system_admin']} />}>
            </Route>
          </Route>
        </Route>

        {/* Đường dẫn cũ đã gộp trang */}

        <Route element={<GuestLayout />}>
        </Route>

        {import.meta.env.DEV && (
          <Route element={<AppLayout />}>
          </Route>
        )}

      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
