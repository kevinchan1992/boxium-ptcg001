/**
 * parseApiError
 * 將 tRPC / Zod 後端錯誤訊息轉換為友好的繁體中文提示。
 *
 * 使用方式：
 *   onError: (e) => toast.error(parseApiError(e))
 */

// Zod 欄位名稱對應中文
const fieldLabels: Record<string, string> = {
  title: "商品名稱",
  description: "商品描述",
  price: "售價",
  quantity: "數量",
  condition: "品相",
  tcgSeries: "卡牌系列",
  cardId: "關聯卡牌",
  images: "商品圖片",
  startingBid: "起標價",
  reservePrice: "底價",
  buyNowPrice: "即時購買價",
  bidIncrement: "加價幅度",
  auctionEndAt: "拍賣結束時間",
  auctionStartAt: "拍賣開始時間",
  recipientName: "收件人姓名",
  recipientPhone: "聯絡電話",
  address: "地址",
  district: "地區",
  shippingMethod: "送貨方式",
  paymentMethod: "付款方式",
  name: "姓名",
  email: "電郵",
  phone: "電話",
  password: "密碼",
  username: "用戶名稱",
  minOfferHkd: "最低出價",
  allowOffers: "接受出價",
  sfStationCode: "順豐站點",
  meetupNote: "自取地點",
  message: "訊息",
  content: "內容",
  amount: "金額",
  reason: "原因",
  status: "狀態",
};

// Zod 錯誤代碼對應中文
const zodCodeMessages: Record<string, (field: string, ctx?: Record<string, unknown>) => string> = {
  too_small: (field, ctx) => {
    const min = ctx?.minimum as number | undefined;
    if (ctx?.type === "string" || ctx?.origin === "string") {
      return `${field}至少需要 ${min ?? 1} 個字元`;
    }
    if (ctx?.type === "number" || ctx?.origin === "number") {
      return `${field}不能小於 ${min ?? 0}`;
    }
    return `${field}不符合最小值要求`;
  },
  too_big: (field, ctx) => {
    const max = ctx?.maximum as number | undefined;
    if (ctx?.type === "string" || ctx?.origin === "string") {
      return `${field}不能超過 ${max ?? 255} 個字元`;
    }
    if (ctx?.type === "number" || ctx?.origin === "number") {
      return `${field}不能大於 ${max ?? 0}`;
    }
    return `${field}超出最大值限制`;
  },
  invalid_type: (field) => `${field}格式不正確`,
  invalid_string: (field, ctx) => {
    if (ctx?.validation === "email") return `${field}必須是有效的電郵地址`;
    if (ctx?.validation === "url") return `${field}必須是有效的網址`;
    return `${field}格式不正確`;
  },
  invalid_enum_value: (field) => `${field}選項無效`,
  required: (field) => `${field}為必填項目`,
  custom: (field) => `${field}驗證失敗`,
};

// 通用 tRPC 錯誤代碼對應中文
const trpcCodeMessages: Record<string, string> = {
  UNAUTHORIZED: "請先登入後再進行此操作",
  FORBIDDEN: "您沒有權限執行此操作",
  NOT_FOUND: "找不到相關資料",
  CONFLICT: "資料已存在，請勿重複提交",
  TOO_MANY_REQUESTS: "操作過於頻繁，請稍後再試",
  INTERNAL_SERVER_ERROR: "伺服器發生錯誤，請稍後再試",
  BAD_REQUEST: "請求資料有誤，請檢查後重試",
  TIMEOUT: "請求逾時，請稍後再試",
  PAYLOAD_TOO_LARGE: "上傳的資料過大，請減少內容後重試",
  METHOD_NOT_SUPPORTED: "不支援此操作",
  PRECONDITION_FAILED: "前置條件未滿足",
  UNPROCESSABLE_CONTENT: "資料格式無法處理",
  CLIENT_CLOSED_REQUEST: "請求已取消",
};

interface ZodIssue {
  path?: (string | number)[];
  code?: string;
  message?: string;
  minimum?: number;
  maximum?: number;
  type?: string;
  origin?: string;
  validation?: string;
  inclusive?: boolean;
}

/**
 * 嘗試解析 Zod 驗證錯誤陣列（JSON 字串或物件）
 */
function tryParseZodErrors(message: string): string | null {
  try {
    const parsed = JSON.parse(message);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const messages: string[] = [];
    for (const issue of parsed as ZodIssue[]) {
      const pathArr = issue.path ?? [];
      const lastKey = pathArr.length > 0 ? String(pathArr[pathArr.length - 1]) : "";
      const fieldLabel = fieldLabels[lastKey] ?? (lastKey || "欄位");

      const code = issue.code ?? "custom";
      const handler = zodCodeMessages[code];
      if (handler) {
        messages.push(handler(fieldLabel, issue as Record<string, unknown>));
      } else if (issue.message && !issue.message.startsWith("[") && !issue.message.startsWith("{")) {
        messages.push(`${fieldLabel}：${issue.message}`);
      } else {
        messages.push(`${fieldLabel}驗證失敗`);
      }
    }
    return messages.join("；");
  } catch {
    return null;
  }
}

/**
 * 主函數：解析 tRPC 錯誤並返回友好的中文訊息
 */
export function parseApiError(error: unknown): string {
  if (!error) return "發生未知錯誤，請稍後再試";

  // tRPC TRPCClientError
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    // 嘗試從 data.zodError 解析
    const data = err.data as Record<string, unknown> | undefined;
    if (data?.zodError) {
      const zodError = data.zodError as Record<string, unknown>;
      const fieldErrors = zodError.fieldErrors as Record<string, string[]> | undefined;
      if (fieldErrors) {
        const msgs: string[] = [];
        for (const [key, errs] of Object.entries(fieldErrors)) {
          const label = fieldLabels[key] ?? key;
          if (Array.isArray(errs) && errs.length > 0) {
            msgs.push(`${label}：${errs[0]}`);
          }
        }
        if (msgs.length > 0) return msgs.join("；");
      }
      const formErrors = zodError.formErrors as string[] | undefined;
      if (formErrors && formErrors.length > 0) return formErrors[0];
    }

    // 嘗試從 tRPC code 解析
    const code = (data?.code as string) ?? (err.code as string);
    if (code && trpcCodeMessages[code]) {
      return trpcCodeMessages[code];
    }

    // 嘗試解析 message 欄位
    const message = err.message as string | undefined;
    if (message) {
      // 嘗試解析 Zod JSON 陣列
      const zodMsg = tryParseZodErrors(message);
      if (zodMsg) return zodMsg;

      // 如果 message 本身是 JSON 物件，嘗試解析
      if (message.startsWith("{") || message.startsWith("[")) {
        return "資料驗證失敗，請檢查填寫的內容";
      }

      // 對常見英文錯誤訊息進行翻譯
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes("unauthorized") || lowerMsg.includes("not authenticated")) {
        return "請先登入後再進行此操作";
      }
      if (lowerMsg.includes("forbidden") || lowerMsg.includes("permission")) {
        return "您沒有權限執行此操作";
      }
      if (lowerMsg.includes("not found")) {
        return "找不到相關資料";
      }
      if (lowerMsg.includes("already exists") || lowerMsg.includes("duplicate")) {
        return "資料已存在，請勿重複提交";
      }
      if (lowerMsg.includes("too many requests") || lowerMsg.includes("rate limit")) {
        return "操作過於頻繁，請稍後再試";
      }
      if (lowerMsg.includes("internal server error") || lowerMsg.includes("internal error")) {
        return "伺服器發生錯誤，請稍後再試";
      }
      if (lowerMsg.includes("timeout")) {
        return "請求逾時，請稍後再試";
      }
      if (lowerMsg.includes("stripe") || lowerMsg.includes("payment")) {
        return "付款處理失敗，請稍後再試或聯絡客服";
      }

      // 如果訊息是中文，直接返回
      if (/[\u4e00-\u9fff]/.test(message)) {
        return message;
      }

      // 其他英文訊息：返回通用提示
      return "操作失敗，請稍後再試";
    }
  }

  if (typeof error === "string") {
    const zodMsg = tryParseZodErrors(error);
    if (zodMsg) return zodMsg;
    if (/[\u4e00-\u9fff]/.test(error)) return error;
    return "操作失敗，請稍後再試";
  }

  return "發生未知錯誤，請稍後再試";
}
