/*
 * reusability: false
 * https://mgdone.alibaba-inc.com/file/188196543332628?file=188196543332628&layer_id=2:50125&page_id=2:72603
 */
import React from 'react';
import { Input } from 'antd';
import { IconButton } from '@agentscope-ai/design';
import { SparkEditLine, SparkDeleteLine } from '@agentscope-ai/icons';
import styles from './index.module.less';

interface ChatSessionItemProps {
  /** 会话名称 */
  name: string;
  /** 会话时间，已格式化的字符串 */
  time: string;
  /** 是否为当前选中会话 */
  active?: boolean;
  /** 是否处于编辑模式 */
  editing?: boolean;
  /** 编辑框当前值 */
  editValue?: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 编辑回调 */
  onEdit?: () => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 编辑框值变化回调 */
  onEditChange?: (value: string) => void;
  /** 确认编辑回调 */
  onEditSubmit?: () => void;
  /** 取消编辑回调 */
  onEditCancel?: () => void;
  className?: string;
}

const ChatSessionItem: React.FC<ChatSessionItemProps> = (props) => {
  const className = [
    styles.chatSessionItem,
    props.active ? styles.active : '',
    props.editing ? styles.editing : '',
    props.className || '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} onClick={props.editing ? undefined : props.onClick}>
      {/* 左侧时间轴占位 */}
      <div className={styles.iconPlaceholder} />
      <div className={styles.content}>
        {props.editing ? (
          <Input
            autoFocus
            size="small"
            value={props.editValue}
            onChange={(e) => props.onEditChange?.(e.target.value)}
            onPressEnter={props.onEditSubmit}
            onBlur={props.onEditCancel}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={styles.name}>{props.name}</div>
        )}
        <div className={styles.time}>{props.time}</div>
      </div>
      {/* hover 时显示的操作按钮 */}
      {!props.editing && (
        <div className={styles.actions}>
          <IconButton
            bordered={false}
            size="small"
            icon={<SparkEditLine />}
            onClick={(e) => {
              e.stopPropagation();
              props.onEdit?.();
            }}
          />
          <IconButton
            bordered={false}
            size="small"
            icon={<SparkDeleteLine />}
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete?.();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ChatSessionItem;
