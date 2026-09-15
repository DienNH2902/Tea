import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AgentMessage } from './conversation-blackboard.interface';

/** Thông tin 1 phiên chat được lưu trong bộ nhớ */
interface StoredSession {
  history: AgentMessage[];
  lastActiveAt: number; // Dùng timestamp (Date.now()) để dễ so sánh hết hạn
}

// Giới hạn số lượng tin nhắn tối đa giữ lại trong lịch sử của 1 phiên.
// Mục đích: tránh việc lịch sử chat quá dài khiến mỗi lần gọi LLM tốn quá
// nhiều token (chi phí) và chậm đi. 20 tin nhắn (~10 lượt qua lại) là đủ để
// BOT nhớ ngữ cảnh gần nhất mà vẫn tiết kiệm.
const MAX_HISTORY_MESSAGES = 20;

// Sau 30 phút không hoạt động, phiên chat sẽ tự bị dọn dẹp khỏi bộ nhớ.
const SESSION_TTL_MS = 30 * 60 * 1000;

// Cứ mỗi 10 phút, chạy 1 lần dọn rác các phiên đã hết hạn.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * ConversationStoreService
 * -----------------------------------------------------------------------
 * Lưu lịch sử hội thoại (mảng AgentMessage) theo từng `sessionId`, để BOT
 * "nhớ" được ngữ cảnh giữa nhiều lượt chat của cùng 1 khách (ví dụ khách
 * hỏi "còn trà sen không?" rồi tiếp theo hỏi "vậy giá bao nhiêu?" - BOT cần
 * hiểu "vậy" đang nói tới trà sen ở câu trước).
 *
 * LƯU Ý CHO NGƯỜI MỚI:
 * Bản hiện tại dùng `Map` trong bộ nhớ (RAM) của Node.js để demo cho đơn
 * giản, dễ hiểu, không cần cài thêm gì. Nhược điểm là dữ liệu sẽ MẤT khi
 * restart server, và KHÔNG dùng được nếu bạn chạy nhiều instance (scale
 * ngang) vì mỗi instance có 1 bộ nhớ riêng. Khi lên production thật, bạn
 * chỉ cần thay phần lưu trữ bên trong service này bằng Redis (ví dụ dùng
 * `@nestjs-modules/ioredis` hoặc `cache-manager-redis-store`) mà KHÔNG cần
 * sửa bất kỳ nơi nào khác đang gọi tới `ConversationStoreService`, vì phần
 * "hợp đồng" (get/save) bên ngoài vẫn giữ nguyên.
 */
@Injectable()
export class ConversationStoreService implements OnModuleDestroy {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Định kỳ dọn dẹp các phiên chat đã lâu không hoạt động để tránh rò rỉ
    // bộ nhớ (memory leak) khi server chạy lâu dài.
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredSessions(),
      CLEANUP_INTERVAL_MS,
    );

    // unref() để timer này không "giữ" tiến trình Node.js sống mãi
    // (không ảnh hưởng gì tới việc dọn dẹp, chỉ giúp graceful shutdown mượt hơn)
    this.cleanupTimer.unref?.();
  }

  /** Lấy lịch sử hội thoại hiện có của 1 phiên (trả về mảng rỗng nếu chưa có) */
  getHistory(sessionId: string): AgentMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  /**
   * Lưu lại lịch sử hội thoại mới nhất của 1 phiên.
   * Tự động cắt bớt nếu vượt quá MAX_HISTORY_MESSAGES (chỉ giữ các tin nhắn
   * gần đây nhất).
   */
  saveHistory(sessionId: string, history: AgentMessage[]): void {
    const trimmed =
      history.length > MAX_HISTORY_MESSAGES
        ? history.slice(history.length - MAX_HISTORY_MESSAGES)
        : history;

    this.sessions.set(sessionId, {
      history: trimmed,
      lastActiveAt: Date.now(),
    });
  }

  /** Xóa hẳn 1 phiên chat (ví dụ khi khách bấm "Bắt đầu cuộc trò chuyện mới") */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Quét và xóa các phiên đã quá hạn TTL để giải phóng bộ nhớ */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActiveAt > SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /** NestJS sẽ tự gọi hàm này khi module bị hủy (ví dụ server tắt) */
  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
