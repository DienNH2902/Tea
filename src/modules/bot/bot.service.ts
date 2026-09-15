import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BotTreeBuilderService } from './tree/bot-tree-builder.service';
import { ConversationBlackboard } from './blackboard/conversation-blackboard.interface';
import { ChatResponseDto } from './dto/chat-response.dto';

/** Thông tin khách hàng tối thiểu cần có để phân quyền cho BOT (nếu có đăng nhập) */
export interface BotChatCurrentUser {
  _id: string;
  name?: string;
}

export interface BotChatInput {
  sessionId?: string;
  message: string;
  /** null nếu là khách vãng lai chưa đăng nhập */
  user: BotChatCurrentUser | null;
}

/**
 * BotService
 * -----------------------------------------------------------------------
 * "Cổng vào" duy nhất của toàn bộ hệ thống BOT. Nhiệm vụ rất đơn giản:
 *   1. Chuẩn hóa input (tạo sessionId mới nếu khách chưa có).
 *   2. Khởi tạo 1 Blackboard mới cho lượt chat này.
 *   3. Giao cho Behavior Tree (BotTreeBuilderService) xử lý toàn bộ.
 *   4. Đọc kết quả từ Blackboard, trả về cho Controller.
 *
 * Service này KHÔNG chứa bất kỳ logic nghiệp vụ nào (không if/else quyết
 * định nội dung) - toàn bộ "bộ não" nằm ở Behavior Tree + LLM Agent + Tool.
 */
@Injectable()
export class BotService {
  constructor(private readonly treeBuilder: BotTreeBuilderService) {}

  async chat(input: BotChatInput): Promise<ChatResponseDto> {
    const sessionId = input.sessionId?.trim() || randomUUID();

    const blackboard: ConversationBlackboard = {
      sessionId,
      userMessage: input.message,
      isAuthenticated: !!input.user,
      userId: input.user?._id,
      userName: input.user?.name,
      history: [], // Sẽ được LoadContextNode nạp lại từ bộ nhớ phiên
      toolCallLog: [],
    };

    const tree = this.treeBuilder.getTree();
    await tree.run(blackboard);

    return {
      sessionId,
      reply:
        blackboard.replyText ??
        'Xin lỗi, hiện BOT chưa thể phản hồi, vui lòng thử lại sau.',
      toolsUsed: blackboard.toolCallLog.map((entry) => entry.toolName),
    };
  }
}
