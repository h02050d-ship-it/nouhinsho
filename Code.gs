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
  if (method === '付売') sheetName = '価格表（付売）';
  else if (method === '市売') sheetName = '価格表（市売）';
  else if (method === 'ニッチ' || method === 'ネット') sheetName = '価格表（ニッチ）';

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { prices: [], sheetName: sheetName, error: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  const prices = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const custName = String(row[0] || '').trim(); // A列: 取引先
    if (!custName.includes(customer) && !customer.includes(custName)) continue;
    prices.push({
      customer: custName,
      hinmei: String(row[1] || '').trim(),   // B列: 品名
      thickness: row[2],                      // C列: 厚
      width: row[3],                          // D列: 巾
      length: row[4],                         // E列: 長
      key: String(row[5] || '').trim(),       // F列: 合体
      marubushi: row[6] || '',                // G列: 丸節
      kobushi: row[7] || '',                  // H列: 小節
      tokujoko: row[8] || '',                 // I列: 特上小
      mubushi: row[9] || '',                  // J列: 無節
      marubushi_tokujoko: row[10] || '',      // K列: 丸節特上小
      namabushi: row[11] || '',               // L列: 生節
      remark: String(row[12] || '').trim()    // M列: 備考
    });
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
