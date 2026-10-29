# Phase 1 – Đối chiếu đặc tả lớp học và bảng điểm

Đối chiếu SRS v0.0.9, BRD và Phase 1.docx với mã nguồn ngày 2026-10-29 (nhánh `feat/grid-lock-roster-accounts`). Phạm vi: các yêu cầu F02.01 đến F02.03 và quy tắc kèm theo. Mã yêu cầu chỉ dùng trong tài liệu này, không đưa lên giao diện.

## A. Hệ thống còn lệch đặc tả, sửa được ngay (8 mục khác đã sửa, xem phần E)

| # | Yêu cầu | Đặc tả | Hệ thống hiện tại | Việc cần làm |
|---|---|---|---|---|
| 1 | BR-M02-011 Lưu trữ theo năm học | Cuối năm học, tác vụ nền chuyển dữ liệu sang khu lưu trữ gắn nhãn năm học; bảng điểm giáo viên lưu 10 năm, không tính cho năm học mới | Có cột `is_archived` của lớp nhưng không có tác vụ nào chạy | Thêm tác vụ lưu trữ theo năm học (cần BA chốt ngày kết thúc năm học) |
| 2 | Email theo đặc tả | Gửi email kích hoạt tài khoản quản trị trường; mã xác minh 90 giây | Chưa gửi email nào. Quản trị trường được gán bằng email tài khoản có sẵn và tự xác nhận trên hệ thống | Cấu hình dịch vụ gửi email rồi nối vào các luồng này |

## B. Chặn bởi dữ liệu hoặc chức năng phase khác

| # | Yêu cầu | Đặc tả | Hệ thống hiện tại | Đang chờ gì |
|---|---|---|---|---|
| 1 | FR02.02.05 Lọc học sinh theo nhóm tố chất | Lọc học sinh có cùng mã Holland hoặc nhóm G nổi trội từ bài tự đánh giá. Học sinh chưa cấp quyền hoặc chưa làm bài không hiện trong kết quả lọc nhưng vẫn chấm được | Bộ lọc hiện tại lọc theo nhóm tiêu chí (cột của bảng), không phải theo học sinh | Cần mã Holland và nhóm G nổi trội của từng học sinh. Backend chưa tính mã Holland nổi trội (tài liệu bàn giao, mục 4). Làm được phần "nhóm G nổi trội" trước vì đã có điểm nhóm G1–G7 |
| 2 | FR02.03.02 Phân bố nghề quan tâm | Báo cáo lớp có phân bố nghề quan tâm | Chỉ có điểm trung bình G1–G7 | Nghề thuộc phase sau (bảng phạm vi phase 1 trong tài liệu bàn giao). BA xác nhận bỏ khỏi phase 1 |
| 3 | FR02.01.04 / FR02.01.01 Gửi yêu cầu xác nhận người giám hộ | Học sinh dưới 16 tuổi: gửi email hoặc SMS cho người giám hộ, đường dẫn hiệu lực 15 phút | Chưa có. Học sinh dưới 16 tuổi chưa xác nhận thì chặn nộp bảng điểm | Cần dịch vụ email/SMS (cùng mục A.10) |

## C. Cần BA xác nhận

| # | Cần xác nhận | Đặc tả hiện ghi | Hệ thống đang làm | Nếu BA chọn khác |
|---|---|---|---|---|
| 1 | Tiêu chí nào thuộc bộ câu hỏi rút gọn | "gồm các tiêu chí cốt lõi" (FR02.02.01), không liệt kê. Thời gian: "khoảng 5 phút" (SRS), "5 phút/lớp" (BRD) | Chưa tiêu chí nào được đánh dấu nên giáo viên chưa nộp được. Quản trị tích ô "Thuộc bộ câu hỏi rút gọn" ở trang Tiêu chí là dùng được ngay | Chỉ đổi dữ liệu |
| 2 | Giáo viên tự chọn tiêu chí hay dùng một bộ cố định | FR02.02.01 ghi "Giáo viên chọn bộ câu hỏi rút gọn", nhưng mô tả khác chỉ nói một bộ chung | Bộ cố định do quản trị đánh dấu | Nếu cho chọn: thêm màn chọn tiêu chí |
| 3 | Câu nào thuộc gói 35/50/75, mức Khái quát hay Chi tiết | Chỉ có số câu mỗi gói và "hệ thống tự chia số câu cho từng phần"; ngân hàng 3.100 câu không có cột gói | Bảng gán trống, tự chọn theo quy tắc đếm số câu. `npm run assign:packages` ghi sẵn để BA xem và sửa | Gán lại trên trang Gán câu hỏi vào gói |
| 4 | Số câu gói là 35/50/75 hay 31/46/71 | Đặc tả ghi 35/50/75. Chưa thấy chỗ nào nói gói gồm câu họ tên và 3 câu thấu hiểu của người được mời | Hiển thị số câu thật 31/46/71 | Đổi nhãn hoặc thêm câu cho đủ số |
| 5 | Học sinh vào lớp sau khi giáo viên đã nộp và khóa bảng | Không nói. Bảng khóa vĩnh viễn nên học sinh vào sau không có trong bảng | Học sinh vào sau không được giáo viên đó chấm | Cho tạo bảng mới hoặc mở lại có kiểm soát |
| 6 | Tài khoản học sinh tạo từ Excel | "Khởi tạo tài khoản cho học sinh"; mẫu Excel không có email | Tạo email nội bộ `mãhọcsinh@mãtrường.vibemapping.local` và mật khẩu tạm; giáo viên tải tệp tài khoản. Vào lớp ngay và ghi nhận đồng ý thay học sinh. Chưa bắt đổi mật khẩu; quên mật khẩu không tự lấy lại được | BA chốt: dùng email thật (thêm cột)? bắt đổi mật khẩu lần đầu? nhà trường được đồng ý thay học sinh? |
| 7 | Ngưỡng 5 học sinh: đếm theo ai, điểm lấy từ đâu | "từ 5 học sinh hoàn thành" (BR-011); không nói nguồn điểm | Đếm học sinh đã tham gia và có kết quả; mỗi em lấy kết quả mới nhất, ưu tiên điểm tổng hợp 360°, không có thì tự đánh giá | Đổi điều kiện đếm hoặc nguồn điểm |
| 8 | Giáo viên và quản trị trường được xem gì | BRD: quản trị trường chỉ xem báo cáo tổng hợp, không xem hồ sơ cá nhân học sinh; giáo viên không xem dữ liệu học sinh chưa cấp quyền | Danh sách thành viên hiện mã học sinh, họ tên, trạng thái (đã làm bài, đã được chấm) cho cả giáo viên và quản trị trường, không phụ thuộc quyền học sinh đã cấp | BA xác định danh sách tên và trạng thái có phải "hồ sơ cá nhân" không; nếu có thì ẩn theo quyền |
| 9 | Ngày sinh trong mẫu Excel có bắt buộc không | Bảng kiểm tra tệp có cột Ngày sinh; không nói bắt buộc | Có cột, được để trống; sai định dạng thì báo lỗi dòng | Nếu bắt buộc: dòng trống ngày sinh bị loại |
| 10 | Giới hạn tệp nhập Excel | Không có giới hạn số dòng hay dung lượng | Tối đa 1.000 dòng, tệp .xlsx dưới 2 MB (nhóm tự đặt) | Đổi hằng số |
| 11 | Chống nộp trùng theo IP có chặn nhầm người dùng chung wifi | "mỗi IP chỉ nộp tối đa 1 bài cho mỗi đường dẫn" | Đang theo đặc tả | Nới hoặc bỏ ràng buộc |
| 12 | Coverage theo nhóm hay theo người chấm; số nhóm kỳ vọng khi sheet THANG ĐO mâu thuẫn ví dụ SRS (G6 chỉ bản thân) | Hai nguồn mâu thuẫn | Đếm theo nhóm, số kỳ vọng = số nhóm được hiển thị | Đổi công thức Coverage |
| 13 | User story US-01-02-13 ghi "tiêu chí nhận 40% điểm" | BR-005: "không đủ cơ sở" là rỗng, không phạt | Theo BR-005 | Sửa user story |
| 14 | Phạm vi đăng ký, đăng nhập phase 1 | Mã xác minh 90 giây qua email hoặc SMS, tab số điện thoại, đồng ý điều khoản, bước "Bạn là ai?", khóa 15 phút sau 5 lần sai | Email + mật khẩu qua Supabase Auth; chưa có OTP, SMS, điều khoản, khóa tài khoản | BA chốt phạm vi |

## D. Cần BA cung cấp dữ liệu

| # | Dữ liệu | Dùng để | Khi chưa có |
|---|---|---|---|
| 1 | Danh sách mã tiêu chí thuộc bộ rút gọn | Mở khóa bảng điểm của giáo viên | Giáo viên thấy cảnh báo, không nộp được |
| 2 | Danh sách câu thuộc mỗi gói 35/50/75, kèm mức Khái quát hay Chi tiết (thêm 2 cột vào file ngân hàng câu hỏi) | Gán đúng ý BA thay quy tắc đếm | Tự chọn theo quy tắc đếm |
| 3 | Mẫu Excel danh sách học sinh của trường (cột nào bắt buộc) | Thay mẫu tạm gồm Mã học sinh, Họ và tên, Ngày sinh | Dùng mẫu tạm |
| 4 | Cột đối tượng (học sinh hay sinh viên) cho từng câu trong ngân hàng | Không gửi câu nói về "sinh viên" cho người được mời của học sinh lớp 11 | Mọi câu là "dùng chung"; 58 câu nhóm Bạn bè nhắc "sinh viên" vẫn gửi cho học sinh |
| 5 | Câu hỏi mở và cách chấm S (EA, SOLO, Carkhuff): dùng AI hay luật | Tính trọng số bài đánh giá. SRS đã có công thức S, ngân hàng không có câu mở nào | S tạm bằng 100 (trung tính) |
| 6 | Căn cứ cho tham số mức Demo (P05, P08–P13, P27, P36–P38) | Dùng cho kết quả chính thức | Nạp theo giá trị đặc tả, chưa dùng cho kết quả chính thức |
| 7 | Sửa lỗi file gốc: dòng 2102 ngân hàng câu hỏi dính ghi chú vào cột Group; tên D5.4 lệch giữa hai sheet; cột vai trò sheet MA TRẬN để trống | Nhập dữ liệu không phải xử lý ngoại lệ | Script nhập tự xử lý; lấy tên D5.4 ở sheet MA TRẬN |
| 8 | Ngày kết thúc năm học | Chạy tác vụ lưu trữ theo năm học (mục A.9) | Chưa lưu trữ |

## E. Đã khớp đặc tả, không cần hỏi

| Nội dung | Căn cứ |
|---|---|
| Nhập danh sách: kiểm tra trước rồi Xác nhận hoặc Hủy bỏ | Bảng kiểm tra tệp của đặc tả; migration `20261028000700` (`p_dry_run`) |
| Thông báo trước khi tham gia lớp | Trang Lớp học của học sinh |
| Báo cáo dưới 5 học sinh hiện phần trăm tiến độ tham gia | BR-011; `member_count` trong báo cáo lớp và trường |
| Gán điểm cho nhóm học sinh đã chọn; điền xuống; dán từ bảng tính | Hộp thoại gán nhóm, nút Điền xuống, dán vào ô đang chọn |
| Tiến độ số học sinh đã chấm đủ; tô đỏ ô thiếu khi nộp bị chặn | Thẻ mức thấu hiểu cả lớp; bảng điểm |
| Mất mạng: điểm lưu tạm ở Local Storage rồi đồng bộ | `grid_offline.ts` |
| Nộp cả bảng khi đủ 100% ô rồi khóa vĩnh viễn | Giao diện "Xác nhận và Khóa bảng điểm"; migration `20261028000600` |
| Tạo tài khoản học sinh khi nhập Excel | BRD, SRS: "khởi tạo tài khoản cho học sinh"; Edge Function `create-roster-accounts` (cách đăng nhập: mục C.6) |
| Cột Ngày sinh trong mẫu nhập danh sách | Bảng kiểm tra tệp của đặc tả; migration `20261028000500` |
| Nhãn bốn mức của ba câu mức thấu hiểu | SRS bảng mặc định A2; mã nguồn dùng đúng nhãn |
| Nhiều giáo viên cùng chấm một lớp | SRS: từ hai giáo viên trở lên thì gộp theo công thức thành điểm nhóm Giáo viên; mỗi giáo viên một bảng |
| Học sinh dưới 16 tuổi chưa có xác nhận giám hộ | BR-M03-008: giáo viên chưa nộp được bảng điểm cho em đó |
| Học sinh thuộc nhiều lớp, rời lớp, bị xóa thì không tự vào lại | FR02.01.05, FR02.01.07; dữ liệu và bài chấm vẫn được giữ |
