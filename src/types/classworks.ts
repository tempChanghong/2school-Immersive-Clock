export interface HomeworkItem {
  key: string;
  name: string;
  type: "normal" | "exam" | "attendance" | "hitokoto" | "custom" | string;
  content: string;
  order: number;
  data?: any; // Used for complex types like attendance/exam in original, keeping it just in case
}

export interface HomeworkResponse {
  [key: string]: any;
}
