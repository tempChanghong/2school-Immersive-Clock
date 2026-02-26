import React, { useEffect, useState, useCallback } from "react";
import styles from "./HomeworkBoard.module.css";

export const HitokotoCard: React.FC = () => {
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHitokoto = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("https://v1.hitokoto.cn/");
      const data = await res.json();
      setContent(data.hitokoto);
      setAuthor(data.from_who || "");
      setOrigin(data.from || "");
    } catch (e) {
      setContent("未能获取到一言。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHitokoto();
    const interval = setInterval(fetchHitokoto, 60000);
    return () => clearInterval(interval);
  }, [fetchHitokoto]);

  return (
    <div 
      className={styles.hitokotoCard}
      onClick={fetchHitokoto}
    >
      <div className={styles.hitokotoContent}>
        {loading && !content ? "正在加载..." : content}
      </div>
      {(author || origin) && (
        <div className={styles.hitokotoAuthor}>
          {author && <span style={{ marginRight: '8px' }}>{author}</span>}
          {origin && <span>《{origin}》</span>}
        </div>
      )}
    </div>
  );
};
