# Phase 1 – Bàn giao: Đánh giá 360° (cơ sở dữ liệu xong; giao diện đã chạy trọn luồng từ tự đánh giá đến kết quả chính thức)

Tài liệu này dành cho phiên làm việc tiếp theo (người hoặc AI). Đọc hết trước khi viết mã.
Cập nhật lần cuối: 2026-10-27. Trạng thái git: **toàn bộ thay đổi chưa commit**.

---

## 1. Phạm vi phase 1

**Làm:** mọi nguồn đánh giá dẫn tới *kết quả đánh giá 360°* và dừng ở việc người dùng nhận được kết quả đó.

| Thuộc phase 1 | Không thuộc phase 1 |
|---|---|
| Tự đánh giá tuần tự (4 phần, gói 35/50/75 câu) | Nghề – Ngành – Trường, tìm kiếm, bản đồ liên kết |
| Mời người ngoài đánh giá qua đường dẫn / QR (phụ huynh, bạn bè, giáo viên, người hướng dẫn) | So sánh phương án, ngân sách, báo cáo quyết định |
| Giáo viên chấm điểm theo bảng lưới trong lớp học (nhà trường) | Lộ trình, khoảng trống kỹ năng |
| Tính điểm trọng số 360°, nhãn trạng thái, chốt kết quả | Cộng đồng, sự kiện, kết nối người hướng dẫn |
| Hạ tầng dùng chung tối thiểu: vai trò, đồng ý quyền riêng tư, thông báo, tham số, nhật ký | Career Fit, Holland Match, xếp hạng nghề |

Nguồn đặc tả: `Phase 1.docx` (gốc, ở thư mục gốc repo) và `TEAM BA/SRS_VibeMapping_v.0.0.9 (1).docx`.
**Mục 4.3 của SRS (Scoring Rule) là nguồn chuẩn cho công thức**; khi khác chỗ khác thì theo mục 4.3.

---

## 2. Những gì đã làm (backend)

### 2.1 Quyết định nền tảng
- **Đăng nhập dùng Supabase Auth** (`auth.users`). `public.user_profiles.id` trùng `auth.users.id`; trigger `on_auth_user_created` tự tạo hồ sơ. Vai trò lấy từ `raw_user_meta_data.role` khi đăng ký (`student`, `university_student`, `parent`, `teacher`, `mentor`). `system_admin` và `school_admin` **không** tự đăng ký được (trigger ép về `student`); cấp tay bằng SQL/Studio.
- Supabase tự host trên VPS vẫn có Auth (GoTrue), nên chuyển từ Cloud sang VPS không đổi hướng này.
- **Khách (người được mời) không có tài khoản.** Họ không đọc được bảng nào; chỉ gọi các hàm RPC (mục 2.4) bằng `anon` key.
- Tên bảng số nhiều, `snake_case`, khóa chính `uuid`, có `created_at/updated_at`, **mọi bảng bật RLS** (theo `.agents/rules/06`).
- Bài của giáo viên chấm theo **bảng lưới** khi nộp sẽ sinh ra bài trong `assessment_360_submissions` (`submission_channel = 'classroom_grid'`, đã chấp nhận) để dùng chung một logic tính điểm.

### 2.2 Migration (`supabase/migrations/`, chạy theo thứ tự)

| File | Nội dung |
|---|---|
| `20261027000100_phase1_users_and_consents.sql` | `user_profiles`, `user_relationships`, `consent_records`, kiểu `user_role`, `rater_group`, trigger tạo hồ sơ, hàm RLS |
| `20261027000200_phase1_criteria_questions_params.sql` | `framework_versions`, `criteria_groups`, `criteria`, `criteria_rater_visibility`, `questions`, `holland_codes`, `core_values`, `operation_parameters` (có lịch sử phiên bản) |
| `20261027000300_phase1_schools_classes.sql` | `schools`, `school_staff`, `classes`, `class_members`, `class_assessment_grids`, `…_grid_students`, `…_grid_details` |
| `20261027000400_phase1_assessments_360.sql` | `assessment_sessions`, `assessment_answers`, `assessment_evidences`, `assessment_core_values`, `invitation_links`, `assessment_360_submissions`, `assessment_360_answers`, `assessment_results`, `assessment_result_scores`, `assessment_result_weights`, `assessment_result_snapshots` |
| `20261027000500_phase1_platform_and_rpc.sql` | `notifications`, `notification_settings`, `audit_logs`, RPC cho khách và giáo viên |
| `20261027000600_phase1_scoring_and_packages.sql` | `question_package_assignments`, `recalculate_result`, `complete_self_assessment`, chốt kết quả |
| `20261027000700_phase1_schedule_auto_finalize.sql` | lịch pg_cron chạy `auto_finalize_results()` mỗi giờ (bỏ qua nếu thiếu pg_cron) |
| `20261027000900_phase1_lock_function_privileges.sql` | siết quyền thực thi hàm: Supabase mặc định cấp EXECUTE cho `anon`/`authenticated` trên mọi hàm mới, nên chỉ cấp lại đúng các hàm được phép gọi (mục 2.4); hàm nội bộ chỉ `service_role` gọi được. **Khi thêm hàm mới phải GRANT rõ ràng** |
| `20261027000800_phase1_align_scoring_rules.sql` | đồng bộ theo SRS 4.3: trọng số, Trust Index, ẩn danh nhóm, điểm nhóm G1–G7, Coverage/Confidence |
| `20261027001000_phase1_display_name_unicode.sql` | ràng buộc tên hiển thị cho phép chữ có dấu (regex theo mã ký tự, vì collation `C` của DB không hiểu `\w` tiếng Việt) |
| `20261027001100_phase1_guest_session_state.sql` | `get_360_session(resume_token)` cho khách quay lại làm tiếp (trạng thái bài, trạng thái đường dẫn, câu đã trả lời); `get_360_questions` trả thêm `criteria_name`. Đã GRANT cho `anon`, `authenticated` |

Idempotent (chạy lại được). Đã xóa migration demo `init_schema` và module "khách hàng" ở frontend.

### 2.3 Dữ liệu từ Excel và script import
- `supabase/scripts/import-ba-data.ts` (Node/TS): `npm run import:ba` (ghi DB) hoặc `npm run import:ba:dry` (chỉ đọc, báo cáo). Đọc `.env` gốc rồi `frontend/.env`. Cần `SUPABASE_URL` (hoặc `VITE_SUPABASE_URL`) và `SUPABASE_SERVICE_ROLE_KEY`.
- Nạp: 7 nhóm, 31 tiêu chí, 155 cấu hình hiển thị, **3100 câu hỏi** (2880 bật, 220 tắt).
- **Ma trận hiển thị lấy từ sheet `THANG ĐO`**, không phải `MA TRẬN` (sheet đó trống). Ô `N/A` → `is_visible = false` và các câu tương ứng `is_active = false`.
- Dữ liệu bẩn đã xử lý/ghi nhận: dòng 2102 của ngân hàng câu hỏi có cột Group dính ghi chú; tên D5.4 lệch giữa sheet ("Ủy quyền & phối hợp" vs "Phân công & phối hợp") — script lấy tên ở sheet `MA TRẬN`. **Nên nhờ BA sửa file gốc.**
- `Career_Profile.xlsx`, `CAREER_JD_RESEARCH_MASTER.xlsm`, `RESEARCH NGÀNH NGHỀ TRƯỜNG.xlsx` thuộc phase sau, chưa đọc.

### 2.4 RPC (giao diện sẽ gọi các hàm này)

| Hàm | Ai gọi | Việc |
|---|---|---|
| `get_invitation_public(token)` | khách | trạng thái link: `valid`/`expired`/`revoked`/`full`/`not_found`, nhóm người chấm, tên hiển thị HS/SV |
| `start_360_submission(token, nickname, relationship, duration, frequency, depth)` | khách | tạo bài nháp, trả `resume_token`; 3 giá trị 1–4 đã quy đổi theo bảng; chống trùng IP; chặn khi link đủ số bài |
| `get_360_questions(resume_token)` | khách | câu hỏi (mỗi tiêu chí 1 câu, chọn ổn định theo token) |
| `save_360_answers(resume_token, answers)` | khách | lưu nháp `[{question_id, score\|null, insufficient}]` |
| `submit_360(resume_token)` | khách | nộp; thiếu câu → `{ok:false, reason:'missing_answers', missing_question_ids}`; gắn cờ chất lượng + Trust Index |
| `decide_submission(id, 'accepted'\|'rejected')` | HS/SV | duyệt bài, tự tính lại kết quả |
| `complete_self_assessment(session_id, invite_enabled)` | HS/SV | hoàn thành tự đánh giá, tạo kết quả nhãn "Tự đánh giá" |
| `finalize_my_result(result_id)` | HS/SV | chốt thủ công (cần ≥ 1 bài đã chấp nhận) |
| `submit_class_grid_student(grid_student_id)` | giáo viên | nộp điểm một học sinh, sửa xong nộp lại được (ghi đè bài cũ); chặn: `empty_cells`, `missing_understanding`, `guardian_pending` |
| `auto_finalize_results()` | cron | chốt tự động khi đủ bài hoặc hết hạn |

Khách phải gửi header `x-forwarded-for` hợp lệ (Supabase tự thêm) thì chống trùng IP mới hoạt động.

### 2.5 Công thức tính điểm đã cài (theo SRS 4.3)
1. **RS** (điểm một người chấm tại một tiêu chí) = trung bình các câu hợp lệ; câu "không đủ cơ sở" là `NULL`, bị bỏ khỏi tử và mẫu, **không phải 0 và không phạt 40%**. Hiển thị mới đổi sang % (điểm ÷ 5 × 100).
2. **Trọng số bài** ∝ `TH% × S`, `TH% = (TH − 3) ÷ 9 × 100`, `TH` = tổng 3 câu ngữ cảnh (3–12). `S` chưa có nguồn nên **tạm = 100**. Tổng bằng 0 thì chia đều.
3. **Điểm tiêu chí tổng hợp**: bản thân giữ `P03 = 50%`; các bài ngoài hợp lệ **được chuẩn hóa lại tại từng tiêu chí** để tổng bằng `100% − P03`. Không có nguồn ngoài hợp lệ thì bản thân = 100%.
4. **Ẩn danh**: điểm theo nhóm chỉ hiện khi nhóm có ≥ 2 bài; nhóm ít bài gộp vào "Người khác" (cũng cần ≥ 2). HS/SV **không đọc được** điểm từng người (`assessment_360_answers`, `assessment_result_weights` không có policy đọc).
5. **Điểm nhóm G1–G7** = trung bình đều các tiêu chí có dữ liệu (bảng `assessment_result_group_scores`, cho radar).
6. **Mức năng lực**: ≥ 80 Rất cao, ≥ 65 Cao, ≥ 50 Trung bình, còn lại Thấp. Tỷ lệ "không đủ cơ sở" > 40% → cờ `insufficient_basis_warning`, **không** xếp "Thấp".
7. **Coverage/Confidence** mỗi tiêu chí: số nhóm có điểm hợp lệ ÷ số nhóm được phân công; ≥ 80% Cao, ≥ 60% Trung bình, dưới Thấp (và hạ Thấp nếu quá 40% không đủ cơ sở).
8. **Trust Index** khi nộp: `(T + D + A) ÷ 3`; T = thời gian ÷ (số câu × 3 giây), D = độ phân tán, A = 1 − tỷ lệ "không đủ cơ sở"; nhãn Tin cậy ≥ 70%, Cần cân nhắc ≥ 40%, còn lại Đề xuất loại; luôn "Đề xuất loại" nếu ≥ 7 tiêu chí cùng một mức hoặc T < 0,5. Không tự loại bài, chỉ gắn cờ.
9. **Trạng thái kết quả**: `self_assessment` → `temporary` (có bài chấp nhận) → `final_360` (chốt). Kết quả đã chốt khóa, không tính lại. Mỗi lần tính ghi một bản chụp bất biến (`assessment_result_snapshots`).
10. Chốt tự động khi mọi link đang mở đã đủ bài chấp nhận hoặc hết hạn (14 ngày) *và* có ≥ 1 bài chấp nhận. Hết hạn mà chưa có bài nào → giữ "Tự đánh giá".

### 2.6 Trạng thái triển khai và kiểm thử
- **Đã triển khai lên Supabase Cloud, project HuongNghiep (region ap-southeast-2)** ngày 2026-10-27: 9 migration (34 bảng, tất cả bật RLS), pg_cron job `auto-finalize-results` chạy mỗi giờ, đã chạy `import:ba` (7 nhóm, 31 tiêu chí, 155 cấu hình hiển thị, 3100 câu hỏi trong đó 2880 bật, 22 tham số hiện hành).
- Kiểm trên project thật: trigger tạo hồ sơ khi có tài khoản mới; RLS cho `authenticated`; API công khai: khách gọi được `get_invitation_public`, **không** đọc được `questions`, `assessment_360_answers`, **không** gọi được hàm nội bộ (`auto_finalize_results`, `push_notification`…); `service_role` gọi được `auto_finalize_results`. Phát hiện và đã vá lỗ hổng quyền hàm (migration 9).
- Kịch bản SQL đầy đủ (luồng khách, tính điểm có số tính tay, giáo viên nộp bảng lưới) đã chạy trên PostgreSQL 18 tạm ở máy cục bộ; **chưa chạy lại trọn bộ trên project thật** (không tạo dữ liệu thử vào project).
- Type TypeScript đã sinh từ schema thật: `npm run supabase:types` (script `supabase/scripts/gen-types.ts`, đọc `DATABASE_URL`, không cần Docker/CLI, chỉ ghi file khi thành công). **Chạy lại sau mỗi lần đổi schema.** (Lệnh cũ dùng `supabase gen types … > file` làm file rỗng khi CLI lỗi, đã thay.)
- Chưa làm: đăng ký/đăng nhập thật từ giao diện (cần kiểm cấu hình xác minh email, Google OAuth, SMTP trong Dashboard). Hiện project mới bật đăng nhập email; **Google chưa bật** nên nút Google tự ẩn (frontend hỏi `/auth/v1/settings`).
- Mọi biến môi trường nằm ở `.env` **thư mục gốc** (đã bị `.gitignore`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Session pooler), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `vite.config.ts` đặt `envDir: '..'` nên frontend đọc `.env` gốc và chỉ đưa ra trình duyệt biến tiền tố `VITE_` (đã kiểm: service role key và mật khẩu DB không có trong bản build). Mật khẩu DB có ký tự `@` phải mã hóa URL (`%40`) khi dùng với công cụ khác; script `import:ba` chỉ cần URL + service role key.

---

## 3. Việc cần chốt (chặn hoặc ảnh hưởng kết quả)

| # | Việc | Ai chốt | Tạm thời đang làm gì |
|---|---|---|---|
| 1 | **`S` – điểm hiểu biết bổ sung** chấm từ câu hỏi mở (EA, SOLO, Carkhuff). Câu hỏi mở ở đâu, "hệ thống chấm" bằng cách nào (AI hay luật)? Ngân hàng 3100 câu **không có** câu mở | BA/PO | `S = 100` (trung tính); cột `understanding_quality_score` đã có |
| 2 | **Bộ câu hỏi rút gọn cho giáo viên** (~5 phút): tiêu chí nào thuộc bộ này | BA | `criteria.is_short_set` đang `false` hết → **giáo viên chưa nộp được bảng lưới** (`short_set_not_configured`) |
| 3 | **Câu nào thuộc gói 35/50/75** và mức khái quát/chi tiết; số câu mỗi phần | Admin | Bảng `question_package_assignments` đã có; **admin tự gán qua giao diện**, hệ thống không tự chia |
| 4 | **Tham số mức "Demo"** (P05, P08–P13, P27, P36–P38…) chưa có căn cứ; không dùng cho kết quả chính thức | PO/chuyên gia | Đang nạp theo giá trị trong SRS |
| 5 | **Coverage theo nhóm hay theo người chấm**; `n_expected` khi sheet THANG ĐO và ví dụ SRS (G6 chỉ bản thân) mâu thuẫn | BA | Đếm theo nhóm, `n_expected` = số nhóm `is_visible` |
| 6 | **Chống nộp trùng theo IP** chặn nhầm người dùng chung wifi (cùng nhà/lớp/trường) | Bạn/PO | Đang giữ theo đặc tả |
| 7 | **`min_completion_seconds`/idle** : quãng bỏ máy 2 phút (P08) chưa đo được | Dev | T dùng tổng thời gian làm bài |
| 8 | **Supabase nào dùng**: Cloud có 2 project (`HuongNghiep`, `Viettrek`); project đã có 31 MB dữ liệu. Không đẩy migration lên project có dữ liệu cũ khi chưa kiểm | Bạn | Chưa đẩy gì |
| 9 | `SUPABASE_URL` chưa có trong `.env`; service role key đang nằm trong `frontend/.env` (nên chuyển về `.env` gốc) | Bạn | Script đọc cả hai file |
| 10 | Lỗi dữ liệu BA: dòng 2102 ngân hàng câu hỏi, tên D5.4 lệch; sheet `MA TRẬN` cột vai trò để trống | BA | Script tự xử lý, nhưng nên sửa nguồn |
| 11 | User story US-01-02-13 còn ghi "tiêu chí nhận 40% điểm" mâu thuẫn BR-005 | BA | Đã theo BR-005 (NULL, không phạt) |
| 12 | Công thức Holland/RIASEC Match (BLOCKED) | PO | Ngoài phase 1 |
| 13 | Công thức trọng số: Phase 1.docx ghi hai bản (có/không `S`, `TH%`) | — | Đã theo SRS 4.3: `TH% × S` (bản thân BR-006 bạn gửi xác nhận) |

---

## 4. Những phần backend **chưa làm** (giao diện sẽ cần)

Chưa có hàm/bảng hoặc chưa nối:
- **Soạn câu hỏi thích ứng theo phần** (chọn câu phần sau dựa trên kết quả phần trước) và **chia số câu theo gói/phần**. Hiện chỉ có dữ liệu `assessment_part`, `detail_level`, gán gói; logic chọn câu cho tự đánh giá làm ở service hoặc thêm RPC.
- **Khóa thứ tự phần**, lưu nháp tự đánh giá (có cột `current_part`, `draft_expires_at`), **xóa bản nháp quá 168 giờ** (cần job dọn), **khoảng cách làm lại 14 ngày**.
- **Báo cáo tính cách, mã Holland nổi trội** (3 chữ cái) tính từ điểm phần tính cách / G6; **kiểm tra 3–5 giá trị cốt lõi** (chỉ có ràng buộc thứ hạng 1–5 ở DB).
- **Liên kết phụ huynh – con bằng mã** (`personal_link_code` có sẵn nhưng chưa có RPC nhập mã/chấp nhận), **chia sẻ kết quả theo quyền** (mới có policy đọc theo `consent_records`), **xác nhận của người giám hộ dưới 16 tuổi** (hạn link 15 phút, gửi email/SMS), khóa tạo link khi chưa được xác nhận (hàm `is_under_guardian_age` có sẵn).
- **Tham gia lớp bằng mã** (RPC tìm lớp theo `class_code`), **nhập danh sách học sinh từ Excel** (phân tích file ở client/Edge Function), tạo trường và cấp tài khoản quản trị trường.
- **Gửi email/SMS** (thông báo, mã xác minh), **ảnh mã QR** (cần lưu `qr_image_path` ở Storage), **xuất PDF Hồ sơ định hướng**, **xuất/xóa dữ liệu cá nhân** (hạn 14 ngày).
- **Báo cáo lớp/trường** (chỉ hiện khi ≥ 5 học sinh), **cảnh báo lệch góc nhìn** (≥ 25%).
- Khóa tài khoản sau 5 lần sai: Supabase Auth đã có rate limit riêng; cột `failed_login_count`, `locked_until` chưa nối.
- Gói bảo mật nhỏ cần xem lại: policy "Owner creates results" cho phép tạo dòng kết quả trực tiếp (đã có trigger chặn sửa cột kết quả).

---

## 5. Kế hoạch xây dựng giao diện

### 5.1 Ràng buộc bắt buộc (đọc `AGENTS.md` và `.agents/rules/01–06`)
1. **Không hiển thị mã đặc tả** lên UI: không `FR01.04.05`, `UI_01-S11`, `BR-006`, số mục `1.1`, tên tài liệu. Dùng ngôn ngữ người dùng ("Danh sách bài đánh giá", không "F01.04 Thu thập đánh giá…").
2. **Không viết câu mô tả giải thích thừa** dưới tiêu đề/form; nhãn tự giải thích; placeholder chỉ gợi ý định dạng ngắn (`DD/MM/YYYY`). Ngoại lệ bắt buộc theo đặc tả: tuyên bố "chỉ mang tính tham khảo, không phải chẩn đoán" và các chú thích nhãn trạng thái ("Kết quả dựa trên đánh giá 360° từ [n] nhóm…").
3. **Tên trùng 1:1 với thuật ngữ đặc tả/DB**: route, component, biến, cột (ví dụ `invitation_link`, `assessment_session`, `understanding_score`).
4. **Design tokens** trong `frontend/src/styles/tokens.css`; dùng bộ thành phần ở `src/components/common/` (hiện có Badge, Button, Card, Input). **Cấm hex tự do, inline style tùy tiện.** Còn thiếu và cần tạo: Modal, Table, Select, Checkbox/Radio, Tabs, Toast, ProgressBar, Drawer, EmptyState, Spinner.
5. **Responsive**: input mobile `font-size: 16px`; vùng chạm ≥ 44×44 px; `safe-area-inset`; khung trang phủ hết chiều ngang (không `max-width`), cỡ chữ/khoảng cách co giãn theo `--px`; `min-width: 0` trên flex; bảng dài bọc `overflow-x: auto`. Màn hình **khách làm bài là ưu tiên mobile** (người được mời quét QR bằng điện thoại, Samsung/Android).
6. **Bộ lọc**: luôn có ô tìm kiếm đầu tiên (debounce 300 ms), select phụ, nút Đặt lại và Áp dụng; input/select `min-width: 160px; max-width: 260px`; menu dropdown `max-height: 280px` cuộn trong; dropdown ≥ 7 lựa chọn hoặc dữ liệu động **phải có thanh tìm kiếm**; mobile thu vào Drawer. Đã có `FilterBar`, `SearchableSelect` để dùng lại.
7. **Supabase**: client duy nhất `src/lib/supabase.ts`; chỉ dùng `anon` key ở frontend; **không** đưa service role key vào `VITE_*`; bọc truy vấn trong service (`*.service.ts`), luôn bắt lỗi (xem `rules/06` mục 4).

### 5.2 Công nghệ đề xuất
- Đã có: React 19, Vite 6, TypeScript, `@supabase/supabase-js`, `lucide-react`.
- Cần thêm: **react-router-dom** (chưa có router), thư viện mã QR (ví dụ `qrcode`), biểu đồ radar (nhẹ: SVG tự vẽ hoặc `recharts`), `xlsx`/`exceljs` ở phía trình duyệt cho nhập danh sách học sinh. Cân nhắc `@tanstack/react-query` cho cache.
- Chạy `npm run supabase:types` để sinh `src/types/supabase.ts` trước khi viết service (file hiện chỉ là khung rỗng).

### 5.3 Cấu trúc thư mục đề xuất (`frontend/src/modules/`)
```
modules/
  auth/                  # đăng ký, đăng nhập, quên mật khẩu, hồ sơ cá nhân
  assessment_session/    # chọn gói, làm bài 4 phần, giá trị cốt lõi, minh chứng
  assessment_result/     # kết quả, radar, nhãn trạng thái, lịch sử, tiến độ, chốt
  invitation_link/       # đồng ý mời, chọn nhóm, tạo/thu hồi link + QR, danh sách bài, duyệt bài
  guest_assessment/      # (khách) mở link, thông tin ban đầu, làm bài, nộp, cảm ơn
  class_management/      # trường, lớp, thành viên, nhập Excel, tham gia bằng mã
  class_assessment_grid/ # bảng lưới chấm điểm, báo cáo lớp
  consent_sharing/       # đồng ý, liên kết phụ huynh, chia sẻ kết quả, xác nhận giám hộ
  notification/          # chuông thông báo, lịch sử, cài đặt
  admin/                 # tiêu chí, câu hỏi, gán gói, tham số vận hành, nhật ký
```
Mỗi module: `pages/`, `components/`, `<module>.service.ts`, `<module>.types.ts`. Component dùng chung ở `components/`.

### 5.4 Điều hướng và vai trò

| Vai trò | Màn hình chính |
|---|---|
| Học sinh, Sinh viên | Làm bài tự đánh giá → Kết quả → Mời người đánh giá → Danh sách bài → Chốt |
| Khách (không đăng nhập) | Chỉ trang `/moi/:token` và các bước làm bài |
| Phụ huynh | Liên kết với con, xem kết quả được chia sẻ (chỉ đọc) |
| Giáo viên | Lớp, bảng lưới, báo cáo lớp |
| Quản trị trường | Giáo viên, lớp, báo cáo lớp/trường |
| Quản trị hệ thống | Tiêu chí, câu hỏi, gán gói, tham số, nhật ký |

Guard theo `user_profiles.role`; trang quản trị chỉ `system_admin`.

### 5.4b Đã làm ở phía giao diện (cập nhật 2026-10-27)
**Nền và thành phần dùng chung**
- Logo (`public/logo-mark.svg`, component `Logo`/`LogoMark` có animation), bảng màu xanh – trắng theo tài liệu đặt tên (`styles/tokens.css`, đã cập nhật `.agents/rules/03`), token chuyển động tự tắt khi người dùng bật giảm chuyển động.
- Thành phần chung: Button, Card, Input, PasswordInput, Textarea, Alert, ProgressBar, Skeleton, Spinner; biểu đồ đa giác `components/charts/PolygonChart` (N trục, có đường so sánh tự đánh giá), quả địa cầu `components/charts/Globe360` (cả hai không khung, hòa vào nền trang). Còn thiếu: Modal, Table, Tabs, Toast, Drawer, Select/Checkbox dùng chung (hiện Select ở hồ sơ và Checkbox ở câu hỏi là kiểu riêng của từng màn).
- Khung ứng dụng: router, `AuthProvider`/`useAuth` (có `refreshProfile`, `isProfileLoading`), `RequireAuth`, `GuestOnly`, `RequireCompleteProfile` (HS/SV phải điền đủ hồ sơ mới vào được các trang khác), `AuthLayout`, `AppLayout` (không có thanh trên: chỉ hai icon nổi ở góc phải trên, `TopActions` gồm chuông thông báo — số chưa đọc, danh sách, đánh dấu đã đọc, công tắc bật/tắt ghi vào `notification_settings` — và avatar mở menu Hồ sơ cá nhân / Đổi mật khẩu / Đăng xuất; `Sidebar` phẳng, thu gọn thành cột biểu tượng 56px bên trái kèm logo, rê chuột vào thì mở rộng đè lên nội dung và tự gập lại khi chọn một mục; điện thoại ẩn hẳn, mở bằng nút ở góc trên bên trái, màn làm bài ẩn nút), điều hướng theo vai trò trong `components/layout/navigation.ts`, trang 404.
- `src/types/supabase.ts` tự sinh từ database: `npm run supabase:types`.

**Các trang đã có (đã chạy thật trên Supabase, desktop và điện thoại)**
| Đường dẫn | Trang | Ghi chú |
|---|---|---|
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` | Tài khoản | Email + mật khẩu. Nút Google tự ẩn khi project chưa bật Google |
| `/` | Trang chủ | Trang tổng quan: khối chào, hai hàng giới thiệu so le hai bên — Tự đánh giá (biểu đồ ngũ giác minh họa `components/charts/PentagonChart`, 5 nhóm G1–G5, số liệu mẫu) và Đánh giá 360° (quả địa cầu canvas `components/charts/Globe360`, 4 nhóm người đánh giá quay quanh). Trạng thái và nút dẫn tới Tự đánh giá / Mời / Duyệt bài / Kết quả lấy từ `home.service`. Nền động `HomeBackdrop` gắn vào đầu `body` bằng portal. Biểu đồ radar 7 nhóm thật vẫn ở `/ket-qua` |
| `/danh-gia-360` | Đánh giá 360 | Công tắc "Cho phép người khác đánh giá" có quả địa cầu (bật: có màu và quay; tắt: xám, giảm tốc rồi đứng yên). Bật phải đồng ý (ghi `consent_records` loại `invite_360`); tắt thu hồi mọi đường dẫn. Khi bật: chọn nhóm Phụ huynh / Bạn bè / Giáo viên / Người hướng dẫn kèm số người dự kiến (1–50), mỗi nhóm một đường dẫn + mã QR (tải PNG), sao chép, thu hồi, tạo lại khi hết hạn, tiến độ đã nộp. Bên cạnh là danh sách bài đã nộp: tab theo nhóm, biệt danh, mối quan hệ, mức thấu hiểu, nhãn tin cậy, cờ chất lượng; Chấp nhận / Loại bỏ / Đổi lại quyết định; "Chốt kết quả" (cảnh báo Dữ liệu mỏng khi chỉ 1 bài). Khóa khi dưới 16 tuổi chưa có xác nhận giám hộ, khóa sau khi chốt. Đường dẫn cũ `/moi-danh-gia`, `/bai-danh-gia` chuyển về đây |
| `/moi/:token` | Làm bài (khách, không đăng nhập, khung `GuestLayout`) | Khai báo biệt danh, mối quan hệ, thời gian quen biết, tần suất tiếp xúc, mức độ hiểu; làm từng câu, tự lưu nháp ("Đã tự động lưu nháp lúc HH:MM"); mã làm tiếp lưu ở `localStorage` (`vm_resume_<token>`) nên đóng/tải lại vẫn làm tiếp được; hộp thoại "Kiểm tra lại bài làm" khi chấm cùng một mức hoặc làm quá nhanh (Kiểm tra lại / Vẫn nộp); chặn nộp khi còn câu trống; màn cảm ơn; thông báo đường dẫn hết hạn / thu hồi / đủ số bài / không tồn tại / trùng IP |
| `/ho-so` | Hồ sơ cá nhân | Họ tên, ngày sinh (dd/mm/yyyy), tên hiển thị (≤ 20 ký tự, cho phép chữ có dấu), trường, khối lớp/ngành; cảnh báo dưới 16 tuổi |
| `/danh-gia-ca-nhan` | Đánh giá cá nhân | Kết quả (nhãn trạng thái, tiến độ, biểu đồ đa giác 7 nhóm tiêu chí `PolygonChart` chồng điểm tự đánh giá và tổng hợp 360°, điểm theo nhóm, tuyên bố miễn trừ) và khối làm bài (3 gói, bảng số câu theo phần, tiếp tục bài đang làm dở, chặn làm lại trong 14 ngày). Đường dẫn cũ `/danh-gia`, `/ket-qua` chuyển về đây |
| `/danh-gia-ca-nhan/:sessionId` | Làm bài | 4 phần tuần tự có khóa, 1 câu một màn hình, thang 1–5 (phím 1–5, Enter), "Không đủ cơ sở" lưu NULL, lưu ngay từng câu, báo cáo tính cách, giá trị cốt lõi (chọn 3–5, sắp thứ tự), mã Holland, minh chứng, hoàn thành |
| `/dev/ket-qua-mau` | Xem thử (chỉ khi `npm run dev`) | Dữ liệu mẫu |
| `/dev/danh-gia-360-mau` | Xem thử (chỉ khi `npm run dev`) | Đánh giá 360 với dữ liệu mẫu, bấm công tắc để xem quả địa cầu đổi màu |
| `/quan-tri/goi-cau-hoi` | Gán câu hỏi vào gói (chỉ `system_admin`) | Câu hỏi góc nhìn bản thân, lọc theo nhóm/tiêu chí/phần/mức; tích từng gói 35/50/75 hoặc chọn nhiều dòng rồi thêm/gỡ theo lô (RPC `set_package_assignments`, một dòng nhật ký cho cả lô); đếm số câu mỗi gói |
| `/quan-tri/cau-hoi` | Ngân hàng câu hỏi | Lọc + phân trang 25 dòng; thêm/sửa (mã chỉ nhập khi thêm), ẩn/hiện; không xóa vì câu trả lời đã tham chiếu |
| `/quan-tri/tieu-chi` | Tiêu chí | Sửa nhóm (tên, thứ tự, dùng/ẩn) và tiêu chí (định nghĩa, chỉ báo, mã Holland, hiển thị + phương pháp thang đo theo từng nhóm người đánh giá). Chưa thêm/xóa tiêu chí |
| `/quan-tri/tham-so` | Tham số vận hành | Mỗi lần lưu là một bản ghi mới (bản cũ tự đóng), có lịch sử; kiểm tra: `self_weight` 0–1, mức quy đổi > 0, ngưỡng năng lực giảm dần (trigger `validate_operation_parameter` kiểm lại ở database) |
| `/quan-tri/nhat-ky` | Nhật ký | Lọc theo thao tác, người dùng (người thực hiện hoặc học sinh), đối tượng, khoảng ngày; bấm dòng xem chi tiết. Migration `20261028000100_phase1_admin_tools.sql` thêm trigger tự ghi mọi thay đổi cấu hình của admin (bỏ qua service role) |

**Lớp học và bảng lưới (cập nhật 2026-10-28, chưa áp lên Supabase thật, chưa thử trên trình duyệt)**
- Migration `20261028000200_phase1_class_management.sql`: RPC `add_school_staff`, `create_class`, `assign_class_teacher`, `join_class_by_code`, `remove_class_member`, `import_class_roster`, `get_class_overview`, `get_class_grid`, `get_class_report`, `get_school_report`; `submit_class_grid` thay bản cũ (thêm chặn học sinh dưới 16 tuổi chưa có người giám hộ và chặn thiếu ba câu mức thấu hiểu). Đã chạy cả 13 migration trên PostgreSQL 18 cục bộ và thử luồng: thêm giáo viên → tạo lớp → nhập Excel (dòng trùng/thiếu) → học sinh vào lớp (nhận lại dòng Excel theo mã học sinh) → bảng lưới → các nhánh chặn → nộp. **Chưa thử** nhánh báo cáo khi đủ 5 học sinh có kết quả.
- Giao diện: `/lop-hoc` (học sinh: tham gia bằng mã, rời lớp; giáo viên và quản trị trường: danh sách lớp, tạo lớp), `/lop-hoc/:classId` (thông tin lớp + QR, thành viên, gán giáo viên, nhập Excel theo mẫu, báo cáo lớp; giáo viên của lớp thấy bảng học sinh × tiêu chí thay cho danh sách thành viên: chọn điểm từng ô (tự lưu), điền cả cột, nhập từ Excel, mức thấu hiểu cả lớp và riêng từng em; bấm tên học sinh mở hộp thoại điền điểm riêng (cũng có nút Gửi); "Nhập điểm từ Excel" mở hộp thoại tải tệp mẫu `mau-cham-diem.xlsx` và chọn tệp đã điền (dòng khớp học sinh theo mã học sinh hoặc họ tên không dấu, cột khớp tiêu chí theo mã, ô trống giữ nguyên điểm cũ); cuối mỗi dòng có nút Gửi / Gửi lại và Xóa; gửi riêng từng em, sửa rồi gửi lại không bị khóa; người khác vẫn thấy danh sách thành viên), `/quan-tri/truong` (quản trị hệ thống: trường, thêm nhân sự, báo cáo trường). Trang Tiêu chí có ô "Thuộc bộ câu hỏi rút gọn".
- Gói câu hỏi: script `npm run assign:packages` (đọc thử) / `-- --apply` (ghi) gán 31/46/71 câu vào ba gói theo đúng quy tắc của `selectQuestions.ts`. **Chưa chạy `--apply`**; bảng `question_package_assignments` trên Supabase thật đang trống.
- `gen-types.ts` nhận biến `PG_NO_SSL=1` để sinh type từ PostgreSQL cục bộ.
- Chưa làm: lọc học sinh theo nhóm tố chất Holland trong bảng lưới (cần mã Holland của từng em), phân bố nghề quan tâm trong báo cáo lớp (thuộc phase sau), xác nhận người giám hộ, học sinh chỉ có dòng Excel (chưa có tài khoản) chưa chấm được vì bảng lưới tham chiếu `user_profiles`.

**Cập nhật 2026-10-29: bảng điểm nộp cả bảng rồi khóa; tạo tài khoản từ Excel (chưa áp lên Supabase thật, chưa triển khai Edge Function)**
- Migration `20261028000500`: cột Ngày sinh trong mẫu nhập danh sách (`class_members.roster_date_of_birth`).
- Migration `20261028000600`: `submit_class_grid(p_grid_id)` nộp cả bảng khi mọi học sinh đủ điều kiện rồi đặt `status = 'submitted'`; RLS chặn sửa bảng, dòng học sinh, ô điểm khi bảng đã nộp; `submit_class_grid_student` bị xóa (thay cho nộp từng em của migration `20261028000400`, ghi đè mục 5.5 giai đoạn 5). Thêm `list_roster_pending`, `find_auth_user_id`, `link_roster_member`. Cũng gỡ quyền EXECUTE của PUBLIC trên mọi hàm (migration 9 bỏ sót nên hàm tạo sau đó anon gọi được).
- Edge Function `supabase/functions/create-roster-accounts`: tạo tài khoản học sinh cho dòng Excel chưa có tài khoản (email nội bộ `<mã học sinh>@<8 ký tự đầu id trường>.vibemapping.local`, mật khẩu tạm ngẫu nhiên trả về một lần, giáo viên tải tệp tài khoản). Triển khai: `supabase functions deploy create-roster-accounts`. Chưa chạy thật (không có Deno / Supabase CLI ở máy này); phần SQL đã thử trên PostgreSQL 18 tạm cùng bảng `auth` giả.
- Các điểm còn cần BA: `docs/phase1-ba-confirmations.md`.

**Quản trị – chưa kiểm tra:** chưa chạy trên Supabase thật (cần áp migration `20261028000100` và một tài khoản `system_admin` cấp tay). `typecheck` và `build` sạch. `supabase/all-migrations.sql` đã cũ (dừng ở migration 9), chưa gộp thêm.

**Cách đã kiểm tra:** chạy trọn luồng đăng nhập, hồ sơ, chọn gói, trả lời 31 câu, giá trị cốt lõi, minh chứng, hoàn thành, kết quả bằng Chrome giả lập ở 1280 px và 390 px với một tài khoản thử tạo qua API quản trị trên Supabase thật (đã xóa sau mỗi lần). Kiểm trong database: câu trả lời, NULL "không đủ cơ sở", giá trị cốt lõi, minh chứng, kết quả "Tự đánh giá", điểm 7 nhóm đều đúng. Chưa thử: Samsung Internet, Safari, Firefox, trình đọc màn hình, đăng ký bằng email thật.

**Kiểm tra luồng 360° trọn vẹn (cùng cách, 1280 px và 390 px, tài khoản thử đã xóa, không sót hồ sơ/bài nộp/đường dẫn):** tự đánh giá 31 câu → đồng ý mời → tạo đường dẫn Phụ huynh và Bạn bè (có QR) → khách Phụ huynh làm 26 câu, nộp qua hộp thoại chất lượng → khách Bạn bè làm dở 3 câu, tải lại, vào lại đúng câu 4 rồi nộp (30 câu) → tải lại sau khi nộp vẫn hiện màn cảm ơn → đường dẫn đã đủ số bài báo "đã nhận đủ số bài", đường dẫn sai báo "không tìm thấy" → học sinh chấp nhận 2 bài, kết quả chuyển Tạm thời (2 nhóm) → chốt, kết quả thành Cuối cùng 360° với điểm tổng hợp từng nhóm. Cả hai bài đều bị gắn "Đề xuất loại" vì kịch bản làm quá nhanh (đúng luật: làm nhanh hơn một nửa thời gian tối thiểu thì luôn đề xuất loại).
Chưa thử bằng giao diện: nhánh trùng IP (`duplicate_ip`, chỉ xảy ra khi đường dẫn còn chỗ — kịch bản dùng đường dẫn 1 người nên gặp "đã đủ số bài" trước), đường dẫn hết hạn / thu hồi khi khách đang làm, nút "Thu hồi" và "Tắt mời", chốt với đúng 1 bài (Dữ liệu mỏng).

**Khác biệt so với đặc tả (cần BA xác nhận)**
1. **Số câu mỗi gói.** Đặc tả ghi 35/50/75 câu (gồm 1 câu họ tên và 3 câu mức hiểu biết, là phần của người được mời). Phần tự đánh giá thực tế là 31/46/71 câu; giao diện hiển thị số thật. Quản trị gán câu vào gói (`question_package_assignments`) thì dùng đúng danh sách đó, chưa gán thì chọn tự động theo quy tắc (`selectQuestions.ts`: mỗi tiêu chí 1 câu; gói 50 thêm 2 câu mỗi nhóm, G2 thêm 3; gói 75 thêm 3 câu mỗi nhóm, G2/G3/G5/G6 thêm 4).
2. **Phần của câu hỏi.** Phần 1 = G1 + G4, Phần 2 = G7, Phần 3 = G6, Phần 4 = G2 + G3 + G5 (đã sửa cả script import và dữ liệu).
3. **Đăng ký/đăng nhập.** Đặc tả dùng mã xác minh 90 giây qua email hoặc SMS, tab "Số điện thoại", ô đồng ý điều khoản, bước "Bạn là ai?" và khóa 15 phút sau 5 lần sai. Hiện làm theo Supabase Auth: email + mật khẩu (xác minh bằng liên kết qua email), chưa có OTP, SMS, điều khoản, khóa tài khoản theo spec.
4. **Phía khách.** Bốn mức của ba câu ngữ cảnh (thời gian quen biết, tần suất tiếp xúc, mức độ hiểu) đã khớp bảng mặc định A2 của SRS (đối chiếu 2026-10-29), không cần BA xác nhận. Danh sách "Mối quan hệ" theo nhóm do nhóm tự đặt. Quy đổi 1–4 điểm mỗi câu (tổng 3–12) nên bảng quy đổi nằm cứng trong `guest.constants.ts` (khách là `anon`, không đọc được `operation_parameters`). Nhãn mức thấu hiểu ở trang duyệt bài (3–5 "Thấu hiểu thấp, cần cân nhắc", 6–8 "Khá hiểu", 9–10 "Hiểu rõ", 11–12 "Rất thấu hiểu") cũng tự đặt. Ngưỡng cảnh báo phía khách (cùng một mức từ 7 tiêu chí; dưới 3 giây mỗi câu) chỉ để nhắc, kết quả cờ chất lượng vẫn do `submit_360` tính phía server. Bỏ chọn "Không đủ cơ sở" ở khách chỉ xóa trạng thái trên màn hình; bản nháp trên server được ghi đè khi khách chọn mức điểm (chưa có RPC xóa câu trả lời).
5. **Ngân hàng câu hỏi (dữ liệu, cần BA rà).** `get_360_questions` có lọc theo `respondent_segment` (`all` / `student` / `university_student`) nhưng script import chưa điền cột này nên mọi câu đang là `all`. Hệ quả đã thấy: khách nhóm Bạn bè/Phụ huynh của một học sinh lớp 11 vẫn nhận câu nói về "sinh viên" (đếm được 58 câu nhóm Bạn bè nhắc "sinh viên" mà đều là `all`). Cần BA cho biết cột nào trong Excel xác định đối tượng (hoặc đánh dấu tay các câu dành riêng cho sinh viên), rồi import lại.
6. **Chưa có:** đổi gói giữa chừng (A1–A3), xác nhận người giám hộ (nút "Gửi yêu cầu xác nhận"), xóa bản nháp quá 168 giờ, so sánh/lịch sử kết quả, tải PDF.

### 5.5 Các giai đoạn (mỗi giai đoạn chạy được, có thể demo)

**Giai đoạn 0 – Nền (làm trước)**
- Chạy migration + `import:ba` lên Supabase đã chốt; sinh type.
- Thêm router, layout theo vai trò, guard, trang lỗi/404; component dùng chung còn thiếu (mục 5.1-4).
- Tài khoản mẫu cho từng vai trò (script seed, dùng service role, không đưa lên frontend); cấp tay `system_admin`.
- Tiêu chí hoàn thành: đăng nhập được, điều hướng đúng vai trò, typecheck sạch.

**Giai đoạn 1 – Tài khoản và hồ sơ**
- Đăng ký (email/Google; điện thoại nếu cấu hình SMS), đăng nhập, quên mật khẩu, chọn vai trò khi đăng ký.
- Hồ sơ: họ tên, ngày sinh, trường, khối lớp/ngành, **tên hiển thị ẩn danh** (≤ 20 ký tự, không ký tự đặc biệt).
- Dưới 16 tuổi: màn chờ xác nhận người giám hộ (phụ thuộc mục 4).
- Phụ thuộc DB: `user_profiles`, Supabase Auth.

**Giai đoạn 2 – Tự đánh giá**
- Chọn gói (35/50/75), tiếp tục phiên dở dang.
- Làm lần lượt 4 phần, khóa phần sau cho tới khi xong phần trước; mỗi câu thang 1–5 + "Không đủ cơ sở" (gửi `NULL`, không phải 0); lưu tạm; ghi `assessment_answers` (`question_id`, `criteria_id`).
- Màn kết quả từng phần (mã Holland nổi trội, báo cáo tính cách — **ghi rõ là xu hướng, không chẩn đoán**), chọn 3–5 giá trị cốt lõi, nhập minh chứng bổ trợ.
- Hoàn thành → `complete_self_assessment(session_id, invite_enabled)`.
- Tiêu chí hoàn thành: kết quả nhãn "Tự đánh giá" và biểu đồ radar.
- *Cần chốt trước:* mục 3 #3 (gói câu hỏi) hoặc làm tạm bằng gán thử qua trang quản trị.

**Giai đoạn 3 – Mời đánh giá 360° và trang của khách**
- Hỏi đồng ý ngay sau tự đánh giá (ghi `consent_records`, lưu nội dung đã hiển thị), chọn nhóm + số người dự kiến, tạo link + **mã QR**, sao chép link, tải ảnh QR, thu hồi/tạo mới, bật/tắt mời.
- Màn hình tiến độ theo nhóm (đã nộp / đã chấp nhận / còn thiếu).
- **Khách (ưu tiên mobile)**: `/moi/:token` → thông tin ban đầu (tên/biệt danh, quan hệ, 3 câu thấu hiểu) → làm bài → nộp → cảm ơn; các trạng thái hết hạn/đã thu hồi/đã đủ/đã nộp; tự lưu nháp theo `resume_token` (lưu ở trình duyệt); popup nhắc nhưng vẫn cho nộp khi cờ chất lượng.
- Danh sách bài đã nộp theo nhóm với trạng thái Chờ duyệt/Đã chấp nhận/Đã loại bỏ, **nhãn Trust Index**, nút Chấp nhận/Loại bỏ (`decide_submission`); **không hiển thị điểm từng người**.
- Tiêu chí hoàn thành: một HS tạo link, một khách ở điện thoại làm xong, HS duyệt và kết quả đổi nhãn "Tạm thời (x/y)".

**Giai đoạn 4 – Kết quả 360° và lịch sử**
- Nhãn trạng thái + chú thích theo đặc tả; radar chồng điểm tự đánh giá và tổng hợp 360°; điểm theo nhóm người chấm chỉ khi đủ ngưỡng (dữ liệu đã được DB lọc); Coverage/Confidence và cảnh báo "Thiếu dữ liệu đánh giá", cờ "Dữ liệu mỏng" khi chốt với 1 bài (hộp thoại xác nhận).
- Nút Chốt kết quả (`finalize_my_result`), lịch sử các bản chụp để so sánh.
- Xuất Hồ sơ định hướng PDF (có tuyên bố miễn trừ trách nhiệm).

**Giai đoạn 5 – Lớp học và giáo viên**
- Quản trị hệ thống tạo trường và quản trị trường; tạo lớp (tên, khối, năm học, mã lớp + QR); gán giáo viên; học sinh vào lớp bằng mã (kèm thông báo đồng ý).
- Nhập danh sách từ Excel: kiểm tra lỗi/trùng, hiển thị dòng lỗi, chỉ nhập dòng hợp lệ.
- Chấm điểm học sinh: bảng lưới nằm ngay trang lớp (không còn trang riêng `/bang-luoi`), nút Gửi ở cuối mỗi dòng gọi `submit_class_grid_student`; sửa rồi gửi lại. Migration `20261028000400_phase1_grade_per_student.sql` (thêm `class_assessment_grid_students.submitted_at`, bỏ `submit_class_grid`, `class_assessment_grids.status` không còn dùng); **chưa áp lên Supabase thật**, đã chạy 15 migration trên PostgreSQL 18 cục bộ và thử: nộp từng em, các nhánh chặn, nộp lại không sinh bài trùng, người ngoài lớp bị chặn, xóa học sinh giữ dòng đã nộp. Chưa thử trên trình duyệt.
- Báo cáo lớp/trường (chỉ khi ≥ 5 học sinh).
- *Cần chốt trước:* mục 3 #2 (bộ rút gọn).

**Giai đoạn 6 – Quyền riêng tư, thông báo, quản trị**
- Liên kết phụ huynh bằng mã, chia sẻ kết quả theo đối tượng (mặc định không chia sẻ), thu hồi, xuất/xóa dữ liệu cá nhân.
- Chuông thông báo, lịch sử, cài đặt bật/tắt từng loại (trong ứng dụng/email).
- Quản trị: cấu hình tiêu chí và hiển thị theo nhóm, ngân hàng câu hỏi (thêm/sửa/ẩn, gắn phần và mức chi tiết), **gán câu vào gói**, tham số vận hành (kiểm: mọi mức quy đổi > 0, `P03` trong 0–100%), tra cứu nhật ký theo học sinh/thời gian/người thực hiện.

### 5.6 Danh sách kiểm tra cho mọi màn hình
- Không có mã đặc tả hoặc câu mô tả thừa trên UI.
- Chỉ dùng token và component chung; không hex, không inline style.
- Hoạt động ở 360 px, 768 px, 1440 px và 2560 px; không cuộn ngang trang; chạm ≥ 44 px; input 16 px trên mobile.
- Bộ lọc đúng chuẩn mục 5.1-6.
- Truy vấn bọc service, bắt lỗi, có trạng thái loading/rỗng/lỗi.
- Thử trên Chrome, Samsung Internet, Firefox, Edge, Safari.
- `npm run typecheck` sạch.

---

## 6. Lệnh thường dùng

```bash
# Dữ liệu từ Excel
npm run import:ba:dry      # đọc thử, không ghi DB (đã chạy: 7 nhóm, 31 tiêu chí, 3100 câu)
npm run import:ba          # ghi DB, cần SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# (lần đầu) cd supabase/scripts && npm install

# Supabase (cần Docker nếu chạy local)
supabase start
supabase db reset          # chạy toàn bộ migration + seed.sql
npm run supabase:types     # sinh frontend/src/types/supabase.ts

# Frontend
npm run dev
npm run typecheck
```

Lịch chốt tự động (nếu pg_cron không có sẵn khi chạy migration): bật extension `pg_cron` rồi chạy lại `20261027000700_…sql`, hoặc gọi `select public.auto_finalize_results();` từ cron của VPS / Edge Function mỗi giờ.

---

## 7. Điểm dễ sai (tóm tắt)
- "Không đủ cơ sở" luôn là `NULL`, không bao giờ là 0 hoặc 2 điểm/40%.
- Khách chỉ qua RPC; đừng cố `select` bảng bằng `anon` key (RLS trả 0 dòng, không báo lỗi).
- HS/SV không được thấy điểm từng người đánh giá, chỉ thấy theo nhóm đủ ngưỡng.
- Kết quả đã chốt (`final_360`) không tính lại; muốn làm lại là phiên tự đánh giá mới (cách nhau 14 ngày, cần thêm logic).
- Đừng đưa `SUPABASE_SERVICE_ROLE_KEY` vào biến `VITE_*` hoặc mã frontend.
- Dữ liệu Demo trong tham số chưa dùng cho kết quả chính thức.
