import { DEFAULT_CRITERIA } from "./constants";

export function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function roundToHalf(value) {
  return Math.round(Number(value || 0) * 2) / 2;
}

export function getText(value) {
  return String(value || "").trim();
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeRubricTone(label = "", score = 0, maxScore = 0) {
  const lower = String(label || "").toLowerCase();
  const ratio = maxScore > 0 ? Number(score || 0) / maxScore : 0;

  if (lower.includes("excellent") || ratio >= 0.95) return "excellent";
  if (lower.includes("good") || ratio >= 0.8) return "good";
  if (lower.includes("satisfactory") || ratio >= 0.65) return "satisfactory";

  if (
    lower.includes("needs") ||
    lower.includes("improvement") ||
    ratio >= 0.5
  ) {
    return "needs-improvement";
  }

  return "unsatisfactory";
}

export function getRubricToneClasses(tone = "satisfactory") {
  const styles = {
    excellent: {
      cell: "bg-emerald-50 border-emerald-200 text-emerald-950 hover:bg-emerald-100",
      header: "bg-emerald-600 text-white border-emerald-700",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    good: {
      cell: "bg-blue-50 border-blue-200 text-blue-950 hover:bg-blue-100",
      header: "bg-blue-600 text-white border-blue-700",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
    },
    satisfactory: {
      cell: "bg-amber-50 border-amber-200 text-amber-950 hover:bg-amber-100",
      header: "bg-amber-500 text-white border-amber-600",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
    },
    "needs-improvement": {
      cell: "bg-orange-50 border-orange-200 text-orange-950 hover:bg-orange-100",
      header: "bg-orange-500 text-white border-orange-600",
      badge: "bg-orange-100 text-orange-800 border-orange-200",
    },
    unsatisfactory: {
      cell: "bg-rose-50 border-rose-200 text-rose-950 hover:bg-rose-100",
      header: "bg-rose-600 text-white border-rose-700",
      badge: "bg-rose-100 text-rose-800 border-rose-200",
    },
  };

  return styles[tone] || styles.satisfactory;
}

export function buildBands(points = 0) {
  const max = Number(points || 0);

  return [
    {
      id: "excellent",
      label: "Excellent",
      points: roundToHalf(max),
      score: roundToHalf(max),
      description: "Fully meets or exceeds the expectations for this criterion.",
      tone: "excellent",
    },
    {
      id: "good",
      label: "Good",
      points: roundToHalf(max * 0.85),
      score: roundToHalf(max * 0.85),
      description: "Meets the criterion well with minor gaps or weaknesses.",
      tone: "good",
    },
    {
      id: "satisfactory",
      label: "Satisfactory",
      points: roundToHalf(max * 0.7),
      score: roundToHalf(max * 0.7),
      description: "Meets the basic expectations but needs more development.",
      tone: "satisfactory",
    },
    {
      id: "needs-work",
      label: "Needs Improvement",
      points: roundToHalf(max * 0.5),
      score: roundToHalf(max * 0.5),
      description: "Partially meets the criterion and needs important revision.",
      tone: "needs-improvement",
    },
    {
      id: "beginning",
      label: "Unsatisfactory",
      points: roundToHalf(max * 0.3),
      score: roundToHalf(max * 0.3),
      description: "Shows limited progress toward the criterion.",
      tone: "unsatisfactory",
    },
  ];
}

export function normalizeRubricBand(
  band = {},
  index = 0,
  maxScore = 0,
  criterionId = "criterion"
) {
  const label = band.label || band.name || `Level ${index + 1}`;

  const points = Number(
    band.points ??
      band.score ??
      band.value ??
      0
  );

  const tone =
    band.tone ||
    normalizeRubricTone(label, points, maxScore);

  return {
    id: band.id || `${criterionId}_band_${index + 1}`,
    label,
    points,
    score: points,
    description: band.description || band.details || "",
    tone,
  };
}

export function normalizeCriterion(criterion = {}, index = 0) {
  const incomingBands = Array.isArray(criterion?.bands)
    ? criterion.bands
    : Array.isArray(criterion?.levels)
    ? criterion.levels
    : [];

  const points = Number(
    criterion?.points ??
      criterion?.maxScore ??
      Math.max(
        ...incomingBands.map((band) =>
          Number(band?.points ?? band?.score ?? 0)
        ),
        0
      )
  );

  const id = criterion?.id || createId("criterion");

  const bands =
    incomingBands.length > 0
      ? incomingBands
          .map((band, bandIndex) =>
            normalizeRubricBand(band, bandIndex, points, id)
          )
          .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
      : buildBands(points);

  return {
    id,
    name: criterion?.name || criterion?.title || `Criterion ${index + 1}`,
    description: criterion?.description || criterion?.details || "",
    minScore:
      criterion?.minScore ??
      Math.min(...bands.map((band) => Number(band.points || 0)), points),
    maxScore: criterion?.maxScore ?? points,
    points,
    levels: bands.map((band) => ({
      id: band.id,
      label: band.label,
      score: band.points,
      points: band.points,
      description: band.description,
      tone: band.tone,
    })),
    bands,
  };
}

export function createStarterCriteria() {
  return DEFAULT_CRITERIA.map((criterion, index) =>
    normalizeCriterion(
      {
        ...criterion,
        id: createId("criterion"),
      },
      index
    )
  );
}

export function calculateTotal(criteria = []) {
  return criteria.reduce(
    (sum, criterion) => sum + Number(criterion.points || 0),
    0
  );
}

export function fitCriteriaToTotal(criteria = [], requestedTotal = 20) {
  const normalized = safeArray(criteria).map(normalizeCriterion);
  const target = Math.max(1, Math.floor(Number(requestedTotal) || 20));
  if (!normalized.length) return normalized;

  const currentTotal = calculateTotal(normalized);
  const rawPoints = normalized.map((criterion) =>
    currentTotal > 0
      ? (Number(criterion.points || 0) / currentTotal) * target
      : target / normalized.length
  );
  const assignedPoints = rawPoints.map(Math.floor);
  let remainder = target - assignedPoints.reduce((sum, points) => sum + points, 0);

  rawPoints
    .map((points, index) => ({ index, fraction: points - Math.floor(points) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remainder > 0) {
        assignedPoints[index] += 1;
        remainder -= 1;
      }
    });

  return normalized.map((criterion, index) => {
    const oldMaximum = Number(criterion.points || 0);
    const points = assignedPoints[index];
    const bands = safeArray(criterion.bands).map((band) => {
      const ratio = oldMaximum > 0 ? Number(band.points || 0) / oldMaximum : 0;
      const bandPoints = Math.min(points, roundToHalf(points * ratio));
      return { ...band, points: bandPoints, score: bandPoints };
    });

    return normalizeCriterion({ ...criterion, points, maxScore: points, bands }, index);
  });
}

export function parseRubricText(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const possibleCriteria = lines
    .filter((line) => line.length > 8)
    .slice(0, 8)
    .map((line, index) => {
      const pointMatch = line.match(/(\d+(?:\.\d+)?)\s*(pts?|points?)/i);
      const points = pointMatch ? Number(pointMatch[1]) : 20;

      const cleanedLine = line
        .replace(/(\d+(?:\.\d+)?)\s*(pts?|points?)/i, "")
        .replace(/^[-•*\d.)\s]+/, "")
        .trim();

      const [namePart, ...descriptionParts] = cleanedLine.split(/[:\-–]/);

      const name = namePart?.trim() || `Criterion ${index + 1}`;

      const description =
        descriptionParts.join(" ").trim() ||
        "Review this criterion and adjust the description before saving.";

      return normalizeCriterion(
        {
          id: createId("criterion"),
          name,
          description,
          points,
        },
        index
      );
    });

  return possibleCriteria.length > 0
    ? possibleCriteria
    : createStarterCriteria();
}
