/*
 * reusability: false
 * https://mgdone.alibaba-inc.com/file/188196543332628?file=188196543332628&layer_id=25:54705&page_id=2:72603
 */
import React, { useCallback, useState } from 'react';
import { Drawer } from 'antd';
import { IconButton } from '@agentscope-ai/design';
import { SparkOperateRightLine } from '@agentscope-ai/icons';
import { useChatAnywhereSessionsState, useChatAnywhereSessions } from '@agentscope-ai/chat';
import { chatApi } from '../../../../api/modules/chat';
import sessionApi from '../../sessionApi';
import ChatSessionItem from '../ChatSessionItem';
import styles from './index.module.less';

interface ChatSessionDrawerProps {
  /** 抽屉是否可见 */
  open: boolean;
  /** 关闭抽屉回调 */
  onClose: () => void;
}

/** 从 ISO 8601 时间戳格式化为 YYYY-MM-DD HH:mm:ss */
const formatCreatedAt = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const date = new Date(raw);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** 获取会话的后端真实 UUID（非本地时间戳 id） */
const getBackendId = (session: Record<string, unknown>): string | null => {
  if (session.realId) return session.realId as string;
  const id = session.id as string;
  if (!/^\d+$/.test(id)) return id;
  return null;
};

const ChatSessionDrawer: React.FC<ChatSessionDrawerProps> = (props) => {
  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    setSessions,
  } = useChatAnywhereSessionsState();

  const { createSession } = useChatAnywhereSessions();

  /** 新建会话并关闭抽屉 */
  const handleCreateSession = useCallback(async () => {
    await createSession();
    props.onClose();
  }, [createSession, props.onClose]);

  /** 当前正在编辑的会话 id */
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  /** 编辑框的当前输入值 */
  const [editValue, setEditValue] = useState('');

  /** 刷新会话列表并同步到状态 */
  const refreshSessions = useCallback(async () => {
    const list = await sessionApi.getSessionList();
    setSessions(list);
  }, [setSessions]);

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      setCurrentSessionId(sessionId);
    },
    [setCurrentSessionId],
  );

  /** 删除会话：调用 deleteChat 接口后刷新列表 */
  const handleDelete = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId) as Record<string, unknown>;
      const backendId = session ? getBackendId(session) : null;

      if (backendId) {
        await chatApi.deleteChat(backendId);
      }

      if (currentSessionId === sessionId) {
        const next = sessions.filter((s) => s.id !== sessionId);
        setCurrentSessionId(next[0]?.id);
      }

      await refreshSessions();
    },
    [sessions, currentSessionId, setCurrentSessionId, refreshSessions],
  );

  /** 开始编辑：记录目标 id 和当前名称 */
  const handleEditStart = useCallback((sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId);
    setEditValue(currentName);
  }, []);

  /** 编辑框值变化 */
  const handleEditChange = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  /** 提交编辑：调用 updateChat 接口后刷新列表 */
  const handleEditSubmit = useCallback(async () => {
    if (!editingSessionId) return;

    const session = sessions.find((s) => s.id === editingSessionId) as Record<string, unknown>;
    const backendId = session ? getBackendId(session) : null;
    const newName = editValue.trim();

    if (backendId && newName && session) {
      // 将 ExtendedSession 还原为完整 ChatSpec，仅覆盖 name
      await chatApi.updateChat(backendId, {
        id: backendId,
        name: newName,
        session_id: session.sessionId as string,
        user_id: session.userId as string,
        channel: session.channel as string,
        created_at: (session.createdAt as string | null) ?? null,
        meta: session.meta as Record<string, unknown> | undefined,
        status: session.status as 'idle' | 'running' | undefined,
      });
    }

    setEditingSessionId(null);
    setEditValue('');
    await refreshSessions();
  }, [editingSessionId, editValue, sessions, refreshSessions]);

  /** 取消编辑 */
  const handleEditCancel = useCallback(() => {
    setEditingSessionId(null);
    setEditValue('');
  }, []);

  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      placement="right"
      width={360}
      closable={false}
      title={null}
      styles={{
        header: { display: 'none' },
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
        mask: { background: 'transparent' },
      }}
      className={styles.drawer}
    >
      {/* 顶部标题栏 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>History</span>
        </div>
        <div className={styles.headerRight}>
          <IconButton
            bordered={false}
            icon={<SparkOperateRightLine />}
            onClick={props.onClose}
          />
        </div>
      </div>

      {/* 新建会话按钮 */}
      <div className={styles.createSection}>
        <div className={styles.createButton} onClick={handleCreateSession}>
          Create New Chat
        </div>
      </div>

      {/* 会话列表 */}
      <div className={styles.listWrapper}>
        <div className={styles.topGradient} />
        <div className={styles.list}>
          {sessions.map((session) => {
            const raw = session as Record<string, unknown>;
            return (
              <ChatSessionItem
                key={session.id}
                name={session.name || 'New Chat'}
                time={formatCreatedAt(raw.createdAt as string | null)}
                active={session.id === currentSessionId}
                editing={editingSessionId === session.id}
                editValue={editingSessionId === session.id ? editValue : undefined}
                onClick={() => handleSessionClick(session.id!)}
                onEdit={() => handleEditStart(session.id!, session.name || 'New Chat')}
                onDelete={() => handleDelete(session.id!)}
                onEditChange={handleEditChange}
                onEditSubmit={handleEditSubmit}
                onEditCancel={handleEditCancel}
              />
            );
          })}
        </div>
        <div className={styles.bottomGradient} />
      </div>
    </Drawer>
  );
};

export default ChatSessionDrawer;
