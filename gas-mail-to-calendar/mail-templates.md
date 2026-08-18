# 予約メール ひな型（受付／確定 ・ 日本語／英語）

EMERALD REEF OKINAWA の予約メール文面です。
GAS（`Code.gs`）がフォーム受信時に、この文面で **Gmail の下書き** を自動作成します。
- お名前に日本語が含まれる → 日本語の下書き
- 含まれない → 英語の下書き
- 各予約につき **①受付メール** と **②予約確定メール** の2通を下書き作成します。

文面を直したいときは、この内容に合わせて `Code.gs` の各テンプレート関数を修正してください。
`{ }` はフォーム内容で自動置換、`【 】` は **送信前に手入力** する欄です。

---

## ① 受付メール（日本語）

**件名**：`【受付】ご予約リクエストありがとうございます｜エメラルドリーフ沖縄`

```
{name} 様

この度はエメラルドリーフ沖縄へご予約リクエストをいただき、誠にありがとうございます。
以下の内容で予約リクエストを受け付けました。

─────────────────────
 ご希望のツアー : {tour}
 ご希望日       : {date}
 ご希望時間     : {time}
 参加人数       : {people}
─────────────────────

※このメールは「受付完了」のお知らせです。ご予約はまだ確定しておりません。
　空き状況を確認のうえ、担当より改めて「予約確定」のご案内（料金・集合時間）を
　お送りいたします。通常は数時間以内（遅くとも翌日まで）にご返信いたします。

お急ぎの場合やご質問は、LINE からもお気軽にどうぞ。
　LINE : https://line.me/R/ti/p/@846jojxw

──────────────────────────────
 エメラルドリーフ沖縄 / EMERALD REEF OKINAWA
 担当：八木 吹輝
 TEL  : 070-8516-8826
 Mail : emeraldreefokinawa@gmail.com
 Web  : https://emerald-reef-okinawa.com/
──────────────────────────────
```

---

## ② 予約確定メール（日本語）

**件名**：`【予約確定】{tour}のご予約が確定しました｜エメラルドリーフ沖縄`

```
{name} 様

エメラルドリーフ沖縄です。
ご予約が確定いたしましたので、詳細をご案内いたします。

【ご予約内容】
　ツアー     : {tour}
　日付       : {date}
　集合時間   : 【　：　　】
　参加人数   : {people}
　所要時間   : 約3〜4時間
　料金       : 【　　　　　円】

【集合・送迎】
　お泊まりのホテル・宿泊先までお迎えに上がります。
　お迎え場所 : 【宿泊先名／住所を記入】
　お迎え時間 : 【　：　　ごろ】

【お支払い】
　Square（スクエア）でのクレジットカード事前決済となります。
　お支払い用リンク：【Square の決済リンクを記入】
　★お支払い期限：本メール送信後【2日以内】にお願いいたします。
　　期限内にご決済が確認できない場合は、ご予約（確定）が自動的に取り消しと
　　なりますので、あらかじめご了承ください。
　※カード以外でのお支払いや現地払いをご希望の場合は、お気軽にお申し付けください。

┏━━━━━━━━━━━━━━━━━━━━━━━┓
　★★ お迎え時間についての重要なお願い ★★
　沖縄は時期・時間帯により道路の渋滞や駐車場の満車が発生し、
　お迎え・ご案内にお時間がかかる場合がございます。
　当日はお時間に余裕をもってご準備くださいますようお願いいたします。
┗━━━━━━━━━━━━━━━━━━━━━━━┛

【ご注意事項】
　・当日、体調がすぐれない場合（寝不足・二日酔い等を含む）は、
　　無理をなさらず、お早めにご連絡ください。
　・集合（お迎え）時間に遅れる場合は、必ずご連絡をお願いいたします。
　・貴重品の管理はお客様ご自身でお願いいたします。

【当日の持ち物・服装】
　・水着を着用してお越しください
　・ビーチサンダル／タオル／お飲み物／お着替え（任意）
　※下記は当店でご用意します（料金に含まれます）
　　シュノーケル器具・保険・お写真データのプレゼント

【雨天・中止について】
　天候により中止となる場合は、前日の夜までにメールでご連絡いたします。

【キャンセルについて】
　・7日前まで                : 無料
　・6日前〜前日18時まで       : 料金の50%
　・前日18時以降〜当日・無連絡 : 料金の100%
　※悪天候など当店判断による中止の場合は、キャンセル料はいただきません。

ご不明点はお気軽にご連絡ください。当日お会いできるのを楽しみにしております！

──────────────────────────────
 エメラルドリーフ沖縄 / EMERALD REEF OKINAWA
 担当：八木 吹輝
 TEL  : 070-8516-8826
 Mail : emeraldreefokinawa@gmail.com
 Web  : https://emerald-reef-okinawa.com/
──────────────────────────────
```

---

## ① Acknowledgment Email (English)

**Subject**: `[Received] Thank you for your booking request — EMERALD REEF OKINAWA`

```
Dear {name},

Thank you for your booking request with EMERALD REEF OKINAWA.
We have received your request with the following details:

─────────────────────
 Tour            : {tour}
 Preferred date  : {date}
 Preferred time  : {time}
 Number of guests: {people}
─────────────────────

Please note: this is a confirmation of RECEIPT only — your booking is not yet
finalized. We will check availability and send you a separate "Booking Confirmed"
email with the price and pickup time, usually within a few hours (at the latest by
the next day).

For any questions, feel free to message us on LINE:
 LINE : https://line.me/R/ti/p/@846jojxw

──────────────────────────────
 EMERALD REEF OKINAWA
 Guide : Fubuki Yagi
 Tel   : +81 70-8516-8826
 Mail  : emeraldreefokinawa@gmail.com
 Web   : https://emerald-reef-okinawa.com/
──────────────────────────────
```

---

## ② Booking Confirmation Email (English)

**Subject**: `[Booking Confirmed] Your {tour} reservation — EMERALD REEF OKINAWA`

```
Dear {name},

This is EMERALD REEF OKINAWA. Your booking is now confirmed!
Here are the details:

[Your Reservation]
 Tour          : {tour}
 Date          : {date}
 Meeting time  : 【  :   】
 Guests        : {people}
 Duration      : approx. 3–4 hours
 Price         : 【          】

[Pickup]
 We will pick you up at your hotel / accommodation.
 Pickup location : 【enter hotel name / address】
 Pickup time     : 【  :   】

[Payment]
 Payment is by credit card in advance, via Square.
 Payment link : 【enter your Square payment link】
 * Payment deadline: please complete payment within 2 days of this email.
   If payment is not confirmed within 2 days, your confirmed booking will be
   canceled automatically. Thank you for your understanding.
 * If you would prefer a payment method other than card, or to pay on-site,
   please just let us know.

┏━━━━━━━━━━━━━━━━━━━━━━━┓
 ** IMPORTANT — please allow extra time for pickup **
 In Okinawa, traffic congestion and full parking lots are common
 depending on the season and time of day, and pickup/guiding may
 take extra time. Please allow plenty of time on the day.
┗━━━━━━━━━━━━━━━━━━━━━━━┛

[Important notes]
 - If you are not feeling well on the day (including lack of sleep
   or a hangover), please do not push yourself and contact us early.
 - If you will be late for pickup, please be sure to let us know.
 - Please look after your own valuables.

[What to bring / wear]
 - Please put your swimsuit on before pickup
 - Beach sandals / towel / a drink / a change of clothes (optional)
 * We provide the following (included in the price):
   snorkeling gear, insurance, and a gift of your photo data.

[Weather / cancellation by us]
 If the tour must be canceled due to weather, we will contact you by email
 by the night before.

[Cancellation policy]
 - Up to 7 days before                      : free
 - 6 days before to 18:00 the day before     : 50% of the fee
 - After 18:00 the day before / same day / no-show : 100% of the fee
 * No cancellation fee if we cancel the tour due to bad weather.

If you have any questions, please let us know.
We look forward to seeing you!

──────────────────────────────
 EMERALD REEF OKINAWA
 Guide : Fubuki Yagi
 Tel   : +81 70-8516-8826
 Mail  : emeraldreefokinawa@gmail.com
 Web   : https://emerald-reef-okinawa.com/
──────────────────────────────
```

---

## ③ 前日リマインドメール（日本語）

**件名**：`【明日のご予約】ご参加確認のお願い｜エメラルドリーフ沖縄`

毎日1回、翌日が予約日の予定を探して **自動送信** します（HTMLメール）。
「参加を確認する」ボタンを押すと、カレンダー予定が確認済み（✅・緑）になります。

```
{name} 様

いよいよ明日、{tour} のツアー当日です！
スタッフ一同、お会いできるのを楽しみにしております。

 ┌───────────────────┐
 │ ツアー   : {tour}
 │ 日付     : {date}（明日）
 │ 集合時間 : {time}
 │ 参加人数 : {people}
 └───────────────────┘

╭─────────────────────────────╮
 ⚠ お迎え時間についての重要なお願い
 沖縄は時期・時間帯により道路の渋滞や駐車場の満車が発生し、
 お迎え・ご案内にお時間がかかる場合がございます。
 当日はお時間に余裕をもってご準備ください。
╰─────────────────────────────╯
（HTMLメールではオレンジ色の枠で目立つ表示になります）

お手数ですが、下記ボタンからご参加の確認をお願いいたします。

        ［ 参加を確認する ］   ← ボタン

※ボタンを押すと、当店に「確認済み」として通知されます。
※ボタンが開けない場合は、このメールへのご返信か LINE で「確認しました」とお知らせください。

当日の持ち物・服装
　水着を着用してお越しください／ビーチサンダル・タオル・お飲み物・お着替え（任意）

ご注意事項
　・当日、体調がすぐれない場合（寝不足・二日酔い等を含む）は、
　　無理をなさらず、お早めにご連絡ください。
　・集合（お迎え）時間に遅れる場合は、必ずご連絡をお願いいたします。
　・貴重品の管理はお客様ご自身でお願いいたします。

天候などでキャンセルとなる場合は当店よりご連絡いたします。ご不明点はお気軽にご連絡ください。
（署名）
```

---

## ③ Reminder Email — day before (English)

**Subject**: `[Tomorrow] Please confirm your tour — EMERALD REEF OKINAWA`

```
Dear {name},

Your {tour} tour is tomorrow!
We are looking forward to seeing you.

 ┌───────────────────┐
 │ Tour          : {tour}
 │ Date          : {date} (tomorrow)
 │ Meeting time  : {time}
 │ Guests        : {people}
 └───────────────────┘

╭─────────────────────────────╮
 ⚠ Important — please allow extra time for pickup
 In Okinawa, traffic congestion and full parking lots are common
 depending on the season and time of day, and pickup/guiding may
 take extra time. Please allow plenty of time on the day.
╰─────────────────────────────╯
(shown as an orange highlighted box in the HTML email)

Please confirm your attendance using the button below.

        [ Confirm my attendance ]   ← button

* Pressing the button notifies us that you are confirmed.
* If the button does not open, simply reply to this email or message us on LINE to confirm.

What to bring / wear
  Please put your swimsuit on before pickup / beach sandals, towel,
  a drink, a change of clothes (optional)

Important notes
  - If you are not feeling well on the day (including lack of sleep
    or a hangover), please do not push yourself and contact us early.
  - If you will be late for pickup, please be sure to let us know.
  - Please look after your own valuables.

(signature)
```

---

### 確認ボタンの仕組み
- ボタンのリンク先は、GAS を **ウェブアプリとして公開した URL**（`?id=予定ID&t=トークン&l=言語`）。
- お客様が押すと `doGet` が動き、その予約のカレンダー予定を
  **タイトル先頭に「✅」＋色を緑＋説明欄に「お客様確認済み: 日時」** を付けて更新します。
- 押した後はお客様に「ご確認ありがとうございます」ページを表示します。
- URL にはトークン（予定ID＋シークレットのハッシュ）が付くため、他人が勝手に確認状態を
  変えることはできません。シークレットは `Code.gs` の `CONFIG.CONFIRM_SECRET` で設定します。

---

### 補足
- 英語署名の代表者名は **"Fubuki Yagi"** と表記しています（「吹輝」の英語読み）。
  別の表記をご希望の場合はお知らせください。
- ツアー名は英語下書きでは自動で英語表記に変換します
  （シュノーケル→Snorkeling／スキンダイビング→Skin Diving／青の洞窟→Blue Cave／
  　那覇ウミガメシュノーケル→Naha Sea Turtle Snorkeling）。
- 確定メールはフォーム受信時点で「下書き」として作成されます。
  空き状況・料金・集合時間を `【 】` に記入してから送信してください。
