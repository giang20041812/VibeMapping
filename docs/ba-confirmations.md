# Điểm cần BA xác nhận và cung cấp

Cập nhật: 06/11/2026. Phạm vi: phần nghề, ngành – trường, so sánh phương án, hồ sơ năng lực, lộ trình, cộng đồng và các tham số còn chờ. Các điểm Phase 1 chưa đổi vẫn ở [phase1-ba-confirmations.md](phase1-ba-confirmations.md); mục 8 ghi những điểm Phase 1 đã thay đổi.

## Tóm tắt

- **Chưa nghề nào đủ chuẩn theo đúng chữ của SRS R08.** R08 yêu cầu nghề có mức yêu cầu cho đủ các tiêu chí, có Holland, có nguồn và ngày cập nhật. Trong 917 nghề có ma trận, nghề nhiều nhất mới có 23/25 tiêu chí G1–G5, G7; 1.169 nghề không có ngày nào trong cột Nguồn dữ liệu. Hệ thống đang dùng một điều kiện "đủ chuẩn" nới lỏng (mục 1, dòng 1) nên 818 nghề đang được công bố và đưa vào gợi ý. Cả 2.176 nghề nay có thể có ngày: 1.007 nghề có ngày (232 theo ngày kiểm tra, 775 theo ngày đăng tin).
- **Dữ liệu JD không đủ cho P16 = 20 JD mỗi nghề.** Toàn bộ JD trong file đã được nạp, không còn JD nào bị bỏ sót. 808/818 nghề đang công bố dựa trên 1–4 JD; chỉ 2 nghề đạt từ 20 JD. Hệ thống đang hạ P16 xuống 1.
- **Ba nhóm dữ liệu không có trong bất kỳ file nào của TEAM BA:** điểm chuẩn và chỉ tiêu tuyển sinh, mức tăng trưởng nghề, mô tả ngành. Các màn hình liên quan đang hiện "Chưa đủ dữ liệu".
- **Thư viện nội dung gần như trống:** 0 gợi ý khóa học/dự án, 3 hoạt động lộ trình đã duyệt, danh sách từ khóa cấm của cộng đồng trống.

## 1. Dữ liệu nghề và Career Fit

| # | Cần BA xác nhận | Tài liệu đang ghi | Hệ thống đang xử lý |
|---|---|---|---|
| 1 | Điều kiện "nghề đủ chuẩn" để đưa vào Career Fit chính thức | R08: đủ mức yêu cầu cho 31 tiêu chí, có Holland, có nguồn và ngày cập nhật. R16 và BR-014: chỉ cần G1–G5, G7 có mức yêu cầu và G6 có Holland. Hai chỗ không thống nhất | Nghề đủ chuẩn khi có ít nhất 1 tiêu chí G1–G5, ít nhất 1 tiêu chí G7 và có Holland Top 3; không xét nguồn, ngày cập nhật. 818 nghề đạt và **được tự động công bố khi nạp dữ liệu**. Tiêu chí nghề không có trong JD thì bỏ khỏi phép tính, không gán mức giả |
| 2 | Số JD tối thiểu mỗi nghề (P16) | R16: tối thiểu 20 JD L1/L2 mỗi nghề (đề xuất, mức Demo) | P16 = 1 trên dữ liệu thật. 808 nghề đang công bố có 1–4 JD, 8 nghề 5–19 JD, 2 nghề từ 20 JD. Nâng P16 lên 20 thì chỉ còn 2 nghề vào gợi ý |
| 3 | Chức danh nào gộp thành một nghề (danh mục nghề chuẩn) | Không có. File JD có 2.004 chức danh, hầu hết chỉ 1–2 JD; 88 chức danh nằm ở nhiều Group ID | Một nghề = Group ID × chức danh. Nếu gộp theo cột "Nhóm nghề" thì có 41 nhóm, 32 nhóm đạt từ 20 JD (đề xuất của dev, chưa áp dụng) |
| 4 | JD cấp L0 (Intern) có vào ma trận không | R16 dòng 1 map L0 → 1; dòng 3 ghi chỉ dùng L1 và L2. BR-014 ghi L1–L2 | Dùng L0, L1, L2. Tham số `career_matrix_include_l0` = bật, mức "Chờ BA". Script nạp đang cố định quy tắc này, đổi tham số trên trang quản trị chưa làm đổi ma trận |
| 5 | Cách tính mức yêu cầu (Req) và trọng số (CW) từ JD | R16 chỉ nêu quy đổi cấp độ, không nêu cách gộp nhiều JD | Req = trung bình Required Level của các JD có gắn tiêu chí. CW = số JD có tiêu chí, chuẩn hóa tổng bằng 1 trong G1–G5 và trong G7. Vì JD L0–L2 có Required Level thấp nên Req thấp (nhiều nghề Req 1,0–2,0) |
| 6 | Công thức RIASEC Match và dạng dữ liệu G6 của nghề (Top 3 hay hồ sơ sáu chiều) | R05 và mục 5.3 STT 10: chưa chốt, BLOCKED | Lưu cả hai. Hồ sơ sáu chiều = tỷ lệ JD có gắn D6.1–D6.6. Đang tính G6 bằng phương pháp Demo `profile_6d_demo`; kết quả vẫn chiếm 30% Career Fit và vào xếp hạng |
| 7 | "Tiêu chí quan trọng của nghề" khi cảnh báo lệch góc nhìn | R21: cảnh báo khi chênh ≥ 25% (P28) ở tiêu chí quan trọng; không định nghĩa "quan trọng" | Tiêu chí có CW ≥ CW trung bình trong phần của nó |
| 8 | Ngày kiểm tra dữ liệu nghề (P20) lấy từ đâu | R17: P20 = 6 tháng kể từ ngày kiểm tra JD mới nhất | Script tách ngày từ chữ tự do ở cột "Nguồn dữ liệu": ngày "kiểm tra lại / research / cập nhật" (232 nghề); JD không có thì lấy ngày "đăng" (775 nghề, hiện nhãn "Đăng tin", là giả định của dev); 1.169 nghề không có ngày. Ngày của nghề là ngày mới nhất trong các JD. Công bố nghề không còn ghi ngày hôm đó. Cảnh báo "Quá hạn rà soát" dùng tham số 6 tháng |
| 9 | Mức tăng trưởng nghề (bộ lọc FR04.01.04) | Có trong FR04.01.04; không file nào có dữ liệu | Có cột `growth_level`, cả 2.176 nghề trống; bộ lọc hiện "Chưa có dữ liệu" |
| 10 | Ngưỡng nghề gần đạt P25 = 40% và số bài tối thiểu nhóm "Người khác" P27 | R20 và mục 5.3 STT 12: chưa được PO xác nhận | Dùng 40% và 2 bài, mức Demo |
| 11 | Mã nhóm lĩnh vực nghề | R16 đề xuất đổi G1–G6 của file JD thành LV1–LV6 | Đã đổi thành LV1–LV6. Tên lĩnh vực cấp 1 lấy theo sheet CHIA NHÓM vì cột tương ứng trong file JD viết không thống nhất |
| 12 | Gửi email khi thứ hạng nghề đổi | FR04.02.08: báo trong ứng dụng và email | Chỉ báo trong ứng dụng. Chưa có dịch vụ gửi thư (cần PO chọn nhà cung cấp) |

## 2. Ngành – Trường

| # | Cần BA xác nhận hoặc cung cấp | Tài liệu đang ghi | Hệ thống đang xử lý |
|---|---|---|---|
| 1 | Bảng liên kết nghề ↔ ngành chính thức, có mức trực tiếp/gián tiếp và nguồn | FR05.01.01: xem ngành theo nghề kèm mức liên quan và nguồn tham khảo. File research không có bảng này | 4.649 liên kết do hệ thống tự dò từ mục Học vấn của JD, tất cả "trực tiếp", 0 liên kết đã kiểm duyệt. 1.437/2.176 nghề có ngành, chỉ 324/1.078 ngành có nghề; ngành chung chung ("Kinh tế", "Luật") gắn rất nhiều nghề |
| 2 | Dữ liệu tuyển sinh: điểm chuẩn, chỉ tiêu, tổ hợp, phương thức theo năm | FR05.01.08, FR06.01.02. File research không có cột nào | Bảng `admission_data` có sẵn, 0 dòng. Trang chương trình và trang so sánh phương án hiện "Chưa đủ dữ liệu"; không tự sinh điểm chuẩn |
| 3 | Mã ngành, mô tả ngành, nội dung đào tạo chính, yêu cầu nền tảng | FR05.01.02 | File chỉ có tên ngành. Mã ngành và hệ chương trình trong ngoặc được tách ra, lưu theo chương trình. Trang ngành hiện tên ngành, nghề liên quan và các trường đào tạo |
| 4 | Giới thiệu trường | FR05.01.07 | Không có trong file. Trang trường hiện loại cơ sở, công lập/tư thục, địa chỉ, website và danh sách chương trình |
| 5 | Học phí chưa công bố hoặc tính theo tín chỉ, theo năm | FR05.01.06 lọc theo khoảng học phí | 4.924/9.511 chương trình (51,8%) tách được học phí mỗi kỳ: 4.199 ghi rõ mỗi kỳ, 703 chia từ học phí năm, 22 chia từ tổng khóa (hai nhóm sau hiện "ước tính"). Học phí theo tín chỉ hoặc theo tháng không quy đổi vì thiếu số tín chỉ, số tháng; số còn lại hiện chữ gốc và không lọc được theo khoảng học phí |
| 6 | Chương trình "Chưa xác minh" và "Cần bổ sung" có được hiển thị không | File ghi rõ dữ liệu chưa đối chiếu website | Hiển thị tất cả, giữ trạng thái research để lọc. 1.240 chương trình "Chưa xác minh", 440 "Cần bổ sung" |
| 7 | Một trường chỉ có một lĩnh vực mạnh | File: mỗi trường xếp một Group ID | Mỗi trường một lĩnh vực mạnh; ngành không gắn lĩnh vực mà nối với nghề qua bảng liên kết |

## 3. So sánh phương án, hồ sơ năng lực, lộ trình

| # | Cần BA xác nhận | Tài liệu đang ghi | Hệ thống đang xử lý |
|---|---|---|---|
| 1 | Bộ quy tắc xếp hạng phương án | FR06.01.05: "theo bộ quy tắc đã phê duyệt"; tài liệu không có bộ quy tắc | Người dùng tự nhập mức quan trọng cho 4 tiêu chí. Đáp ứng đầu vào = 100 nếu đạt, thiếu mỗi điểm trừ 15. Tài chính = 100 nếu trong ngân sách, vượt bao nhiêu % trừ bấy nhiêu. Địa điểm do người dùng tự cho 0–100. Phương án chưa đạt điều kiện bắt buộc không bao giờ xếp trên phương án đạt (BR-019) |
| 2 | Ngưỡng Đạt / Gần đạt / Chưa đạt của hồ sơ năng lực | Mục 5.3 STT 5: đang để [x], [y] | Đạt khi Gap = 0; Gần đạt khi thiếu dưới 1 mức; Chưa đạt khi thiếu từ 1 mức |
| 3 | Cách tính "Mức đạt tổng thể" so với vị trí | UI_08: công thức và trọng số theo mức ảnh hưởng (cần xác nhận) | Đếm số tiêu chí đạt trên tổng số tiêu chí của nghề, không trọng số |
| 4 | So với JD chuẩn của vị trí hay ma trận nghề; có cho tải JD riêng | UI_08: MVP dùng JD chuẩn có sẵn; tải JD riêng (cần xác nhận) | So với ma trận của nghề đã lưu. Không có tải JD riêng |
| 5 | Kỹ năng mềm lấy từ kết quả 360°: nhóm nào, quy đổi thế nào | UI_08: cột tiêu chí G2–G5; công thức quy đổi (cần xác nhận) | Lấy tiêu chí G2–G5 từ kết quả Cuối cùng 360°, mức = điểm 1–5 làm tròn. Lấy lại thì ghi đè các mục đã xác thực |
| 6 | Sinh viên tự sửa mức có giữ nhãn Đã xác thực 360° không | UI_08 (cần xác nhận) | Hỏi xác nhận rồi gỡ nhãn |
| 7 | Gợi ý thêm vào lộ trình được gán trụ cột nào | UI_08 (cần xác nhận quy tắc gán) | Luôn gán trụ Kiến thức, thêm vào lộ trình đang dùng |
| 8 | Thư viện hoạt động lộ trình đã duyệt | F07.01: lộ trình sinh từ thư viện đã duyệt | 3 hoạt động. Lộ trình sinh ra rất ít mốc cho đến khi có thư viện |

## 4. Cộng đồng

Các dòng dưới đây là những chỗ SRS ghi "(cần xác nhận)" ở màn hình cộng đồng.

| # | Cần BA xác nhận | Hệ thống đang xử lý |
|---|---|---|
| 1 | Giới hạn vai trò được tham gia từng cộng đồng | Không giới hạn; mọi tài khoản đã đăng nhập tham gia được |
| 2 | Tham gia có cần chủ cộng đồng duyệt | Vào ngay, không duyệt |
| 3 | Rời cộng đồng thì bài đã đăng có bị gỡ | Bài giữ nguyên |
| 4 | Tạo cộng đồng có cần quản trị duyệt; người tạo có quyền quản trị nhóm; giới hạn độ dài và trùng tên | Tạo ngay, tên từ 3 ký tự, không chặn trùng tên. Chỉ quản trị hệ thống quản lý thành viên và chủ đề |
| 5 | Tác giả có thấy bài của mình đã bị ẩn | Không thấy; bài bị ẩn biến mất với mọi thành viên |
| 6 | Danh mục lý do báo cáo | Người báo cáo tự nhập lý do, tối thiểu 8 ký tự. Mỗi người báo cáo một bài một lần; đủ 3 báo cáo thì tự ẩn |
| 7 | Hạn chế tác giả bao nhiêu ngày | Chưa có chức năng hạn chế; quản trị chỉ khôi phục hoặc xóa bài |
| 8 | Sự kiện hết chỗ có danh sách chờ; nhắc qua email trước bao lâu | Hết chỗ hoặc quá hạn thì từ chối đăng ký; không có danh sách chờ; chưa gửi email |
| 9 | Phạm vi sự kiện của quản trị trường; có trạng thái nháp | Quản trị trường tạo sự kiện cho trường mình; quản trị hệ thống tạo cho mọi trường. Không có nháp, tạo là công bố |
| 10 | Giới hạn số yêu cầu kết nối người hướng dẫn đang chờ; các trạng thái của yêu cầu | Không giới hạn; gửi lại cho cùng người thì cập nhật lời nhắn và về trạng thái chờ |
| 11 | Danh sách từ khóa cấm | Danh sách trống, nên chưa lọc từ nào |
| 12 | Kiểm duyệt bằng dịch vụ bên ngoài | Chưa dùng; chỉ có từ khóa cấm và ẩn khi đủ 3 báo cáo |

## 5. Tham số đang ở mức Demo hoặc Chờ BA

Các số này đang chạy trên hệ thống thật. Mức "Demo" là số đặt tạm theo đặc tả, chưa có căn cứ (SRS mục 5.3 STT 12).

| Tham số | Giá trị đang chạy | Mức | Cần BA |
|---|---|---|---|
| P05, P08–P13 (chỉ số tin cậy bài chấm) | Theo SRS R14 | Demo | Căn cứ hoặc hiệu chỉnh |
| P16 số JD tối thiểu mỗi nghề | 1 (SRS đề xuất 20) | Demo | Chốt số, xem mục 1 dòng 2 |
| P17, P19, P21, P22 (hiệu lực, nhắc, ẩn danh, ngưỡng tiến bộ) | 12 tháng, 14 ngày, 24 tháng, 0,5 điểm | Demo | Xác nhận |
| P24 độ rộng bậc xếp hạng | 1 điểm % | Demo | Xác nhận |
| P25 ngưỡng nghề gần đạt | 40% | Demo | Xác nhận |
| P27 số bài tối thiểu nhóm Người khác | 2 | Demo | Xác nhận |
| P35–P38 (nhãn đầy đủ dữ liệu, trọng số tiêu chí trong nhóm, ngưỡng Confidence) | Theo SRS; trọng số tiêu chí chia đều | Demo | Xác nhận |
| P40–P45 (ngưỡng Priority, Gap, số tiêu chí hiển thị, số lẻ) | 0,5 / 0,25 / 1 / 0,5 / 5 / 1 | Demo | Priority theo Gap tuyệt đối hay tương đối |
| `riasec_match_method` | Hồ sơ sáu chiều (Demo) | Chờ BA | Công thức RIASEC Match |
| `career_matrix_include_l0` | Bật | Chờ BA | Có dùng JD L0 |
| `unreviewed_supplemental_default` | 100 (bài 360° chưa chấm định tính được coi là trung tính) | Chờ BA | Hay không tính bài chưa chấm |
| `understanding_percent_floor` | 0 | Chờ BA | Sàn TH% khi TH = 3 |
| `zero_weight_equal_fallback` | Bật | Chờ BA | Khi mọi bài TH = 3 thì chia đều hay bỏ điểm 360° |
| `require_open_answers` | Tắt | Chờ BA | Có bắt buộc trả lời câu mở khi nộp bài 360° |

## 6. Dữ liệu cần BA cung cấp

| # | Dữ liệu | Dùng để | Khi chưa có, hệ thống làm gì |
|---|---|---|---|
| 1 | Danh mục nghề chuẩn: chức danh nào thuộc nghề nào | Gom đủ JD cho mỗi nghề, bỏ trùng nghề | Mỗi chức danh là một nghề |
| 2 | Thêm JD cho các nghề muốn đưa vào gợi ý (L1–L2, đủ P16) | Ma trận nghề đủ tin cậy | Ma trận dựng từ 1–4 JD |
| 3 | Ngày kiểm tra JD dạng ngày (một cột riêng) | Hạn rà soát P20, điều kiện nguồn và ngày của R08 | Để trống |
| 4 | Mức tăng trưởng của từng nghề | Bộ lọc nghề | "Chưa có dữ liệu" |
| 5 | Bảng nghề ↔ ngành có mức trực tiếp/gián tiếp và nguồn | Trang nghề, trang ngành, bản đồ Nghề → Ngành → Trường | Dùng liên kết tự dò, chưa kiểm duyệt |
| 6 | Dữ liệu tuyển sinh theo năm và phương thức | Đối chiếu điều kiện đăng ký, so sánh phương án | "Chưa đủ dữ liệu" |
| 7 | Mã ngành, mô tả ngành, nội dung đào tạo, yêu cầu nền tảng; giới thiệu trường | Trang ngành, trang trường | Chỉ hiện tên và danh sách chương trình |
| 8 | Thư viện hoạt động lộ trình đã duyệt | Sinh lộ trình | 3 hoạt động |
| 9 | Thư viện khóa học, dự án, chứng chỉ (có nhãn đối tác nếu có) | Gợi ý trong hồ sơ năng lực | Trống |
| 10 | Danh sách từ khóa cấm | Lọc bài cộng đồng | Trống |
| 11 | Bộ quy tắc xếp hạng phương án đã phê duyệt | So sánh phương án | Công thức tạm ở mục 3 dòng 1 |

## 7. Lỗi trong file nguồn của TEAM BA

| File | Lỗi | Hệ thống đang xử lý |
|---|---|---|
| CAREER_JD_RESEARCH_MASTER.xlsm, sheet G2 | 44 dòng lệch cột: cột "Link JD" chứa "Onsite", cột "Chức danh" chứa mã kiểu `G2-023`, `C002` | Không đọc file này; các dòng đó cũng không có trong Career_Profile |
| Career_Profile.xlsx | 106 JD có Required Level trống hoặc "N / A" | Không vào ma trận |
| Career_Profile.xlsx | Cột "Required Level" trộn số (3.0, 4.5) với chữ dài ("L1 – Mức nền của nghề…") | Quy đổi theo R16; số đã trong 1–5 giữ nguyên |
| Career_Profile.xlsx | Cột "Group ID" không phải mã nghề: 21 mã gom hàng chục chức danh | Mã nghề = Group ID, thêm tên chức danh nếu mã đó có nhiều chức danh |
| RESEARCH NGÀNH NGHỀ TRƯỜNG.xlsx | Một số dòng có tên trường nằm trong ô tỉnh/thành; 2 trường không ghi công lập/tư thục; 10 dòng ngành giữ chỗ ("Thạc sĩ", "Tiến sĩ các ngành") | Bỏ dòng lệch cột và dòng giữ chỗ, liệt kê trong báo cáo nạp thử |
| Bảng đánh giá định tính 360° và SRS | File đánh giá định tính gộp điểm thấu hiểu theo 30/20/25/25; SRS cấm dùng tỷ trọng nhóm cố định | Theo SRS: trọng số từng bài theo mức thấu hiểu, không dùng 30/20/25/25 |

## 8. Điểm Phase 1 đã thay đổi

| Điểm trong bản Phase 1 | Hiện tại |
|---|---|
| Bộ câu hỏi rút gọn của giáo viên chưa có tiêu chí | Đã đánh dấu cả 29 tiêu chí giáo viên chấm được. Bảng lưới chạy được nhưng không còn "rút gọn"; BA vẫn cần chốt danh sách |
| Bảng gán câu vào gói trống | Đã ghi 148 dòng theo quy tắc của hệ thống (31 + 46 + 71). Nhãn câu tình huống, chuyên sâu vẫn chưa có |
| Ngân hàng không có câu mở | File "Bảng đánh giá định tính 360°" có câu mở theo 4 khía cạnh và câu Carkhuff. Người được mời trả lời các câu này; quản trị chấm EA, SOLO, Carkhuff bằng tay. Hiện chưa có bài nào. BA cần chốt người chấm (quản trị, chuyên gia hay AI) |

## 9. Nhóm dev đã làm, không cần BA

- Trang quản trị nghề: danh sách có bộ lọc, trang chi tiết sửa thông tin, mức yêu cầu G1–G5 và G7, Holland; mỗi lần lưu mức yêu cầu tạo phiên bản ma trận mới (R18).
- Ngày kiểm tra dữ liệu nghề (xem mục 1 dòng 8); script nạp đọc tham số `career_matrix_include_l0`; một hàm SQL chung quyết định nghề đủ chuẩn và nghề được tự công bố (có xét P16).
- Danh mục nghề thả xuống trên thanh điều hướng; chọn vai trò khi đăng ký; lịch sử quyết định; chuyển phương án ưu tiên thành nghề mục tiêu.
- Giả định của dev đã thêm: chưa chia sẻ báo cáo cho phụ huynh nào thì vẫn được chốt nghề mục tiêu (nếu đã chia sẻ thì cần phụ huynh đồng thuận).
- Còn chưa làm: lưu trữ tệp lên kho riêng, gửi email, kiểm duyệt bằng dịch vụ ngoài (cần tài khoản và khóa dịch vụ).

## Cách kiểm tra

- SRS v0.0.9: đối chiếu danh sách chức năng nghề, ngành – trường, so sánh phương án (mục 4.2), các ô "(cần xác nhận)" ở mô tả màn hình (mục 4.1), quy tắc R05–R08, R16–R21 (mục 4.3) và vấn đề mở (mục 5.3). Chưa đọc hết phần còn lại của SRS; BRD chưa đối chiếu riêng (SRS ghi là được dựng từ BRD v0.0.3).
- Các file dữ liệu Excel trong TEAM BA và file Bảng đánh giá định tính 360°: đọc tiêu đề cột, kiểm tra số dòng và lỗi.
- So JD giữa CAREER_JD_RESEARCH_MASTER và Career_Profile theo mã JD: 2.754 mã ở master; 79 mã không có trong Career_Profile, gồm 35 mã nằm trong sheet "JD trùng đã xóa" và 44 dòng lệch cột.
- Số liệu nghề, liên kết, chương trình, tham số lấy bằng truy vấn chỉ đọc trên Supabase thật ngày 06/11/2026.
