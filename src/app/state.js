export function createAppState() {
  return {
    mode: "auto",
    latestReportState: null
  };
}

export function setLatestReportState(state, latestReportState) {
  state.latestReportState = latestReportState;
}

export function createSelectedReportOptionKeys(items) {
  return items.map((item) => item.key);
}

export function getSelectableReportOptions(reportState) {
  if (!reportState) {
    return [];
  }

  if (reportState.kind === "uniformity-ok") {
    return reportState.candidates || [];
  }

  return [];
}

export function getSelectedReportOptions(reportState) {
  const selectableOptions = getSelectableReportOptions(reportState);
  if (selectableOptions.length === 0) {
    return [];
  }

  const selectedKeys = new Set(
    reportState.selectedOptionKeys?.length
      ? reportState.selectedOptionKeys
      : createSelectedReportOptionKeys(selectableOptions)
  );

  return selectableOptions.filter((item) => selectedKeys.has(item.key));
}

export function toggleLatestReportOptionSelection(state, optionKey, selected) {
  const reportState = state.latestReportState;
  const selectableOptions = getSelectableReportOptions(reportState);
  if (!reportState || selectableOptions.length === 0) {
    return;
  }

  const selectableKeys = selectableOptions.map((item) => item.key);
  if (!selectableKeys.includes(optionKey)) {
    return;
  }

  const nextSelectedKeys = new Set(
    reportState.selectedOptionKeys?.length
      ? reportState.selectedOptionKeys
      : createSelectedReportOptionKeys(selectableOptions)
  );

  if (selected) {
    nextSelectedKeys.add(optionKey);
  } else {
    nextSelectedKeys.delete(optionKey);
  }

  reportState.selectedOptionKeys = selectableKeys.filter((key) => nextSelectedKeys.has(key));
}

export function resetState(state) {
  state.mode = "auto";
  state.latestReportState = null;
}
