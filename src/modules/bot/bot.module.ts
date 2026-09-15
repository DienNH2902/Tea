import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TeaModule } from '../tea/tea.module';
import { OrderModule } from '../order/order.module';
import { CartModule } from '../cart/cart.module';

import { BotController } from './bot.controller';
import { BotService } from './bot.service';

// --- Behavior Tree: nạp/lưu ngữ cảnh, chạy Agent, lưới an toàn ---
import { LoadContextNode } from './tree/nodes/load-context.node';
import { HasAuthenticatedUserCondition } from './tree/nodes/has-authenticated-user.condition';
import { RunAuthenticatedAgentNode } from './tree/nodes/run-authenticated-agent.node';
import { AuthenticatedOrderConfirmationGuardNode } from './tree/nodes/authenticated-order-confirmation-guard.node';
import { RequireLoginToOrderNode } from './tree/nodes/require-login-to-order.node';
import { RunGuestAgentNode } from './tree/nodes/run-guest-agent.node';
import { GuestFakeOrderReplyGuardNode } from './tree/nodes/guest-fake-order-reply-guard.node';
import { HasReplyTextCondition } from './tree/nodes/has-reply-text.condition';
import { FallbackReplyNode } from './tree/nodes/fallback-reply.node';
import { PersistContextNode } from './tree/nodes/persist-context.node';
import { BotTreeBuilderService } from './tree/bot-tree-builder.service';

// --- Blackboard: bộ nhớ dùng chung + lưu trữ lịch sử hội thoại theo phiên ---
import { ConversationStoreService } from './blackboard/conversation-store.service';

// --- Tools: "hộp công cụ" mà LLM sẽ dùng để kiểm kho/tư vấn/đặt hàng ---
import { SearchTeaTool } from './tools/search-tea.tool';
import { CheckStockTool } from './tools/check-stock.tool';
import { SuggestAddonTool } from './tools/suggest-addon.tool';
import { AddToCartTool } from './tools/add-to-cart.tool';
import { CreateOrderTool } from './tools/create-order.tool';
import { CheckOrderStatusTool } from './tools/check-order-status.tool';
import { ToolRegistryService } from './tools/tool-registry.service';
import { TeaCatalogCacheService } from './tools/tea-catalog-cache.service';

// --- LLM: kết nối tới Ollama (miễn phí, chạy local) + vòng lặp tool-use ---
import { LlmClientProvider } from './llm/llm-client.provider';
import { LlmAgentService } from './llm/llm-agent.service';
import { GuestWantsToOrderCondition } from './tree/nodes/guest-want-to-order.condition';

/**
 * BotModule
 * -----------------------------------------------------------------------
 * Module NestJS đóng gói toàn bộ tính năng "BOT tư vấn bán chè". Được
 * import thẳng vào `AppModule` (xem `src/app.module.ts`) để dùng CHUNG
 * cùng 1 tiến trình Node.js với các module còn lại (Tea/Order/Cart...),
 * tận dụng lại toàn bộ logic nghiệp vụ đã có sẵn (không viết lại kiểm kho
 * hay tạo đơn hàng từ đầu).
 */
@Module({
  imports: [
    ConfigModule, // Để đọc LLM_BASE_URL, LLM_MODEL (cấu hình Ollama) từ file .env
    TeaModule, // Cung cấp TeaService cho các tool tra cứu/kiểm kho
    OrderModule, // Cung cấp OrdersService cho tool tạo đơn/tra cứu đơn
    CartModule, // Cung cấp CartService cho tool thêm giỏ hàng
  ],
  controllers: [BotController],
  providers: [
    BotService,

    // Behavior Tree
    LoadContextNode,
    HasAuthenticatedUserCondition,
    RunAuthenticatedAgentNode,
    AuthenticatedOrderConfirmationGuardNode,
    GuestWantsToOrderCondition,
    RequireLoginToOrderNode,
    RunGuestAgentNode,
    GuestFakeOrderReplyGuardNode,
    HasReplyTextCondition,
    FallbackReplyNode,
    PersistContextNode,
    BotTreeBuilderService,

    // Blackboard / lưu trữ phiên chat
    ConversationStoreService,

    // Tools
    TeaCatalogCacheService,
    SearchTeaTool,
    CheckStockTool,
    SuggestAddonTool,
    AddToCartTool,
    CreateOrderTool,
    CheckOrderStatusTool,
    ToolRegistryService,

    // LLM
    LlmClientProvider,
    LlmAgentService,
  ],
  exports: [BotService],
})
export class BotModule {}
