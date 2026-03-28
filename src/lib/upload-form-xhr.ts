export type XhrUploadResult = {
  ok: boolean;
  status: number;
  /** Распарсенный JSON ответа (или пустой объект). */
  body: unknown;
};

/**
 * POST multipart/form-data с отслеживанием прогресса (fetch не даёт upload progress).
 * Cookie (сессия) уходит на same-origin автоматически.
 */
export function postFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
  options?: { timeoutMs?: number },
): Promise<XhrUploadResult> {
  const timeoutMs = options?.timeoutMs ?? 120_000;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(100, Math.round((100 * e.loaded) / e.total)));
      }
    };

    xhr.onload = () => {
      cleanup();
      let body: unknown = xhr.response;
      if (body === null || body === "") {
        try {
          body = JSON.parse(xhr.responseText || "{}") as unknown;
        } catch {
          body = {};
        }
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body,
      });
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Сеть: не удалось связаться с сервером"));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new Error("Загрузка слишком долгая или прервана (таймаут 2 мин)"));
    };

    timer = setTimeout(() => {
      xhr.abort();
    }, timeoutMs);

    xhr.send(formData);
  });
}
