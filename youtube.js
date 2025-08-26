// ============================
// YouTube関連のモジュール。
// ============================

const axios = require('axios');
const chatwork = require('./chatwork');

// YouTube URLを解析するための正規表現
const YOUTUBE_URL = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w\-]+)/;

// Invidiousインスタンス一覧のURL
const INVIDIOUS_INSTANCES_URL = "https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json";

// ロードされたInvidiousインスタンスを格納する配列
let invidiousInstances = [];

/**
 * Invidiousインスタンス一覧を外部URLからロードします。
 * 失敗した場合はエラーをログに記録します。
 */
async function loadInvidiousInstances() {
  try {
    const response = await axios.get(INVIDIOUS_INSTANCES_URL);
    // JSONレスポンスが直接インスタンスの配列であると想定
    invidiousInstances = response.data.map(inst => `https://${inst.uri}`);
    console.log("Invidiousインスタンス一覧をロードしました。");
  } catch (error) {
    console.error("Invidiousインスタンスのロードに失敗しました:", error.message);
    // エラーが発生した場合、空の配列で処理を続行
    invidiousInstances = [];
  }
}

/**
 * 動作しているInvidiousインスタンスをリストから見つけます。
 * タイムアウトを設定し、最初の成功したインスタンスを返します。
 * @returns {Promise<string|null>} 動作しているインスタンスのURL、またはnull
 */
async function getWorkingInstance() {
  for (const instance of invidiousInstances) {
    try {
      // 軽いヘルスチェックとして、存在しないビデオIDにアクセス
      const response = await axios.get(`${instance}/api/v1/videos/DeKLpgzh-qQ`, { timeout: 5000 });
      if (response.status === 200) {
        console.log(`使用するインスタンス: ${instance}`);
        return instance;
      }
    } catch (error) {
      console.warn(`インスタンス ${instance} は動作していません。`);
    }
  }
  return null;
}

/**
 * ChatWorkからのメッセージを処理し、YouTube動画の情報を取得・共有します。
 * キーワード検索またはYouTube URLをサポートします。
 */
async function getwakametube(body, message, messageId, roomId, accountId) {
  const ms = message.replace(/\s+/g, "");
  const regex = /「(.*?)」/;
  const matchid = ms.match(regex);

  // まず、動作するInvidiousインスタンスを取得
  const invidiousInstance = await getWorkingInstance();
  if (!invidiousInstance) {
    await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n現在、利用可能なYouTubeプロキシがありません。`, roomId);
    return;
  }

  // 1. キーワード検索による動画取得
  if (matchid && matchid[1]) {
    try {
      const searchQuery = matchid[1];
      const videoId = await getFirstVideoId(searchQuery, invidiousInstance);
      if (videoId) {
        await sendVideoInfo(videoId, messageId, roomId, accountId, invidiousInstance);
      } else {
        await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n指定されたキーワードで動画が見つかりませんでした。`, roomId);
      }
      return;
    } catch (error) {
      console.error("キーワード検索処理エラー:", error);
      await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
      return;
    }
  }

  // 2. YouTube URLによる動画取得
  const match = ms.match(YOUTUBE_URL);
  if (match) {
    const videoId = match[1];
    try {
      await sendVideoInfo(videoId, messageId, roomId, accountId, invidiousInstance);
      return;
    } catch (error) {
      console.error("URL処理エラー:", error);
      await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
      return;
    }
  } else {
    await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n有効なYouTubeのURLまたは「キーワード」を入力してください。`, roomId);
  }
}

/**
 * 検索クエリに一致する最初の動画のIDをInvidious APIで取得します。
 */
async function getFirstVideoId(query, invidiousInstance) {
  try {
    const response = await axios.get(`${invidiousInstance}/api/v1/search?q=${encodeURIComponent(query)}`);
    if (response.data.length > 0) {
      return response.data[0].videoId;
    }
    return null;
  } catch (error) {
    console.error("動画検索APIエラー:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * 動画情報を取得してChatWorkに送信する共通関数。
 */
async function sendVideoInfo(videoId, messageId, roomId, accountId, invidiousInstance) {
  try {
    const response = await axios.get(`${invidiousInstance}/api/v1/videos/${videoId}`);
    const videoData = response.data;
    
    const videoTitle = videoData.title;
    const author = videoData.author;
    const hlsUrl = videoData.hlsUrl;
    
    let messageBody = `[rp aid=${accountId} to=${roomId}-${messageId}]\n`;
    messageBody += `${videoTitle} - ${author}\n`;
    
    if (hlsUrl) {
      messageBody += `[code]${hlsUrl}[/code]\n`;
    } else {
      messageBody += `動画のストリームURLが見つかりませんでした。\n`;
    }

    messageBody += `Invidiousで視聴する\n${invidiousInstance}/watch?v=${videoId}`;
    
    await chatwork.sendchatwork(messageBody, roomId);
  } catch (error) {
    console.error("動画情報取得APIエラー:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getwakametube,
  getFirstVideoId,
  loadInvidiousInstances,
};
