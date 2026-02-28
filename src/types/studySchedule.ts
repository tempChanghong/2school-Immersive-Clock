export interface StudyPeriod {
  id: string;
  startTime: string;
  endTime: string;
  name: string;
}

export const DEFAULT_SCHEDULE: StudyPeriod[] = [
  {
    id: "default-1",
    startTime: "19:15",
    endTime: "21:30",
    name: "晚自习",
  },
];
