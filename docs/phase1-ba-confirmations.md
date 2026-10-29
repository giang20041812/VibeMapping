# Phase 1 – Điểm cần BA xác nhận và cung cấp

## Tóm tắt

Phase 1 còn 14 điểm chờ BA xác nhận và 9 nhóm dữ liệu chờ BA cung cấp; trong lúc chờ, hệ thống chạy bằng các quy tắc tạm ghi ở cột "Hệ thống đang xử lý".

Đã làm xong phần lớp học: tạo trường và lớp, gán giáo viên, nhập danh sách học sinh từ Excel (kiểm tra trước rồi mới nhập, tự tạo tài khoản), học sinh vào lớp bằng mã hoặc QR, bảng lưới chấm điểm của giáo viên (nộp cả bảng rồi khóa), báo cáo lớp và trường, xuất báo cáo lớp ra Excel.

Chặn lớn nhất: tài liệu không liệt kê tiêu chí nào thuộc bộ câu hỏi rút gọn, và không gắn nhãn câu tình huống, câu chuyên sâu cho ngân hàng câu hỏi. Khi chưa có danh sách tiêu chí rút gọn, giáo viên chưa nộp được bảng điểm; tự đánh giá vẫn chạy theo đúng số lượng câu của đặc tả.

Đã đối chiếu lại với SRS, BRD và Phase 1.docx: nhiều điểm của bản trước đã được đặc tả trả lời hoặc đã sửa trong hệ thống, xem phần cuối.

## Cần BA xác nhận

Mỗi dòng là một quyết định mà đặc tả chưa nêu, nêu chưa đủ hoặc tự mâu thuẫn; cột cuối cho biết hệ thống đang làm gì cho đến khi có câu trả lời.

| # | Cần xác nhận | Vì sao chưa rõ | Hệ thống đang xử lý |
|---|---|---|---|
| 1 | Tiêu chí nào thuộc bộ câu hỏi rút gọn dành cho giáo viên | Đặc tả chỉ ghi "các tiêu chí cốt lõi", không liệt kê; file Excel không có cột đánh dấu. Thời gian ghi "khoảng 5 phút" ở chỗ này, "5 phút/lớp" ở chỗ khác. Ma trận thang đo cho thấy giáo viên chỉ chấm được 29 trong 31 tiêu chí (không chấm D6.3, D6.4), nên bộ rút gọn phải chọn trong 29 tiêu chí này | Chưa đánh dấu tiêu chí nào nên giáo viên chưa nộp được bảng điểm. Quản trị tích ô "Thuộc bộ câu hỏi rút gọn" ở trang Tiêu chí là dùng được ngay. Hệ thống không cho đánh dấu tiêu chí giáo viên không chấm được |
| 2 | Giáo viên tự chọn tiêu chí hay dùng bộ cố định | Đặc tả dùng từ "giáo viên chọn bộ rút gọn" nhưng phần mô tả lại chỉ nói một bộ chung | Bộ cố định do quản trị đánh dấu; giáo viên không tự chọn được |
| 3 | Câu nào là 15 câu tình huống (thêm vào gói Tiêu chuẩn) và 25 câu chuyên sâu (thêm vào gói Chuyên sâu) | Đặc tả đã nêu số câu thêm theo từng nhóm, nhưng ngân hàng 620 câu tự đánh giá đều là câu Likert như nhau, 20 câu cho mỗi tiêu chí, không câu nào gắn nhãn tình huống hay chuyên sâu | Bảng gán trống trên Supabase. Hệ thống chọn đúng số lượng của đặc tả: mỗi tiêu chí 1 câu (theo mã câu), thêm câu chia đều trong từng nhóm. Có sẵn lệnh gán trước vào bảng, chưa chạy |
| 4 | Số câu gói: 35/50/75 hay 31/46/71 | Đặc tả tính gói 35 = 1 câu họ tên/ẩn danh + 3 câu mức hiểu biết + 31 câu tiêu chí; tài liệu nghiệp vụ lại gắn bốn câu đầu với người được mời, không phải học sinh | Học sinh làm 31/46/71 câu tiêu chí, giao diện hiển thị số thật |
| 5 | Học sinh vào lớp sau khi giáo viên đã nộp và khóa bảng điểm | Đặc tả không nói; bảng đã khóa không sửa được | Học sinh vào sau không nằm trong bảng của giáo viên đó, nên chưa được chấm |
| 6 | Tài khoản của học sinh tạo từ danh sách Excel | Đặc tả nói "khởi tạo tài khoản" nhưng mẫu Excel không có email; không nói học sinh đăng nhập bằng gì | Tạo email nội bộ dạng mãhọcsinh@mãtrường.vibemapping.local và mật khẩu tạm ngẫu nhiên; giáo viên tải tệp tài khoản để phát. Học sinh vào lớp ngay và nhà trường ghi nhận đồng ý thay. Chưa bắt đổi mật khẩu lần đầu; quên mật khẩu không tự lấy lại được vì email không có thật |
| 7 | Ngưỡng 5 học sinh của báo cáo đếm theo ai; điểm lấy từ nguồn nào | Đặc tả chỉ ghi "nhóm có từ 5 học sinh hoàn thành" | Đếm học sinh đã tham gia lớp và có kết quả; dưới 5 thì chỉ hiện tiến độ tham gia. Mỗi học sinh lấy kết quả mới nhất, ưu tiên điểm tổng hợp 360°, không có thì dùng tự đánh giá |
| 8 | Giáo viên và quản trị trường được xem gì về học sinh | Tài liệu nghiệp vụ: quản trị trường chỉ xem báo cáo tổng hợp, không xem hồ sơ cá nhân; giáo viên không xem dữ liệu học sinh chưa cấp quyền. Chưa nói tên và trạng thái làm bài có phải hồ sơ cá nhân không | Cả hai vai trò thấy mã học sinh, họ tên, trạng thái (đã tham gia, đã làm bài, đã được chấm) của mọi học sinh trong lớp |
| 9 | Mẫu Excel: ngày sinh có bắt buộc không; giới hạn số dòng và dung lượng | Bảng kiểm tra tệp của đặc tả có cột Ngày sinh nhưng không nói bắt buộc, cũng không nêu giới hạn | Có cột Ngày sinh, được để trống, sai định dạng thì báo lỗi dòng. Tối đa 1.000 dòng, tệp .xlsx dưới 2 MB (nhóm tự đặt) |
| 10 | Chống nộp trùng theo IP có chặn nhầm người dùng chung wifi (cùng nhà, lớp, trường) | Đặc tả ghi mỗi IP chỉ nộp tối đa 1 bài cho mỗi đường dẫn | Đang theo đặc tả |
| 11 | Coverage tính theo nhóm hay theo người chấm; câu chuyện người dùng ghi "tiêu chí nhận 40% điểm" trái với quy tắc nghiệp vụ | Bảng thang đo mâu thuẫn ví dụ trong SRS (G6 chỉ có bản thân); câu chuyện người dùng trái quy tắc "không đủ cơ sở là rỗng, không phạt" | Đếm theo nhóm; theo quy tắc nghiệp vụ (rỗng, không phạt) |
| 12 | Phạm vi phase 1: đăng ký đăng nhập bằng mã OTP/SMS, gửi email, gửi yêu cầu xác nhận người giám hộ, cấp tài khoản quản trị trường kèm email kích hoạt | Đặc tả mô tả đầy đủ nhưng không nói mục nào thuộc phase 1 | Chưa làm. Đăng nhập bằng email + mật khẩu; quản trị trường được gán theo email tài khoản có sẵn và tự xác nhận; học sinh dưới 16 tuổi chưa có xác nhận giám hộ thì bị chặn nộp bảng điểm |
| 13 | Báo cáo lớp có "phân bố nghề quan tâm" và lọc học sinh theo mã Holland | Phase 1 loại phần Nghề; mã Holland nổi trội của từng em chưa được tính | Báo cáo chỉ có điểm trung bình G1–G7. Bảng có bộ lọc theo nhóm G nổi trội của học sinh thay cho lọc theo Holland |
| 14 | Nội dung và định dạng báo cáo lớp xuất ra | Đặc tả cho chọn Excel hoặc PDF, và phạm vi toàn bộ lớp hoặc chỉ học sinh đã hoàn thành; không nói tệp gồm những cột nào | Xuất Excel gồm danh sách học sinh (mã, họ tên, trạng thái tham gia, bài làm, đã được chấm) và điểm trung bình G1–G7 khi đủ ngưỡng. Chưa có PDF |

## Cần BA cung cấp

| # | Dữ liệu | Dùng để | Khi chưa có, hệ thống làm gì |
|---|---|---|---|
| 1 | Danh sách mã tiêu chí thuộc bộ câu hỏi rút gọn, chọn trong 29 tiêu chí giáo viên chấm được | Mở khóa bảng lưới chấm điểm của giáo viên | Giáo viên thấy cảnh báo "chưa có tiêu chí rút gọn" và không nộp được |
| 2 | Với 620 câu tự đánh giá: câu nào là tình huống, câu nào là chuyên sâu, thuộc Phần 1–4 nào (thêm 2 cột Phần và Mức chi tiết vào file ngân hàng câu hỏi) | Gán câu vào gói đúng ý BA | Chọn đúng số lượng của đặc tả nhưng lấy theo thứ tự mã câu |
| 3 | Bảng quy tắc ánh xạ kết quả phần trước sang câu hỏi phần sau (đặc tả: "soạn câu hỏi Phần 2 theo bảng quy tắc ánh xạ"; bảng này không có ở đâu) | Soạn câu hỏi các phần sau theo kết quả phần trước | Mỗi gói dùng một danh sách câu cố định, không đổi theo kết quả |
| 4 | Mẫu Excel danh sách học sinh của trường (cột nào bắt buộc) | Thay mẫu tạm | Mẫu tạm có 3 cột: Mã học sinh, Họ và tên, Ngày sinh |
| 5 | Cột đối tượng (học sinh hay sinh viên) cho từng câu trong ngân hàng | Không đưa câu nói về "sinh viên" cho người được mời của học sinh lớp 11 | Mọi câu đang là "dùng chung"; đã đếm 58 câu nhóm Bạn bè nhắc "sinh viên" vẫn gửi cho học sinh |
| 6 | Câu hỏi mở và cách chấm điểm hiểu biết bổ sung S (EA, SOLO, Carkhuff): dùng AI hay luật. Công thức đã có trong đặc tả, ngân hàng không có câu mở nào | Tính trọng số bài đánh giá | S tạm bằng 100, tức là trung tính |
| 7 | Căn cứ cho các tham số mức Demo (P05, P08–P13, P27, P36–P38) | Dùng cho kết quả chính thức | Nạp theo giá trị ghi trong đặc tả; chưa dùng cho kết quả chính thức |
| 8 | Sửa lỗi trong file gốc: dòng 2102 ngân hàng câu hỏi dính ghi chú vào cột Group; tên D5.4 lệch giữa hai sheet; cột vai trò sheet MA TRẬN để trống | Nhập dữ liệu không phải xử lý ngoại lệ | Script nhập tự xử lý từng lỗi; lấy tên D5.4 ở sheet MA TRẬN |
| 9 | Ngày kết thúc năm học | Tác vụ lưu trữ dữ liệu theo năm học (bảng điểm giáo viên lưu 10 năm, không tính cho năm học mới) | Chưa lưu trữ |

## Hệ thống đang xử lý thế nào

### Gói câu hỏi
- Ngân hàng tự đánh giá đang bật có 620 câu. Gói 35/50/75 ra 31/46/71 câu tiêu chí, gói lớn luôn chứa gói nhỏ.
- Số câu thêm theo đúng đặc tả: gói Tiêu chuẩn thêm 15 câu (mỗi nhóm G1–G7 thêm 2 câu, riêng G2 thêm 3), gói Chuyên sâu thêm 25 câu (mỗi nhóm thêm 3 câu, riêng G2, G3, G5, G6 thêm 4). 31 + 15 + 25 = 71.
- Bốn phần làm tuần tự: Phần 1 = G1 + G4, Phần 2 = G7, Phần 3 = G6, Phần 4 = G2 + G3 + G5.
- Nếu quản trị đã gán câu vào gói ("Gán câu hỏi vào gói") thì dùng đúng danh sách đó; chưa gán thì tự chọn theo quy tắc trên. Hiện bảng gán trống nên đang dùng quy tắc.
- Lệnh `npm run assign:packages` ghi sẵn kết quả quy tắc vào bảng để BA xem và sửa trên giao diện; chưa ghi vào dữ liệu thật.

### Bộ rút gọn và bảng lưới
- Bộ rút gọn là các tiêu chí được đánh dấu "Thuộc bộ câu hỏi rút gọn" ở trang Tiêu chí. Chỉ đánh dấu được tiêu chí giáo viên chấm được; tiêu chí đang thuộc bộ rút gọn không ẩn được với giáo viên.
- Bảng lưới hiển thị mỗi tiêu chí một cột, mỗi học sinh một dòng. Ô nhận điểm 1–5 hoặc "Không đủ cơ sở" (lưu là trống, không phải 0).
- Điền cả cột, điền xuống, dán từ bảng tính, nhập từ tệp Excel, chọn nhiều học sinh rồi gán cùng một bộ điểm, lọc theo nhóm tiêu chí và theo nhóm G nổi trội, lưu nháp từng ô. Mất mạng thì điểm lưu tạm trên máy và đồng bộ khi có mạng lại.
- Ba câu mức thấu hiểu khai báo một lần cho cả lớp, sửa riêng từng em. Nhãn bốn mức theo bảng mặc định của đặc tả.
- Nộp cả bảng một lần. Nộp bị chặn khi còn ô trống (các ô thiếu được tô đỏ), thiếu mức thấu hiểu, còn học sinh dưới 16 tuổi chưa có xác nhận giám hộ, hoặc chưa có tiêu chí rút gọn.
- Nộp xong bảng khóa, không mở lại được. Mỗi học sinh có một bài đánh giá nhóm Giáo viên đã chấp nhận, kết quả của em được tính lại. Nhiều giáo viên cùng chấm một lớp thì mỗi người một bảng, các bài được gộp thành điểm nhóm Giáo viên.

### Lớp học
- Quản trị hệ thống tạo trường, thêm giáo viên hoặc quản trị trường theo email tài khoản (quản trị trường không tự đăng ký được, vai trò được nâng khi gán).
- Giáo viên hoặc quản trị trường tạo lớp; hệ thống sinh mã lớp và mã QR. Giáo viên tạo lớp tự vào lớp với vai trò chủ nhiệm.
- Học sinh nhập mã (hoặc quét QR) để vào lớp, được báo trước rằng tham gia lớp được coi là đồng ý để giáo viên đánh giá. Một học sinh vào được nhiều lớp, rời lớp được; bị xóa khỏi lớp thì không tự vào lại.
- Nhập Excel: đọc tệp .xlsx theo mẫu, hiện kết quả kiểm tra (số dòng hợp lệ, số dòng lỗi, từng dòng lỗi: thiếu mã hoặc tên, trùng trong tệp, đã có trong lớp, ngày sinh sai), rồi bấm Xác nhận nhập hoặc Hủy bỏ. Nhập xong tự tạo tài khoản cho học sinh chưa có tài khoản và cho tải tệp tài khoản.
- Trạng thái từng học sinh: đã tham gia, đã làm bài, đã được chấm, chờ người giám hộ.
- Báo cáo lớp và trường: điểm trung bình G1–G7; dưới 5 học sinh có kết quả thì không hiện điểm, chỉ hiện phần trăm tiến độ tham gia. Báo cáo lớp xuất được ra Excel.

### Chưa làm
- Xuất báo cáo lớp dạng PDF.
- Lọc học sinh theo mã Holland (chờ tính mã Holland nổi trội) và phân bố nghề quan tâm (thuộc phase sau).
- Gửi email và SMS: mã xác minh, email kích hoạt quản trị trường, yêu cầu xác nhận người giám hộ.
- Đăng ký và đăng nhập bằng OTP/SMS, đồng ý điều khoản, khóa tài khoản sau 5 lần nhập sai.
- Soạn câu hỏi các phần sau theo kết quả phần trước (chờ bảng quy tắc ánh xạ).
- Lưu trữ dữ liệu theo năm học (chờ ngày kết thúc năm học).

## So với bản trước

| Điểm của bản trước | Hiện tại |
|---|---|
| Học sinh dưới 16 tuổi: chặn cả bảng hay chỉ bỏ em đó | Đã có trong đặc tả (giáo viên chưa nộp được bảng điểm cho em đó); hệ thống chặn cả bảng và nêu tên |
| Nhiều giáo viên bộ môn cùng chấm | Đã có trong đặc tả: từ hai giáo viên trở lên thì gộp thành điểm nhóm Giáo viên |
| Sửa bảng điểm sau khi nộp | Đặc tả: nộp xong khóa bảng. Hệ thống đã làm đúng như vậy |
| Học sinh mới chỉ có dòng nhập từ Excel được chấm không | Đặc tả yêu cầu khởi tạo tài khoản. Hệ thống đã tạo tài khoản khi nhập; còn lại câu hỏi cách đăng nhập (mục 6) |
| Bốn mức của ba câu mức thấu hiểu | Đặc tả đã có nhãn từng mức; mã nguồn dùng đúng |
| Báo cáo dưới 5 học sinh chỉ hiện thông báo thiếu | Đặc tả yêu cầu hiện phần trăm tiến độ tham gia; đã sửa |
| Mẫu Excel 2 cột | Mẫu có thêm cột Ngày sinh theo bảng kiểm tra tệp của đặc tả |
| Gói 35/50/75 "chỉ có quy tắc đếm" | Đặc tả đã định nghĩa đầy đủ số câu thêm theo nhóm; hệ thống đúng từng con số. Còn thiếu nhãn từng câu |
