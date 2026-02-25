import React, { useCallback } from "react";

import { useAppState, useAppDispatch } from "../../../contexts/AppContext";
import { getAppSettings, updateGeneralSettings } from "../../../utils/appSettings";
import { FormSection, FormSlider, FormInput, FormRow } from "../../FormComponents";
import { QuoteChannelManager } from "../../QuoteChannelManager";
import styles from "../SettingsPanel.module.css";

/**
 * 内容设置分段组件属性
 */
export interface ContentSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 内容管理分段组件
 * - 语录自动刷新间隔设置
 * - 频道管理
 */
export const ContentSettingsPanel: React.FC<ContentSettingsPanelProps> = ({ onRegisterSave }) => {
  const { quoteSettings } = useAppState();
  const dispatch = useAppDispatch();
  const [draftInterval, setDraftInterval] = React.useState<number>(
    quoteSettings.autoRefreshInterval
  );

  const [cwServerUrl, setCwServerUrl] = React.useState("");
  const [cwNamespace, setCwNamespace] = React.useState("");
  const [cwPassword, setCwPassword] = React.useState("");

  React.useEffect(() => {
    try {
      const cw = getAppSettings().general.classworks;
      setCwServerUrl(cw?.serverUrl || "https://kv-service.wuyuan.dev");
      setCwNamespace(cw?.namespace || "");
      setCwPassword(cw?.password || "");
    } catch {}
  }, []);

  const channelSaveRef = React.useRef<(() => void) | null>(null);

  const formatRefreshIntervalText = useCallback((seconds: number): string => {
    if (seconds === 0) return "手动刷新";
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds === 0 ? `${minutes}分钟` : `${minutes}分${remainingSeconds}秒`;
  }, []);

  const handleQuoteRefreshIntervalChange = useCallback((value: number) => {
    setDraftInterval(value);
  }, []);

  React.useEffect(() => {
    onRegisterSave?.(() => {
      // 保存刷新间隔
      dispatch({ type: "SET_QUOTE_AUTO_REFRESH_INTERVAL", payload: draftInterval });
      
      // 保存 Classworks 配置
      updateGeneralSettings({
        classworks: {
          serverUrl: cwServerUrl.trim() || "https://kv-service.wuyuan.dev",
          namespace: cwNamespace.trim(),
          password: cwPassword.trim(),
          autoRefreshIntervalMin: 15, // TODO: add slider later if needed
        }
      });

      // 保存渠道草稿
      channelSaveRef.current?.();
    });
  }, [onRegisterSave, draftInterval, cwServerUrl, cwNamespace, cwPassword, dispatch]);

  return (
    <div id="content-panel" role="tabpanel" aria-labelledby="content">
      <FormSection title="作业板设置">
        <p className={styles.helpText} style={{ marginBottom: "12px", lineHeight: 1.5 }}>
          此功能依赖 Classworks KV 服务存储您的作业。请前往{" "}
          <a href="https://kv-service.wuyuan.dev/" target="_blank" rel="noreferrer" style={{ color: "#03DAC6", textDecoration: "none" }}>
            https://kv-service.wuyuan.dev/
          </a>{" "}
          查阅 API 并设置命名空间。如果您是从现有白板迁移，请输入原板的 UUID 或分配的命名空间，并配置密码（如果是私人板）。请提前完成密码和KV的自动授权配置。
        </p>
        <FormRow gap="sm">
          <FormInput
            label="服务端地址"
            value={cwServerUrl}
            onChange={(e) => setCwServerUrl(e.target.value)}
            placeholder="https://kv-service.wuyuan.dev"
          />
        </FormRow>
        <FormRow gap="sm">
          <FormInput
            label="命名空间 / UUID"
            value={cwNamespace}
            onChange={(e) => setCwNamespace(e.target.value)}
            placeholder="这里输入你的 UUID 或命名空间"
          />
          <FormInput
            label="密码 / Token (可选)"
            type="password"
            value={cwPassword}
            onChange={(e) => setCwPassword(e.target.value)}
            placeholder="如果面板设置了密码请输入"
          />
        </FormRow>
      </FormSection>

      <FormSection title="语录自动刷新">
        <div className={styles.sliderWithInfo}>
          <div className={styles.sliderWrapper}>
            <FormSlider
              label="刷新频率"
              value={draftInterval}
              min={30}
              max={1800}
              step={30}
              onChange={handleQuoteRefreshIntervalChange}
              formatValue={formatRefreshIntervalText}
              showRange={true}
              rangeLabels={["30秒", "手动刷新"]}
            />
          </div>
          <p className={styles.infoSide}>
            调节语录的自动刷新频率，左端为最短间隔30秒，右端为关闭自动刷新。
          </p>
        </div>
      </FormSection>

      <QuoteChannelManager
        onRegisterSave={(fn) => {
          channelSaveRef.current = fn;
        }}
      />
    </div>
  );
};

export default ContentSettingsPanel;
