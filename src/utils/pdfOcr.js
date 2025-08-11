const { createWorker } = Tesseract;
import {
  addMask,
  clearAllOcrMasks,
  clearOcrMasks,
  endTask,
  incMaskingCount,
} from "./maskingManager.js";
import { INITIAL_RENDER_SCALE, getPageText, getPdfDoc } from "./pdfViewer.js";
import { getAll } from "./regexManager.js";

let worker = null;
let cntPrivacy = 0;
let isAlwaysOcr = false;

function getWorkingElements() {
  const modal = document.getElementById("working-modal");
  const ocrProgress = document.getElementById("ocr-progress-bar");
  const ocrProgressText = document.getElementById("ocr-progress-text");
  return { modal, ocrProgress, ocrProgressText };
}

export function displayWorkingModal() {
  const { modal, ocrProgress, ocrProgressText } = getWorkingElements();
  if (modal.classList.contains("hide")) modal.classList.remove("hide");
  else return;

  cntPrivacy = 0;
  ocrProgress.style.width = "0%";
  ocrProgressText.innerText = "OCR 준비 중...";
}

export function hideWorkingModal() {
  const { modal, ocrProgress, ocrProgressText } = getWorkingElements();

  ocrProgress.style.width = "100%";
  ocrProgressText.innerText = `${cntPrivacy} 건 마스킹 처리완료!`;

  setTimeout(() => {
    modal.classList.add("hide");
  }, 1000);
}

export function setIsAlwaysOcr() {
  isAlwaysOcr = document.getElementById("always-ocr-check").checked;
}

async function initializeOCR() {
  if (worker) return worker;

  worker = await createWorker("eng+kor", 1, {
    workerPath: "./ocr/worker.min.js",
    corePath: "./ocr/core",
    langPath: "./ocr/lang",
    logger: (m) => {
      const { ocrProgress, ocrProgressText } = getWorkingElements();

      if (
        m.progress &&
        m.status !== "uninitialized" &&
        ocrProgress &&
        ocrProgressText
      ) {
        const progress = Math.round(m.progress * 100);
        ocrProgress.style.width = `${progress}%`;

        let status = m.status;

        status = status.replaceAll("initializing api", "엔진 구동 중");
        status = status.replaceAll("recognizing text", "글자 인식 중");

        ocrProgressText.innerText = `${status}: ${progress}%`;
      }
    },
  });

  return worker;
}

export async function runAllOCR() {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;

  clearAllOcrMasks();
  displayWorkingModal();
  incMaskingCount();
  setIsAlwaysOcr();

  const numPages = pdfDoc.numPages;
  const { ocrProgressText } = getWorkingElements();

  for (let i = 0; i < numPages; i++) {
    const pageNum = i + 1;
    ocrProgressText.innerText = `전체 ${numPages} 페이지 중 ${pageNum} 페이지 처리 중...`;

    await runOCR(pageNum);
  }

  hideWorkingModal();
  endTask();
}

export async function runOCR(pageNum) {
  clearOcrMasks(pageNum);

  const regexList = getAll();
  const regexExps = Object.keys(regexList).map((key) => ({
    key: key,
    regex: new RegExp(regexList[key], "g"),
  }));

  const pageTexts = getPageText(pageNum);

  if (!isAlwaysOcr && pageTexts.length > 0) {
    const canvasHeight = document.getElementById("masking-canvas").height;

    for (const textItem of pageTexts) {
      const word = textItem.text;
      for (const { regex } of regexExps) {
        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(word)) !== null) {
          const matchedText = match[0];
          const len = word.length;
          const charWidth = textItem.width / len;
          const matchedLen = matchedText.length;

          const bbox = textItem.transform;
          const x = bbox[4] + charWidth * match.index;
          const y = bbox[5] + textItem.height;
          const width = charWidth * matchedLen;
          const height = textItem.height;

          cntPrivacy += 1;
          addMask(pageNum, {
            x: x * INITIAL_RENDER_SCALE,
            y: canvasHeight - y * INITIAL_RENDER_SCALE,
            width: width * INITIAL_RENDER_SCALE,
            height: height * INITIAL_RENDER_SCALE,
            kind: "ocr",
          });
        }
      }
    }

    if (cntPrivacy === 0) {
      const lines = [];
      let currentLine = [];
      let lastY = -1;
      const Y_TOLERANCE = 1;

      pageTexts.sort(
        (a, b) =>
          a.transform[5] - b.transform[5] || a.transform[4] - b.transform[4]
      );

      for (const textItem of pageTexts) {
        const currentY = textItem.transform[5];
        if (lastY === -1 || Math.abs(currentY - lastY) <= Y_TOLERANCE) {
          currentLine.push(textItem);
        } else {
          lines.push(currentLine);
          currentLine = [textItem];
        }
        lastY = currentY;
      }

      if (currentLine.length > 0) lines.push(currentLine);

      for (const line of lines) {
        const combinedText = line.map((item) => item.text).join("");

        for (const { regex } of regexExps) {
          let match;
          regex.lastIndex = 0;

          while ((match = regex.exec(combinedText)) !== null) {
            const matchedText = match[0];
            const matchedIdx = match.index;
            const matchedLen = matchedText.length;

            let currLen = 0;
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            for (const word of line) {
              const text = word.text;
              const len = text.length;
              if (
                matchedIdx + matchedLen > currLen &&
                matchedIdx < currLen + len
              ) {
                const startIdx = Math.max(0, matchedIdx - currLen);
                const endIdx = Math.min(len, matchedIdx - currLen + matchedLen);

                const charWidth = word.width / len;
                const currentX = word.transform[4] + startIdx * charWidth;
                const currentWidth = (endIdx - startIdx) * charWidth;

                minX = Math.min(minX, currentX);
                minY = Math.min(minY, word.transform[5]);
                maxX = Math.max(maxX, currentX + currentWidth);
                maxY = Math.max(maxY, word.transform[5] + word.height);
              }
              currLen += len;
            }

            cntPrivacy += 1;
            addMask(pageNum, {
              x: (minX + 1) * INITIAL_RENDER_SCALE,
              y: canvasHeight - maxY * INITIAL_RENDER_SCALE,
              width: (maxX - minX - 1) * INITIAL_RENDER_SCALE,
              height: (maxY - minY) * INITIAL_RENDER_SCALE,
              kind: "ocr",
            });
          }
        }
      }
    }
  } else {
    const pdfDoc = getPdfDoc();
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({
      scale: INITIAL_RENDER_SCALE,
    });

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;

    await page.render({
      canvasContext: tempCtx,
      viewport: viewport,
    }).promise;

    const opencvLoaded =
      typeof cv !== "undefined" && typeof cv.imread === "function";

    if (opencvLoaded) {
      const src = cv.imread(tempCanvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      const dst = new cv.Mat();
      cv.adaptiveThreshold(
        gray,
        dst,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11,
        2
      );
      cv.imshow(tempCanvas, dst);
      src.delete();
      gray.delete();
      dst.delete();
    }

    await initializeOCR();

    const {
      data: { blocks },
    } = await worker.recognize(tempCanvas, {}, { blocks: true });

    if (blocks && blocks.length > 0) {
      for (const block of blocks) {
        if (block.paragraphs && block.paragraphs.length > 0) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.lines && paragraph.lines.length > 0) {
              for (const line of paragraph.lines) {
                if (line.words && line.words.length > 0) {
                  const noGap = line.text.replaceAll(" ", "");

                  for (const { regex } of regexExps) {
                    let match;
                    regex.lastIndex = 0;

                    while ((match = regex.exec(noGap)) !== null) {
                      const matchedText = match[0];
                      const matchedIdx = match.index;

                      let startIdx = -1;
                      let endIdx = -1;
                      let currLen = 0;

                      for (let j = 0; j < line.words.length; j++) {
                        const word = line.words[j];
                        const len = word.text.length;

                        if (
                          startIdx === -1 &&
                          matchedIdx >= currLen &&
                          matchedIdx < currLen + len
                        ) {
                          startIdx = j;
                        }

                        if (
                          startIdx !== -1 &&
                          matchedIdx + matchedText.length <= currLen + len
                        ) {
                          endIdx = j;
                          break;
                        }
                        currLen += len;
                      }

                      if (startIdx !== -1 && endIdx !== -1) {
                        let minX0 = Infinity;
                        let minY0 = Infinity;
                        let maxX1 = -Infinity;
                        let maxY1 = -Infinity;

                        for (let k = startIdx; k <= endIdx; k++) {
                          const wordBox = line.words[k].bbox;
                          minX0 = Math.min(minX0, wordBox.x0);
                          minY0 = Math.min(minY0, wordBox.y0);
                          maxX1 = Math.max(maxX1, wordBox.x1);
                          maxY1 = Math.max(maxY1, wordBox.y1);
                        }

                        cntPrivacy += 1;
                        addMask(pageNum, {
                          x: minX0,
                          y: minY0,
                          width: maxX1 - minX0,
                          height: maxY1 - minY0,
                          kind: "ocr",
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

export async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
