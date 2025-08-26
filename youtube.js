// ============================
// YouTube関連のモジュール。
// ============================

const axios = require('axios');
const chatwork = require('./chatwork');

// YouTube URLを解析するための正規表現
const YOUTUBE_URL = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w\-]+)/;

// ハードコードされたInvidiousインスタンスのリスト
const INVIDIOUS_INSTANCES = [
  "https://nyc1.iv.ggtyler.dev",
  "https://cal1.iv.ggtyler.dev",
  "https://invidious.nikkosphere.com",
  "https://lekker.gay",
  "https://invidious.f5.si",
  "https://invidious.lunivers.trade",
  "https://invid-api.poketube.fun",
  "https://pol1.iv.ggtyler.dev",
  "https://eu-proxy.poketube.fun",
  "https://iv.melmac.space",
  "https://invidious.reallyaweso.me",
  "https://invidious.dhusch.de",
  "https://usa-proxy2.poketube.fun",
  "https://id.420129.xyz",
  "https://invidious.darkness.service",
  "https://iv.duti.dev",
  "https://invidious.projectsegfau.lt",
  "https://invidious.perennialte.ch",
  "https://invidious.einfachzocken.eu",
  "https://invidious.adminforge.de",
  "https://inv.nadeko.net",
  "https://invidious.esmailelbob.xyz",
  "https://invidious.0011.lt",
  "https://invidious.ducks.party"
];

/**
 * 動作しているInvidiousインスタンスをリストから見つけます。
 * タイムアウトを設定し、最初に成功したインスタンスを返します。
 * @returns {Promise<string|null>} 動作しているインスタンスのURL、またはnull
 */
async function getWorkingInstance() {
  const TEST_VIDEO_ID = 'lQm4vQpEDWw'; // 実際に存在する動画ID
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await axios.get(`${instance}/api/v1/videos/${TEST_VIDEO_ID}`, { timeout: 5000 });
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
 * YouTube検索リクエストを処理し、検索結果をChatWorkに投稿します。
 */
async function handleYoutubeRequest(body, message, messageId, roomId, accountId) {
  const ms = message.replace(/\s+/g, "");
  const regex = /「(.*?)」/;
  const matchid = ms.match(regex);

  // キーワード検索
  if (matchid && matchid[1]) {
    try {
      await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n検索しています…`, roomId);
      
      const invidiousInstance = await getWorkingInstance();
      if (!invidiousInstance) {
        await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n現在、利用可能なYouTubeプロキシがありません。`, roomId);
        return;
      }
      
      const searchQuery = matchid[1];
      const videoResults = await getSearchResults(searchQuery, invidiousInstance, 5); // 5件取得
      
      if (videoResults.length > 0) {
        let responseMessage = `[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n検索結果を5件表示します。\n\n`;
        
        videoResults.forEach(video => {
          responseMessage += `タイトル: ${video.title}\n`;
          responseMessage += `ID: ${video.videoId}\n`;
          // サムネイルが存在するかチェック
          if (video.videoThumbnails && video.videoThumbnails.length > 0) {
            responseMessage += `サムネイル: ${video.videoThumbnails[0].url}\n\n`;
          } else {
            responseMessage += `サムネイル: なし\n\n`;
          }
        });
        
        responseMessage += `\n動画の詳細情報を表示するには、IDを指定して「OK [動画ID]」と返信してください。`;
        await chatwork.sendchatwork(responseMessage, roomId);
      } else {
        await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n指定されたキーワードで動画が見つかりませんでした。`, roomId);
      }
    } catch (error) {
      console.error("検索処理エラー:", error);
      await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\nエラーが発生しました。`, roomId);
    }
  } else {
    await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n「キーワード」を二重引用符で囲んで入力してください。`, roomId);
  }
}

/**
 * 検索クエリに一致する動画のリストをInvidious APIで取得します。
 * @param {string} query 検索クエリ
 * @param {string} invidiousInstance 使用するInvidiousインスタンスURL
 * @param {number} count 取得する件数
 * @returns {Promise<Array>} 動画オブジェクトの配列
 */
async function getSearchResults(query, invidiousInstance, count) {
  try {
    const response = await axios.get(`${invidiousInstance}/api/v1/search?q=${encodeURIComponent(query)}`);
    
    // 動画のみをフィルタリング
    const videoResults = response.data.filter(item => item.type === 'video');
    
    if (videoResults.length > 0) {
      return videoResults.slice(0, count);
    }
    return [];
  } catch (error) {
    console.error("動画検索APIエラー:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * 動画情報を取得してChatWorkに送信する共通関数。
 * @param {string} videoId - YouTubeの動画ID
 * @param {string} messageId - ChatWorkのメッセージID
 * @param {string} roomId - ChatWorkのルームID
 * @param {string} accountId - ChatWorkのユーザーID
 */
async function sendVideoInfo(videoId, messageId, roomId, accountId) {
  const invidiousInstance = await getWorkingInstance();
  if (!invidiousInstance) {
      await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n現在、利用可能なYouTubeプロキシがありません。`, roomId);
      return;
  }
  
  try {
    const response = await axios.get(`${invidiousInstance}/api/v1/videos/${videoId}`);
    const videoData = response.data;
    
    const videoTitle = videoData.title;
    const author = videoData.author;
    const hlsUrl = videoData.hlsUrl;
    
    let messageBody = `[rp aid=${accountId} to=${roomId}-${messageId}]\n`;
    messageBody += `タイトル: ${videoTitle}\n`;
    messageBody += `投稿者: ${author}\n`;
    
    if (hlsUrl) {
      messageBody += `[code]${hlsUrl}[/code]\n`;
    } else {
      messageBody += `動画のストリームURLが見つかりませんでした。\n`;
    }

    messageBody += `Invidiousで視聴する\n${invidiousInstance}/watch?v=${videoId}`;
    
    await chatwork.sendchatwork(messageBody, roomId);
  } catch (error) {
    console.error("動画情報取得APIエラー:", error.response?.data || error.message);
    await chatwork.sendchatwork(`[rp aid=${accountId} to=${roomId}-${messageId}][pname:${accountId}]さん\n動画情報の取得中にエラーが発生しました。`, roomId);
  }
}

module.exports = {
  handleYoutubeRequest,
  sendVideoInfo,
};
