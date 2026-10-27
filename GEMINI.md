# GEMINI.MD - WORKSPACE INSTRUCTIONS & RULES

Tài liệu này kế thừa và đồng bộ 100% với [AGENTS.md](file:///d:/VibeMapping/AGENTS.md).

## CÁC QUY CHUẨN BẮT BUỘC (CRITICAL DIRECTIVES)
1. **Không đưa số liệu/đầu mục/thông tin từ tài liệu lên trên giao diện**: Tuyệt đối không có "1.1", "Mục 2", "Theo đặc tả..." trên UI.
2. **Không xây dựng mô tả, giải thích đầu mục**: Không sinh các câu mô tả chức năng, văn bản filler thừa thãi dưới tiêu đề hoặc nhãn.
3. **Không đặt tên sai module/trường/biến**: Bám sát 100% đặc tả nghiệp vụ, ánh xạ 1:1 từ tên bảng/cột Supabase sang TypeScript và tên Form.
4. **Không đặt mô tả, hướng dẫn, ví dụ linh tinh**: Giữ nhãn và placeholder súc tích, chuyên nghiệp.
5. **Bám sát 1 quy chuẩn giao diện chung**: Dùng thống nhất bộ Design Tokens (`src/styles/tokens.css`) và các component dùng chung tại `src/components/common/`.
6. **Đảm bảo tương thích đa thiết bị**: Samsung / Android (font size 16px tránh auto-zoom, touch target >= 44px, safe area), PC (giới hạn container, chống giật layout, chống thanh cuộn ngang vỡ giao diện).
7. **Form filter chuẩn hóa**: Cùng một kiểu dáng UI, giới hạn kích thước (`max-height: 280px` cho dropdown), bắt buộc có Search Bar tích hợp nếu danh sách >= 7 lựa chọn hoặc dữ liệu động.

Xem chi tiết từng bộ quy chuẩn trong thư mục [.agents/rules/](file:///d:/VibeMapping/.agents/rules/).
