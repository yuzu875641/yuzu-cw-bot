// ============================
// Webhookメイン処理
// ============================

const express = require('express');
const app = express();
const chatwork = require('./chatwork');
const youtube = require('./youtube');

app.use(express.json());

// ChatWork webhook用のコマンドディスパッチテーブル
const commands = {
  "youtube": youtube.getwakametube,
};

// コマンドを抽出するヘルパー関数
function getCommand(body) {
  const pattern = /\/(.*?)\//;
  const match = body.match(pattern);
  return match ? match[1] : null;
}

// ChatWork webhookエンドポイント
app.post('/webhook', async (req, res) => {
  const accountId = req.body.webhook_event.from_account_id;
  const roomId = req.body.webhook_event.room_id;
  const messageId = req.body.webhook_event.message_id;
  const body = req.body.webhook_event.body;

  try {
    // 自身のメッセージへの返信を無視して無限ループを防ぐ
    if (body.includes(`[rp aid=${process.env.BOT_ACCOUNT_ID}]`)) {
      return res.sendStatus(200);
    }

    // 削除コマンドの処理
    if (body.includes("削除")) {
      await chatwork.deleteMessages(body, body, messageId, roomId, accountId);
      return res.sendStatus(200);
    }

    // メッセージからコマンドを抽出
    const command = getCommand(body);
    const message = body.replace(/\[To:\d+\s+ゆずbotさん\]|\/.*?\/|\s+/g, "");

    // コマンドディスパッチ
    if (command && commands[command]) {
      await commands[command](body, message, messageId, roomId, accountId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook処理エラー:', error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // ここで関数呼び出しを削除
});
