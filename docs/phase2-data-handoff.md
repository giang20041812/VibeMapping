# Phase 2 – Bàn giao dữ liệu: Nghề phù hợp và Nghề – Ngành – Trường

Phạm vi: chỉ phần **dữ liệu** (bảng, nạp từ Excel của BA, kiểm tra). Chưa có giao diện, chưa có RPC tính Career Fit.
Cập nhật: 2026-10-30. Chưa áp lên Supabase thật (`.env` chưa có khóa); đã chạy thử trên PostgreSQL 18 cục bộ.

## 1. Đã làm

| Thành phần | File |
|---|---|
| Migration các bảng + RLS | `supabase/migrations/20261030000100_phase2_career_major_institution.sql` |
| Script nạp + báo cáo | `supabase/scripts/import-phase2-data.ts` |
| Lệnh | `npm run import:phase2:dry` (chỉ đọc, báo cáo) · `npm run import:phase2` (ghi DB) |

Thứ tự áp dụng: migration → `import:ba` (cần bảng `criteria`) → `import:phase2`.

### Bảng (tên theo thực thể SRS mục ENT-04)

| Bảng | Thực thể | Nguồn | Số dòng khi nạp thử |
|---|---|---|---|
| `career_fields` | Career_Field (cây: lĩnh vực LV1–LV6 → nhóm nghề) | Career_Profile | 47 |
| `careers` | Career | Career_Profile | 2.176 |
| `career_job_descriptions` | JD gốc, căn cứ tính ma trận | Career_Profile | 2.870 |
| `career_job_description_criteria` | JD ↔ tiêu chí (kèm căn cứ chọn) | cột "Dimension liên quan" | 21.321 |
| `career_requirements` | Career_Requirement: `required_score` (Req), `career_weight` (CW) | tính từ JD | 5.242 |
| `career_holland_profiles` | Hồ sơ sáu chiều RIASEC của nghề (G6) | tính từ JD | 5.502 |
| `career_matrix_versions` | Phiên bản ma trận nghề `NGHE-1.0` (R18) | — | 1 |
| `majors` | Major | RESEARCH NGÀNH NGHỀ TRƯỜNG | 1.080 |
| `career_major_links` | Career_Major_Link | tự dò, xem 3.3 | 4.651 |
| `institutions` | Institution (+ 5 hệ thống đại học quốc gia/vùng) | RESEARCH NGÀNH NGHỀ TRƯỜNG | 341 + 5 |
| `training_programs` | Training_Program | RESEARCH NGÀNH NGHỀ TRƯỜNG | 9.514 |

Tất cả bật RLS. Người dùng đã đăng nhập đọc được danh mục (lĩnh vực, ngành, trường, chương trình); **nghề và mọi dữ liệu đi kèm chỉ đọc được khi nghề ở trạng thái `published`**; ghi chỉ `system_admin`. `anon` không đọc gì. Nghề nạp vào luôn ở `draft` theo SRS R16 (chỉ `published` mới vào Career Fit).

Script idempotent: chạy lại không đổi `status` nghề đã công bố; ma trận và liên kết nghề–ngành sinh tự động được dựng lại, dòng đã nâng `verification_level` lên mức chuyên gia hoặc liên kết `manual`/`is_verified` được giữ.

## 2. Quy tắc dựng dữ liệu

### Nghề
- Nguồn: `Career_Profile.xlsx` (bản gộp đã khử trùng JD, đã gắn 31 dimension). `CAREER_JD_RESEARCH_MASTER.xlsm` là bản thô của cùng JD, không đọc.
- Mã nhóm G1–G6 của file JD là **lĩnh vực nghề**, đổi thành `LV1–LV6` để không nhầm với nhóm năng lực G1–G7 (SRS R16 đề xuất như vậy).
- Cột "Group ID" không phải mã nghề thống nhất: 808 mã chỉ có một chức danh, nhưng 21 mã (ví dụ `G2`, `G6-F01`, `G1-02`) gom hàng chục chức danh. Nên một nghề = (Group ID × chức danh, không phân biệt hoa thường); `career_code` = Group ID nếu mã đó chỉ có một chức danh, ngược lại `Group ID:slug-chức-danh`.
- Required Level quy đổi theo R16: `L0,L1→1; L2→2; L3→3; L4→4; L5–L7→5`, hai mức lấy thấp hơn, số đã trong 1–5 giữ nguyên, chữ/trống không quy đổi (`required_level` để NULL, giữ chữ gốc ở `required_level_raw`).
- Chỉ JD mức L0–L2 có `required_level` quy đổi được mới tính vào ma trận (số này là `careers.qualifying_jd_count`).
- **Giả định của dev, chưa có văn bản BA chốt:**
  - `required_score` = trung bình Required Level của các JD đủ điều kiện có gắn tiêu chí đó.
  - `career_weight` = số JD có tiêu chí đó, chuẩn hóa để tổng bằng 1 trong từng thành phần (G1–G5 chung, G7 riêng).
  - Hồ sơ Holland = tỷ lệ JD đủ điều kiện có gắn D6.1–D6.6 (R, I, A, S, E, C); `holland_top3` lấy ba chữ có JD nhiều nhất.
  - `verification_level = per_jd_data` ("Theo dữ liệu JD").
- `is_standard_complete` = có yêu cầu thuộc G1–G5 **và** G7 **và** có Holland.

### Trường – Ngành
- Mọi sheet có cột "Tên trường" được đọc (trừ danh sách đại học chủ quản). Các sheet chia dòng rời nhau gần như hoàn toàn (9.734 dòng hợp lệ, 220 dòng trùng khóa được gộp, giữ dòng có trạng thái research cao hơn).
- Tên trường gộp theo khóa: bỏ dấu, bỏ phần ngoặc, bỏ tiền tố "Trường" → 341 trường (từ 419 cách viết).
- Hệ thống đại học quốc gia/vùng (ĐHQGHN, ĐHQG-HCM, Đà Nẵng, Huế, Thái Nguyên) là bản ghi `parent_university`; 76 trường thành viên trỏ về bằng `parent_institution_id`. Các "đại học chủ quản" khác trong file (UEH, Cần Thơ, Duy Tân…) chỉ là chính trường đó nên không tạo cha.
- Tên ngành: bỏ mọi phần ngoặc cuối (mã ngành, viết tắt, hệ chương trình) để cùng một ngành không bị tách; phần bỏ lưu ở `training_programs.program_qualifier`. Mười dòng ngành giữ chỗ ("Thạc sĩ", "Tiến sĩ các ngành"…) bị bỏ (xem cảnh báo của dry-run).
- Một **chương trình đào tạo** = trường × khoa × ngành × chuyên ngành × hệ × phần ngoặc. `research_status` lấy từ cột "Trạng thái research".
- `study_years`, `tuition_per_semester_min/max`, `degree_levels` tách từ chữ tự do bằng quy tắc; không tách được thì để NULL và giữ chữ gốc (`program_summary`, `tuition_text`).
- Lĩnh vực mạnh của trường (`main_field_id`) lấy theo Group ID của file; file nói rõ mỗi trường chỉ xếp một nhóm. Vì vậy **ngành không gắn lĩnh vực**, ngành nối với nghề qua `career_major_links`.

### Liên kết nghề – ngành
File research không có bảng nghề ↔ ngành. Liên kết sinh tự động: nghề liên kết `direct` với một ngành khi mọi thành phần tên ngành (tách theo `-`, `,`, `/`, "và") xuất hiện nguyên từ trong mục Học vấn của các JD thuộc nghề. Mọi dòng có `link_source = jd_education_text`, `is_verified = false`. **Chưa có liên kết `indirect`** (không có căn cứ).

## 3. Phát hiện cần BA xem (ảnh hưởng trực tiếp tới Career Fit)

1. **Gần như không nghề nào đủ JD.** SRS R16 đề xuất tối thiểu 20 JD (L1/L2) mỗi nghề; dữ liệu có 2.176 nghề nhưng chỉ **917** nghề có ít nhất 1 JD dùng được, **8** nghề có 5–19 JD, **2** nghề đạt từ 20 (nhiều nhất 36). 818 nghề "đủ chuẩn" theo định nghĩa thành phần nhưng dựa trên 1–4 JD, ma trận rất mỏng. Cần BA chọn: hạ P16, gộp các chức danh cùng nghề, hoặc bổ sung JD.
2. **Chức danh chưa được gộp thành nghề.** Cùng một nghề đang là nhiều dòng (ví dụ cùng "Chuyên viên Phân tích nghiệp vụ" nằm ở nhiều Group ID, 88 chức danh xuất hiện ở hơn một Group ID). Cần danh mục nghề chuẩn do BA đặt.
3. **Cách gộp Req/CW** (trung bình, đếm JD) và việc chỉ dùng JD L0–L2 do dev đặt mặc định; JD L0–L2 thường có Required Level thấp nên Req cũng thấp (nghề kiểm thử có Req từ 1,0 đến 2,0).
4. **Công thức Holland/RIASEC Match vẫn BLOCKED** (SRS R05); chỉ mới có dữ liệu đầu vào (hồ sơ sáu chiều + Top 3).
5. **106 JD có Required Level trống/"N / A"** nên không vào ma trận.
6. **Học phí và số năm**: 40,6% chương trình tách được học phí mỗi kỳ (phần còn lại ghi "chưa công bố", theo tín chỉ hoặc theo năm); 76% có số năm đào tạo.
7. **Chất lượng research**: 1.240 chương trình "Chưa xác minh", 440 "Cần bổ sung" (file ghi rõ chưa đối chiếu website). Trạng thái được giữ ở `research_status` để giao diện/lọc dùng.
8. **Liên kết nghề–ngành tự dò chưa kiểm duyệt**: 1.437/2.176 nghề có ít nhất một ngành, nhưng chỉ 325/1.080 ngành có nghề; ngành chung chung ("Kinh tế", "Luật") gắn rất nhiều nghề. Cần BA rà hoặc cung cấp bảng ngành ↔ nghề chính thức.
9. 2 trường chưa rõ công lập/tư thục và 1 trường chưa có tỉnh/thành do dòng nguồn lệch cột.

## 4. Chưa làm
- `Admission_Data` (điểm chuẩn, chỉ tiêu, tổ hợp xét tuyển): file research không có.
- `User_Saved_Career` và các thực thể ENT-05/06: thuộc tính năng.
- Hàm tính Career Fit / Gap / xếp hạng (R06–R08, R20), trang quản trị nghề (công bố, sửa ma trận), giao diện tra cứu.
- `data_checked_at` (P20) chưa điền vì ngày kiểm tra JD nằm trong chữ tự do ở cột "Nguồn dữ liệu".
- `supabase/all-migrations.sql` đã cũ (dừng ở migration 9); sau khi áp migration lên Supabase thật nên chạy `npm run supabase:types` để sinh lại type.

## 5. Cách đã kiểm tra
- Chạy toàn bộ 24 migration (cả file mới, hai lần) trên PostgreSQL 18 cục bộ: không lỗi, mọi bảng bật RLS.
- Chạy đường ghi của script (qua client giả nối Postgres, vì không có Supabase thật) hai lần liên tiếp: toàn bộ ràng buộc CHECK/FK/UNIQUE qua; số dòng không đổi giữa hai lần; nghề đã đặt `published` giữ nguyên.
- Tổng `career_weight` mỗi nghề trong từng thành phần = 1. Người dùng thường chỉ đọc được nghề `published` và dữ liệu đi kèm, không ghi được; `anon` không đọc được.
- **Chưa chạy trên Supabase thật** (cần `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, migration đã áp, `import:ba` đã chạy).
