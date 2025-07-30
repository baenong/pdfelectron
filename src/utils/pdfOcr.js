const { createWorker } = Tesseract;
import {
  addMask,
  clearAllOcrMasks,
  clearOcrMasks,
  endTask,
  incMaskingCount,
} from "./maskingManager.js";
import { INITIAL_RENDER_SCALE, getPdfDoc } from "./pdfViewer.js";
import { getAll } from "./regexManager.js";

let worker = null;
let cntPrivacy = 0;

export function displayWorkingModal() {
  const modal = document.getElementById("working-modal");
  const searchCount = document.getElementById("search-count");
  if (modal.classList.contains("hide")) modal.classList.remove("hide");
  else return;

  cntPrivacy = 0;
  searchCount.innerText = "탐색중...";
}

export function hideWorkingModal() {
  const modal = document.getElementById("working-modal");
  const searchCount = document.getElementById("search-count");
  searchCount.innerText = `${cntPrivacy} 건 마스킹 처리완료!`;

  setTimeout(() => {
    modal.classList.add("hide");
  }, 2000);
}

async function initializeOCR() {
  if (worker) return worker;

  worker = await createWorker("eng+kor", 1, {
    workerPath: "./ocr/worker.min.js",
    corePath: "./ocr/core",
    langPath: "./ocr/lang",
    logger: (m) => console.log(m.status),
  });

  return worker;
}

export async function runAllOCR() {
  const pdfDoc = getPdfDoc();
  if (!pdfDoc) return;
  await initializeOCR();

  clearAllOcrMasks();
  displayWorkingModal();
  incMaskingCount();

  const numPages = pdfDoc.numPages;

  for (let i = 0; i < numPages; i++) {
    const pageNum = i + 1;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({
      scale: INITIAL_RENDER_SCALE,
    });

    // runOCR은 canvas 기준으로 읽으므로 임시 canvas를 만들어서 실행
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;

    await page.render({
      canvasContext: tempCtx,
      viewport: viewport,
    }).promise;

    await runOCR(tempCanvas, pageNum);
  }

  hideWorkingModal();
  endTask();
}

export async function runOCR(canvas, pageNum) {
  if (!canvas) return;
  await initializeOCR();

  clearOcrMasks(pageNum);

  const {
    data: { blocks },
  } = await worker.recognize(canvas, {}, { blocks: true });

  const regexList = getAll();
  const regexExps = Object.keys(regexList).map((key) => ({
    key: key,
    regex: new RegExp(regexList[key], "g"),
  }));

  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      if (block.paragraphs && block.paragraphs.length > 0) {
        for (const paragraph of block.paragraphs) {
          if (paragraph.lines && paragraph.lines.length > 0) {
            for (const line of paragraph.lines) {
              if (line.words && line.words.length > 0) {
                const noGap = line.text.replaceAll(" ", "");

                for (const { key, regex } of regexExps) {
                  let match;
                  // global regex는 exec 호출 시마다 lastIndex를 업데이트하므로
                  // 반드시 lastIndex = 0;으로 초기화해야한다.
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
                        color: "rgba(255, 0, 0, 0.5)",
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

export async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
