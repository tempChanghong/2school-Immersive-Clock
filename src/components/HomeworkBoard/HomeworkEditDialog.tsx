import React, { useState, useRef, useEffect } from "react";
import { Modal } from "../Modal/Modal";
import { FormButton } from "../FormComponents";
import { getAppSettings } from "../../utils/appSettings";
import styles from "./HomeworkEditDialog.module.css";

interface HomeworkEditDialogProps {
  isOpen: boolean;
  onClose: (savedContent?: string) => void;
  title: string;
  initialContent: string;
  isPastData?: boolean;
}

export const HomeworkEditDialog: React.FC<HomeworkEditDialogProps> = ({
  isOpen,
  onClose,
  title,
  initialContent,
  isPastData
}) => {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const showQuickTools = getAppSettings().general.classworks.showQuickTools ?? true;
  const quickTexts = ["课", "题", "例", "变", "T", "P"];

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    if (textarea.selectionStart === undefined) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newContent = content.slice(0, start) + text + content.slice(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const deleteLastChar = () => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end && start > 0) {
      setContent(content.slice(0, start - 1) + content.slice(start));
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start - 1, start - 1);
      }, 0);
    } else if (start !== end) {
      setContent(content.slice(0, start) + content.slice(end));
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start);
      }, 0);
    }
  };

  const handleSave = () => {
    onClose(content);
  };

  const footer = (
    <div className={styles.footer}>
      <FormButton variant="secondary" onClick={() => onClose()}>取消</FormButton>
      <FormButton variant="primary" onClick={handleSave}>保存</FormButton>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose()}
      title={`编辑作业 - ${title}`}
      maxWidth="md"
      footer={footer}
    >
      {isPastData && (
        <div className={styles.warningAlert}>
          <strong>注意：</strong> 你正在修改历史数据，请谨慎操作，确保不会覆盖重要数据。
        </div>
      )}
      <div className={styles.dialogBody}>
        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="使用换行表示分条"
            rows={10}
          />
        </div>
        
        {showQuickTools && (
          <div className={styles.quickTools}>
            <div className={styles.keypad}>
              <div className={styles.keypadRow}>
                {[1, 2, 3].map(n => (
                  <button type="button" key={n} className={styles.keyBtn} onClick={() => insertAtCursor(String(n))}>{n}</button>
                ))}
              </div>
              <div className={styles.keypadRow}>
                {[4, 5, 6].map(n => (
                  <button type="button" key={n} className={styles.keyBtn} onClick={() => insertAtCursor(String(n))}>{n}</button>
                ))}
              </div>
              <div className={styles.keypadRow}>
                {[7, 8, 9].map(n => (
                  <button type="button" key={n} className={styles.keyBtn} onClick={() => insertAtCursor(String(n))}>{n}</button>
                ))}
              </div>
              <div className={styles.keypadRow}>
                <button type="button" className={styles.keyBtn} onClick={() => insertAtCursor('-')}>-</button>
                <button type="button" className={styles.keyBtn} onClick={() => insertAtCursor('0')}>0</button>
                <button type="button" className={`${styles.keyBtn} ${styles.delBtn}`} onClick={deleteLastChar}>←</button>
              </div>
              <div className={styles.keypadRow}>
                <button type="button" className={styles.keyBtn} style={{flex: 1}} onClick={() => insertAtCursor(' ')}>空格</button>
                <button type="button" className={styles.keyBtn} style={{flex: 1}} onClick={() => insertAtCursor('\n')}>换行</button>
              </div>
            </div>
            
            <div className={styles.quickTexts}>
              {quickTexts.map(text => (
                <button type="button" key={text} className={styles.quickTextBtn} onClick={() => insertAtCursor(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
