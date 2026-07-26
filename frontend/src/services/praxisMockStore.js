const STORAGE_KEY = "praxis_mock_data";
const DATA_VERSION = 2;
let memoryData = null;

const DEFAULT_DATA = {
  version: DATA_VERSION,

  users: [],
  classes: [],
  enrollments: [],
  assignments: [],
  submissions: [],
  rubrics: [],

  notifications: [],
  messages: [],
  bugReports: [],

  adminStudentFlags: {},
  processAnalyses: [],
  researchWithdrawalLog: [],
  adminProcessAnalysisRun: null,
};

function createFreshData() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizePraxisData(data) {
  const parsedData = isPlainObject(data) ? data : {};

  return {
    ...createFreshData(),
    ...parsedData,

    version: DATA_VERSION,

    users: Array.isArray(parsedData.users)
      ? parsedData.users
      : [],

    classes: Array.isArray(parsedData.classes)
      ? parsedData.classes
      : [],

    enrollments: Array.isArray(parsedData.enrollments)
      ? parsedData.enrollments
      : [],

    assignments: Array.isArray(parsedData.assignments)
      ? parsedData.assignments
      : [],

    submissions: Array.isArray(parsedData.submissions)
      ? parsedData.submissions
      : [],

    rubrics: Array.isArray(parsedData.rubrics)
      ? parsedData.rubrics
      : [],

    notifications: Array.isArray(parsedData.notifications)
      ? parsedData.notifications
      : [],

    messages: Array.isArray(parsedData.messages)
      ? parsedData.messages
      : [],

    bugReports: Array.isArray(parsedData.bugReports)
      ? parsedData.bugReports
      : [],

    processAnalyses: Array.isArray(parsedData.processAnalyses)
      ? parsedData.processAnalyses
      : [],

    researchWithdrawalLog: Array.isArray(
      parsedData.researchWithdrawalLog
    )
      ? parsedData.researchWithdrawalLog
      : [],

    adminStudentFlags: isPlainObject(
      parsedData.adminStudentFlags
    )
      ? parsedData.adminStudentFlags
      : {},

    adminProcessAnalysisRun: isPlainObject(
      parsedData.adminProcessAnalysisRun
    )
      ? parsedData.adminProcessAnalysisRun
      : null,
  };
}

function notifyPraxisDataChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("praxis-data-changed")
  );
}

function writePraxisData(data) {
  memoryData = data;
  return data;
}

export function getPraxisData() {
  if (typeof window === "undefined") {
    return createFreshData();
  }

  if (!memoryData) {
    const freshData = createFreshData();
    writePraxisData(freshData);
    return freshData;
  }

  try {
    const parsedData = memoryData;

    /*
     * The previous mock store had no version and contained seeded
     * courses, assignments, submissions, and rubrics.
     *
     * When this version is loaded for the first time, any older
     * saved mock data is replaced with a clean empty workspace.
     */
    if (parsedData?.version !== DATA_VERSION) {
      const freshData = createFreshData();
      writePraxisData(freshData);
      notifyPraxisDataChanged();
      return freshData;
    }

    const normalizedData = normalizePraxisData(parsedData);

    /*
     * Save normalized data so newly introduced collections are
     * added without deleting valid data created with this version.
     */
    writePraxisData(normalizedData);

    return normalizedData;
  } catch (error) {
    console.error(
      "Could not read Praxis mock data. Resetting the store.",
      error
    );

    const freshData = createFreshData();
    writePraxisData(freshData);
    notifyPraxisDataChanged();

    return freshData;
  }
}

export function savePraxisData(data) {
  const normalizedData = normalizePraxisData(data);

  writePraxisData(normalizedData);
  notifyPraxisDataChanged();

  return normalizedData;
}

export function updatePraxisData(updater) {
  if (typeof updater !== "function") {
    throw new TypeError(
      "updatePraxisData expects an updater function."
    );
  }

  const currentData = getPraxisData();
  const nextData = updater(currentData);

  if (!isPlainObject(nextData)) {
    throw new TypeError(
      "The Praxis data updater must return an object."
    );
  }

  return savePraxisData(nextData);
}

export function resetPraxisData() {
  const freshData = createFreshData();

  writePraxisData(freshData);
  notifyPraxisDataChanged();

  return freshData;
}

export function clearPraxisData() {
  const freshData = createFreshData();

  writePraxisData(freshData);
  notifyPraxisDataChanged();

  return freshData;
}

export {
  STORAGE_KEY,
  DATA_VERSION,
  DEFAULT_DATA,
};
