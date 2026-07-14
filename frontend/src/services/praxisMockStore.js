const STORAGE_KEY = "praxis_mock_data";

const DEFAULT_DATA = {
  classes: [
    {
      id: 1,
      code: "CSC4301",
      name: "Software Engineering",
      semester: "Fall 2026",
      enrolledCount: 24,
    },
    {
      id: 2,
      code: "CSC3331",
      name: "Big Data",
      semester: "Fall 2026",
      enrolledCount: 18,
    },
  ],

  enrollments: [
    {
      id: 1,
      studentEmail: "student@aui.ma",
      classId: 1,
      classCode: "CSC4301",
    },
    {
      id: 2,
      studentEmail: "student@aui.ma",
      classId: 2,
      classCode: "CSC3331",
    },
  ],

  assignments: [
    {
      id: 1,
      title: "Critical Essay",
      instructions:
        "Write a critical analysis of AI in higher education.",
      description:
        "Write a critical analysis of AI in higher education.",
      classId: 1,
      classCode: "CSC4301",
      className: "Software Engineering",
      dueDate: "2025-07-25",
      status: "Published",
      minWords: 500,
      maxWords: 900,
      allowAI: true,
      aiFeedback: true,
      writingPlayback: true,
      submissionsCount: 2,
      createdAt: "2025-07-01",
      updatedAt: "2025-07-01",
      publishedAt: "2025-07-02",
      archived: false,
    },
    {
      id: 2,
      title: "Research Proposal",
      instructions:
        "Submit a one-page proposal for your semester project.",
      description:
        "Submit a one-page proposal for your semester project.",
      classId: 2,
      classCode: "CSC3331",
      className: "Big Data",
      dueDate: "2025-08-05",
      status: "Draft",
      minWords: 300,
      maxWords: 600,
      allowAI: true,
      aiFeedback: false,
      writingPlayback: true,
      submissionsCount: 1,
      createdAt: "2025-07-03",
      updatedAt: "2025-07-03",
      publishedAt: null,
      archived: false,
    },
  ],

  submissions: [
    {
      id: 1,
      assignmentId: 1,
      assignmentTitle: "Critical Essay",
      studentName: "Younes Lamhamedi",
      studentEmail: "younes@aui.ma",
      classCode: "CSC4301",
      submittedAt: "2025-07-20",
      status: "Submitted",
      score: null,
      feedback: "",
      reviewedAt: null,
      wordCount: 742,
      aiFlags: 2,
      content:
        "Artificial intelligence is changing the way universities approach writing, feedback, and academic integrity. This essay analyzes both the opportunities and the risks of AI-assisted learning in higher education.",
    },
    {
      id: 2,
      assignmentId: 1,
      assignmentTitle: "Critical Essay",
      studentName: "Sara El Amrani",
      studentEmail: "sara@aui.ma",
      classCode: "CSC4301",
      submittedAt: "2025-07-21",
      status: "Graded",
      score: 88,
      feedback:
        "Good analysis with clear structure and relevant examples.",
      reviewedAt: "2025-07-22",
      wordCount: 815,
      aiFlags: 0,
      content:
        "AI can support student writing when used transparently, but universities must design clear policies to protect authorship, fairness, and critical thinking.",
    },
  ],

  rubrics: [
    {
      id: 1,
      assignmentId: 1,
      assignmentTitle: "Critical Essay",
      title: "Critical Essay Rubric",
      totalPoints: 100,
      status: "Active",
      criteria: [
        {
          id: 1,
          name: "Argument Quality",
          description:
            "Clear thesis, logical reasoning, and strong argumentation.",
          points: 30,
        },
        {
          id: 2,
          name: "Evidence & Support",
          description:
            "Use of relevant examples, references, and supporting details.",
          points: 25,
        },
        {
          id: 3,
          name: "Organization",
          description:
            "Structure, paragraph flow, and coherence.",
          points: 20,
        },
        {
          id: 4,
          name: "Language & Style",
          description:
            "Grammar, clarity, tone, and academic writing quality.",
          points: 25,
        },
      ],
    },
  ],
};

export function getPraxisData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return DEFAULT_DATA;
  }

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return DEFAULT_DATA;
  }
}

export function savePraxisData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updatePraxisData(updater) {
  const currentData = getPraxisData();
  const nextData = updater(currentData);
  savePraxisData(nextData);
  return nextData;
}

export function resetPraxisData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
  return DEFAULT_DATA;
}