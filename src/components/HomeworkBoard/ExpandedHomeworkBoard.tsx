import React, { useState, useMemo, useRef } from "react";
import { Modal } from "../Modal/Modal";
import { HitokotoCard } from "./HitokotoCard";
import { AttendanceCard } from "./AttendanceCard";
import { HomeworkEditDialog } from "./HomeworkEditDialog";
import { Edit } from "lucide-react";
import type { HomeworkItem } from "../../types/classworks";
import { getAppSettings } from "../../utils/appSettings";
import { useMasonryLayout } from "../../hooks/useMasonryLayout";
import styles from "./HomeworkBoard.module.css";

const DEFAULT_SUBJECTS: HomeworkItem[] = [
  { key: "语文", name: "语文", content: "", order: 0, type: "normal" as const },
  { key: "数学", name: "数学", content: "", order: 1, type: "normal" as const },
  { key: "英语", name: "英语", content: "", order: 2, type: "normal" as const },
  { key: "物理", name: "物理", content: "", order: 3, type: "normal" as const },
  { key: "化学", name: "化学", content: "", order: 4, type: "normal" as const },
  { key: "生物", name: "生物", content: "", order: 5, type: "normal" as const },
  { key: "政治", name: "政治", content: "", order: 6, type: "normal" as const },
  { key: "历史", name: "历史", content: "", order: 7, type: "normal" as const },
  { key: "地理", name: "地理", content: "", order: 8, type: "normal" as const },
  { key: "其他", name: "其他", content: "", order: 9, type: "normal" as const },
];

interface ExpandedHomeworkBoardProps {
  isOpen: boolean;
  onClose: () => void;
  data: HomeworkItem[];
  onSaveItem: (key: string, content: string) => Promise<boolean>;
}

export const ExpandedHomeworkBoard: React.FC<ExpandedHomeworkBoardProps> = ({ isOpen, onClose, data, onSaveItem }) => {
  const [editingItem, setEditingItem] = useState<{key: string, name: string, content: string} | null>(null);
  
  const hitokotoEnabled = getAppSettings().general.classworks.hitokotoEnabled ?? true;
  const gridContainerRef = useRef<HTMLDivElement>(null);

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
  
  // 1. 组合并排序数据
  const mergedData = useMemo(() => {
    const list = [...data];
    DEFAULT_SUBJECTS.forEach((ds) => {
      if (!list.some((item) => item.key === ds.key || item.name === ds.name)) {
        list.push(ds);
      }
    });
    list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    return list;
  }, [data]);

  // 2. 利用自定义 Hook 进行瀑布流列分配
  const masonryColumns = useMasonryLayout(gridContainerRef, mergedData);

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
        
        {/* 瀑布流容器 */}
        <div className={styles.expandedGrid} ref={gridContainerRef}>
          {masonryColumns.map((colItems, colIdx) => (
            <div key={`col-${colIdx}`} className={styles.masonryColumn}>
              {colItems.map((item) => {
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
                      {(!item.content || item.content.trim() === '') && (
                        <div style={{ opacity: 0.5, fontSize: '0.9rem', fontStyle: 'italic', padding: '8px 0' }}>暂无作业，点击添加</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {data.length === 0 && (
            <div className={styles.emptyState} style={{ width: '100%', textAlign: 'center' }}>
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

