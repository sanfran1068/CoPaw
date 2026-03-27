import React, { useState } from 'react';
import { IconButton } from '@agentscope-ai/design';
import { SparkHistoryLine, SparkNewChatFill } from '@agentscope-ai/icons';
import { useChatAnywhereSessions } from '@agentscope-ai/chat';
import ChatSessionDrawer from '../ChatSessionDrawer';
import { Flex } from 'antd';

/**
 * 会话历史抽屉触发器
 * 放在 rightHeader 中渲染，确保在 ComposedProvider 内部以访问 sessions context
 * 包含：新建对话按钮 + 历史记录抽屉触发按钮
 */
const ChatActionGroup: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { createSession } = useChatAnywhereSessions();

  return (
    <Flex gap={8} align="center" style={{ marginLeft: '14px'}}>
      <IconButton
        bordered={false}
        icon={<SparkNewChatFill />}
        onClick={() => createSession()}
      />
      <IconButton
        bordered={false}
        icon={<SparkHistoryLine />}
        onClick={() => setOpen(true)}
      />
      <ChatSessionDrawer open={open} onClose={() => setOpen(false)} />
    </Flex>
  );
};

export default ChatActionGroup;
