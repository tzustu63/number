// /netlify/functions/send.js (Netlify 版本)

// 輔助函數：這部分完全不需要修改，因為它是純粹的 JavaScript 邏輯
function findStringValue(obj, maxDepth = 3, currentDepth = 0) {
  // ... (您的 findStringValue 函數內容複製到此處，保持不變)
  if (currentDepth >= maxDepth) return null;
  if (typeof obj === "string" && obj.length > 0) {
    return obj;
  }
  if (typeof obj === "object" && obj !== null) {
    const priorityKeys = ["output", "response", "message", "text", "content"];
    for (const key of priorityKeys) {
      if (obj[key] && typeof obj[key] === "string") {
        return obj[key];
      }
    }
    for (const [key, value] of Object.entries(obj)) {
      if (!priorityKeys.includes(key)) {
        const result = findStringValue(value, maxDepth, currentDepth + 1);
        if (result) return result;
      }
    }
  }
  return null;
}

// 【修改點 1】函式簽名改為 Netlify 的格式
export const handler = async (event) => {
  // 【修改點 2】HTTP 方法的檢查方式改變
  if (event.httpMethod !== "POST") {
    // 【修改點 3】回傳回應的語法改變
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  const n8nWebhookUrl = "https://n8n.harvestwize.com/webhook/indonesia_birth";

  try {
    // 【修改點 4】從 event.body 解析 JSON，並加上錯誤處理
    let userMessage;
    try {
      const body = JSON.parse(event.body);
      userMessage = body.message;
      if (!userMessage)
        throw new Error("Request body is missing 'message' property.");
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return {
        statusCode: 400, // Bad Request
        body: JSON.stringify({
          message:
            "Invalid request body. Expected JSON with a 'message' property.",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });

    // 這部分從 try/catch 內部開始的邏輯完全相同，因為它與平台無關
    const n8nData = await n8nResponse.json();
    let outputText = "";

    console.log("n8n 回傳的原始資料:", JSON.stringify(n8nData, null, 2));

    // 【防禦性檢查】這整段邏輯都不需要修改
    if (n8nData && typeof n8nData === "object") {
      if (n8nData.output && typeof n8nData.output === "string") {
        outputText = n8nData.output;
        console.log("成功從 n8nData.output 取得資料");
      } else if (
        Array.isArray(n8nData) &&
        n8nData.length > 0 &&
        n8nData[0] &&
        n8nData[0].output
      ) {
        outputText = n8nData[0].output;
        console.log("成功從 n8nData[0].output 取得資料");
      } else if (n8nData.json && n8nData.json.output) {
        outputText = n8nData.json.output;
        console.log("成功從 n8nData.json.output 取得資料");
      } else if (n8nData.response) {
        outputText = n8nData.response;
        console.log("成功從 n8nData.response 取得資料");
      } else if (n8nData.message) {
        outputText = n8nData.message;
        console.log("成功從 n8nData.message 取得資料");
      } else {
        const possibleOutput = findStringValue(n8nData);
        if (possibleOutput) {
          outputText = possibleOutput;
          console.log(
            "從物件中找到字串值:",
            possibleOutput.substring(0, 100) + "..."
          );
        } else {
          console.warn("無法在回傳資料中找到有效的輸出內容");
          outputText = "抱歉，我這次沒有得到有效的回覆，請您換個方式再問一次。";
        }
      }
    } else {
      console.warn("n8n 回傳的資料格式異常:", typeof n8nData);
      outputText = "抱歉，系統回傳的資料格式有問題，請稍後再試。";
    }

    // 【修改點 5】將最終的成功回應也改為 Netlify 的 return 格式
    return {
      statusCode: 200,
      body: JSON.stringify({ response: outputText }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    console.error("Error in Netlify function:", error);
    // (可選) 紀錄更詳細的錯誤資訊
    // console.error("Error details:", { message: error.message, stack: error.stack });

    // 【修改點 6】錯誤處理的回應也改為 Netlify 的 return 格式
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        // 考慮到安全，生產環境中不洩漏詳細錯誤
        error:
          process.env.NODE_ENV === "development" ? error.message : "系統錯誤",
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
};
