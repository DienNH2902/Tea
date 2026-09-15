import { Injectable } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import { ConversationStoreService } from '../../blackboard/conversation-store.service';

/**
 * PersistContextNode - BƯỚC CUỐI của quy trình xử lý 1 tin nhắn.
 * Lưu lại lịch sử hội thoại (đã được LlmAgentService cập nhật vào
 * `blackboard.history`) trở lại bộ nhớ phiên, để lượt chat tiếp theo của
 * cùng khách vẫn giữ được ngữ cảnh.
 */
@Injectable()
export class PersistContextNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'PersistContext';

  constructor(private readonly conversationStore: ConversationStoreService) {
    super();
  }

  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    this.conversationStore.saveHistory(
      blackboard.sessionId,
      blackboard.history,
    );
    return NodeStatus.SUCCESS;
  }
}
