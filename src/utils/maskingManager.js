import { getCurrentPageNum, getNumPages } from "./pdfViewer.js";
import {
  activeRedoButtons,
  activeUndoButtons,
  deactiveRedoButtons,
  deactiveUndoButtons,
} from "./domHelpers.js";

const MASK_OFFSET_X = 5;
const MASK_OFFSET_Y = 5;
const MASK_PADDING_WIDTH = 10;
const MASK_PADDING_HEIGHT = 15;

const MaskActionType = {
  ADD: "ADD_MASK",
  DELETE: "DELETE_MASK",
  CLEAR_PAGE: "CLEAR_PAGE_MASKS",
  CLEAR_OCR: "CLEAR_OCR_MASKS",
  CLEAR_ALL: "CLEAR_ALL_MASKS",
  GROUP: "TASK_GROUP",
};

let maskingCanvas = null;
let maskingCtx = null;

let Undos = [];
let Redos = [];
let currentTask = [];

const MAX_STACK_SIZE = 50;

let maskingCount = 0;
let taskCount = 0;

// x, y, width, height, color, id
let currentPageMasks = {};

export function initializeMaskingCanvas() {
  maskingCanvas = document.getElementById("masking-canvas");
  if (maskingCanvas) {
    maskingCtx = maskingCanvas.getContext("2d");
  } else {
    console.error("Masking Canvas가 존재하지 않습니다");
  }
}

export function syncMaskingCanvasSize(
  canvasWidth,
  canvasHeight,
  cssWidth,
  cssHeight
) {
  if (maskingCanvas) {
    maskingCanvas.width = canvasWidth;
    maskingCanvas.height = canvasHeight;
    maskingCanvas.style.width = cssWidth;
    maskingCanvas.style.height = cssHeight;
  }
}

function drawMask(maskInfo) {
  if (!maskingCtx) {
    console.error("Context가 준비되지 않았습니다.");
    return;
  }

  const drawX = maskInfo.x - MASK_OFFSET_X;
  const drawY = maskInfo.y - MASK_OFFSET_Y;
  const drawWidth = maskInfo.width + MASK_PADDING_WIDTH;
  const drawHeight = maskInfo.height + MASK_PADDING_HEIGHT;

  let maskColor = "";

  if (maskInfo.isBlur) {
    // 블러 범위 표시
    maskingCtx.beginPath();
    maskingCtx.rect(drawX, drawY, drawWidth, drawHeight);
    maskingCtx.lineWidth = 3;
    maskingCtx.strokeStyle = "blue";
    maskingCtx.stroke();
  } else {
    if (maskInfo.color) {
      const { r, g, b } = maskInfo.color;
      maskColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
    } else {
      maskColor = "rgba(0, 0, 255, 0.5)";
    }

    maskingCtx.fillStyle = maskColor;
    maskingCtx.fillRect(drawX, drawY, drawWidth, drawHeight);
  }
}

export function redrawPageMasks(pageNum) {
  clearMaskingCanvas(); // 캔버스 지우기

  // if (currentPageMasks === undefined) return;
  if (!currentPageMasks[pageNum]) currentPageMasks[pageNum] = [];
  const masks = currentPageMasks[pageNum];

  if (masks && masks.length > 0) {
    masks.forEach((mask) => {
      drawMask(mask);
    });
  }
}

export function addMask(pageNum, maskInfo) {
  if (!currentPageMasks[pageNum]) currentPageMasks[pageNum] = [];

  taskCount++;

  const { r, g, b } = hexToRgb(
    document.getElementById("pick-mask-color").value
  );
  maskInfo.color = { r, g, b };
  maskInfo.isBlur = document.getElementById("isblur").checked;

  maskInfo.id =
    maskInfo.id ||
    `mask-${pageNum}-${maskingCount}-${taskCount}-${maskInfo.kind}`;
  currentPageMasks[pageNum].push(maskInfo);

  currentTask.push({
    type: MaskActionType.ADD,
    payload: { pageNum, mask: deepCopy(maskInfo) },
    id: maskInfo.id,
  });
}

export function clearMaskingCanvas() {
  if (maskingCanvas) {
    maskingCtx.clearRect(0, 0, maskingCanvas.width, maskingCanvas.height);
  }
}

export function clearAllMasks() {
  if (Object.keys(currentPageMasks).length > 0) {
    const allMasks = deepCopy(currentPageMasks);

    currentPageMasks = {};

    currentTask.push({
      type: MaskActionType.CLEAR_ALL,
      payload: { masks: allMasks },
      ids: [],
    });
  }
}

export function clearPageMasks(pageNum) {
  if (currentPageMasks[pageNum] && currentPageMasks[pageNum].length > 0) {
    const clearedMasks = deepCopy(currentPageMasks[pageNum]);
    currentPageMasks[pageNum] = [];

    currentTask.push({
      type: MaskActionType.CLEAR_PAGE,
      payload: { pageNum, masks: clearedMasks },
      ids: clearedMasks.map((m) => m.id),
    });
  }
}

export function clearAllOcrMasks() {
  const numPages = getNumPages();

  for (let i = 0; i < numPages; i++) {
    clearOcrMasks(i + 1);
  }
}

export function clearOcrMasks(pageNum) {
  if (!currentPageMasks[pageNum]) return;

  const masks = [...currentPageMasks[pageNum]];
  const numMasks = masks.length;
  if (numMasks === 0) return;

  const notOcrs = masks.filter((mask) => {
    return detectOcrFromId(mask.id) !== "ocr";
  });

  const deletedOcrMasks = masks.filter((mask) => !notOcrs.includes(mask));

  if (deletedOcrMasks.length > 0) {
    // currentPageMasks[pageNum] = [...notOcrs];
    currentPageMasks[pageNum] = notOcrs;

    currentTask.push({
      type: MaskActionType.CLEAR_OCR,
      payload: { pageNum, masks: deepCopy(deletedOcrMasks) },
      ids: deletedOcrMasks.map((m) => m.id),
    });
  }
}

export function clearAllStoredMasks() {
  currentPageMasks = {};
  Undos = [];
  Redos = [];
  clearMaskingCanvas(); // 캔버스도 지웁니다.
  deactiveUndoButtons();
  deactiveRedoButtons();
}

export function getPageMasks(pageNum) {
  return currentPageMasks[pageNum] || [];
}

export function endTask() {
  if (currentTask.length > 0) {
    Undos.push({
      type: MaskActionType.GROUP,
      actions: currentTask,
    });

    Redos = [];
    currentTask = [];
    taskCount = 0;

    activeUndoButtons();
    deactiveRedoButtons();
  }
  redrawPageMasks(getCurrentPageNum());
}

export function Undo() {
  const lastTask = Undos.pop();
  if (!lastTask) return;

  Redos.push(lastTask);
  const actions = lastTask.actions || [lastTask];
  const reversed = [...actions].reverse();

  for (const action of reversed) {
    const payload = action.payload;
    const pageNum = payload.pageNum;

    switch (action.type) {
      case MaskActionType.ADD:
        if (currentPageMasks[pageNum]) {
          currentPageMasks[pageNum] = currentPageMasks[pageNum].filter(
            (mask) => mask.id !== action.id
          );
        }
        break;

      case MaskActionType.DELETE:
        if (!currentPageMasks[pageNum]) {
          currentPageMasks[pageNum] = [];
        }
        currentPageMasks[pageNum].push(...payload.masks);
        break;

      case MaskActionType.CLEAR_PAGE:
        currentPageMasks[pageNum] = payload.masks;
        break;

      case MaskActionType.CLEAR_ALL:
        currentPageMasks = payload.masks;
        break;

      case MaskActionType.CLEAR_OCR:
        if (!currentPageMasks[pageNum]) {
          currentPageMasks[pageNum] = [];
        }
        currentPageMasks[pageNum].push(...payload.masks);
        break;

      default:
        break;
    }
  }

  if (Undos.length === 0) deactiveUndoButtons();
  activeRedoButtons();

  redrawPageMasks(getCurrentPageNum());
}

export function Redo() {
  const recentTask = Redos.pop();
  if (!recentTask) return;

  Undos.push(recentTask);

  const actions = recentTask.actions || [recentTask];

  for (const action of actions) {
    const payload = action.payload;
    const pageNum = payload.pageNum;

    switch (action.type) {
      case MaskActionType.ADD:
        if (!currentPageMasks[pageNum]) {
          currentPageMasks[pageNum] = [];
        }
        currentPageMasks[pageNum].push(payload.mask);
        break;

      case MaskActionType.DELETE:
        if (currentPageMasks[pageNum]) {
          currentPageMasks[pageNum] = currentPageMasks[pageNum].filter(
            (mask) => !action.ids.includes(mask.id)
          );
        }
        break;

      case MaskActionType.CLEAR_PAGE:
        currentPageMasks[pageNum] = [];
        break;

      case MaskActionType.CLEAR_ALL:
        currentPageMasks = {};
        break;

      case MaskActionType.CLEAR_OCR:
        if (currentPageMasks[pageNum]) {
          currentPageMasks[pageNum] = currentPageMasks[pageNum].filter(
            (mask) => {
              return detectOcrFromId(mask.id) !== "ocr";
            }
          );
        }
        break;

      default:
        break;
    }
  }

  if (Redos.length === 0) deactiveRedoButtons();
  activeUndoButtons();

  redrawPageMasks(getCurrentPageNum());
}

export function deleteMaskInBox(pageNum, boxInfo) {
  if (!currentPageMasks[pageNum]) return;

  const masks = [...currentPageMasks[pageNum]];
  const numMasks = masks.length;
  if (numMasks === 0) return;

  const endBoxX = boxInfo.x + boxInfo.width;
  const endBoxY = boxInfo.y + boxInfo.height;

  const outOfRange = masks.filter((mask) => {
    const endMaskX = mask.x + mask.width;
    const endMaskY = mask.y + mask.height;

    return !(
      boxInfo.x <= mask.x &&
      boxInfo.y <= mask.y &&
      endBoxX >= endMaskX &&
      endBoxY >= endMaskY
    );
  });

  const deletedMasks = masks.filter((mask) => !outOfRange.includes(mask));

  if (deletedMasks.length > 0) {
    // currentPageMasks[pageNum] = [...outOfRange];
    currentPageMasks[pageNum] = outOfRange;

    currentTask.push({
      type: MaskActionType.DELETE,
      payload: { pageNum, masks: deepCopy(deletedMasks) },
      ids: deletedMasks.map((m) => m.id),
    });
  }
}

export function incMaskingCount() {
  maskingCount++;
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function detectOcrFromId(id) {
  const indexSlice = String(id).lastIndexOf("-");
  return id.slice(indexSlice + 1);
}

function hexToRgb(hex) {
  let cleanHex = hex.startsWith("#") ? hex.slice(1) : hex;

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (cleanHex.length !== 6) {
    console.error("색깔 HEX 코드가 아닙니다.");
    return { r: 0, g: 0, b: 0 };
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return { r, g, b };
}
