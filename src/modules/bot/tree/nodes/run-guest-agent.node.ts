import { Injectable } from '@nestjs/common';
import { ActionNode } from '../../behavior-tree/nodes/base-node';
import { NodeStatus } from '../../behavior-tree/behavior-tree.types';
import { ConversationBlackboard } from '../../blackboard/conversation-blackboard.interface';
import { LlmAgentService } from '../../llm/llm-agent.service';
import { ToolRegistryService } from '../../tools/tool-registry.service';
import { buildSystemPrompt } from '../../llm/system-prompt';

/**
 * RunGuestAgentNode
 * -----------------------------------------------------------------------
 * Nhánh DỰ PHÒNG trong SelectorNode "RouteByAuth": khi khách CHƯA đăng
 * nhập (HasAuthenticatedUserCondition trả FAILURE), Selector sẽ tự động
 * rơi xuống đây. `ToolRegistryService.getToolsFor()` sẽ tự động loại bỏ
 * các Tool `requiresAuth = true` (create_order, add_to_cart, check_order_status),
 * nên khách vãng lai chỉ có thể được tư vấn/tra cứu sản phẩm, không thể
 * đặt hàng thật - mà KHÔNG cần viết thêm bất kỳ điều kiện if/else nào ở đây.
 */
@Injectable()
export class RunGuestAgentNode extends ActionNode<ConversationBlackboard> {
  readonly name = 'RunGuestAgent';

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

    // Node cuối trong Selector luôn SUCCESS để đảm bảo LUÔN có 1 nhánh
    // "bắt được" mọi trường hợp (đây là mẫu hình Selector kinh điển: nhánh
    // cuối cùng đóng vai trò default/fallback).
    return NodeStatus.SUCCESS;
  }
}
