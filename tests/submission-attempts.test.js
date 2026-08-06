const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const {
  buildSubmissionAttempts,
  buildSubmissionAttemptList,
} = require('../submission-attempts');

describe('durable submission attempts', () => {
  const submission = {
    id: 'submission-1',
    assignment_id: 'assignment-1',
    student_id: 'student-1',
    status: 'submitted',
    final_text: 'Revised answer',
    version: 12,
  };

  test('keeps an ordinary first submission as Attempt 1', () => {
    const attempts = buildSubmissionAttempts(submission, [
      {
        submission_id: 'submission-1',
        revision_number: 4,
        change_type: 'submitted',
        snapshot: { ...submission, final_text: 'First answer', version: 4 },
      },
    ]);

    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].id, 'submission-1');
    assert.equal(attempts[0].attempt_number, 1);
    assert.equal(attempts[0].previous_submission_id, null);
    assert.equal(attempts[0].is_current, true);
  });

  test('restores immutable Attempt 1 and marks a resubmission Attempt 2', () => {
    const attempts = buildSubmissionAttempts(submission, [
      {
        submission_id: 'submission-1',
        revision_number: 4,
        change_type: 'submitted',
        snapshot: { ...submission, status: 'submitted', final_text: 'First answer', version: 4 },
      },
      {
        submission_id: 'submission-1',
        revision_number: 6,
        change_type: 'reviewed',
        snapshot: {
          ...submission,
          status: 'graded',
          final_text: 'First answer',
          teacher_review: { status: 'graded', finalScore: 16 },
          version: 6,
        },
      },
      {
        submission_id: 'submission-1',
        revision_number: 11,
        change_type: 'autosaved',
        snapshot: { ...submission, status: 'reopened', final_text: 'Revised answer', version: 11 },
      },
      {
        submission_id: 'submission-1',
        revision_number: 12,
        change_type: 'submitted',
        snapshot: submission,
      },
    ]);

    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].id, 'submission-1:attempt:1');
    assert.equal(attempts[0].attempt_number, 1);
    assert.equal(attempts[0].is_current, false);
    assert.equal(attempts[0].final_text, 'First answer');
    assert.equal(attempts[0].teacher_review.finalScore, 16);
    assert.equal(attempts[0].detail_loaded, true);
    assert.equal(attempts[1].id, 'submission-1');
    assert.equal(attempts[1].attempt_number, 2);
    assert.equal(attempts[1].previous_submission_id, 'submission-1:attempt:1');
    assert.equal(attempts[1].is_current, true);
    assert.equal(attempts[1].final_text, 'Revised answer');
  });

  test('shows a reopened revision immediately as clean Attempt 2', () => {
    const reopened = {
      ...submission,
      status: 'reopened',
      version: 8,
      teacher_review: { status: 'reopened', finalScore: '', annotations: [] },
    };
    const attempts = buildSubmissionAttempts(reopened, [
      {
        submission_id: 'submission-1',
        revision_number: 4,
        change_type: 'submitted',
        snapshot: { ...submission, status: 'submitted', final_text: 'First answer', version: 4 },
      },
      {
        submission_id: 'submission-1',
        revision_number: 6,
        change_type: 'reviewed',
        snapshot: {
          ...submission,
          status: 'graded',
          final_text: 'First answer',
          teacher_review: { status: 'graded', finalScore: 16, annotations: [{ id: 'old-note' }] },
          version: 6,
        },
      },
      {
        submission_id: 'submission-1',
        revision_number: 8,
        change_type: 'reviewed',
        snapshot: reopened,
      },
    ]);

    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].attempt_number, 1);
    assert.equal(attempts[0].teacher_review.finalScore, 16);
    assert.equal(attempts[0].teacher_review.annotations.length, 1);
    assert.equal(attempts[0].is_current, false);
    assert.equal(attempts[1].attempt_number, 2);
    assert.equal(attempts[1].status, 'reopened');
    assert.equal(attempts[1].teacher_review.finalScore, '');
    assert.equal(attempts[1].teacher_review.annotations.length, 0);
    assert.equal(attempts[1].is_current, true);
  });

  test('expands attempts independently for every student submission', () => {
    const list = buildSubmissionAttemptList(
      [submission, { ...submission, id: 'submission-2', student_id: 'student-2' }],
      []
    );
    assert.deepEqual(list.map((entry) => entry.attempt_number), [1, 1]);
  });
});
