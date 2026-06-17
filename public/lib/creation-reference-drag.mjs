import { isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";

function isProductCreationReference(item = {}) {
  return isCreationSubjectReferenceRole(item.role || "product");
}

export function reorderCreationReferenceFiles(referenceFiles = [], referenceId = "", beforeReferenceId = "") {
  const normalizedReferenceId = String(referenceId || "").trim();
  if (!normalizedReferenceId) {
    return null;
  }

  const sourceIndex = referenceFiles.findIndex((item) => item.id === normalizedReferenceId);
  if (sourceIndex < 0) {
    return null;
  }

  const source = referenceFiles[sourceIndex];
  if (!isProductCreationReference(source)) {
    return null;
  }

  const next = referenceFiles.filter((item) => item.id !== normalizedReferenceId);
  let insertIndex = next.length;
  const normalizedBeforeReferenceId = String(beforeReferenceId || "").trim();
  if (normalizedBeforeReferenceId) {
    const targetIndex = next.findIndex((item) => item.id === normalizedBeforeReferenceId);
    if (targetIndex >= 0) {
      insertIndex = targetIndex;
    }
  }

  next.splice(Math.max(0, Math.min(insertIndex, next.length)), 0, source);
  return next.map((item) => item.id).join("\n") === referenceFiles.map((item) => item.id).join("\n")
    ? null
    : next;
}

function getCreationReferenceDropBeforeId(event, dragState) {
  const card = event.target?.closest?.(".creation-reference-card[data-creation-reference-card-id]");
  if (!card || card.dataset.creationReferenceCardId === dragState?.referenceId) {
    return "";
  }

  const rect = card.getBoundingClientRect();
  const insertAfter = event.clientY > rect.top + rect.height * 0.65 || event.clientX > rect.left + rect.width / 2;
  if (!insertAfter) {
    return card.dataset.creationReferenceCardId || "";
  }

  let next = card.nextElementSibling;
  while (next && !next.dataset?.creationReferenceCardId) {
    next = next.nextElementSibling;
  }
  return next?.dataset?.creationReferenceCardId || "";
}

export function bindCreationReferenceDrag({
  grid,
  getReferenceFiles,
  reorderReferenceFile,
} = {}) {
  if (!grid || typeof getReferenceFiles !== "function" || typeof reorderReferenceFile !== "function") {
    return;
  }

  let dragState = null;
  const clearDragState = () => {
    dragState = null;
    grid.classList.remove("is-dragover");
    grid
      .querySelectorAll(".creation-reference-card.is-dragging")
      .forEach((card) => card.classList.remove("is-dragging"));
  };

  grid.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-creation-reference-card-id]");
    const referenceId = card?.dataset.creationReferenceCardId || "";
    const item = getReferenceFiles().find((entry) => entry.id === referenceId);
    if (!card || !isProductCreationReference(item)) {
      event.preventDefault();
      return;
    }

    dragState = { referenceId };
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", referenceId);
  });
  grid.addEventListener("dragend", clearDragState);
  grid.addEventListener("dragover", (event) => {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    grid.classList.add("is-dragover");
  });
  grid.addEventListener("dragleave", (event) => {
    if (!grid.contains(event.relatedTarget)) {
      grid.classList.remove("is-dragover");
    }
  });
  grid.addEventListener("drop", (event) => {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    const referenceId = dragState.referenceId || event.dataTransfer.getData("text/plain");
    reorderReferenceFile(referenceId, getCreationReferenceDropBeforeId(event, dragState));
    clearDragState();
  });
}
