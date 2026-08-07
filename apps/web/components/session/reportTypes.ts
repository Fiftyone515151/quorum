export interface ReportTurn {
  id: string;
  actor: string;
  actorName: string;
  content: string;
}

export interface ReportSegment {
  code: string;
  label: string;
  turns: ReportTurn[];
}

export interface SessionReportData {
  id: string;
  companyName: string;
  stage: string;
  mode: string;
  modeLabel: string;
  createdAt: string;
  generatedAt: string;
  participants: string[];
  segments: ReportSegment[];
  result: any;
  scope: "result" | "full";
}
