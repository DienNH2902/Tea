import { Injectable } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import { LlmAgentService } from '../../llm/llm-agent.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { buildSystemPrompt } from '../../llm/system-prompt';

/**
 * RunAuthenticatedAgentNode
 * -----------------------------------------------------------------------
 * Chạy AI Agent với TOÀN BỘ Tool mà khách đã đăng nhập được phép dùng, bao
 * gồm cả các thao tác "thật" như tạo đơn hàng, tra cứu đơn hàng cá nhân.
 */
@Injectable()
export class RunAuthenticatedAgentNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'RunAuthenticatedAgent';

  constructor(
    private readonly llmAgentService: LlmAgentService,
    private readonly toolRegistry: ToolRegistryService,
  ) {
    super();
  }

  async run(blackboard: ConversationBlackboard): Promise<NodeStatus> {
    const allowedTools = this.toolRegistry.getToolsFor(blackboard);
    const systemPrompt = buildSystemPrompt(blackboard);

    await this.llmAgentService.runAgent(systemPrompt, allowedTools, blackboard);

    // Node này luôn SUCCESS (đã cố gắng xử lý xong lượt chat); nếu có lỗi
    // hệ thống, cờ `hadSystemError` sẽ được node an toàn phía sau xử lý -
    // KHÔNG trả FAILURE ở đây để tránh Selector cha hiểu nhầm là "nhánh
    // đăng nhập không dùng được" rồi rơi xuống nhánh khách vãng lai.
    return NodeStatus.SUCCESS;
  }
}
