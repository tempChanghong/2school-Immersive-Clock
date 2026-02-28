import { Users } from "lucide-react";
import React from "react";

import type { HomeworkItem } from "../../types/classworks";

import styles from "./HomeworkBoard.module.css";

export const AttendanceCard: React.FC<{ item: HomeworkItem }> = ({ item }) => {
  const data = item.data;
  if (!data) return null;

  const total = data.total || 0;
  const absent = Array.isArray(data.absent) ? data.absent : [];
  const late = Array.isArray(data.late) ? data.late : [];
  const exclude = Array.isArray(data.exclude) ? data.exclude : [];

  const actualPresent = total - absent.length - exclude.length;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3
          className={styles.cardTitle}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Users size={18} /> 出勤统计
        </h3>
      </div>
      <div className={styles.cardBody}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span>应到/实到</span>
          <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
            {total - exclude.length}/{actualPresent}
          </span>
        </div>
        <hr
          style={{
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            margin: "8px 0 12px",
          }}
        />

        {absent.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#ff6b6b", marginBottom: "4px" }}>
              请假 ({absent.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {absent.map((name: string) => (
                <span
                  key={name}
                  style={{
                    background: "rgba(255, 107, 107, 0.2)",
                    color: "#ff6b6b",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {late.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#fca311", marginBottom: "4px" }}>
              迟到 ({late.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {late.map((name: string) => (
                <span
                  key={name}
                  style={{
                    background: "rgba(252, 163, 17, 0.2)",
                    color: "#fca311",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {exclude.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "0.8rem", color: "#adb5bd", marginBottom: "4px" }}>
              不参与 ({exclude.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {exclude.map((name: string) => (
                <span
                  key={name}
                  style={{
                    background: "rgba(173, 181, 189, 0.2)",
                    color: "#adb5bd",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {absent.length === 0 && late.length === 0 && exclude.length === 0 && (
          <div style={{ color: "#51cf66", textAlign: "center", marginTop: "12px" }}>全勤</div>
        )}
      </div>
    </div>
  );
};
