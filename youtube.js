// ============================
// YouTube関連のモジュール。
// ============================

const axios = require('axios');
const chatwork = require('./chatwork');

const YOUTUBE_URL = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w\-]+)/;
const INVIDIOUS_INSTANCES_URL = "https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json";

let invidiousInstances = [];

// 起動時にInvidiousインスタンス一覧をロードする
async function loadInvidiousInstances() {
  try {
    const response = await axios.get(INVIDIOUS_INSTANCES_URL);
    // レスポンスデータの形式に合わせる
    invidiousInstances = response.data.instances.map(inst => `https://${inst.uri}`);
    console.log("Invidiousインスタンス一覧をロードしました。");
  } catch (error) {
    console.error("Invidiousインスタンスのロードに失敗しました:", error.message);
  }
}

// 動作するInvidiousインスタンスを見つける
async function getWorkingInstance() {
  for (const instance of invidiousInstances) {
    try {
      // 軽いヘルスチェックとして、バージョン情報を取得してみる
      const response = await axios.get(`${instance}/api/v1/videos/pdgQPLOogj4`, { timeout: 10000 });
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

// YouTube動画の検索と共有
async function getwakametube(body, message, messageId, roomId, accountId) {
  const ms = message.replace(/\s+/g, "");
  const regex = /「(.*?)」/;
  const matchid = ms.match(regex);

  // Invidiousインスタンスを取得
  const invidiousInstance = await getWorkingInstance();
  if (!invidiousInstance) {
    await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n現在、利用可能なYouTubeプロキシがありません。`, roomId);
    return;
  }

  // 1. キーワード検索による動画取得
  if (matchid && matchid[1]) {
    try {
      const searchQuery = matchid[1];
      console.log(`検索クエリ: ${searchQuery}`);
      const videoId = await getFirstVideoId(searchQuery, invidiousInstance);

      if (!videoId) {
        await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n指定されたキーワードで動画が見つかりませんでした。`, roomId);
        return;
      }

      await sendVideoInfo(videoId, messageId, roomId, accountId, invidiousInstance);
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

// 検索クエリから最初の動画IDを取得する
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

// 動画情報を取得してChatWorkに送信する共通関数
async function sendVideoInfo(videoId, messageId, roomId, accountId, invidiousInstance) {
  try {
    const response = await axios.get(`${invidiousInstance}/api/v1/videos/${videoId}`);
    const videoData = response.data;
    
    // InvidiousのAPIレスポンスから必要な情報を抽出
    const videoTitle = videoData.title;
    const author = videoData.author;
    const hlsUrl = videoData.hlsUrl;
    
    let messageBody = `[rp aid=${accountId} to=${roomId}-${messageId}]\n`;
    messageBody += `${videoTitle} - ${author}\n`;
    
    // HLSストリームURLを送信
    if (hlsUrl) {
      messageBody += `[code]${hlsUrl}[/code]\n`;
    } else {
      messageBody += `動画のストリームURLが見つかりませんでした。\n`;
    }

    // 動画を直接表示するためのInvidious URLも追加
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
