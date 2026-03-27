/*
 * reusability: false
 * 展示当前选中会话的名称，放置在 rightHeader 左侧
 */
import React from 'react';
import { useChatAnywhereSessionsState } from '@agentscope-ai/chat';
import styles from './index.module.less';

/** 当前会话标题，无会话时显示 "New Chat" */
const ChatHeaderTitle: React.FC = () => {
  const { sessions, currentSessionId } = useChatAnywhereSessionsState();
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const chatName = currentSession?.name || 'New Chat';

  return <span className={styles.chatName}>{chatName}</span>;
};

export default ChatHeaderTitle;
