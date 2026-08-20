/**
 * FormSubmit 予約メール → Google カレンダー 自動登録 (Google Apps Script)
 *
 * EMERALD REEF OKINAWA の予約フォーム(FormSubmit)からの通知メールを定期チェックし、
 * 本文の表から予約内容を抽出して Google カレンダーに予定を登録する。
 *
 * ・対象: submissions@formsubmit.co からの、件名に「予約」を含むメールのみ
 *         （件名が「問い合わせ」のものはカレンダー登録しない）
 * ・時間: ご希望時間があればその時刻から4時間、無ければ11:00から4時間
 * ・二重登録防止: 処理済みメールに「カレンダー登録済み」ラベルを付与
 *
 * セットアップ手順は README.md を参照。
 */

// ============================================================
// ① 設定
// ============================================================
const CONFIG = {
  // 対象メールの絞り込み（Gmail 検索クエリ）
  SEARCH_QUERY: 'from:submissions@formsubmit.co subject:予約',

  // 件名にこの語が含まれる場合のみカレンダー登録する（問い合わせ除外）
  REQUIRE_SUBJECT_KEYWORD: '予約',

  // 登録先カレンダーの名前（この名前のカレンダーに登録する）
  CALENDAR_NAME: '予約状況',

  // 処理済みメールに付けるラベル名（Gmail に既存の「カレンダー登録済み」を使用）
  PROCESSED_LABEL: 'カレンダー登録済み',

  // 1 回の実行で処理する最大スレッド数
  MAX_THREADS: 20,

  // 予定の所要時間（時間）
  DURATION_HOURS: 4,

  // ご希望時間が無い場合の開始時刻（時）※「相談したい」等で時間未指定のとき
  DEFAULT_START_HOUR: 11,

  // 予約メール(受付・確定)の Gmail 下書きを自動作成するか
  CREATE_DRAFTS: true,

  // 前日リマインドメールを自動送信するか
  SEND_REMINDERS: true,

  // リマインド送信済みを示す目印（予定の説明欄に追記。二重送信防止）
  REMINDED_MARK: '[リマインド送信済み]',

  // 「確認済み」ボタンのURL改ざん防止用シークレット（必ず推測されにくい文字列に変更）
  CONFIRM_SECRET: 'er-okinawa-Q3xNDmrtdn4eRiYQpcnicRl',

  // 公開したウェブアプリの本番URL(/exec)。手動実行時も確実にこのURLを使う。
  // （空にすると getUrl() で自動取得するが、エディタ手動実行では開発用URLになるため固定を推奨）
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbyrEZsNiPyeRnykSwLPgqyIDLVwMtAIPdkIsMaSYwBHsbwKJZFJW4aefcLioxPFsor4/exec',
};

// ============================================================
// ①-2 店舗情報（メール署名・本文に使用）
// ============================================================
const SHOP = {
  NAME_JA: 'エメラルドリーフ沖縄',
  NAME_EN: 'EMERALD REEF OKINAWA',
  OWNER_JA: '八木 吹輝',
  OWNER_EN: 'Fubuki Yagi',
  TEL: '070-8516-8826',
  TEL_INTL: '+81 70-8516-8826',
  MAIL: 'emeraldreefokinawa@gmail.com',
  LINE: 'https://line.me/R/ti/p/@846jojxw',
  WEB: 'https://emerald-reef-okinawa.com/',
};

// ツアー名（日本語 → 英語）の対応表（英語下書き用）
const TOUR_EN = {
  'シュノーケル': 'Snorkeling',
  'スキンダイビング': 'Skin Diving',
  '青の洞窟': 'Blue Cave',
  '那覇ウミガメシュノーケル': 'Naha Sea Turtle Snorkeling',
};

// ============================================================
// ①-3 日本時間(JST)で日時を生成するヘルパー
// ============================================================
/**
 * 日本時間(JST = UTC+9・夏時間なし)の「y年mo月d日 h時mi分」を表す Date を返す。
 *
 * new Date(y, mo-1, d, h, mi) は “スクリプトのタイムゾーン” で時刻を解釈するため、
 * プロジェクトのタイムゾーンが東京以外だと、カレンダー上の時刻がずれてしまう
 * （例: 東京+1時間の設定だと 8:00 の予約が 7:00 で登録される）。
 * ここでは UTC を基準に h-9 時として生成することで、
 * プロジェクトのタイムゾーン設定に関係なく常に正しい日本時間の予定になる。
 */
function jstDate_(y, mo, d, h, mi) {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi || 0, 0));
}

// ============================================================
// ② メイン処理（トリガーから呼ばれる）
// ============================================================
function processMailToCalendar() {
  const label = getOrCreateLabel_(CONFIG.PROCESSED_LABEL);
  const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (calendars.length === 0) {
    throw new Error('カレンダーが見つかりません: ' + CONFIG.CALENDAR_NAME);
  }
  const calendar = calendars[0];

  // 未処理（ラベル未付与）の対象メールだけを検索
  const query = CONFIG.SEARCH_QUERY + ' -label:' + CONFIG.PROCESSED_LABEL;
  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);

  let created = 0;
  threads.forEach(function (thread) {
    let anyHandled = false;

    thread.getMessages().forEach(function (message) {
      const subject = message.getSubject() || '';

      // 件名に「予約」が無い（=問い合わせ等）はスキップ
      if (subject.indexOf(CONFIG.REQUIRE_SUBJECT_KEYWORD) === -1) {
        anyHandled = true; // ラベルは付けて再チェックを防ぐ
        return;
      }

      try {
        const info = parseReservation_(message);
        if (!info) {
          Logger.log('日時を抽出できませんでした: ' + subject);
          return;
        }
        calendar.createEvent(info.title, info.start, info.end, {
          description: info.description,
        });
        created++;
        anyHandled = true;
        Logger.log('登録: ' + info.title + ' @ ' + info.start);

        // 予約メール（受付・確定）の下書きを自動作成（失敗してもカレンダー登録は維持）
        if (CONFIG.CREATE_DRAFTS) {
          try {
            createBookingDrafts_(info);
          } catch (de) {
            Logger.log('下書き作成エラー (' + subject + '): ' + de);
          }
        }
      } catch (e) {
        Logger.log('エラー (' + subject + '): ' + e);
      }
    });

    if (anyHandled) thread.addLabel(label);
  });

  Logger.log('完了: ' + created + ' 件の予定を登録しました');

  // あそびゅー（asoview）の予約確定メールも同じカレンダーに登録する
  // （失敗してもフォーム予約の処理結果は保持する）
  try {
    processAsoview_();
  } catch (ae) {
    Logger.log('アソビュー処理エラー: ' + ae);
  }

  // アクティビティジャパンの即時確定予約通知も同じカレンダーに登録する
  try {
    processActivityJapan_();
  } catch (aje) {
    Logger.log('アクティビティジャパン処理エラー: ' + aje);
  }

  // じゃらん（遊び・体験予約）の予約確定メールも同じカレンダーに登録する
  try {
    processJalan_();
  } catch (je) {
    Logger.log('じゃらん処理エラー: ' + je);
  }
}

// ============================================================
// ③ FormSubmit メールの解析
// ============================================================
/**
 * FormSubmit の表形式メールから予約情報を抽出する。
 * 日時が取れなければ null を返す。
 */
function parseReservation_(message) {
  const subject = message.getSubject() || '';
  // HTML 本文を「ラベル/値が1行ずつ並ぶ」テキストに変換
  const lines = htmlToLines_(message.getBody());

  // 各項目を取得（表のラベルの次の行が値）
  const tour    = getField_(lines, 'ご希望のツアー');
  const name    = getField_(lines, 'お名前');
  const email   = getField_(lines, 'email');
  const tel     = getField_(lines, '電話番号');
  const dateStr = getField_(lines, 'ご希望日');     // 例: 2026-06-18
  const timeStr = getField_(lines, 'ご希望時間');   // 例: 9:00（無いこともある）
  const people  = getField_(lines, '参加人数');
  const child   = getField_(lines, 'お子様の有無');
  const stay    = getField_(lines, '宿泊先');
  const note    = getField_(lines, '備考');

  // --- 日付（必須） ---
  const dm = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (!dm) return null;
  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);

  // --- 時刻 ---
  let startHour, startMin;
  const tm = timeStr.match(/(\d{1,2})[:：時](\d{1,2})?/);
  if (tm) {
    startHour = Number(tm[1]);
    startMin = tm[2] ? Number(tm[2]) : 0;
  } else {
    startHour = CONFIG.DEFAULT_START_HOUR; // 時間指定なし → 11:00
    startMin = 0;
  }

  const start = jstDate_(y, mo, d, startHour, startMin);
  const end = new Date(start.getTime() + CONFIG.DURATION_HOURS * 60 * 60 * 1000);

  // --- タイトル & 説明 ---
  const title = subject + (name ? '（' + name + ' ' + people + '）' : '');
  const description = [
    'ご希望のツアー: ' + tour,
    'お名前: ' + name,
    'email: ' + email,
    '電話番号: ' + tel,
    'ご希望日: ' + dateStr,
    'ご希望時間: ' + (timeStr || '(指定なし → ' + CONFIG.DEFAULT_START_HOUR + ':00)'),
    '参加人数: ' + people,
    'お子様の有無: ' + child,
    '宿泊先: ' + stay,
    '備考: ' + note,
    '',
    '※ Gmail から自動登録',
  ].join('\n');

  return {
    title: title, start: start, end: end, description: description,
    // 下書きメール用の生データ
    tour: tour, name: name, email: email, tel: tel,
    dateStr: dateStr, timeStr: timeStr, people: people,
  };
}

// ============================================================
// ③-2 予約メール（受付・確定）の Gmail 下書きを作成
// ============================================================
/**
 * 1 件の予約に対し「受付メール」と「予約確定メール」の下書きを2通作成する。
 * お名前に日本語が含まれるかで日本語/英語を自動判定する。
 * 宛先メールアドレスが無い場合は何もしない。
 */
function createBookingDrafts_(info) {
  const to = (info.email || '').trim();
  if (!to || to.indexOf('@') === -1) {
    Logger.log('メールアドレスが無いため下書きをスキップ: ' + info.name);
    return;
  }
  // 言語判定はお名前のみで行う（ツアー名はフォーム上つねに日本語のため判定に使わない）
  const ja = isJapanese_(info.name);
  const ack = ja ? buildAckJa_(info) : buildAckEn_(info);
  const cfm = ja ? buildConfirmJa_(info) : buildConfirmEn_(info);

  GmailApp.createDraft(to, ack.subject, ack.body);
  GmailApp.createDraft(to, cfm.subject, cfm.body);
  Logger.log('下書き作成: ' + to + '（' + (ja ? '日本語' : '英語') + '・受付/確定）');
}

// --- 受付メール（日本語） ---
function buildAckJa_(info) {
  const subject = '【受付】ご予約リクエストありがとうございます｜' + SHOP.NAME_JA;
  const body = [
    info.name + ' 様',
    '',
    'この度は' + SHOP.NAME_JA + 'へご予約リクエストをいただき、誠にありがとうございます。',
    '以下の内容で予約リクエストを受け付けました。',
    '',
    '─────────────────────',
    ' ご希望のツアー : ' + info.tour,
    ' ご希望日       : ' + info.dateStr,
    ' ご希望時間     : ' + (info.timeStr || '（ご相談）'),
    ' 参加人数       : ' + info.people,
    '─────────────────────',
    '',
    '※このメールは「受付完了」のお知らせです。ご予約はまだ確定しておりません。',
    '　空き状況を確認のうえ、担当より改めて「予約確定」のご案内（料金・集合時間）を',
    '　お送りいたします。通常は数時間以内（遅くとも翌日まで）にご返信いたします。',
    '',
    'お急ぎの場合やご質問は、LINE からもお気軽にどうぞ。',
    '　LINE : ' + SHOP.LINE,
    '',
    signatureJa_(),
  ].join('\n');
  return { subject: subject, body: body };
}

// --- 予約確定メール（日本語） ---
function buildConfirmJa_(info) {
  const subject = '【予約確定】' + info.tour + 'のご予約が確定しました｜' + SHOP.NAME_JA;
  const body = [
    info.name + ' 様',
    '',
    SHOP.NAME_JA + 'です。',
    'ご予約が確定いたしましたので、詳細をご案内いたします。',
    '',
    '【ご予約内容】',
    '　ツアー     : ' + info.tour,
    '　日付       : ' + info.dateStr,
    '　集合時間   : 【　：　　】',
    '　参加人数   : ' + info.people,
    '　所要時間   : 約3〜4時間',
    '　料金       : 【　　　　　円】',
    '',
    '【集合・送迎】',
    '　お泊まりのホテル・宿泊先までお迎えに上がります。',
    '　お迎え場所 : 【宿泊先名／住所を記入】',
    '　お迎え時間 : 【　：　　ごろ】',
    '',
    '【お支払い】',
    '　Square（スクエア）でのクレジットカード事前決済となります。',
    '　お支払い用リンク：【Square の決済リンクを記入】',
    '　★お支払い期限：本メール送信後【2日以内】にお願いいたします。',
    '　　期限内にご決済が確認できない場合は、ご予約（確定）が自動的に取り消しと',
    '　　なりますので、あらかじめご了承ください。',
    '　※カード以外でのお支払いや現地払いをご希望の場合は、お気軽にお申し付けください。',
    '',
    '┏━━━━━━━━━━━━━━━━━━━━━━━┓',
    '　★★ 注意事項 ★★',
    '　沖縄は時期・時間帯により道路の渋滞や駐車場の満車が発生し、',
    '　お迎え・ご案内にお時間がかかる場合がございます。',
    '　あらかじめご了承くださいますようお願いいたします。',
    '┗━━━━━━━━━━━━━━━━━━━━━━━┛',
    '',
    '【ご注意事項】',
    '　・当日、体調がすぐれない場合（寝不足・二日酔い等を含む）は、',
    '　　無理をなさらず、お早めにご連絡ください。',
    '　・集合（お迎え）時間に遅れる場合は、必ずご連絡をお願いいたします。',
    '　・貴重品の管理はお客様ご自身でお願いいたします。',
    '',
    '【当日の持ち物・服装】',
    '　・水着を着用してお越しください',
    '　・ビーチサンダル／タオル／お飲み物／お着替え（任意）',
    '　※下記は当店でご用意します（料金に含まれます）',
    '　　シュノーケル器具・保険・お写真データのプレゼント',
    '',
    '【雨天・中止について】',
    '　天候により中止となる場合は、前日の夜までにメールでご連絡いたします。',
    '',
    '【キャンセルについて】',
    '　・7日前まで                : 無料',
    '　・6日前〜前日18時まで       : 料金の50%',
    '　・前日18時以降〜当日・無連絡 : 料金の100%',
    '　※悪天候など当店判断による中止の場合は、キャンセル料はいただきません。',
    '',
    'ご不明点はお気軽にご連絡ください。当日お会いできるのを楽しみにしております！',
    '',
    signatureJa_(),
  ].join('\n');
  return { subject: subject, body: body };
}

// --- 受付メール（英語） ---
function buildAckEn_(info) {
  const tour = TOUR_EN[info.tour] || info.tour;
  const subject = '[Received] Thank you for your booking request — ' + SHOP.NAME_EN;
  const body = [
    'Dear ' + info.name + ',',
    '',
    'Thank you for your booking request with ' + SHOP.NAME_EN + '.',
    'We have received your request with the following details:',
    '',
    '─────────────────────',
    ' Tour            : ' + tour,
    ' Preferred date  : ' + info.dateStr,
    ' Preferred time  : ' + (info.timeStr || '(to be advised)'),
    ' Number of guests: ' + info.people,
    '─────────────────────',
    '',
    'Please note: this is a confirmation of RECEIPT only — your booking is not yet',
    'finalized. We will check availability and send you a separate "Booking Confirmed"',
    'email with the price and pickup time, usually within a few hours (at the latest by',
    'the next day).',
    '',
    'For any questions, feel free to message us on LINE:',
    ' LINE : ' + SHOP.LINE,
    '',
    signatureEn_(),
  ].join('\n');
  return { subject: subject, body: body };
}

// --- 予約確定メール（英語） ---
function buildConfirmEn_(info) {
  const tour = TOUR_EN[info.tour] || info.tour;
  const subject = '[Booking Confirmed] Your ' + tour + ' reservation — ' + SHOP.NAME_EN;
  const body = [
    'Dear ' + info.name + ',',
    '',
    'This is ' + SHOP.NAME_EN + '. Your booking is now confirmed!',
    'Here are the details:',
    '',
    '[Your Reservation]',
    ' Tour          : ' + tour,
    ' Date          : ' + info.dateStr,
    ' Meeting time  : 【  :   】',
    ' Guests        : ' + info.people,
    ' Duration      : approx. 3-4 hours',
    ' Price         : 【          】',
    '',
    '[Pickup]',
    ' We will pick you up at your hotel / accommodation.',
    ' Pickup location : 【enter hotel name / address】',
    ' Pickup time     : 【  :   】',
    '',
    '[Payment]',
    ' Payment is by credit card in advance, via Square.',
    ' Payment link : 【enter your Square payment link】',
    ' * Payment deadline: please complete payment within 2 days of this email.',
    '   If payment is not confirmed within 2 days, your confirmed booking will be',
    '   canceled automatically. Thank you for your understanding.',
    ' * If you would prefer a payment method other than card, or to pay on-site,',
    '   please just let us know.',
    '',
    '┏━━━━━━━━━━━━━━━━━━━━━━━┓',
    ' ** Important notes **',
    ' In Okinawa, traffic congestion and full parking lots are common',
    ' depending on the season and time of day, and pickup/guiding may',
    ' take extra time. Thank you for your understanding in advance.',
    '┗━━━━━━━━━━━━━━━━━━━━━━━┛',
    '',
    '[Important notes]',
    ' - If you are not feeling well on the day (including lack of sleep',
    '   or a hangover), please do not push yourself and contact us early.',
    ' - If you will be late for pickup, please be sure to let us know.',
    ' - Please look after your own valuables.',
    '',
    '[What to bring / wear]',
    ' - Please put your swimsuit on before pickup',
    ' - Beach sandals / towel / a drink / a change of clothes (optional)',
    ' * We provide the following (included in the price):',
    '   snorkeling gear, insurance, and a gift of your photo data.',
    '',
    '[Weather / cancellation by us]',
    ' If the tour must be canceled due to weather, we will contact you by email',
    ' by the night before.',
    '',
    '[Cancellation policy]',
    ' - Up to 7 days before                              : free',
    ' - 6 days before to 18:00 the day before            : 50% of the fee',
    ' - After 18:00 the day before / same day / no-show  : 100% of the fee',
    ' * No cancellation fee if we cancel the tour due to bad weather.',
    '',
    'If you have any questions, please let us know.',
    'We look forward to seeing you!',
    '',
    signatureEn_(),
  ].join('\n');
  return { subject: subject, body: body };
}

function signatureJa_() {
  return [
    '──────────────────────────────',
    ' ' + SHOP.NAME_JA + ' / ' + SHOP.NAME_EN,
    ' 担当：' + SHOP.OWNER_JA,
    ' TEL  : ' + SHOP.TEL,
    ' Mail : ' + SHOP.MAIL,
    ' Web  : ' + SHOP.WEB,
    '──────────────────────────────',
  ].join('\n');
}

function signatureEn_() {
  return [
    '──────────────────────────────',
    ' ' + SHOP.NAME_EN,
    ' Guide : ' + SHOP.OWNER_EN,
    ' Tel   : ' + SHOP.TEL_INTL,
    ' Mail  : ' + SHOP.MAIL,
    ' Web   : ' + SHOP.WEB,
    '──────────────────────────────',
  ].join('\n');
}

/** 文字列に日本語（ひらがな・カタカナ・漢字）が含まれるか */
function isJapanese_(s) {
  return /[぀-ヿ㐀-鿿]/.test(s || '');
}

// ============================================================
// ④ ユーティリティ
// ============================================================
/**
 * HTML を、タグ境界で改行した「行の配列」に変換する。
 * FormSubmit の表は <td>ラベル</td><td>値</td> 構造なので、
 * 変換後は「ラベル」「値」が交互の行になる。
 */
function htmlToLines_(html) {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(td|th|tr|p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
  return text
    .split('\n')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * 行配列から、ラベルに一致する行の「次の行」を値として返す。
 * 値が空（次が別ラベル）の場合は空文字を返す。
 */
function getField_(lines, label) {
  const knownLabels = [
    'ご希望のツアー', 'お名前', 'email', '電話番号', 'ご希望日', 'ご希望時間',
    '参加人数', 'お子様の有無', '宿泊先', '備考', 'policy_agree', 'Name', 'Value',
  ];
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === label) {
      const next = lines[i + 1];
      // 次の行が別のラベルなら値は空とみなす
      return knownLabels.indexOf(next) === -1 ? next : '';
    }
  }
  return '';
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ============================================================
// ⑤ 前日リマインドメール（自動送信）＋ 確認ボタン
// ============================================================
/**
 * 「翌日」が予約日の予定を探し、お客様へリマインドメールを自動送信する。
 * メールには「参加を確認する」ボタン（ウェブアプリへのリンク）を入れる。
 * 二重送信防止のため、送信した予定の説明欄に目印を追記する。
 * タイトルの冒頭が「キャンセル」の予定（例: 「キャンセル那覇シュノーケル…」）は対象外。
 * → 毎日 1 回のトリガーで実行する（createReminderTrigger）。
 */
function processReminders() {
  if (!CONFIG.SEND_REMINDERS) return;

  const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (calendars.length === 0) {
    throw new Error('カレンダーが見つかりません: ' + CONFIG.CALENDAR_NAME);
  }
  const calendar = calendars[0];

  // 「翌日(日本時間)」の 0:00〜24:00 の予定を対象にする。
  // プロジェクトのタイムゾーンに依存しないよう、日本時間で日付を判定する。
  const tzTomorrow = Utilities.formatDate(
    new Date(Date.now() + 24 * 60 * 60 * 1000), 'Asia/Tokyo', 'yyyy/MM/dd').split('/');
  const dayStart = jstDate_(Number(tzTomorrow[0]), Number(tzTomorrow[1]), Number(tzTomorrow[2]), 0, 0);
  const events = calendar.getEvents(dayStart, new Date(dayStart.getTime() + 24 * 60 * 60 * 1000));

  let sent = 0;
  events.forEach(function (ev) {
    try {
      // タイトル冒頭が「キャンセル」の予定はリマインドを送らない
      if (/^\s*キャンセル/.test(ev.getTitle() || '')) return;

      const desc = ev.getDescription() || '';
      if (desc.indexOf(CONFIG.REMINDED_MARK) !== -1) return; // 送信済み

      const info = parseEventInfo_(ev);
      if (!info.email || info.email.indexOf('@') === -1) return; // 宛先なし

      const ja = isJapanese_(info.name);
      const url = buildConfirmUrl_(ev, ja ? 'ja' : 'en');
      const mail = ja ? buildReminderJa_(info, url) : buildReminderEn_(info, url);

      GmailApp.sendEmail(info.email, mail.subject, mail.text, {
        htmlBody: mail.html,
        name: ja ? SHOP.NAME_JA : SHOP.NAME_EN,
        replyTo: SHOP.MAIL,
      });

      const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
      ev.setDescription(desc + '\n' + CONFIG.REMINDED_MARK + ' ' + stamp);
      sent++;
      Logger.log('リマインド送信: ' + info.email + '（' + (ja ? '日本語' : '英語') + '）');
    } catch (e) {
      Logger.log('リマインドエラー: ' + e);
    }
  });

  Logger.log('リマインド完了: ' + sent + ' 件送信しました');
}

/**
 * ウェブアプリのエンドポイント。お客様が「参加を確認する」ボタンを押すと呼ばれる。
 * 予定IDとトークンを検証し、正しければカレンダー予定を「確認済み」にする。
 */
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const id = p.id || '';
  const token = p.t || '';
  const lang = (p.l === 'en') ? 'en' : 'ja';

  // トークン検証（URLの改ざん防止）
  if (!id || token !== makeToken_(id)) {
    return confirmPage_(lang, 'error');
  }

  try {
    const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
    const calendar = calendars[0];
    const ev = calendar.getEventById(id);
    if (!ev) return confirmPage_(lang, 'error');

    const title = ev.getTitle();
    if (title.indexOf('✅') === -1) {
      ev.setTitle('✅ ' + title);
      const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
      ev.setDescription((ev.getDescription() || '') + '\n----\nお客様確認済み: ' + stamp);
      try { ev.setColor(CalendarApp.EventColor.GREEN); } catch (_) {}
      return confirmPage_(lang, 'ok');
    }
    // すでに確認済み
    return confirmPage_(lang, 'already');
  } catch (err) {
    Logger.log('doGet エラー: ' + err);
    return confirmPage_(lang, 'error');
  }
}

/** 確認ボタンのURL（ウェブアプリURL＋予定ID＋トークン＋言語）を作る */
function buildConfirmUrl_(ev, lang) {
  // 本番URLを優先（未設定なら getUrl で自動取得）
  const base = CONFIG.WEBAPP_URL || ScriptApp.getService().getUrl();
  const id = ev.getId();
  return base + '?id=' + encodeURIComponent(id) + '&t=' + makeToken_(id) + '&l=' + lang;
}

/** 予定IDとシークレットから短いトークンを生成（改ざん防止） */
function makeToken_(eventId) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, eventId + '|' + CONFIG.CONFIRM_SECRET);
  return raw.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('').substring(0, 16);
}

/** カレンダー予定の説明欄から予約情報を取り出す（リマインド用） */
function parseEventInfo_(ev) {
  const desc = ev.getDescription() || '';
  const start = ev.getStartTime();
  return {
    name: getDescVal_(desc, 'お名前'),
    email: getDescVal_(desc, 'email'),
    tour: getDescVal_(desc, 'ご希望のツアー'),
    people: getDescVal_(desc, '参加人数'),
    /* お迎え先＝予約時にいただいた「宿泊先」。前日メールの集合場所として使う */
    place: getDescVal_(desc, '宿泊先'),
    dateStr: Utilities.formatDate(start, 'Asia/Tokyo', 'yyyy-MM-dd'),
    timeStr: Utilities.formatDate(start, 'Asia/Tokyo', 'HH:mm'),
  };
}

/**
 * 宿泊先が実際の場所として使えるか判定する。
 * 「（記載なし）」「未定」など、お迎え先が確定していない値は false を返す。
 */
function hasPickupPlace_(place) {
  if (!place) return false;
  var t = String(place).replace(/[\s　]/g, '');
  if (!t) return false;
  if (/^[（(]?(記載なし|なし|未定|不明|-|－)[)）]?$/.test(t)) return false;
  if (t.indexOf('未定') !== -1) return false;
  return true;
}

/** 説明欄テキストから「ラベル: 値」の値を取り出す */
function getDescVal_(desc, label) {
  const lines = desc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf(label + ':');
    if (idx !== -1) return lines[i].substring(idx + label.length + 1).trim();
  }
  return '';
}

// --- 前日リマインド（日本語） ---
function buildReminderJa_(info, url) {
  const subject = '【明日のご予約】ご参加確認のお願い｜' + SHOP.NAME_JA;
  const t = esc_(info.tour), n = esc_(info.name);
  const html =
    '<div style="font-family:\'Hiragino Sans\',\'Yu Gothic\',sans-serif;max-width:560px;margin:0 auto;color:#1a2a2a;line-height:1.75;">' +
      '<p>' + n + ' 様</p>' +
      '<p>いよいよ明日、<b>' + t + '</b> のツアー当日です！<br>スタッフ一同、お会いできるのを楽しみにしております。</p>' +
      meetBoxJa_(info) +
      detailTableJa_(info) +
      warnBoxHtml_(true) +
      '<p>お手数ですが、下記ボタンから<b>ご参加の確認</b>をお願いいたします。</p>' +
      buttonHtml_(url, '参加を確認する') +
      '<p style="font-size:13px;color:#777;">※ボタンを押すと、当店に「確認済み」として通知されます。<br>※ボタンが開けない場合は、このメールへのご返信か LINE で「確認しました」とお知らせください。</p>' +
      '<p><b>当日の持ち物・服装</b><br>水着を着用してお越しください／ビーチサンダル・タオル・お飲み物・お着替え（任意）</p>' +
      '<p style="font-size:13px;color:#555;"><b>ご注意事項</b><br>' +
        '・当日、体調がすぐれない場合（寝不足・二日酔い等を含む）は、無理をなさらずお早めにご連絡ください。<br>' +
        '・集合（お迎え）時間に遅れる場合は、必ずご連絡をお願いいたします。<br>' +
        '・貴重品の管理はお客様ご自身でお願いいたします。</p>' +
      '<p style="font-size:13px;color:#555;">天候などでキャンセルとなる場合は当店よりご連絡いたします。ご不明点はお気軽にご連絡ください。</p>' +
      signatureHtmlJa_() +
    '</div>';
  const text = [
    info.name + ' 様', '',
    'いよいよ明日、' + info.tour + ' のツアー当日です！',
    'お会いできるのを楽しみにしております。', '',
    '━━━━━━━━━━━━━━━━━━',
    '■ 集合時間（お迎え）: ' + info.timeStr + '　' + info.dateStr + '（明日）',
    '■ 集合場所（お迎え先）: ' + (hasPickupPlace_(info.place)
      ? info.place + '\n　　ロビー・エントランスまでお迎えにあがります。'
      : '未確定です\n　　このメールへのご返信、または LINE でご宿泊先をお知らせください。'),
    '━━━━━━━━━━━━━━━━━━', '',
    '【ご予約内容】',
    '　ツアー   : ' + info.tour,
    '　日付     : ' + info.dateStr + '（明日）',
    '　集合時間 : ' + info.timeStr,
    '　集合場所 : ' + (hasPickupPlace_(info.place) ? info.place : '未確定（ご連絡ください）'),
    '　参加人数 : ' + info.people, '',
    '★★ 注意事項 ★★',
    '沖縄は時期・時間帯により道路の渋滞や駐車場の満車が発生し、',
    'お迎え・ご案内にお時間がかかる場合がございます。',
    'あらかじめご了承ください。', '',
    'お手数ですが、下記URLからご参加の確認をお願いいたします。',
    url, '',
    '※開けない場合は、このメールへのご返信か LINE で「確認しました」とお知らせください。', '',
    '【当日の持ち物・服装】',
    '水着を着用してお越しください／ビーチサンダル・タオル・お飲み物・お着替え（任意）', '',
    '【ご注意事項】',
    '　・当日、体調がすぐれない場合（寝不足・二日酔い等を含む）は、',
    '　　無理をなさらず、お早めにご連絡ください。',
    '　・集合（お迎え）時間に遅れる場合は、必ずご連絡をお願いいたします。',
    '　・貴重品の管理はお客様ご自身でお願いいたします。', '',
    signatureText_('ja'),
  ].join('\n');
  return { subject: subject, html: html, text: text };
}

// --- 前日リマインド（英語） ---
function buildReminderEn_(info, url) {
  const tourEn = TOUR_EN[info.tour] || info.tour;
  const subject = '[Tomorrow] Please confirm your tour — ' + SHOP.NAME_EN;
  const t = esc_(tourEn), n = esc_(info.name);
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a2a2a;line-height:1.75;">' +
      '<p>Dear ' + n + ',</p>' +
      '<p>Your <b>' + t + '</b> tour is <b>tomorrow</b>!<br>We are looking forward to seeing you.</p>' +
      meetBoxEn_(info) +
      detailTableEn_(info, tourEn) +
      warnBoxHtml_(false) +
      '<p>Please confirm your attendance using the button below.</p>' +
      buttonHtml_(url, 'Confirm my attendance') +
      '<p style="font-size:13px;color:#777;">* Pressing the button notifies us that you are confirmed.<br>* If the button does not open, simply reply to this email or message us on LINE to confirm.</p>' +
      '<p><b>What to bring / wear</b><br>Please put your swimsuit on before pickup / beach sandals, towel, a drink, a change of clothes (optional)</p>' +
      '<p style="font-size:13px;color:#555;"><b>Important notes</b><br>' +
        '- If you are not feeling well on the day (including lack of sleep or a hangover), please do not push yourself and contact us early.<br>' +
        '- If you will be late for pickup, please be sure to let us know.<br>' +
        '- Please look after your own valuables.</p>' +
      '<p style="font-size:13px;color:#555;">If the tour has to be cancelled due to weather, we will contact you. Please feel free to get in touch with any questions.</p>' +
      signatureHtmlEn_() +
    '</div>';
  const text = [
    'Dear ' + info.name + ',', '',
    'Your ' + tourEn + ' tour is tomorrow!',
    'We are looking forward to seeing you.', '',
    '======================',
    '* PICKUP TIME  : ' + info.timeStr + '   ' + info.dateStr + ' (tomorrow)',
    '* PICKUP PLACE : ' + (hasPickupPlace_(info.place)
      ? info.place + '\n                 We will meet you at the lobby / entrance.'
      : 'Not yet confirmed\n                 Please reply to this email or message us on LINE with your hotel.'),
    '======================', '',
    '[Your Reservation]',
    ' Tour          : ' + tourEn,
    ' Date          : ' + info.dateStr + ' (tomorrow)',
    ' Meeting time  : ' + info.timeStr,
    ' Pickup        : ' + (hasPickupPlace_(info.place) ? info.place : 'Not yet confirmed — please let us know'),
    ' Guests        : ' + info.people, '',
    '** Important notes **',
    'In Okinawa, traffic congestion and full parking lots are common',
    'depending on the season and time of day, and pickup/guiding may',
    'take extra time. Thank you for your understanding in advance.', '',
    'Please confirm your attendance using the link below:',
    url, '',
    '* If the link does not open, simply reply to this email or message us on LINE to confirm.', '',
    '[What to bring / wear]',
    'Please put your swimsuit on before pickup / beach sandals, towel, a drink, a change of clothes (optional)', '',
    '[Important notes]',
    ' - If you are not feeling well on the day (including lack of sleep',
    '   or a hangover), please do not push yourself and contact us early.',
    ' - If you will be late for pickup, please be sure to let us know.',
    ' - Please look after your own valuables.', '',
    signatureText_('en'),
  ].join('\n');
  return { subject: subject, html: html, text: text };
}

/** お客様が見る確認結果ページ（ボタン押下後） */
function confirmPage_(lang, status) {
  const ja = (lang !== 'en');
  let head, msg, color;
  if (status === 'ok') {
    color = '#00A896';
    head = ja ? 'ご確認ありがとうございます' : 'Thank you for confirming';
    msg = ja ? '当日お会いできるのを楽しみにしております！' : 'We look forward to seeing you!';
  } else if (status === 'already') {
    color = '#00A896';
    head = ja ? 'すでに確認済みです' : 'Already confirmed';
    msg = ja ? 'ご確認は受付済みです。当日お会いしましょう！' : 'Your attendance is already confirmed. See you soon!';
  } else {
    color = '#c0392b';
    head = ja ? 'リンクが無効です' : 'Invalid link';
    msg = ja ? 'お手数ですが、メールに記載のお問い合わせ先までご連絡ください。' : 'Please contact us using the details in your email.';
  }
  const html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + head + '</title></head>' +
    '<body style="margin:0;font-family:sans-serif;background:#F0FBF8;">' +
    '<div style="max-width:480px;margin:12vh auto;background:#fff;border-radius:16px;padding:40px 28px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08);">' +
    '<div style="font-size:48px;margin-bottom:8px;">' + (status === 'error' ? '⚠️' : '✅') + '</div>' +
    '<h1 style="color:' + color + ';font-size:22px;margin:0 0 12px;">' + head + '</h1>' +
    '<p style="color:#444;line-height:1.7;margin:0 0 24px;">' + msg + '</p>' +
    '<p style="color:#888;font-size:14px;margin:0;">' + SHOP.NAME_JA + ' / ' + SHOP.NAME_EN + '</p>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html);
}

// --- リマインド用の小さな HTML 部品 ---
/** 渋滞・駐車場満車による待ち時間の注意を目立たせる警告ボックス（オレンジ） */
function warnBoxHtml_(ja) {
  const title = ja ? '⚠ 注意事項'
                   : '⚠ Important notes';
  const body = ja
    ? '沖縄は時期・時間帯により<b>道路の渋滞や駐車場の満車</b>が発生し、お迎え・ご案内にお時間がかかる場合がございます。あらかじめご了承ください。'
    : 'In Okinawa, <b>traffic congestion and full parking lots</b> are common depending on the season and time of day, and pickup/guiding may take extra time. Thank you for your understanding in advance.';
  return '<div style="background:#FFF4E5;border-left:5px solid #FF8C00;border-radius:8px;padding:14px 16px;margin:18px 0;">' +
    '<p style="margin:0;color:#9a4b00;font-weight:bold;font-size:15px;">' + title + '</p>' +
    '<p style="margin:8px 0 0;color:#5a3a10;line-height:1.7;font-size:14px;">' + body + '</p></div>';
}

function buttonHtml_(url, label) {
  return '<p style="text-align:center;margin:28px 0;">' +
    '<a href="' + url + '" style="display:inline-block;background:#00A896;color:#ffffff;' +
    'text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px;">' +
    label + '</a></p>';
}

/**
 * 集合時間・集合場所だけを大きく見せる枠。
 * 前日メールで最も知りたい2点なので、明細表とは別に先頭へ置く。
 */
function meetBoxJa_(info) {
  var placeHtml = hasPickupPlace_(info.place)
    ? '<div style="font-size:17px;font-weight:bold;color:#003D35;line-height:1.5;">' + esc_(info.place) + '</div>' +
      '<div style="font-size:12px;color:#00756a;margin-top:2px;">ロビー・エントランスまでお迎えにあがります</div>'
    : '<div style="font-size:15px;font-weight:bold;color:#c62828;line-height:1.6;">お迎え先が未確定です</div>' +
      '<div style="font-size:12px;color:#555;margin-top:2px;">このメールへのご返信、または LINE でご宿泊先をお知らせください。</div>';
  return '<table role="presentation" style="width:100%;border-collapse:collapse;background:#E8F7F2;border:2px solid #00A896;border-radius:12px;margin:18px 0;">' +
    '<tr><td style="padding:14px 18px 10px;">' +
      '<div style="font-size:11px;font-weight:bold;color:#00756a;letter-spacing:.1em;">⏰ 集合時間（お迎え）</div>' +
      '<div style="font-size:26px;font-weight:bold;color:#003D35;line-height:1.25;">' + esc_(info.timeStr) + '</div>' +
      '<div style="font-size:12px;color:#00756a;">' + esc_(info.dateStr) + '（明日）</div>' +
    '</td></tr>' +
    '<tr><td style="padding:10px 18px 15px;border-top:1px dashed rgba(0,168,150,.45);">' +
      '<div style="font-size:11px;font-weight:bold;color:#00756a;letter-spacing:.1em;">📍 集合場所（お迎え先）</div>' +
      placeHtml +
    '</td></tr>' +
    '</table>';
}

function meetBoxEn_(info) {
  var placeHtml = hasPickupPlace_(info.place)
    ? '<div style="font-size:17px;font-weight:bold;color:#003D35;line-height:1.5;">' + esc_(info.place) + '</div>' +
      '<div style="font-size:12px;color:#00756a;margin-top:2px;">We will meet you at the lobby / entrance.</div>'
    : '<div style="font-size:15px;font-weight:bold;color:#c62828;line-height:1.6;">Pickup location not yet confirmed</div>' +
      '<div style="font-size:12px;color:#555;margin-top:2px;">Please reply to this email or message us on LINE with your hotel.</div>';
  return '<table role="presentation" style="width:100%;border-collapse:collapse;background:#E8F7F2;border:2px solid #00A896;border-radius:12px;margin:18px 0;">' +
    '<tr><td style="padding:14px 18px 10px;">' +
      '<div style="font-size:11px;font-weight:bold;color:#00756a;letter-spacing:.1em;">⏰ PICKUP TIME</div>' +
      '<div style="font-size:26px;font-weight:bold;color:#003D35;line-height:1.25;">' + esc_(info.timeStr) + '</div>' +
      '<div style="font-size:12px;color:#00756a;">' + esc_(info.dateStr) + ' (tomorrow)</div>' +
    '</td></tr>' +
    '<tr><td style="padding:10px 18px 15px;border-top:1px dashed rgba(0,168,150,.45);">' +
      '<div style="font-size:11px;font-weight:bold;color:#00756a;letter-spacing:.1em;">📍 PICKUP LOCATION</div>' +
      placeHtml +
    '</td></tr>' +
    '</table>';
}

function detailTableJa_(info) {
  return '<table style="width:100%;border-collapse:collapse;background:#F0FBF8;border-radius:10px;margin:16px 0;">' +
    rowHtml_('ツアー', esc_(info.tour)) +
    rowHtml_('日付', esc_(info.dateStr) + '（明日）') +
    rowHtml_('集合時間', esc_(info.timeStr)) +
    rowHtml_('集合場所', hasPickupPlace_(info.place) ? esc_(info.place) : '未確定（ご連絡ください）') +
    rowHtml_('参加人数', esc_(info.people)) +
    '</table>';
}

function detailTableEn_(info, tourEn) {
  return '<table style="width:100%;border-collapse:collapse;background:#F0FBF8;border-radius:10px;margin:16px 0;">' +
    rowHtml_('Tour', esc_(tourEn)) +
    rowHtml_('Date', esc_(info.dateStr) + ' (tomorrow)') +
    rowHtml_('Meeting time', esc_(info.timeStr)) +
    rowHtml_('Pickup', hasPickupPlace_(info.place) ? esc_(info.place) : 'Not yet confirmed — please let us know') +
    rowHtml_('Guests', esc_(info.people)) +
    '</table>';
}

function rowHtml_(label, value) {
  return '<tr>' +
    '<td style="padding:8px 14px;color:#00756a;font-weight:bold;white-space:nowrap;">' + label + '</td>' +
    '<td style="padding:8px 14px;color:#1a2a2a;">' + value + '</td></tr>';
}

function signatureHtmlJa_() {
  return '<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0 12px;">' +
    '<p style="font-size:13px;color:#555;line-height:1.7;margin:0;">' +
    '<b>' + SHOP.NAME_JA + '</b> / ' + SHOP.NAME_EN + '<br>' +
    '担当：' + SHOP.OWNER_JA + '<br>' +
    'TEL：' + SHOP.TEL + '<br>Mail：' + SHOP.MAIL + '<br>' +
    'LINE：<a href="' + SHOP.LINE + '">' + SHOP.LINE + '</a><br>' +
    'Web：<a href="' + SHOP.WEB + '">' + SHOP.WEB + '</a></p>';
}

function signatureHtmlEn_() {
  return '<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0 12px;">' +
    '<p style="font-size:13px;color:#555;line-height:1.7;margin:0;">' +
    '<b>' + SHOP.NAME_EN + '</b><br>' +
    'Guide: ' + SHOP.OWNER_EN + '<br>' +
    'Tel: ' + SHOP.TEL_INTL + '<br>Mail: ' + SHOP.MAIL + '<br>' +
    'LINE: <a href="' + SHOP.LINE + '">' + SHOP.LINE + '</a><br>' +
    'Web: <a href="' + SHOP.WEB + '">' + SHOP.WEB + '</a></p>';
}

function signatureText_(lang) {
  return (lang === 'en') ? signatureEn_() : signatureJa_();
}

/** HTML エスケープ（本文に差し込む値の安全化） */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 前日リマインドの自動実行トリガーを設定する（毎日 10:00 ごろ）。
 * 最初に 1 度だけ手動実行する。
 */
function createReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processReminders').timeBased().everyDays(1).atHour(10).create();
  Logger.log('リマインド用トリガーを作成しました（毎日 10 時台）');
}

/**
 * 5 分おきの自動実行トリガーを設定する（最初に 1 度だけ手動実行）。
 */
function createTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processMailToCalendar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processMailToCalendar').timeBased().everyMinutes(5).create();
  Logger.log('トリガーを作成しました（5 分おき）');
}

// ============================================================
// ⑥ あそびゅー（asoview）予約確定メール → カレンダー
// ============================================================
/**
 * あそびゅーの「予約が確定しました」メールを解析し、同じ「予約状況」カレンダーに登録する。
 * ・対象: mailsender@asoview.com / 件名に「予約が確定」を含むメールのみ
 *         （認証コード・お申し込み通知・反映済み通知などは対象外）
 * ・本文はプレーンテキスト（「ラベル | 値」「◆ラベル | 値」形式）を解析する。
 * ・お客様のメールアドレスは記載されないため、自動返信の下書き・前日リマインドは作らない
 *   （＝カレンダー登録のみ）。processMailToCalendar から毎回呼ばれる。
 */
function processAsoview_() {
  const label = getOrCreateLabel_(CONFIG.PROCESSED_LABEL);
  const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (calendars.length === 0) {
    throw new Error('カレンダーが見つかりません: ' + CONFIG.CALENDAR_NAME);
  }
  const calendar = calendars[0];

  const query = 'from:mailsender@asoview.com subject:予約が確定 -label:' + CONFIG.PROCESSED_LABEL;
  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);

  let created = 0;
  threads.forEach(function (thread) {
    let anyHandled = false;
    thread.getMessages().forEach(function (message) {
      const subject = message.getSubject() || '';
      // 「予約が確定」以外（認証コード等が同スレッドに混ざった場合）はスキップ
      if (subject.indexOf('予約が確定') === -1) { anyHandled = true; return; }
      try {
        const info = parseAsoviewReservation_(message);
        if (!info) { Logger.log('アソビュー: 催行日を抽出できませんでした: ' + subject); return; }
        calendar.createEvent(info.title, info.start, info.end, { description: info.description });
        created++; anyHandled = true;
        Logger.log('アソビュー登録: ' + info.title + ' @ ' + info.start);
      } catch (e) {
        Logger.log('アソビューエラー (' + subject + '): ' + e);
      }
    });
    if (anyHandled) thread.addLabel(label);
  });

  Logger.log('アソビュー完了: ' + created + ' 件の予定を登録しました');
}

/**
 * あそびゅーの予約確定メール（プレーンテキスト）から予約情報を抽出する。
 * 催行日が取れなければ null を返す。
 */
function parseAsoviewReservation_(message) {
  const body = message.getPlainBody() || '';
  // 全角スペースを半角化し、行ごとに整形
  const lines = body.split('\n').map(function (s) { return s.replace(/　/g, ' ').trim(); });

  const name    = asvField_(lines, '予約代表者氏名').replace(/\s*様\s*$/, '');
  const tel     = asvField_(lines, '電話番号');
  const dateRaw = asvField_(lines, '催行日');
  const course  = asvField_(lines, 'コース');
  const activity= asvField_(lines, 'アクティビティ');
  const plan    = asvField_(lines, 'プラン名');
  const price   = asvField_(lines, '提示金額');
  const pay     = asvField_(lines, '支払い方法');
  const meet    = asvField_(lines, '集合場所');
  const hotel   = asvDetail_(lines, 'ホテル名');
  const note    = asvDetail_(lines, 'ご質問');

  // --- 催行日（必須） ---
  const dm = dateRaw.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!dm) return null;
  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);
  const weekday = (dateRaw.match(/（[^）]*）/) || [''])[0]; // 例:（土曜日）

  // --- 時刻（コース。無ければ既定の開始時刻） ---
  let startHour = CONFIG.DEFAULT_START_HOUR, startMin = 0;
  const tm = course.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
  if (tm) { startHour = Number(tm[1]); startMin = Number(tm[2]); }

  const start = jstDate_(y, mo, d, startHour, startMin);
  const end = new Date(start.getTime() + CONFIG.DURATION_HOURS * 60 * 60 * 1000);

  // --- 人数（「◯◯ | 6000円 × 2名」の行を集計） ---
  let adult = 0, child = 0;
  const parts = [];
  lines.forEach(function (ln) {
    const m = ln.match(/^(.+?)\s*\|\s*[\d,]+\s*円\s*[×✕xX]\s*(\d+)\s*名/);
    if (m) {
      const cat = m[1], n = Number(m[2]);
      const shortCat = (cat.match(/^[^（(\s]+/) || [cat])[0]; // 「大人（…）」→「大人」
      parts.push(shortCat + n + '名');
      if (/小人|子供|こども|幼児|小学生以下|未就学/.test(cat)) child += n; else adult += n;
    }
  });
  const total = adult + child;
  const peopleSummary = total > 0 ? ('計' + total + '名（' + parts.join('・') + '）') : '（記載なし）';
  const childInfo = child > 0 ? ('あり（子供' + child + '名）') : 'なし';

  // --- 予約番号・管理URL ---
  const urlLine = lines.filter(function (l) { return l.indexOf('manager.asoview.com') !== -1; })[0] || '';
  const rm = body.match(/reserveNo(\d+)/);
  const reserveNo = rm ? rm[1] : '';

  // --- タイトル & 説明 ---
  const tourLabel = activity + (plan ? '／' + plan : '');
  const title = '【アソビュー】' + (activity || 'ご予約') +
    (name ? '（' + name + (total > 0 ? ' ' + total + '名' : '') + '）' : '');

  const dateStr = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2) + weekday;
  const timeStr = tm ? (startHour + ':' + ('0' + startMin).slice(-2)) : ('（コース: ' + (course || '記載なし') + '）');

  const description = [
    '【アソビュー予約】',
    'ご希望のツアー: ' + tourLabel,
    'お名前: ' + name,
    'email: （アソビュー経由・記載なし）',
    '電話番号: ' + tel,
    'ご希望日: ' + dateStr,
    'ご希望時間: ' + timeStr,
    '参加人数: ' + peopleSummary,
    'お子様の有無: ' + childInfo,
    '宿泊先: ' + (hotel || '（記載なし）'),
    '備考: ' + (note || '（なし）'),
    '',
    '────── 参考情報 ──────',
    '料金: ' + (price || '－') + ' / 支払い: ' + (pay || '－'),
    '集合場所: ' + (meet || '－'),
    '予約番号: ' + (reserveNo || '－'),
    '管理URL: ' + urlLine,
    '',
    '※ アソビューの予約確定メールから自動登録',
  ].join('\n');

  return { title: title, start: start, end: end, description: description };
}

/**
 * プレーンテキストの「ラベル | 値」行から値を取得する。
 * 行頭の ◆◇・ や前後の空白は無視し、ラベルは完全一致で判定する
 * （「電話番号」と「当日電話番号」、「予約代表者氏名」と「予約代表者氏名カナ」を区別）。
 * 区切りは最初の半角「|」。値の中に全角「｜」が含まれても影響しない。
 */
function asvField_(lines, label) {
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf('|');
    if (idx === -1) continue;
    const left = lines[i].slice(0, idx).replace(/^[◆◇・\s]+/, '').trim();
    if (left === label) return lines[i].slice(idx + 1).trim();
  }
  return '';
}

/**
 * 【申込詳細内容】の「◆質問文／＜内容＞／回答」ブロックから、
 * 質問文に keyword を含む項目の回答を取得する。
 */
function asvDetail_(lines, keyword) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('◆') !== -1 && lines[i].indexOf(keyword) !== -1) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].indexOf('＜内容＞') !== -1 || lines[j].indexOf('<内容>') !== -1) {
          const vals = [];
          for (let k = j + 1; k < lines.length; k++) {
            const l = lines[k];
            if (l.indexOf('◆') !== -1) break;
            if (l.indexOf('ご不明点') !== -1) break;
            if (l.indexOf('アソビュー') !== -1) break;
            if (/^[-—─=]{3,}$/.test(l)) break;
            if (l.length) vals.push(l);
          }
          return vals.join(' ').trim();
        }
      }
      return '';
    }
  }
  return '';
}

// ============================================================
// ⑦ アクティビティジャパン（activityjapan）確定予約通知 → カレンダー
// ============================================================
/**
 * アクティビティジャパンの「即時確定予約通知」メールを解析し、同じカレンダーに登録する。
 * ・対象: 件名に「確定予約通知」を含み、本文に「アクティビティジャパン」を含むメール
 *         （送信元は本来 reserve-system@activityjapan.com。転送された場合も拾えるよう
 *          件名＋本文で判定する。オファー通知・メッセージ受信通知などは対象外）
 * ・本文はプレーンテキスト（「ラベル：値」全角コロン区切り）。転送の「> 」引用符も除去。
 * ・時刻はプラン名末尾の「（HH:MM）」から取得する。
 * ・お客様のメールアドレスは記載されないため、カレンダー登録のみ（返信下書き・リマインドなし）。
 */
function processActivityJapan_() {
  const label = getOrCreateLabel_(CONFIG.PROCESSED_LABEL);
  const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (calendars.length === 0) {
    throw new Error('カレンダーが見つかりません: ' + CONFIG.CALENDAR_NAME);
  }
  const calendar = calendars[0];

  const query = 'subject:確定予約通知 -label:' + CONFIG.PROCESSED_LABEL;
  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);

  let created = 0;
  threads.forEach(function (thread) {
    let anyHandled = false;
    thread.getMessages().forEach(function (message) {
      const subject = message.getSubject() || '';
      const body = message.getPlainBody() || '';
      // 「確定予約通知」かつアクティビティジャパンのメールだけを対象にする
      if (subject.indexOf('確定予約通知') === -1) { anyHandled = true; return; }
      if (body.indexOf('アクティビティジャパン') === -1 && body.indexOf('activityjapan') === -1) {
        anyHandled = true; return;
      }
      try {
        const info = parseActivityJapanReservation_(body);
        if (!info) { Logger.log('AJ: 日時を抽出できませんでした: ' + subject); return; }
        calendar.createEvent(info.title, info.start, info.end, { description: info.description });
        created++; anyHandled = true;
        Logger.log('AJ登録: ' + info.title + ' @ ' + info.start);
      } catch (e) {
        Logger.log('AJエラー (' + subject + '): ' + e);
      }
    });
    if (anyHandled) thread.addLabel(label);
  });

  Logger.log('アクティビティジャパン完了: ' + created + ' 件の予定を登録しました');
}

/**
 * アクティビティジャパンの確定予約通知（プレーンテキスト）から予約情報を抽出する。
 * 催行日が取れなければ null を返す。転送メール（各行「> 」付き）にも対応。
 */
function parseActivityJapanReservation_(body) {
  // 転送の引用符「> 」、全角スペースを正規化して行配列に
  const lines = body.split('\n').map(function (s) {
    return s.replace(/^\s*>+\s?/, '').replace(/　/g, ' ').replace(/\s+$/, '');
  });

  const resNo   = ajField_(lines, '予約番号');
  const dateRaw = ajField_(lines, '日時');
  const name    = ajField_(lines, '氏名').replace(/\s*[(（].*?[)）]\s*$/, '').trim(); // カナ括弧を除去
  const tel     = ajField_(lines, '電話番号');
  const plan    = ajField_(lines, 'プラン名（コース名）') || ajField_(lines, 'プラン名');
  const pay     = ajField_(lines, '支払方法');
  const bill    = ajField_(lines, 'お客様へのご請求料金') || ajField_(lines, '合計料金');

  // --- 催行日（必須） ---
  const dm = dateRaw.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!dm) return null;
  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);

  // --- 時刻：プラン名末尾の「（HH:MM）」 ---
  let startHour = CONFIG.DEFAULT_START_HOUR, startMin = 0, timeFound = false;
  const times = plan.match(/[（(]\s*\d{1,2}\s*[:：]\s*\d{2}\s*[)）]/g);
  if (times && times.length) {
    const t = times[times.length - 1].match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
    startHour = Number(t[1]); startMin = Number(t[2]); timeFound = true;
  }

  const start = jstDate_(y, mo, d, startHour, startMin);
  const end = new Date(start.getTime() + CONFIG.DURATION_HOURS * 60 * 60 * 1000);

  // --- 人数：「◯◯ × N 人」行を集計（単位は「人」） ---
  let adult = 0, child = 0;
  const parts = [];
  lines.forEach(function (ln) {
    const m = ln.trim().match(/^(.+?)\s*[×✕xX]\s*(\d+)\s*人\s*$/);
    if (m) {
      const cat = m[1], n = Number(m[2]);
      const shortCat = (cat.match(/^[^（(\s]+/) || [cat])[0];
      parts.push(shortCat + n + '名');
      if (/子供|子ども|こども|小人|幼児|未就学/.test(cat)) child += n; else adult += n;
    }
  });
  const total = adult + child;
  const peopleSummary = total > 0 ? ('計' + total + '名（' + parts.join('・') + '）') : '（記載なし）';
  const childInfo = child > 0 ? ('あり（子供' + child + '名）') : 'なし';

  // --- 備考ブロック（宿泊先・お客様メモ）を抽出 ---
  let notesBlock = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^備考\s*[:：]/.test(lines[i])) {
      for (let k = i + 1; k < lines.length; k++) {
        const l = lines[k];
        if (l.indexOf('予約管理システム') !== -1) break;
        if (l.indexOf('activityjapan.com') !== -1) break;
        if (l.indexOf('━') !== -1) break;
        notesBlock.push(l);
      }
      break;
    }
  }
  let hotel = '';
  for (let i = 0; i < notesBlock.length; i++) {
    if (notesBlock[i].indexOf('ホテル名') !== -1) {
      for (let k = i + 1; k < notesBlock.length; k++) {
        if (notesBlock[k].trim()) { hotel = notesBlock[k].trim(); break; }
      }
      break;
    }
  }
  const note = notesBlock.filter(function (l) {
    const t = l.trim();
    if (!t) return false;
    if (t.indexOf('ホテル名') !== -1) return false;   // 「①ご宿泊ホテル名…」ラベル
    if (t === hotel) return false;                     // ホテル名の値（宿泊先へ）
    if (/^[①-⑳]/.test(t)) return false;               // ①②… の項目ラベル
    return true;
  }).join(' ').trim();

  // --- アクティビティ略称（タイトル用） ---
  let activity = 'ご予約';
  if (/スキンダイビング/.test(plan)) activity = 'スキンダイビング';
  else if (/ウミガメ/.test(plan)) activity = 'ウミガメシュノーケル';
  else if (/青の洞窟/.test(plan)) activity = '青の洞窟シュノーケル';
  else if (/シュノーケル|シュノーケリング/.test(plan)) activity = 'シュノーケリング';

  // --- タイトル & 説明 ---
  const title = '【アクティビティジャパン】' + activity +
    (name ? '（' + name + (total > 0 ? ' ' + total + '名' : '') + '）' : '');

  const dateStr = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
  const timeStr = timeFound ? (startHour + ':' + ('0' + startMin).slice(-2)) : '（プラン名に時刻記載なし）';

  const description = [
    '【アクティビティジャパン予約】',
    'ご希望のツアー: ' + plan,
    'お名前: ' + name,
    'email: （アクティビティジャパン経由・記載なし）',
    '電話番号: ' + tel,
    'ご希望日: ' + dateStr,
    'ご希望時間: ' + timeStr,
    '参加人数: ' + peopleSummary,
    'お子様の有無: ' + childInfo,
    '宿泊先: ' + (hotel || '（記載なし）'),
    '備考: ' + (note || '（なし）'),
    '',
    '────── 参考情報 ──────',
    '料金: ' + (bill || '－') + ' / 支払い: ' + (pay || '－') + '（事前決済・集金不要）',
    '予約番号: ' + (resNo || '－'),
    '管理URL: ' + (resNo ? 'https://ptn.activityjapan.com/reserve/detail/' + resNo : '－'),
    '',
    '※ アクティビティジャパンの確定予約通知メールから自動登録',
  ].join('\n');

  return { title: title, start: start, end: end, description: description };
}

/**
 * プレーンテキストの「ラベル：値」（全角コロン）から値を取得する。
 * ラベルは最初の全角「：」より前の部分と完全一致で判定する。
 * 転送メールの半角コロン見出し（差出人:/日時:/件名: 等）は全角ではないので誤マッチしない。
 */
function ajField_(lines, label) {
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf('：');
    if (idx === -1) continue;
    const left = lines[i].slice(0, idx).trim();
    if (left === label) return lines[i].slice(idx + 1).trim();
  }
  return '';
}

// ============================================================
// ⑧ じゃらん（jalan / ACTIVITY BOARD）予約確定通知 → カレンダー
// ============================================================
/**
 * じゃらん（遊び・体験予約）の事業者向け「予約確定通知」メールを解析し、
 * 同じカレンダーに登録する。
 * ・対象: 件名に「予約確定通知」を含み、本文に「じゃらん」または「activityboard」を含むメール
 *         （本来の送信元は reservation@activityboard.jp。転送でも拾えるよう件名＋本文で判定。
 *          ※お客様に届く控えメール「ご予約確定のお知らせ」ではなく、事業者向けの方）
 * ・本文はプレーンテキスト（「ラベル：値」全角コロン区切り）。転送の「> 」引用符も除去。
 * ・日時は「利用日時：YYYY/MM/DD(曜) HH:MM〜…」の開始時刻から取得。
 * ・このメールにはお客様のメールアドレスも記載されるため email: ラベルで記録し、
 *   前日リマインドの送信対象にする（自動返信の下書き作成は自社フォーム予約のみ）。
 */
function processJalan_() {
  const label = getOrCreateLabel_(CONFIG.PROCESSED_LABEL);
  const calendars = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (calendars.length === 0) {
    throw new Error('カレンダーが見つかりません: ' + CONFIG.CALENDAR_NAME);
  }
  const calendar = calendars[0];

  const query = 'subject:予約確定通知 -label:' + CONFIG.PROCESSED_LABEL;
  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);

  let created = 0;
  threads.forEach(function (thread) {
    let anyHandled = false;
    thread.getMessages().forEach(function (message) {
      const subject = message.getSubject() || '';
      const body = message.getPlainBody() || '';
      if (subject.indexOf('予約確定通知') === -1) { anyHandled = true; return; }
      // じゃらん（ACTIVITY BOARD）のメールだけを対象にする（アクティビティジャパン等を除外）
      if (body.indexOf('じゃらん') === -1 && body.indexOf('activityboard') === -1 &&
          body.indexOf('ACTIVITY BOARD') === -1) { anyHandled = true; return; }
      try {
        const info = parseJalanReservation_(body);
        if (!info) { Logger.log('じゃらん: 日時を抽出できませんでした: ' + subject); return; }
        calendar.createEvent(info.title, info.start, info.end, { description: info.description });
        created++; anyHandled = true;
        Logger.log('じゃらん登録: ' + info.title + ' @ ' + info.start);
      } catch (e) {
        Logger.log('じゃらんエラー (' + subject + '): ' + e);
      }
    });
    if (anyHandled) thread.addLabel(label);
  });

  Logger.log('じゃらん完了: ' + created + ' 件の予定を登録しました');
}

/**
 * じゃらん（ACTIVITY BOARD）の予約確定通知メール（プレーンテキスト）から予約情報を抽出する。
 * 利用日時が取れなければ null を返す。転送メール（各行「> 」付き）にも対応。
 */
function parseJalanReservation_(body) {
  const lines = body.split('\n').map(function (s) {
    return s.replace(/^\s*>+\s?/, '').replace(/　/g, ' ').replace(/\s+$/, '');
  });

  const resNo  = jlField_(lines, '予約番号');
  const dtRaw  = jlField_(lines, '利用日時');
  const plan   = jlField_(lines, 'プラン名');
  const paxRaw = jlField_(lines, '人数');
  const pay    = jlField_(lines, '支払方法');
  const sum    = jlField_(lines, '合計料金(税込)') || jlField_(lines, '合計料金');
  // お名前は末尾のカナ括弧・様を除去
  const name   = jlField_(lines, '体験者氏名')
                   .replace(/\s*様\s*$/, '')
                   .replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim();
  const email  = jlField_(lines, 'メールアドレス');   // このメールにはお客様アドレスが載る
  const tel    = jlField_(lines, '電話番号');          // ここは事業者ではなくお客様の番号
  const emg    = jlField_(lines, '当日緊急連絡先');
  const hotel  = jlAnswer_(lines, '予約者からの回答');

  // --- 利用日時（必須。「YYYY/MM/DD(曜) HH:MM〜」or「YYYY年MM月DD日 HH:MM」） ---
  const dm = dtRaw.match(/(\d{4})\s*[\/年]\s*(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?[^\d]*?(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (!dm) return null;
  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);
  const startHour = Number(dm[4]), startMin = Number(dm[5]);

  const start = jstDate_(y, mo, d, startHour, startMin);
  const end = new Date(start.getTime() + CONFIG.DURATION_HOURS * 60 * 60 * 1000);

  // --- 人数：「1名 (大人:1名, 子供:1名)」等の内訳を集計 ---
  let adult = 0, child = 0;
  const parts = [];
  const bd = paxRaw.match(/([^\s:：,、()（）]+)\s*[:：]\s*(\d+)\s*名/g);
  if (bd) {
    bd.forEach(function (seg) {
      const m = seg.match(/([^\s:：,、()（）]+)\s*[:：]\s*(\d+)\s*名/);
      const cat = m[1], n = Number(m[2]);
      parts.push(cat + n + '名');
      if (/子供|子ども|こども|小人|幼児|未就学/.test(cat)) child += n; else adult += n;
    });
  } else {
    const tm = paxRaw.match(/(\d+)\s*名/);
    if (tm) { adult = Number(tm[1]); parts.push('大人' + adult + '名'); }
  }
  const total = adult + child;
  const peopleSummary = total > 0 ? ('計' + total + '名（' + parts.join('・') + '）') : (paxRaw || '（記載なし）');
  const childInfo = child > 0 ? ('あり（子供' + child + '名）') : 'なし';

  // --- アクティビティ略称（タイトル用） ---
  let activity = 'ご予約';
  if (/スキンダイビング/.test(plan)) activity = 'スキンダイビング';
  else if (/ウミガメ/.test(plan)) activity = 'ウミガメシュノーケル';
  else if (/青の洞窟/.test(plan)) activity = '青の洞窟シュノーケル';
  else if (/シュノーケル|シュノーケリング/.test(plan)) activity = 'シュノーケリング';

  const title = '【じゃらん】' + activity +
    (name ? '（' + name + (total > 0 ? ' ' + total + '名' : '') + '）' : '');

  const dateStr = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2);
  const timeStr = startHour + ':' + ('0' + startMin).slice(-2);

  // ※ 以前は当日リマインド送信の対象外にするため "email:" とは別ラベル（お客様メール:）で記録していたが、
  //   メールアドレスが記載されている予約はサイトを問わず前日リマインドを送るよう "email:" に統一。
  const description = [
    '【じゃらん予約】',
    'ご希望のツアー: ' + plan,
    'お名前: ' + name,
    'email: ' + (email || '（記載なし）'),
    '電話番号: ' + (tel || emg || '（記載なし）'),
    'ご希望日: ' + dateStr,
    'ご希望時間: ' + timeStr,
    '参加人数: ' + peopleSummary,
    'お子様の有無: ' + childInfo,
    '宿泊先: ' + (hotel || '（記載なし）'),
    '備考: （なし）',
    '',
    '────── 参考情報 ──────',
    '料金: ' + (sum || '－') + ' / 支払い: ' + (pay || '－'),
    '当日緊急連絡先: ' + (emg || '－'),
    '予約番号: ' + (resNo || '－'),
    '',
    '※ じゃらん（ACTIVITY BOARD）の予約確定通知メールから自動登録',
  ].join('\n');

  return { title: title, start: start, end: end, description: description };
}

/**
 * プレーンテキストの「ラベル：値」（全角コロン）から値を取得する（じゃらん用）。
 * ラベルは最初の全角「：」より前の部分と完全一致で判定する。
 */
function jlField_(lines, label) {
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf('：');
    if (idx === -1) continue;
    const left = lines[i].slice(0, idx).trim();
    if (left === label) return lines[i].slice(idx + 1).trim();
  }
  return '';
}

/**
 * 「〇〇：」というラベル行を探し、その値（同じ行、無ければ次の非空行）を返す。
 * じゃらんの「予約者からの回答：」（回答が次行にある）などに使う。
 */
function jlAnswer_(lines, label) {
  const re = new RegExp('^' + label + '\\s*[:：]');
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      const inline = lines[i].replace(re, '').trim();
      if (inline) return inline;
      for (let k = i + 1; k < lines.length; k++) {
        const l = lines[k].trim();
        if (!l) continue;
        if (l.indexOf('━') !== -1 || /^[─=\-]{3,}$/.test(l)) break;
        return l;
      }
      return '';
    }
  }
  return '';
}
