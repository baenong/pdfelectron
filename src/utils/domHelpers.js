export const hideElement = (elem) => elem.classList.add("hide");
export const showElement = (elem) => elem.classList.remove("hide");
export const toggleHide = (elem) => elem.classList.toggle("hide");

export const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export function activeUndoButtons() {
  const undoBtn = document.getElementById("undo-btn");
  const undoBtnIcon = document.getElementById("undo-btn-icon");

  undoBtn.classList.remove("disabled");
  undoBtnIcon.classList.remove("disabled");
}

export function deactiveUndoButtons() {
  const undoBtn = document.getElementById("undo-btn");
  const undoBtnIcon = document.getElementById("undo-btn-icon");

  undoBtn.classList.add("disabled");
  undoBtnIcon.classList.add("disabled");
}

export function activeRedoButtons() {
  const redoBtn = document.getElementById("redo-btn");
  const redoBtnIcon = document.getElementById("redo-btn-icon");

  redoBtn.classList.remove("disabled");
  redoBtnIcon.classList.remove("disabled");
}

export function deactiveRedoButtons() {
  const redoBtn = document.getElementById("redo-btn");
  const redoBtnIcon = document.getElementById("redo-btn-icon");

  redoBtn.classList.add("disabled");
  redoBtnIcon.classList.add("disabled");
}
