# Phase 1 – Điểm còn cần BA xác nhận

Đối chiếu với SRS v0.0.9, BRD và Phase 1.docx ngày 2026-10-29. Chỉ liệt kê điểm mà đặc tả chưa nêu, nêu mâu thuẫn, hoặc hệ thống đang làm khác đặc tả vì chưa sửa được.

## A. Cần BA xác nhận

| # | Cần xác nhận | Đặc tả hiện ghi | Hệ thống đang làm | Nếu BA chọn khác |
|---|---|---|---|---|
| 1 | Tiêu chí nào thuộc bộ câu hỏi rút gọn | "gồm các tiêu chí cốt lõi" (FR02.02.01), không liệt kê. Thời gian: "khoảng 5 phút" (SRS), "5 phút/lớp" (BRD) | Chưa tiêu chí nào được đánh dấu nên giáo viên chưa nộp được bảng điểm. Quản trị tích ô "Thuộc bộ câu hỏi rút gọn" ở trang Tiêu chí là dùng được ngay | Chỉ đổi dữ liệu, không sửa mã |
| 2 | Giáo viên tự chọn tiêu chí hay dùng một bộ cố định | FR02.02.01 ghi "Giáo viên chọn bộ câu hỏi rút gọn", nhưng các mô tả khác chỉ nói một bộ chung | Bộ cố định do quản trị đánh dấu | Nếu cho chọn: thêm màn chọn tiêu chí cho giáo viên |
| 3 | Câu nào thuộc gói 35/50/75, mức Khái quát hay Chi tiết | Chỉ có số câu mỗi gói và "hệ thống tự chia số câu cho từng phần"; ngân hàng 3.100 câu không có cột gói | Bảng gán trống, tự chọn theo quy tắc đếm số câu. Lệnh `npm run assign:packages` ghi sẵn kết quả để BA xem và sửa | Gán lại trên trang Gán câu hỏi vào gói |
| 4 | Số câu gói là 35/50/75 hay 31/46/71 | Đặc tả ghi 35/50/75. Chưa tìm thấy chỗ nào nói gói gồm câu họ tên và 3 câu mức hiểu biết của người được mời | Hiển thị số câu thật: 31/46/71 | Đổi nhãn hiển thị hoặc thêm câu cho đủ số |
| 5 | Học sinh vào bảng điểm sau khi giáo viên đã nộp và khóa | Đặc tả không nói. Bảng khóa vĩnh viễn nên học sinh vào lớp sau đó không có trong bảng | Học sinh vào sau khi khóa không được chấm bởi giáo viên này | Cần cho phép tạo thêm bảng mới hoặc mở lại có kiểm soát |
| 6 | Tài khoản học sinh tạo từ Excel: cách đăng nhập và quản lý | "Khởi tạo tài khoản cho học sinh". Mẫu Excel không có email | Tạo email nội bộ dạng mãhọcsinh@mãtrường.vibemapping.local và mật khẩu tạm ngẫu nhiên; giáo viên tải tệp tài khoản để phát. Tài khoản vào lớp ngay, ghi nhận đồng ý tham gia lớp thay học sinh. Chưa bắt đổi mật khẩu lần đầu; quên mật khẩu không tự lấy lại được (email không có thật) | BA chốt: dùng email thật (thêm cột email)? bắt đổi mật khẩu lần đầu? nhà trường được đồng ý thay học sinh không? |
| 7 | Ngưỡng 5 học sinh của báo cáo: đếm theo ai, điểm lấy từ đâu | "từ 5 học sinh hoàn thành trở lên" (BR-011). Không nói nguồn điểm | Đếm học sinh đã tham gia lớp và có kết quả; mỗi em lấy kết quả mới nhất, ưu tiên điểm tổng hợp 360°, không có thì tự đánh giá | Đổi điều kiện đếm hoặc nguồn điểm |
| 8 | Báo cáo lớp: "phân bố nghề quan tâm" và lọc theo "nhóm tố chất" | Phase 1.docx: báo cáo có phân bố nghề quan tâm và điểm TB G1–G7; lọc theo nhóm tố chất gồm Logic, Xã hội, Kỹ thuật, Sáng tạo | Chỉ có điểm TB G1–G7. Bảng lưới lọc theo nhóm tiêu chí (G1–G7). Nghề không thuộc phase 1 | BA cho biết 4 nhóm tố chất lấy từ đâu (mã Holland? nhóm tiêu chí?) và có đưa vào phase 1 không |
| 9 | Ngày sinh trong mẫu Excel có bắt buộc không | Bảng lỗi nhập Excel có cột Ngày sinh; không nói bắt buộc | Mẫu có cột Ngày sinh, được phép để trống, sai định dạng thì báo lỗi dòng | Nếu bắt buộc: dòng trống ngày sinh bị loại |
| 10 | Giới hạn tệp nhập Excel | Không có giới hạn số dòng hay dung lượng (chữ "2MB" trong SRS là dung lượng tải trang) | Tối đa 1.000 dòng, tệp .xlsx dưới 2 MB (do nhóm tự đặt) | Đổi hằng số |
| 11 | Chống nộp trùng theo IP có chặn nhầm người dùng chung wifi (cùng nhà, lớp, trường) | "mỗi IP chỉ nộp tối đa 1 bài cho mỗi đường dẫn" | Đang theo đặc tả | Nới hoặc bỏ ràng buộc |
| 12 | Coverage tính theo nhóm hay theo người chấm; số nhóm kỳ vọng khi sheet THANG ĐO mâu thuẫn ví dụ SRS (G6 chỉ bản thân) | Hai nguồn mâu thuẫn | Đếm theo nhóm, số kỳ vọng = số nhóm được hiển thị | Đổi công thức Coverage |
| 13 | User story US-01-02-13 ghi "tiêu chí nhận 40% điểm" | BR-005: "không đủ cơ sở" là rỗng, không phạt | Theo BR-005 | Sửa user story cho khớp |
| 14 | Đăng ký, đăng nhập | Mã xác minh 90 giây qua email hoặc SMS, tab số điện thoại, ô đồng ý điều khoản, bước "Bạn là ai?", khóa 15 phút sau 5 lần sai | Email + mật khẩu qua Supabase Auth; chưa có OTP, SMS, điều khoản, khóa tài khoản | Cần BA chốt phạm vi phase 1 cho phần này |
| 15 | Gửi yêu cầu xác nhận người giám hộ (học sinh dưới 16 tuổi) | Gửi email hoặc SMS, link hiệu lực 15 phút | Chưa có chức năng gửi. Học sinh dưới 16 tuổi chưa xác nhận thì chặn nộp bảng điểm | Cần BA chốt có làm trong phase 1 không |

## B. Cần BA cung cấp dữ liệu

| # | Dữ liệu | Dùng để | Khi chưa có |
|---|---|---|---|
| 1 | Danh sách mã tiêu chí thuộc bộ rút gọn | Mở khóa bảng lưới chấm điểm | Giáo viên thấy cảnh báo, không nộp được |
| 2 | Danh sách câu thuộc mỗi gói 35/50/75, kèm mức Khái quát hay Chi tiết (thêm 2 cột vào file ngân hàng câu hỏi) | Gán đúng ý BA thay quy tắc đếm | Tự chọn theo quy tắc đếm |
| 3 | Mẫu Excel danh sách học sinh của trường (cột nào bắt buộc) | Thay mẫu tạm gồm Mã học sinh, Họ và tên, Ngày sinh | Dùng mẫu tạm |
| 4 | Cột đối tượng (học sinh hay sinh viên) cho từng câu trong ngân hàng | Không gửi câu nói về "sinh viên" cho người được mời của học sinh lớp 11 | Mọi câu là "dùng chung"; 58 câu nhóm Bạn bè nhắc "sinh viên" vẫn gửi cho học sinh |
| 5 | Câu hỏi mở và cách chấm S (EA, SOLO, Carkhuff): dùng AI hay luật | Tính trọng số bài đánh giá. SRS đã có công thức S nhưng ngân hàng không có câu mở nào | S tạm bằng 100 (trung tính) |
| 6 | Căn cứ cho tham số mức Demo (P05, P08–P13, P27, P36–P38) | Dùng cho kết quả chính thức | Nạp theo giá trị trong đặc tả, chưa dùng cho kết quả chính thức |
| 7 | Sửa lỗi file gốc: dòng 2102 ngân hàng câu hỏi dính ghi chú vào cột Group; tên D5.4 lệch giữa hai sheet; cột vai trò sheet MA TRẬN để trống | Nhập dữ liệu không phải xử lý ngoại lệ | Script nhập tự xử lý; lấy tên D5.4 ở sheet MA TRẬN |

## C. Đã đối chiếu, không cần hỏi BA

| Nội dung | Kết luận |
|---|---|
| Nhãn bốn mức của ba câu mức thấu hiểu | Đặc tả đã có (SRS, bảng mặc định A2: dưới 6 tháng, 6–12 tháng, 1–3 năm, trên 3 năm; hiếm khi, vài lần/tháng, vài lần/tuần, hằng ngày; biết sơ qua, khá hiểu, hiểu rõ, rất hiểu). Mã nguồn đã dùng đúng |
| Nhiều giáo viên cùng chấm một lớp | SRS: từ hai giáo viên trở lên thì gộp theo công thức thành điểm nhóm Giáo viên. Hệ thống đã làm vậy |
| Học sinh dưới 16 tuổi chưa có xác nhận giám hộ | BR-M03-008: giáo viên chưa nộp được bảng điểm cho em đó. Hệ thống đã chặn |
| Nộp bảng điểm | Đặc tả: nộp cả bảng khi đủ 100% ô, rồi khóa. Đã sửa hệ thống theo đặc tả (migration `20261028000600`): nộp cả bảng, khóa vĩnh viễn, bỏ nộp từng học sinh và nộp lại |
| Tạo tài khoản khi nhập Excel | Đặc tả yêu cầu khởi tạo tài khoản. Đã làm bằng Edge Function `create-roster-accounts` (chi tiết cách đăng nhập ở mục 6 bảng A) |
| Cột Ngày sinh trong mẫu nhập danh sách | Đã thêm vào mẫu theo bảng lỗi của đặc tả (migration `20261028000500`, chưa áp lên Supabase thật) |
