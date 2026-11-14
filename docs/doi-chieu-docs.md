# VibeMapping — đối chiếu với tài liệu

Ngày đọc: 2026-11-01.

Nguồn tài liệu: `career_guidance/docs` (00–07), chủ yếu `02_SRS_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`.

Nguồn code: `VibeMapping/frontend/src`, `VibeMapping/supabase/migrations`.

Chỉ ghi việc đọc được trong hai nguồn đó. Không tick từng dòng mockup giao diện. Một dòng “đã có” nghĩa là code có chức năng đó. Một dòng “chưa có” nghĩa là tài liệu yêu cầu mà code chưa làm, hoặc code đang chạy giá trị tạm vì tài liệu chưa chốt.

## Đã có

| Tài liệu | Tài liệu yêu cầu | Code đang có |
|---|---|---|
| FR01.01.01 | Đăng ký và đăng nhập bằng email và mật khẩu; lấy lại mật khẩu | `RegisterPage.tsx`, `LoginPage.tsx`, `ForgotPasswordPage.tsx` (`requestPasswordReset`) |
| FR01.01.01 | Đăng nhập Google khi nhà cung cấp được bật | `LoginPage.tsx` chỉ hiện nút khi `getEnabledProviders()` báo Google bật. Trang đăng ký không có nút này |
| FR01.02 | Gói 35 / 50 / 75, bốn phần làm tuần tự, lưu nháp | `selectQuestions.ts`, `AssessmentRunPage.tsx` |
| FR01.02, R09 | “Không đủ cơ sở” không tính điểm, không gán 40% | `assessmentScores.ts`: câu `insufficient` bị loại khỏi trung bình, phần trăm để `null` |
| F01.03 | Điểm G1–G7 và biểu đồ radar, có đường tổng hợp khi có 360° | `ResultView.tsx` dùng `PolygonChart`, có `reference` khi đã có điểm gộp |
| F01.03 | Xem lịch sử kết quả | `ResultHistoryPage.tsx`: mỗi bản so với bản ngay trước, ngưỡng P22 |
| F01.04 | Mời 360° bằng đường dẫn, hạn 14 ngày (P04), chặn nộp trùng IP | `invitation` và migration `20261027000500_phase1_platform_and_rpc.sql` (`duplicate_ip`) |
| F01.04, F01.05 | Học sinh chấp nhận hoặc loại bài; trọng số bài theo mức thấu hiểu | Hàm tính trong `20261031000100_phase3_rules_and_modules.sql` |
| File 04 mục 4.2, SRS dòng 6082–6086 | S_i từng bài theo EA / SOLO / Carkhuff, bạn bè không có Carkhuff | `supplemental_understanding_score` trong migration phase 3 |
| SRS dòng 6087 | Không gộp 360° bằng tỷ trọng cố định 30/20/25/25 | Trọng số từng bài, không dùng công thức S_total ở file 04 mục 4.3 |
| F01.06 | Nhãn Tự đánh giá / Tạm thời / Cuối cùng 360°; hiệu lực rồi gắn “Cần đánh giá lại” | `ResultInsightsPanel.tsx`, tham số P17 |
| F02 | Trường, lớp, nhập danh sách, lưới chấm, báo cáo lớp | `SchoolsPage.tsx`, `ClassListPage.tsx`, `ClassDetailPage.tsx`, `RosterImportModal.tsx`, `ClassGradeTable.tsx`, `GradeImportModal.tsx`, `ClassReportCard.tsx` |
| F03.02.01, FR03.02.04 | Thông báo trong ứng dụng, bật tắt từng loại | `account.service.ts`, bảng `notifications` |
| F03.03 | Đồng ý chia sẻ, xác nhận giám hộ dưới 16 tuổi, xuất dữ liệu, yêu cầu xóa tài khoản | `PrivacyPage.tsx`, `create_guardian_consent_token`, `export_my_data` |
| F03.04, F03.05 | Trang tham số và nhật ký | `/quan-tri/tham-so`, `/quan-tri/nhat-ky` |
| F04.02, R08, R13, R20 | Career Fit 40/30/30 (P32–P34), thiếu thành phần thì chia lại; Top nghề và nghề gần đạt | Tham số seed P32=`0.4`, P33=`0.3`, P34=`0.3`; trang `/nghe` |
| F04.02 | So sánh 2–4 nghề; nghề quan tâm; tối đa 2 nghề mục tiêu; lệch góc nhìn; cảnh báo quá hạn rà soát | `/nghe/so-sanh`, `CareerDetailPage.tsx` (`target_career_limit`), `findPerceptionGaps`, `AdminModulesPages.tsx` (“Quá hạn rà soát”) |
| FR04.01.01 | Tìm nghề có dấu hoặc không dấu | `vnSearch.ts` (`toSearchKey`) và `searchCareers` trong `career.service.ts`. Chỉ nghề `published` |
| FR04.01.02 | Duyệt cây Lĩnh vực › nhóm › nghề | `CareerListPage.tsx` đọc `career_fields` (`parent_field_id`) rồi lọc nghề thuộc nhánh đã chọn |
| FR04.01.03 | Xem danh mục nghề khi chưa đăng nhập | Route `/danh-muc-nghe` và `/danh-muc-nghe/:careerId` trong `PublicLayout`. Migration `20261101000200_public_career_catalog.sql` cho phép `anon` đọc nghề `published`. Trang công khai không hiện điểm phù hợp |
| FR01.03.04 | Chọn đúng 2 bản kết quả để so sánh G1–G7 | `ResultHistoryPage.tsx`: nút “Chọn để so sánh”, tối đa 2 bản, bảng chênh |
| FR07.01.08 | Sinh lộ trình ưu tiên tiêu chí điểm thấp | `RoadmapPage.tsx` truyền `scoresByCriterionId` từ `loadLearnerProfile` vào `generateRoadmapFromLibrary` |
| F05 | Danh mục trường, ngành, chương trình; lọc học phí; bản đồ nút Nghề → Ngành → Trường | `SchoolExplorerPage.tsx`, `EducationDetailPages.tsx` |
| F06.01 | So sánh 2–4 phương án do người dùng nhập; tách điều kiện bắt buộc; nhãn Đáp ứng / Chưa đáp ứng / Chưa đủ dữ liệu | `DecisionComparePage.tsx`, `compareDecisionOptions` trong `assessmentRules.ts` |
| F06.02 | Khai báo ngân sách; báo cáo quyết định xem trên web; chia sẻ cho phụ huynh; xác nhận đồng thuận | `DecisionComparePage.tsx`, `DecisionReportPage.tsx` |
| F07.01 | Lộ trình 3 trụ, sinh từ thư viện đã duyệt, cột mốc, tiến độ, cảnh báo chệch hướng, tạo lại | `RoadmapPage.tsx`, `roadmapGeneration.ts` |
| F08 | Hồ sơ năng lực sinh viên, nhãn Đã xác thực 360°, Đạt / Gần đạt / Chưa đạt, gợi ý có nhãn Đối tác | `PortfolioPage.tsx` |
| F09 | Tạo và tham gia cộng đồng, đăng bài, bình luận, báo cáo (ẩn khi đủ 3), từ khóa cấm, sự kiện cơ bản, người hướng dẫn đã xác minh, chặn kết nối dưới 16 tuổi | `CommunityPage.tsx`, `report_community_post` (ẩn khi `count >= 3`), `community_banned_keywords` |
| FR01.02.10 | Sau mỗi phần, chọn câu thêm của phần sau theo điểm các phần trước | `adaptQuestions` trong `selectQuestions.ts`. Câu nền mỗi tiêu chí giữ nguyên. Quản trị đã gán câu thì không đổi |
| FR01.03.03, F06.02 | Tải file PDF hồ sơ định hướng và báo cáo quyết định | `downloadPdf` trong `printProfile.ts`. Nút trên hồ sơ kết quả và `DecisionReportPage.tsx`. Font PDF chuẩn không có dấu tiếng Việt; bản in HTML vẫn giữ tiếng Việt |
| FR04.01.04 | Lọc thang lương, trình độ, môi trường, mức tăng trưởng | `CareerListPage.tsx`. Lương, trình độ, môi trường lấy từ JD (`salary_reference`, `education_requirement`, `work_environment`). Tăng trưởng lấy cột `careers.growth_level`; chưa có giá trị thì hiện “Chưa có dữ liệu” |
| FR06.01.02 | Đối chiếu điều kiện theo năm và phương thức | `DecisionComparePage.tsx` đọc `admission_data`. Không có bản ghi thì ghi “Chưa đủ dữ liệu” |
| FR06.01.08 | Đề xuất phương án cùng nhóm ngành khi phương án ưu tiên không đạt hoặc vượt ngân sách | `DecisionComparePage.tsx` lấy tối đa 3 chương trình cùng `major_id`. Không bịa điểm chuẩn |
| FR07.01.02 | Điểm xuất phát: cấp học, năm học, kỹ năng, chứng chỉ, ngoại khóa | Form tạo lộ trình và `save_roadmap_origin` |
| FR07.01.04, FR07.01.06 | Lộ trình theo giai đoạn tháng / quý | `RoadmapPage.tsx` mục “Bản đồ đường đi”, nhóm mốc theo tháng |
| SRS R10 | Coverage đếm số người có điểm, không gộp theo nhóm | Trigger `apply_person_coverage` trong `20261101000300_docs_gaps.sql`. Mẫu số vẫn là số nhóm được phân công trên ma trận, đúng ví dụ G6 = 1 và không phụ huynh = 4 |
| FR09.01.03 | Rời cộng đồng | `leave_community`, nút “Rời nhóm” |
| BR-M09-003 | Sự kiện có số chỗ và hạn đăng ký | Cột `seat_limit`, `registration_deadline`. Hết chỗ hoặc quá hạn thì `register_career_event` từ chối |
| BR-M09-006 | Nhãn “Nội dung thành viên” | `CommunityPage.tsx` gắn nhãn trên mỗi bài |
| FR09.01.09 | Quản trị thành viên và chủ đề | `CommunityAdminPage`, hàm `list_community_admin`, `remove_community_member`, `add_community_topic` |

Các mã P05, P08–P13, P16, P17, P19, P21, P22, P24, P25, P27, P35–P38, P40–P45 được gán `verification_level = demo` trong `20261031000200_phase3_parameters_and_m03_m09.sql`. Số đang chạy là số seed trong file đó. SRS mục 5.3 STT 12 ghi các số Demo này chưa có căn cứ PO.

## Chưa có

| Loại | Tài liệu | Tài liệu yêu cầu | Code đang làm |
|---|---|---|---|
| Chờ chốt | SRS R05, khoảng dòng 6155–6160; mục 5.3 STT 10 | Công thức RIASEC Match chưa chốt, gắn DEMO/BLOCKED, không dùng cho xếp hạng chính thức | Tham số `riasec_match_method` = `profile_6d_demo`, `verification_level` = `pending_ba` |
| Chờ chốt | SRS dòng 6082–6086; file 04 mục 4.2 | Chỉ có công thức S_i khi đã có điểm EA / SOLO / Carkhuff. Không ghi giá trị khi chưa chấm | `unreviewed_supplemental_default` = `100`, `pending_ba`. Ghi chú trong seed: `null` thì không tính bài |
| Chờ chốt | SRS dòng 6086–6093 | TH = 3 cho tỷ trọng rất nhỏ. Không ghi một sàn TH% khác 0 | `understanding_percent_floor` = `0`, `pending_ba` |
| Chờ chốt | SRS công thức TH% = (TH − 3) / 9 | Khi mọi bài TH = 3 thì tổng trọng số bằng 0. Tài liệu không nói chia đều hay bỏ điểm 360° | `zero_weight_equal_fallback` = `true`, `pending_ba` |
| Chờ chốt | SRS R16 dòng 6265 và 6267; BR-014; file 06 mục 1.2 | R16 vừa map L0,L1 → 1, vừa ghi chỉ dùng JD L1 và L2. BR-014 ghi L1 đến L2. File 06 có bậc L0 | `career_matrix_include_l0` = `true`, `pending_ba` |
| Chờ chốt | SRS chưa viết điều kiện chặn | Không có câu đã chốt về việc bắt buộc câu mở khi nộp bài 360° | `require_open_answers` = `false`, `pending_ba` |
| Chưa làm | FR01.01.01, dòng 1596 | Người đăng ký chọn vai trò: Học sinh, Sinh viên, Phụ huynh, Giáo viên, Người hướng dẫn | Giữ nguyên. `RegisterPage.tsx` ghi cứng `role: 'student'` |
| Chưa làm | INT-005 | Lưu PDF, ảnh QR và tệp xuất lên Cloud Storage | Chưa có kho tệp. Đã tải được file PDF về máy |
| Tích hợp ngoài | FR01.01.01, SW_03 | Đăng ký hoặc đăng nhập bằng số điện thoại, mã gửi qua SMS | Đăng ký có ô số điện thoại. Bấm tạo tài khoản thì sang `/xac-minh-otp` (`OtpVerifyPage.tsx`, 6 ô). Hàm gửi là `supabase.auth.signInWithOtp`. Trang đăng nhập không có số điện thoại. Việc SMS đi hay không phụ thuộc nhà cung cấp trên Supabase |
| Tích hợp ngoài | FR01.01.01, FR03.02.02 | Mã xác minh và thư thông báo qua email | Có quên mật khẩu bằng email. Không có hàm gửi email cho thông báo nghiệp vụ trong `frontend/src` |
| Tích hợp ngoài | INT-005, EXT-13 | Cloud Storage cho PDF, ảnh QR, tệp dữ liệu cá nhân | Không có lời gọi kho tệp trong `frontend/src` |
| Tích hợp ngoài | SRS mục 2.4, NFR-COMP-016 | Kiểm duyệt nội dung bằng dịch vụ bên ngoài, đổi nhà cung cấp không đổi nghiệp vụ | Đang lọc `community_banned_keywords` và ẩn bài đủ 3 báo cáo. Không gọi dịch vụ kiểm duyệt ngoài |
| Tích hợp ngoài | NFR-COMP-013 | SDK phân tích và giám sát lỗi, chỉ chạy sau khi người dùng đồng ý | Không có SDK này trong `frontend/package.json` |
| Ngoài MVP | SRS mục 5.3 STT 7 | INT-011…INT-015 và mô hình AI thuộc giai đoạn sau, đã loại khỏi MVP | Không có module M10 trong `App.tsx` |

## Màn SRS chưa có màn riêng trong VM

Đối chiếu mục 4.1 của SRS với route trong `App.tsx`. Màn đã gộp vào một trang thì không ghi là thiếu chức năng.

| Màn SRS | Tình trạng trong VM |
|---|---|
| UI_01 đăng ký có chọn vai trò | Không còn. `RegisterPage.tsx` ghi cứng Học sinh |
| UI_04 khám phá nghề khi chưa đăng nhập | Có `/danh-muc-nghe`. Menu thả từng nghề trên thanh điều hướng thì chưa có; thanh trên có một liên kết “Nghề nghiệp” |
| UI_07-S01 đến S04 | Gộp một trang `/lo-trinh`. Có mục “Bản đồ đường đi” theo tháng, chưa phải sơ đồ các nút nối nhau |
| UI_08-S01 đến S08 | Gộp một trang `/nang-luc`. Không có hộp thoại riêng “thêm gợi ý vào lộ trình” |
| UI_09-S06 | Không có trang chi tiết sự kiện. Sự kiện nằm trong `/cong-dong` |
| UI_09-S07 | Không có trang tìm người hướng dẫn riêng. Danh sách người đã xác minh nằm trong `/cong-dong` |
| UI_10-S08 | Có trong `/quan-tri/cong-dong`: đưa thành viên ra khỏi nhóm, thêm và xóa chủ đề |

## Chỗ tài liệu tự không thống nhất

Đây là lệch trong `career_guidance/docs`, không phải lỗi so với CNS.

| Chỗ | Lệch |
|---|---|
| SRS R05 và mục 5.3 STT 10 | Công thức RIASEC Match ghi chưa chốt |
| SRS dòng 6087 và file 04 mục 4.3 | SRS cấm tỷ trọng nhóm 30/20/25/25. File 04 ghi S_total = 0,30·PH + 0,20·BB + 0,25·GV + 0,25·NHD |
| SRS R16 dòng 6265 và 6267, BR-014, file 06 mục 1.2 | Vừa map L0, vừa nói ma trận HSSV chỉ dùng L1 và L2 |
| SRS R19 dòng 6212 và R16 dòng 6270 | R19 viết đủ 31 tiêu chí. R16 và BR-014 viết G1–G5, G7 và Holland |
| SRS mục 5.3 STT 12 | P25, P27 và một số ngưỡng Demo chưa được PO xác nhận |
