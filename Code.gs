// =====================================================
// 納品書作成ツール — Google Apps Script API
// スプレッドシートID: 1UdKYVR6tC0yQTpn341b3WiudfMPZcUcpbljLwkpZno8
// =====================================================

const SS_ID = '1UdKYVR6tC0yQTpn341b3WiudfMPZcUcpbljLwkpZno8';

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'getCustomers':
        result = getCustomers();
        break;
      case 'getPrices':
        result = getPrices(e.parameter.customer, e.parameter.method);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const action = e.parameter.action;
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    switch (action) {
      case 'saveRecords':
        result = saveRecords(body);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- 取引先データ取得 ---
function getCustomers() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('取引先データ');
  const data = sheet.getDataRange().getValues();
  const customers = [];
  for (let i = 1; i < data.length; i++) {
    const name = data[i][1]; // B列: 取引先
    if (!name) continue;
    customers.push({
      name: String(name).trim(),
      method: String(data[i][2] || '').trim(), // C列: 取引方法
      address: String(data[i][3] || '').trim()  // D列: 住所
    });
  }
  return { customers: customers };
}

// --- 価格表取得 ---
function getPrices(customer, method) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheetName = '価格表';
  let isSimple = false; // 市売/付売は取引先列なしの共通価格表
  if (method === '付売') { sheetName = '価格表（付売）'; isSimple = true; }
  else if (method === '市売') { sheetName = '価格表（市売）'; isSimple = true; }
  else if (method === 'ニッチ' || method === 'ネット') { sheetName = '価格表（ニッチ）'; isSimple = true; }

  // シート名の末尾スペース対策: 部分一致で検索
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    const allSheets = ss.getSheets();
    sheet = allSheets.find(function(s) { return s.getName().trim() === sheetName || s.getName().includes(sheetName); });
  }
  if (!sheet) return { prices: [], sheetName: sheetName, error: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  const prices = [];

  if (isSimple) {
    // 市売/付売/ニッチ: A:品名, B:厚, C:巾, D:長, E:丸節, F:小節, G:特上小, H:無節, I:無節特上小, J:生節
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      const hinmei = String(row[0] || '').trim();
      if (!hinmei || hinmei.startsWith('※')) break;
      prices.push({
        customer: customer,
        hinmei: hinmei,
        thickness: row[1],
        width: row[2],
        length: row[3],
        key: '',
        marubushi: row[4] || '',
        kobushi: row[5] || '',
        tokujoko: row[6] || '',
        mubushi: row[7] || '',
        marubushi_tokujoko: row[8] || '',
        namabushi: row[9] || '',
        remark: ''
      });
    }
  } else {
    // メイン価格表: A:取引先, B:品名, C:厚, D:巾, E:長, F:合体, G:丸節...
    const cleanName = function(s) { return String(s).replace(/[（）\(\)株有]/g, '').trim(); };
    const cleanCust = cleanName(customer);
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const custName = String(row[0] || '').trim();
      const cleanC = cleanName(custName);
      if (!custName) continue;
      if (custName !== customer && !custName.includes(customer) && !customer.includes(custName) && cleanC !== cleanCust && !cleanC.includes(cleanCust) && !cleanCust.includes(cleanC)) continue;
      prices.push({
        customer: custName,
        hinmei: String(row[1] || '').trim(),
        thickness: row[2],
        width: row[3],
        length: row[4],
        key: String(row[5] || '').trim(),
        marubushi: row[6] || '',
        kobushi: row[7] || '',
        tokujoko: row[8] || '',
        mubushi: row[9] || '',
        marubushi_tokujoko: row[10] || '',
        namabushi: row[11] || '',
        remark: String(row[12] || '').trim()
      });
    }
  }
  return { prices: prices };
}

// --- データベースに書き込み ---
function saveRecords(body) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('データベース');
  const records = body.records;
  if (!records || !records.length) return { error: 'No records' };

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    sheet.appendRow([
      r.date,         // A: 日付
      r.customer,     // B: 取引先
      r.hinmei,       // C: 品名
      r.grade,        // D: 等級
      r.thickness,    // E: 厚
      r.width,        // F: 巾
      r.length,       // G: 長
      r.irikazu,      // H: 入数
      r.qty,          // I: 数量
      r.tanka,        // J: 単価
      r.tanka_mod,    // K: 修正単価
      r.kingaku,      // L: 金額
      r.tax,          // M: 消費税
      r.unchin,       // N: 運賃
      r.nichi_unchin, // O: ニッチ運賃
      r.total,        // P: 合計金額
      r.method,       // Q: 取引方法
      r.carrier       // R: 配送業者
    ]);
  }
  return { success: true, count: records.length };
}
