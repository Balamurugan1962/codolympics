import { json, route } from "@/lib/api";
import { gradingQueue } from "@/lib/phase1-review";
import { requireApiViewer } from "@/lib/session";

/** Every manually graded item, grouped by question (US-P5-02). Evaluators and admins. */
export const GET = route(async () => {
  await requireApiViewer("evaluator", "admin");
  const { groups, ungraded } = await gradingQueue();
  return json({
    ungraded,
    groups: groups.map((g) => ({
      question: { id: g.question.id, title: g.question.title, body_md: g.question.bodyMd, kind: g.question.kind, grading: g.question.grading,
                  points: g.question.points, explain_points: g.question.explainPoints, model_answer: g.question.modelAnswer },
      items: g.items.map((i) => ({
        participant_id: i.a.participantId, name: i.name, answer: i.a.answer, explanation: i.a.explanation,
        manual_score: i.a.manualScore, explain_score: i.a.explainScore, comment: i.a.gradeComment, graded_by: i.a.gradedBy,
      })),
    })),
  });
});
