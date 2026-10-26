-- ====================================================================
-- Initial Seed Data
-- ====================================================================

-- Insert sample categories
INSERT INTO public.customer_categories (id, code, name, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'VIP', 'Khách hàng VIP', true),
  ('22222222-2222-2222-2222-222222222222', 'ENTERPRISE', 'Doanh nghiệp lớn', true),
  ('33333333-3333-3333-3333-333333333333', 'SME', 'Doanh nghiệp vừa và nhỏ', true),
  ('44444444-4444-4444-4444-444444444444', 'RETAIL', 'Khách hàng cá nhân', true),
  ('55555555-5555-5555-5555-555555555555', 'PARTNER', 'Đối tác liên kết', true)
ON CONFLICT (code) DO NOTHING;

-- Insert sample customers
INSERT INTO public.customers (customer_code, full_name, category_id, email, phone, tax_id, city, status)
VALUES
  ('KH-0001', 'Công ty Cổ phần Công nghệ Toàn Cầu', '22222222-2222-2222-2222-222222222222', 'contact@toancau.vn', '02438889999', '0102938475', 'Hà Nội', 'active'),
  ('KH-0002', 'Tập đoàn Đầu tư & Phát triển Phương Nam', '11111111-1111-1111-1111-111111111111', 'info@phuongnamgroup.com', '02837778888', '0304958671', 'Hồ Chí Minh', 'active'),
  ('KH-0003', 'Công ty TNHH Giải pháp Phần mềm Sáng Tạo', '33333333-3333-3333-3333-333333333333', 'admin@sangtao.io', '0912345678', '0109988776', 'Đà Nẵng', 'pending'),
  ('KH-0004', 'Nguyễn Thị Minh Hạnh', '44444444-4444-4444-4444-444444444444', 'minhhanh.nguyen@gmail.com', '0987654321', NULL, 'Hà Nội', 'active'),
  ('KH-0005', 'Công ty Cổ phần Vận tải & Logistics Biển Đông', '22222222-2222-2222-2222-222222222222', 'support@biendonglogistics.vn', '02253888777', '0203948576', 'Hải Phòng', 'locked'),
  ('KH-0006', 'Trần Đình Trọng', '44444444-4444-4444-4444-444444444444', 'trong.td@outlook.com', '0903456789', NULL, 'Cần Thơ', 'inactive')
ON CONFLICT (customer_code) DO NOTHING;
