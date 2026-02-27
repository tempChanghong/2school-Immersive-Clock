import React, { useState, useCallback, useEffect } from "react";
import { useAppDispatch } from "../../../contexts/AppContext";
import { getAppSettings, updateGeneralSettings } from "../../../utils/appSettings";
import { FormSection, FormInput, FormRow, FormCheckbox, FormButton, FormSelect } from "../../FormComponents";
import styles from "../SettingsPanel.module.css";
import { testHomeworkConnection, fetchRawClassworksData } from "../../../services/classworksService";

export interface HomeworkSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

export const HomeworkSettingsPanel: React.FC<HomeworkSettingsPanelProps> = ({ onRegisterSave }) => {
  const [enabled, setEnabled] = useState(true);
  const [cwServerUrl, setCwServerUrl] = useState("");
  const [cwNamespace, setCwNamespace] = useState("");
  const [cwPassword, setCwPassword] = useState("");
  const [cwAutoRefreshInterval, setCwAutoRefreshInterval] = useState(30);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hitokotoEnabled, setHitokotoEnabled] = useState(true);
  const [emptySubjectDisplay, setEmptySubjectDisplay] = useState<"card" | "button">("card");
  const [showQuickTools, setShowQuickTools] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [blockNonTodayAutoSave, setBlockNonTodayAutoSave] = useState(true);
  const [blockPastDataEdit, setBlockPastDataEdit] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [debugRawData, setDebugRawData] = useState<string | null>(null);

  const dispatch = useAppDispatch();

  useEffect(() => {
    try {
      const cw = getAppSettings().general.classworks;
      setEnabled(cw?.enabled ?? true);
      setCwServerUrl(cw?.serverUrl || "https://kv-service.wuyuan.dev");
      setCwNamespace(cw?.namespace || "");
      setCwPassword(cw?.password || "");
      setCwAutoRefreshInterval(cw?.autoRefreshIntervalSec ?? 30);
      setNotificationsEnabled(cw?.notificationsEnabled ?? true);
      setSoundEnabled(cw?.soundEnabled ?? false);
      setHitokotoEnabled(cw?.hitokotoEnabled ?? true);
      setEmptySubjectDisplay(cw?.emptySubjectDisplay || "card");
      setShowQuickTools(cw?.showQuickTools ?? true);
      setAutoSave(cw?.autoSave ?? true);
      setBlockNonTodayAutoSave(cw?.blockNonTodayAutoSave ?? true);
      setBlockPastDataEdit(cw?.blockPastDataEdit ?? false);
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
          autoRefreshIntervalSec: cwAutoRefreshInterval,
          notificationsEnabled,
          soundEnabled,
          hitokotoEnabled,
          emptySubjectDisplay,
          showQuickTools,
          autoSave,
          blockNonTodayAutoSave,
          blockPastDataEdit,
        }
      });
      // Toggle immediately for better UX
      dispatch({ type: "SET_HOMEWORK_ENABLED", payload: enabled });
    });
  }, [onRegisterSave, enabled, cwServerUrl, cwNamespace, cwPassword, cwAutoRefreshInterval, notificationsEnabled, soundEnabled, hitokotoEnabled, emptySubjectDisplay, showQuickTools, autoSave, blockNonTodayAutoSave, blockPastDataEdit, dispatch]);

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
              label="Token (可选)"
              type="password"
              value={cwPassword}
              onChange={(e) => setCwPassword(e.target.value)}
              placeholder="请输入应用 Token"
            />
          </FormRow>
          <FormRow gap="sm">
            <FormInput
              label="自动刷新间隔 (秒)"
              type="number"
              value={String(cwAutoRefreshInterval)}
              onChange={(e) => setCwAutoRefreshInterval(Number(e.target.value) || 30)}
              placeholder="30"
            />
          </FormRow>
          
          <div style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "bold", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
            显示与内容设置
          </div>
          <FormRow gap="sm">
            <FormSelect
              label="空科目显示方式"
              value={emptySubjectDisplay}
              onChange={(e) => setEmptySubjectDisplay(e.target.value as "card" | "button")}
              options={[
                { value: "card", label: "卡片" },
                { value: "button", label: "按钮" }
              ]}
            />
          </FormRow>
          <FormRow>
            <FormCheckbox
              id="hitokoto-enabled"
              label="展开作业板时上方显示励志语录"
              checked={hitokotoEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHitokotoEnabled(e.target.checked)}
            />
          </FormRow>

          <div style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "bold", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
            编辑设置
          </div>
          <FormRow>
            <FormCheckbox
              id="show-quick-tools"
              label="作业编辑时显示快捷按键 (仅 PC/平板)"
              checked={showQuickTools}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowQuickTools(e.target.checked)}
            />
          </FormRow>
          <FormRow>
            <FormCheckbox
              id="auto-save"
              label="开启自动上传"
              checked={autoSave}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAutoSave(e.target.checked)}
            />
          </FormRow>
          <FormRow>
            <FormCheckbox
              id="block-non-today-autosave"
              label="禁止自动上传非当天数据 (防止意外覆盖历史数据)"
              checked={blockNonTodayAutoSave}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlockNonTodayAutoSave(e.target.checked)}
              disabled={!autoSave}
            />
          </FormRow>
          <FormRow>
            <FormCheckbox
              id="block-past-data-edit"
              label="禁止编辑过往数据"
              checked={blockPastDataEdit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlockPastDataEdit(e.target.checked)}
            />
          </FormRow>

          <div style={{ marginTop: "16px", marginBottom: "8px", fontWeight: "bold", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
            通知设置
          </div>
          <FormRow>
            <FormCheckbox
              id="notifications-enabled"
              label="允许接收同步通知"
              checked={notificationsEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotificationsEnabled(e.target.checked)}
            />
          </FormRow>
          <FormRow>
            <FormCheckbox
              id="sound-enabled"
              label="播放通知提示音 (部分设备可能需要在页面内交互后才能生效)"
              checked={soundEnabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSoundEnabled(e.target.checked)}
              disabled={!notificationsEnabled}
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
          
          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ marginBottom: "12px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>开发调试: 通知预览</div>
            <FormRow gap="sm">
              <FormButton 
                variant="secondary" 
                onClick={() => {
                  dispatch({
                    type: "ADD_NOTIFICATION",
                    payload: {
                      id: `debug-info-${Date.now()}`,
                      level: "info",
                      message: "这是一条测试的普通通知，几秒后会自动消失。",
                      senderInfo: { deviceName: "本地调试" },
                      timestamp: new Date().toISOString()
                    }
                  });
                }}
              >
                测试普通通知
              </FormButton>
              <FormButton 
                variant="secondary" 
                onClick={() => {
                  dispatch({
                    type: "ADD_NOTIFICATION",
                    payload: {
                      id: `debug-urgent-${Date.now()}`,
                      level: "urgent",
                      message: "这是一条测试的紧急通知！需要您手动确认以关闭。",
                      senderInfo: { deviceName: "本地调试", deviceType: "admin" },
                      timestamp: new Date().toISOString()
                    }
                  });
                }}
              >
                测试紧急通知
              </FormButton>
              <FormButton 
                variant="secondary" 
                onClick={async () => {
                  setDebugRawData("加载中...");
                  try {
                    const headers: Record<string, string> = cwPassword.trim() ? { "x-site-key": cwPassword.trim(), "x-app-token": cwPassword.trim(), "Accept": "application/json" } : { "Accept": "application/json" };
                    // 尝试列出命名空间中的所有键
                    let urlStr = `${cwServerUrl.trim().replace(/\/$/, "")}/kv/_keys?limit=100`;
                    const res = await fetch(urlStr, { headers });
                    if (res.ok) {
                      const data = await res.json();
                      setDebugRawData("此命名空间下的所有键名:\n" + JSON.stringify(data, null, 2));
                    } else {
                      // 尝试备用代理路径
                      urlStr = `${cwServerUrl.trim().replace(/\/$/, "")}/kv/_info`;
                      const res2 = await fetch(urlStr, { headers });
                      if (res2.ok) {
                         const data2 = await res2.json();
                         setDebugRawData("API基础信息(无/_keys支持):\n" + JSON.stringify(data2, null, 2));
                      } else {
                         setDebugRawData(`无法列出键名: ${res.status}, ${res2.status}`);
                      }
                    }
                  } catch (e: any) {
                    setDebugRawData("拉取失败: " + e.message);
                  }
                }}
              >
                列出命名空间下的所有键名
              </FormButton>

              <FormButton 
                variant="secondary" 
                onClick={async () => {
                  setDebugRawData("加载中...");
                  try {
                    const headers: Record<string, string> = cwPassword.trim() ? { "x-site-key": cwPassword.trim(), "x-app-token": cwPassword.trim(), "Accept": "application/json" } : { "Accept": "application/json" };
                    const legacyKey = "classworks-config-homework-today";
                    const legacyUrl = `${cwServerUrl.trim().replace(/\/$/, "")}/kv/${legacyKey}`;
                    const res = await fetch(legacyUrl, { headers });
                    if (res.ok) {
                      const data = await res.json();
                      setDebugRawData(`旧版数据 (${legacyKey}):\n` + JSON.stringify(data, null, 2));
                    } else {
                      setDebugRawData(`旧版数据 (${legacyKey}) 也是 ${res.status} 未找到`);
                    }
                  } catch (e: any) {
                    setDebugRawData("拉取失败: " + e.message);
                  }
                }}
              >
                拉取旧版历史数据
              </FormButton>
            </FormRow>
            {debugRawData && (
              <div style={{ marginTop: "12px", padding: "8px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", maxHeight: "300px", overflowY: "auto" }}>
                {debugRawData}
              </div>
            )}
          </div>
        </div>
      </FormSection>
    </div>
  );
};

export default HomeworkSettingsPanel;
