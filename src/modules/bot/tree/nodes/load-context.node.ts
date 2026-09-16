import { Injectable } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import { ConversationStoreService } from '../../blackboard/conversation-store.service';

/**
 * LoadContextNode - BƯỚC 1 của quy trình xử lý 1 tin nhắn.
 * Nạp lịch sử hội thoại đã lưu trước đó (nếu có) của cùng `sessionId` vào
 * blackboard, để LLM Agent "nhớ" được ngữ cảnh các lượt chat trước.
 */
@Injectable()
export class LoadContextNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'LoadContext';

  constructor(private readonly conversationStore: ConversationStoreService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    blackboard.history = this.conversationStore.getHistory(
      blackboard.sessionId,
    );
    return NodeStatus.SUCCESS;
  }
}
