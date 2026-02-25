import React, { useState, useCallback, useEffect } from "react";
import { useAppDispatch } from "../../../contexts/AppContext";
import { getAppSettings, updateGeneralSettings } from "../../../utils/appSettings";
import { FormSection, FormInput, FormRow, FormCheckbox, FormButton } from "../../FormComponents";
import styles from "../SettingsPanel.module.css";
import { testHomeworkConnection } from "../../../services/classworksService";

export interface HomeworkSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

export const HomeworkSettingsPanel: React.FC<HomeworkSettingsPanelProps> = ({ onRegisterSave }) => {
  const [enabled, setEnabled] = useState(true);
  const [cwServerUrl, setCwServerUrl] = useState("");
  const [cwNamespace, setCwNamespace] = useState("");
  const [cwPassword, setCwPassword] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const dispatch = useAppDispatch();

  useEffect(() => {
    try {
      const cw = getAppSettings().general.classworks;
      setEnabled(cw?.enabled ?? true);
      setCwServerUrl(cw?.serverUrl || "https://kv-service.wuyuan.dev");
      setCwNamespace(cw?.namespace || "");
      setCwPassword(cw?.password || "");
    } catch {}
  }, []);

  useEffect(() => {
    onRegisterSave?.(() => {
      updateGeneralSettings({
        classworks: {
          enabled,
          serverUrl: cwServerUrl.trim() || "https://kv-service.wuyuan.dev",
          namespace: cwNamespace.trim(),
          password: cwPassword.trim(),
          autoRefreshIntervalMin: 15,
        }
      });
      // Toggle immediately for better UX
      dispatch({ type: "SET_HOMEWORK_ENABLED", payload: enabled });
    });
  }, [onRegisterSave, enabled, cwServerUrl, cwNamespace, cwPassword, dispatch]);

  const handleTestConnection = useCallback(async () => {
    if (!cwServerUrl.trim() || !cwNamespace.trim()) {
      setTestStatus("error");
      setTestError("请填写服务端地址和命名空间");
      return;
    }

    setTestStatus("testing");
    setTestError("");
    try {
      const result = await testHomeworkConnection(
        cwServerUrl.trim(),
        cwNamespace.trim(),
        cwPassword.trim()
      );
      if (result.success) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(result.error || "连接成功，但未找到有效的数据格式");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestError(err.message || "请求失败，请检查网络或地址设置");
    }
  }, [cwServerUrl, cwNamespace, cwPassword]);

  return (
    <div id="homework-panel" role="tabpanel" aria-labelledby="homework">
      <FormSection title="Classworks 作业板设置">
        <FormRow>
          <FormCheckbox
            id="classworks-enabled"
            label="在主页面右侧显示作业板"
            checked={enabled}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked)}
          />
        </FormRow>

        <p className={styles.helpText} style={{ marginBottom: "12px", lineHeight: 1.5, opacity: enabled ? 1 : 0.5 }}>
          此功能依赖 Classworks KV 服务。请前往{" "}
          <a href="https://kv-service.wuyuan.dev/" target="_blank" rel="noreferrer" style={{ color: "#03DAC6", textDecoration: "none" }}>
            kv-service.wuyuan.dev
          </a>{" "}
          查阅 API 并设置命名空间。
        </p>
        
        <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? "auto" : "none" }}>
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

          <div style={{ marginTop: "1rem" }}>
            <FormRow gap="sm" align="end">
              {testStatus === "testing" && <span style={{ color: "#aaa", fontSize: "14px", alignSelf: "center", marginRight: "8px" }}>测试中...</span>}
              {testStatus === "success" && <span style={{ color: "#03DAC6", fontSize: "14px", alignSelf: "center", marginRight: "8px" }}>连接测试成功！</span>}
              {testStatus === "error" && <span style={{ color: "#CF6679", fontSize: "14px", alignSelf: "center", marginRight: "8px" }}>{testError}</span>}
              
              <FormButton 
                variant="secondary" 
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
              >
                测试连接
              </FormButton>
            </FormRow>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

export default HomeworkSettingsPanel;
