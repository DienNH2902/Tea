import { Injectable } from '@nestjs/common';
import { ConditionNode } from '../../behavior-tree/nodes/base-node';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';

/**
 * HasAuthenticatedUserCondition
 * -----------------------------------------------------------------------
 * Node điều kiện đơn giản: khách đang chat đã đăng nhập chưa? Đây chính là
 * "nhánh rẽ" (branching) của Behavior Tree - dựa vào kết quả SUCCESS/FAILURE
 * của node này, `SelectorNode` cha sẽ tự động chọn nhánh xử lý phù hợp
 * (Agent đầy đủ quyền hay Agent chỉ tư vấn cho khách vãng lai) MÀ KHÔNG
 * CẦN VIẾT IF/ELSE Ở TẦNG ĐIỀU PHỐI - toàn bộ việc "chọn nhánh" nằm gọn
 * trong cấu trúc cây (khai báo trong BotTreeBuilderService).
 */
@Injectable()
export class HasAuthenticatedUserCondition extends ConditionNode<ConversationBlackboard> {
  readonly name = 'HasAuthenticatedUser?';

  check(blackboard: ConversationBlackboard): boolean {
    return blackboard.isAuthenticated === true && !!blackboard.userId;
  }
}
