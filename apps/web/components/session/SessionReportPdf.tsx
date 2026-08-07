import { resolve } from "node:path";
import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SessionReportData } from "./reportTypes";

const repoRoot = process.cwd().endsWith("/apps/web") ? resolve(process.cwd(), "../..") : process.cwd();
Font.register({ family: "NotoSansSC", src: resolve(repoRoot, "apps/web/public/fonts/NotoSansSC.ttf") });

const ORANGE = "#F26522";
const ORANGE_TINT = "#FFF3EC";
const NAVY = "#262261";
const LIGHT = "#E4E3EC";
const MUTED = "#6F6B86";

const styles = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 52, paddingHorizontal: 44, fontFamily: "NotoSansSC", fontSize: 9.5, color: NAVY, lineHeight: 1.55 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 22, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: LIGHT },
  logo: { width: 105 },
  headerMeta: { marginLeft: "auto", color: MUTED, fontSize: 8 },
  title: { color: ORANGE, fontSize: 20, fontWeight: 700, marginBottom: 14, letterSpacing: 0.3 },
  subtitle: { color: MUTED, fontSize: 9.5, marginBottom: 20 },
  chips: { flexDirection: "row", marginBottom: 20 },
  chip: { backgroundColor: ORANGE_TINT, color: ORANGE, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9, marginRight: 7, fontSize: 8.5 },
  section: { marginTop: 15 },
  sectionLabel: { color: ORANGE, fontSize: 11, fontWeight: 700, letterSpacing: 1.1, marginBottom: 8 },
  participantRow: { flexDirection: "row", flexWrap: "wrap" },
  participant: { borderWidth: 1, borderColor: LIGHT, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 8, marginRight: 6, marginBottom: 6, fontSize: 8.5 },
  round: { marginTop: 17 },
  roundLabel: { color: ORANGE, backgroundColor: ORANGE_TINT, borderLeftWidth: 3, borderLeftColor: ORANGE, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 9, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 },
  turn: { marginBottom: 10, paddingHorizontal: 8 },
  founderTurn: { alignItems: "flex-end" },
  actor: { color: MUTED, fontSize: 7.5, marginBottom: 3 },
  bubble: { maxWidth: "88%", borderWidth: 1, borderColor: ORANGE, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, color: NAVY },
  orangeBubble: { backgroundColor: ORANGE, color: "#FFFFFF" },
  resultBox: { marginTop: 22, borderWidth: 2, borderColor: ORANGE, borderRadius: 12, padding: 16 },
  resultTitle: { color: ORANGE, fontSize: 13, fontWeight: 700, letterSpacing: 1.3, marginBottom: 12 },
  headlineRow: { marginBottom: 18 },
  score: { color: ORANGE, fontSize: 24, fontWeight: 700, lineHeight: 1, marginBottom: 14 },
  verdict: { color: ORANGE, fontSize: 14, fontWeight: 700, lineHeight: 1.2 },
  paragraph: { marginBottom: 7 },
  key: { color: MUTED, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  item: { borderTopWidth: 1, borderTopColor: LIGHT, paddingTop: 7, marginTop: 7 },
  footer: { position: "absolute", bottom: 23, left: 44, color: MUTED, fontSize: 7.5 },
  pageNumber: { position: "absolute", bottom: 23, right: 44, color: MUTED, fontSize: 7.5 },
});

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/⚠️?/g, "Warning:")
    .replace(/•/g, "-")
    .replace(/→/g, "->")
    .replace(/↔/g, "vs.")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .trim();
}

function ResultContent({ mode, result }: { mode: string; result: any }) {
  if (!result) return <Text>No result was recorded.</Text>;
  if (mode === "screening") return (
    <View>
      <View style={styles.headlineRow}><Text style={styles.score}>{result.score}/100</Text><Text style={styles.verdict}>{clean(result.outcome)}{result.route ? ` -> ${clean(result.route)}` : ""}</Text></View>
      <Text style={styles.paragraph}>{clean(result.reason)}</Text>
      {result.dealbreaker && <View style={styles.item}><Text style={styles.key}>Dealbreaker</Text><Text>{clean(result.dealbreaker)}</Text></View>}
      {result.dimension_scores?.map((dimension: any, index: number) => (
        <View key={index} style={styles.item}><Text style={styles.key}>{clean(dimension.dimension)} · weight {dimension.weight}%</Text><Text>{dimension.covered ? `${dimension.score}/10` : "Not covered"}</Text></View>
      ))}
      {result.crux?.length > 0 && <View style={styles.item}><Text style={styles.key}>Crux</Text>{result.crux.map((item: string, i: number) => <Text key={i}>- {clean(item)}</Text>)}</View>}
    </View>
  );
  if (mode === "ic") return (
    <View>
      <Text style={styles.verdict}>{clean(result.verdict)}</Text>
      <Text style={[styles.paragraph, { marginTop: 8 }]}>{clean(result.rationale)}</Text>
      {result.crux && <View style={styles.item}><Text style={styles.key}>Crux</Text><Text>{clean(result.crux)}</Text></View>}
      {result.conditions?.length > 0 && <View style={styles.item}><Text style={styles.key}>Conditions</Text>{result.conditions.map((item: string, i: number) => <Text key={i}>- {clean(item)}</Text>)}</View>}
      {result.dissent && <View style={styles.item}><Text style={styles.key}>Strongest dissent</Text><Text>{clean(result.dissent)}</Text></View>}
    </View>
  );
  if (mode === "board") return (
    <View>
      <Text style={styles.verdict}>Priority action list</Text>
      {result.action_list?.map((item: any, index: number) => (
        <View key={index} style={styles.item}><Text style={styles.key}>Priority {item.priority_score} · {clean(item.axis)} · severity {item.severity}</Text><Text>{clean(item.suggestion)}</Text></View>
      ))}
      {result.gaps?.length > 0 && <View style={styles.item}><Text style={styles.key}>Coverage gaps</Text><Text>{result.gaps.map(clean).join(", ")}</Text></View>}
    </View>
  );
  return (
    <View>
      <Text style={styles.verdict}>Clues, not conclusions</Text>
      {[["Surprising angles", result.surprising_angles], ["Theme map", result.theme_map], ["Open questions", result.open_questions]].map(([label, values]: any, index) => values?.length ? (
        <View key={index} style={styles.item}><Text style={styles.key}>{label}</Text>{values.map((item: string, i: number) => <Text key={i}>- {clean(item)}</Text>)}</View>
      ) : null)}
      {result.unresolved_disagreements?.length > 0 && <View style={styles.item}><Text style={styles.key}>Unresolved disagreements</Text>{result.unresolved_disagreements.map((item: any, i: number) => <Text key={i}>- {clean(item.point)}: {(item.sides ?? []).map(clean).join(" vs. ")}</Text>)}</View>}
    </View>
  );
}

export default function SessionReportPdf({ report }: { report: SessionReportData }) {
  const logo = resolve(repoRoot, "apps/web/public/brand/lockup.png");
  const sessionDate = new Date(report.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const generatedDate = new Date(report.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return (
    <Document title={`${report.companyName} - ${report.modeLabel}`} author="Quorum" subject="AI investor panel session report">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}><Image src={logo} style={styles.logo} /><Text style={styles.headerMeta}>FORMATTED SESSION REPORT</Text></View>
        <Text style={styles.title}>{clean(report.companyName)}</Text>
        <Text style={styles.subtitle}>{report.modeLabel} · Session date {sessionDate} UTC</Text>
        <View style={styles.chips}><Text style={styles.chip}>{clean(report.stage)}</Text><Text style={styles.chip}>{report.scope === "full" ? "Conversation + result" : "Result only"}</Text></View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionLabel}>PANEL</Text>
          <View style={styles.participantRow}>{report.participants.map((name) => <Text key={name} style={styles.participant}>{clean(name)}</Text>)}</View>
        </View>

        {report.scope === "full" && report.segments.map((segment) => segment.turns.length ? (
          <View key={segment.code} style={styles.round}>
            <Text style={styles.roundLabel}>{clean(segment.label).toUpperCase()}</Text>
            {segment.turns.map((turn) => {
              const founder = turn.actor === "founder";
              const orange = founder || turn.actor === "host";
              return (
                <View key={turn.id} style={[styles.turn, founder ? styles.founderTurn : {}]} wrap={false}>
                  <Text style={styles.actor}>{clean(turn.actorName)}</Text>
                  <View style={[styles.bubble, orange ? styles.orangeBubble : {}]}><Text>{clean(turn.content)}</Text></View>
                </View>
              );
            })}
          </View>
        ) : null)}

        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>RESULT</Text>
          <ResultContent mode={report.mode} result={report.result} />
        </View>

        <Text style={styles.footer} fixed>Generated by Quorum · {generatedDate} UTC</Text>
        <Text style={styles.pageNumber} fixed render={({ pageNumber }) => `Page ${pageNumber}`} />
      </Page>
    </Document>
  );
}
