function buildSubmissionAttempts(submission = {}, revisions = []) {
  if (!submission?.id) return [];

  const orderedRevisions = revisions
    .filter(
      (revision) =>
        revision?.submission_id === submission.id &&
        revision.snapshot &&
        typeof revision.snapshot === "object"
    )
    .sort(
      (a, b) =>
        Number(a.revision_number || 0) - Number(b.revision_number || 0)
    );
  const submittedRevisions = orderedRevisions.filter(
    (revision) => String(revision.change_type || "").toLowerCase() === "submitted"
  );

  const isReopened = String(submission.status || "").toLowerCase() === "reopened";
  if (isReopened && submittedRevisions.length > 0) {
    const historicalAttempts = submittedRevisions.map((revision, index) => {
      const nextRevisionNumber = Number(
        submittedRevisions[index + 1]?.revision_number || Number.MAX_SAFE_INTEGER
      );
      const gradedSnapshot = orderedRevisions
        .filter((candidate) =>
          Number(candidate.revision_number || 0) > Number(revision.revision_number || 0) &&
          Number(candidate.revision_number || 0) < nextRevisionNumber &&
          String(candidate.snapshot?.status || "").toLowerCase() === "graded"
        )
        .at(-1)?.snapshot;
      const snapshot = gradedSnapshot || revision.snapshot;
      return {
        ...snapshot,
        id: `${submission.id}:attempt:${index + 1}`,
        source_submission_id: submission.id,
        source_revision_number: Number(revision.revision_number || 0),
        attempt_number: index + 1,
        previous_submission_id:
          index > 0 ? `${submission.id}:attempt:${index}` : null,
        is_current: false,
        detail_loaded: true,
        profiles: submission.profiles || snapshot.profiles || null,
      };
    });
    const attemptNumber = submittedRevisions.length + 1;
    return [
      ...historicalAttempts,
      {
        ...submission,
        attempt_number: attemptNumber,
        previous_submission_id: `${submission.id}:attempt:${attemptNumber - 1}`,
        source_submission_id: submission.id,
        is_current: true,
      },
    ];
  }

  if (submittedRevisions.length <= 1) {
    return [{
      ...submission,
      attempt_number: 1,
      previous_submission_id: null,
      is_current: true,
    }];
  }

  const historicalAttempts = submittedRevisions.slice(0, -1).map((revision, index) => {
    const nextSubmittedRevision = submittedRevisions[index + 1];
    const gradedSnapshot = orderedRevisions
      .filter((candidate) =>
        Number(candidate.revision_number || 0) > Number(revision.revision_number || 0) &&
        Number(candidate.revision_number || 0) < Number(nextSubmittedRevision.revision_number || 0) &&
        String(candidate.snapshot?.status || "").toLowerCase() === "graded"
      )
      .at(-1)?.snapshot;
    const snapshot = gradedSnapshot || revision.snapshot;
    return {
    ...snapshot,
    id: `${submission.id}:attempt:${index + 1}`,
    source_submission_id: submission.id,
    source_revision_number: Number(revision.revision_number || 0),
    attempt_number: index + 1,
    previous_submission_id:
      index > 0 ? `${submission.id}:attempt:${index}` : null,
    is_current: false,
    detail_loaded: true,
    profiles: submission.profiles || snapshot.profiles || null,
  };
  });

  const currentAttemptNumber = submittedRevisions.length;
  return [
    ...historicalAttempts,
    {
      ...submission,
      attempt_number: currentAttemptNumber,
      previous_submission_id: `${submission.id}:attempt:${currentAttemptNumber - 1}`,
      source_submission_id: submission.id,
      source_revision_number: Number(submittedRevisions.at(-1)?.revision_number || 0),
      is_current: true,
    },
  ];
}

function buildSubmissionAttemptList(submissions = [], revisions = []) {
  return submissions.flatMap((submission) =>
    buildSubmissionAttempts(submission, revisions)
  );
}

module.exports = {
  buildSubmissionAttempts,
  buildSubmissionAttemptList,
};
