import React, { useState } from "react";
import { Modal } from "../Modal/Modal";
import { HitokotoCard } from "./HitokotoCard";
import { AttendanceCard } from "./AttendanceCard";
import { HomeworkEditDialog } from "./HomeworkEditDialog";
import { Edit } from "lucide-react";
import type { HomeworkItem } from "../../types/classworks";
import { getAppSettings } from "../../utils/appSettings";
import styles from "./HomeworkBoard.module.css";

interface ExpandedHomeworkBoardProps {
  isOpen: boolean;
  onClose: () => void;
  data: HomeworkItem[];
  onSaveItem: (key: string, content: string) => Promise<boolean>;
}

export const ExpandedHomeworkBoard: React.FC<ExpandedHomeworkBoardProps> = ({ isOpen, onClose, data, onSaveItem }) => {
  const [editingItem, setEditingItem] = useState<{key: string, name: string, content: string} | null>(null);

  const hitokotoEnabled = getAppSettings().general.classworks.hitokotoEnabled ?? true;

  const splitContent = (content: string) => {
    if (!content) return [];
    return content.split("\n").filter((line) => line.trim().length > 0);
  };

  const handleCardClick = (item: HomeworkItem) => {
    if (item.type !== "attendance" && item.type !== "exam") {
      setEditingItem({ key: item.key, name: item.name, content: item.content });
    }
  };

  const handleSaveDialog = async (content?: string) => {
    if (content !== undefined && editingItem) {
      const success = await onSaveItem(editingItem.key, content);
      if (success) {
        setEditingItem(null);
      }
    } else {
      setEditingItem(null);
    }
  };

  return (
    <>
      <Modal  
      isOpen={isOpen} 
      onClose={onClose} 
      title="课堂作业板 (Classworks)" 
      maxWidth="xl"
    >
      <div className={styles.expandedContainer}>
        {hitokotoEnabled && <HitokotoCard />}
        
        <div className={styles.expandedGrid}>
          {data.map(item => {
            if (item.type === "hitokoto" || item.type === "exam") return null;

            if (item.type === "attendance") {
              return <AttendanceCard key={item.key} item={item} />;
            }

            return (
              <div 
                key={item.key} 
                className={styles.card}
                onClick={() => handleCardClick(item)}
                style={{ cursor: 'pointer' }}
                title="点击编辑"
              >
                <div className={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className={styles.cardTitle}>{item.name}</h3>
                    <Edit size={14} className={styles.editIcon} style={{ opacity: 0.5 }} />
                  </div>
                  {item.type && item.type !== "normal" && item.type !== "custom" && (
                    <span className={styles.cardBadge}>{item.type}</span>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <ul className={styles.taskList}>
                    {splitContent(item.content).map((line, idx) => (
                      <li key={`${item.key}-line-${idx}`} className={styles.taskItem}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}

          {data.length === 0 && (
            <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
              <p>今天没有作业记录哦~</p>
              <span className={styles.emptyHint}>可能是放假，或者后端暂未配置</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
    
    {editingItem && (
      <HomeworkEditDialog
        isOpen={!!editingItem}
        onClose={handleSaveDialog}
        title={editingItem.name}
        initialContent={editingItem.content}
      />
    )}
  </>
  );
};

