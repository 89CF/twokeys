# Güncelleme talimatı: önceki brief → güncel brief

> **Bu dosya kime:** Projeyi `kapora-protocol-brief.md` dosyasının **önceki sürümüne** göre kurmuş olan geliştirici veya AI ajanı. Önceki sürümün özellikleri: hesap adı zaten `Deal`, `kind: DealKind::Deposit` var, sayfalar `/d/...` altında, ama roller hâlâ `buyer/seller`, hukuk kuralı `legal_rule` ve ikinci demo sitesi `DemoEstate`.
> **Ne yapılacak:** Mevcut kod **sıfırdan yazılmayacak.** Aşağıdaki değişiklikler mevcut kodun üzerine uygulanacak.
> **Referans:** Güncel brief (`kapora-protocol-brief.md`, son sürüm) ile birlikte oku. Bu dosya ile güncel brief çelişirse **güncel brief geçerlidir.** Güncel brief'in **Bölüm 1.1**'i (Superteam'in resmi kuralları) her şeyin önündedir.

---

## 0. Önce durum tespiti (kod yazmadan)

1. Repoyu tara ve kısa bir rapor çıkar:
   - Hangi instruction'lar yazıldı?
   - `anchor build` ve `anchor test` çalışıyor mu?
   - Program devnet'te mi? Program ID ne?
   - SDK, frontend ve widget hangi durumda?
2. Bozuk ya da derlenmeyen bir şey varsa **önce onu düzelt**, sonra bu talimata geç. Hatanın ne olduğunu ve nasıl düzeltildiğini README'deki "Decisions" başlığına not et.
3. Aşağıdaki değişiklikleri **sırayla** uygula. Her bölümden sonra `anchor build` çalışmalı. Bölüm 3'ten sonra `anchor test` de geçmeli.

---

## 1. Neden değişiyor? (bağlam)

- Ürün artık sadece kapora değil. **Her sektöre ve her siteye takılabilen tek bir güven bileşeni.** Kapora, P2P kiralama, freelance ve P2P alışveriş, aynı programın **şablonları.** Kapora ana hikâye olarak kalıyor.
- Superteam'in resmi kuralları geldi. Bunlardan en önemlisi: **Aracının yerini alan bütün mantık on-chain programda olmalı.** Zincir dışı "güven" özellikleri (kimlik emaneti) bu yüzden çıkarıldı.
- Jüri canlı demoda Solana Explorer'da onaylanmış işlem görmek istiyor ve "taraflardan biri kaybolursa ne olur?" diye soracak.

---

## 2. İsim değişiklikleri (mekanik, önce bunu yap)

Önceki sürümde zaten doğru olanlar, **dokunma:** `Deal` hesabı, `["deal", ...]` ve `["vault", deal]` seed'leri, `/d/[deal]` ve `/d/new` sayfaları, `getDeal()`, `SelfDeal` ve `UnsupportedKind` hataları.

Bütün kodda (program, testler, SDK, frontend, widget, scriptler, README) şunları değiştir:

| Eski | Yeni |
|---|---|
| `buyer` | `payer` |
| `seller` | `payee` |
| `Buyer…` / `Seller…` (enum varyantları, ör. `BuyerWithdrew`) | `Payer…` / `Payee…` (ör. `PayerWithdrew`, `PayeeNoShow`) |
| `fault` enum'ında `Buyer` / `Seller` | `Payer` / `Payee` |
| `deposit_amount` | `payer_amount` |
| `seller_stake` | `payee_stake` |
| `buyer_bps` | `payer_bps` |
| `to_buyer` / `to_seller` (event alanları dahil) | `to_payer` / `to_payee` |
| `buyer_confirmed` / `seller_confirmed` | `payer_confirmed` / `payee_confirmed` |
| `PlatformStats.buyer_withdrew` / `seller_withdrew` | `payer_withdrew` / `payee_withdrew` |
| PDA seed `["deal", seller, offer_id]` | `["deal", payee, offer_id]` (sadece değişken adı; seed içeriği aynı) |
| `DealKind::Deposit` | `DealKind::Standard` (dört şablonun hepsi bunu kullanır) |
| `payout_deposit(...)` | `payout(...)` (Bölüm 3.3) |
| Sayfa `/seller/new` | `/offer/new` |
| Demo sitesi `DemoEstate` (`/demo/estate`) | `DemoRent` (`/demo/rent`) — Bölüm 6'ya bak |
| Widget `data-template="car"` | `data-template="deposit"` |

**Rol eşlemesi:** `payer` = ana tutarı kilitleyen taraf (alıcı, kiracı, müşteri). `payee` = teklifi oluşturan taraf (satıcı, ürün sahibi, freelancer). Teklifi her zaman payee oluşturur (`create_offer`), payer rezerve eder (`reserve`).

---

## 3. Program değişiklikleri

### 3.1 `Deal` hesabına yeni alanlar

```
kind: DealKind             // VAR. Sadece varyant adı Deposit → Standard.
penalty: Penalty           // YENİ. Forfeit | Refund
on_complete: OnComplete    // YENİ. ToPayee | ToPayer
legal_label: LegalLabel    // YENİ. None | Zadatek | Zaliczka | TrBaglanma
template: u8               // ESKİ `vertical` alanının yerine. 0=Deposit, 1=Rental, 2=Freelance, 3=Purchase (sadece etiket)
```

**Kaldırılacaklar:** `legal_rule: LegalRule` alanı ve `LegalRule` enum'ı (Zadatek | Zaliczka), `vertical` alanı. Zadatek ve Zaliczka artık `LegalLabel` enum'ının değerleri; ödeme mantığını `penalty` ve `on_complete` belirliyor.

**Hesap boyutu değiştiği için:** `space` hesabını güncelle. Devnet'teki eski hesaplar yeni layout ile uyumsuz olacak. Bu sorun değil, demo verisi yeniden oluşturulacak (Bölüm 3.6).

### 3.2 `create_offer` imzası

```
create_offer(
  offer_id, payer_amount, payee_stake,
  penalty, on_complete, legal_label, template,
  listing_hash, reserve_window_secs, complete_window_secs,
  grace_secs, arbiter_window_secs, arbiter, platform
)
```

**Yeni kısıtlar.** İhlal edilirse yeni hata `InvalidLegalParams` döner:
- `legal_label == Zadatek` ise `penalty == Forfeit`, `payee_stake == payer_amount` ve `on_complete == ToPayee` olmalı.
- `legal_label == Zaliczka` ise `penalty == Refund` olmalı.
- `payer_amount > 0`, `payee_stake >= 0`.
- `kind` her zaman `Standard` olarak yazılır.
- Önceki sürümdeki `StakeMustEqualDeposit` hatası kalabilir; Zadatek + `S != D` durumunda ya bu ya da `InvalidLegalParams` dönsün, ikisinden birini seç ve "Decisions" başlığına not et.

Yeni hata kodları: `InvalidLegalParams`, `UnsupportedKind`.

### 3.3 Ödeme tablosu (`settle.rs` → `payout`)

Yeni imza:

```rust
fn payout(penalty: Penalty, on_complete: OnComplete, outcome: Outcome,
          d: u64, s: u64, payer_bps: u16) -> Result<(u64 /*to_payer*/, u64 /*to_payee*/)>
```

`settle` içinde `kind`'e göre dallan: `match deal.kind { DealKind::Standard => payout(...) }`.

Tanımlar: `D` = payer_amount, `S` = payee_stake, `P` = D + S.

| Outcome | Forfeit: payer / payee | Refund: payer / payee |
|---|---|---|
| `Completed` | ToPayee: 0 / P — ToPayer: D / S | aynı |
| `PayerWithdrew` | 0 / P | D / S |
| `PayeeWithdrew` | P / 0 | D / S |
| `PayerNoShow` | 0 / P | D / S |
| `PayeeNoShow` | P / 0 | D / S |
| `Expired` | D / S | D / S |
| `Cancelled` | — / S | — / S |
| `Resolved` | P·payer_bps/10000 / kalanı | aynı |
| `DisputeTimeout` | D / S | D / S |

- Her zaman `to_payer + to_payee == P` olmalı. Yuvarlama artığı payee'ye gider.
- **Önceki sürümden fark:** Önceki sürümde `Completed` her zaman "satıcı P alır" idi, ve Zaliczka sütunu şimdiki `Refund` sütunuyla aynıydı. Şimdi `on_complete == ToPayer` ise D payer'a geri döner. Kiralamada depozito iadesi bu şekilde sağlanıyor.

### 3.4 Hakem kuralı (açıklama, kod değişikliği az)

- Hakem her zaman **isteğe bağlıdır** (`arbiter == Pubkey::default()` = hakem yok). Zincirde hiçbir şablon için hakem zorunlu değil.
- `resolve` sadece iki taraf arasında böler. Hakem kendine pay alamaz. Mevcut kod bunu zaten sağlıyorsa değişiklik yok, kontrol et.

### 3.5 Testler

Eski testleri yeni isimlere ve yeni `create_offer` imzasına uyarla. Kapora testlerinde parametreler: `penalty = Forfeit`, `on_complete = ToPayee`, `legal_label = Zadatek`, `S = D`.

**Yeni testler ekle:**
1. **Rental:** `on_complete = ToPayer`, iki onay → payer D alır, payee S alır.
2. **Freelance:** sadece payee onaylar, süre dolar → `PayerNoShow`, payee D alır (S = 0).
3. **Refund:** payee vazgeçer → payer D, payee S alır.
4. **Kısıt ihlalleri reddedilir:** Zadatek + Refund, Zadatek + S ≠ D, Zadatek + ToPayer, Zaliczka + Forfeit.

Not: Superteam test kapsamını değerlendirmiyor. Ama bu testler, değişikliklerin hiçbir şeyi bozmadığının güvencesi.

### 3.6 Yeniden deploy

- Programı devnet'e yeniden deploy et. Upgrade yetkisi hâlâ bizdeyse aynı program ID kullanılabilir.
- IDL'i yeniden üret ve SDK'yı güncelle.
- Demo cüzdanlarını ve test USDC'yi kontrol et, gerekirse yeniden fonla.
- README'deki program ID'yi güncelle.
- **Upgrade yetkisini şimdi KALDIRMA.** Bu, en son, final deploy'dan sonra yapılacak (Bölüm 8).

---

## 4. Kaldırılacaklar

- **Kimlik emaneti:** `identity_escrow` tablosu, mock şifreleme kodu ve ilgili UI. Henüz yazılmadıysa hiç yazma. Superteam'in "kurallar programda olmalı" şartıyla çelişiyor. Sadece vizyon slaytında anlatılacak.
- Hakemi "zorunlu" gösteren widget ya da UI mantığı. Bunun yerine sadece "Hakem eklemek önerilir" yazsın.

---

## 5. SDK ve widget

- **SDK:** Bölüm 2'deki isimlere uyarla ve `createOffer()` imzasını güncelle.
- **Şablon presetleri:** SDK'ya bir `templates` modülü ekle. Widget ve `/offer/new` sayfası parametreleri buradan alacak.

| template | penalty | on_complete | legal_label | S varsayılanı | Onay butonu etiketleri |
|---|---|---|---|---|---|
| `deposit` | Forfeit | ToPayee | Zadatek | = D | ikisi de: "Deal completed" |
| `rental` | Forfeit | ToPayer | None | 0 | payer: "I returned the item" / payee: "Item returned in good condition" |
| `freelance` | Forfeit | ToPayee | None | 0 | payee: "Work delivered" / payer: "I accept the work" |
| `purchase` | Forfeit | ToPayee | None | 0 | payee: "Item handed over / sent" / payer: "Item received" |

- **Widget:** `data-template` değerleri artık `deposit | rental | freelance | purchase`. Eskiden `car` gibi bir değer kullanılıyorsa `deposit`'e çevir.
- **Freelance UI:** Müşteriye (payer) "Withdraw" butonu yerine "Open dispute" öner. Forfeit kuralında müşterinin vazgeçmesi ücretini kaybettirir; bunu kullanıcıya düz dille açıkla.

---

## 6. Frontend

1. **Durum sayfası (`/d/[deal]`):**
   - Her işlemden sonra **"View on Solana Explorer"** linki göster (devnet, işlemin imzasıyla). **Bu zorunlu**, jüri onaylanmış işlemi Explorer'da görmek istiyor.
   - **"Süre doldu, sonucu uygula"** (`claim_after_deadline`) butonu belirgin olsun. Bu buton herkese görünsün, sadece taraflara değil. Demonun "aracının kalktığı an" sahnesi bu.
   - Onay butonlarının etiketleri seçilen şablona göre değişsin (Bölüm 5'teki tablo).
   - Kuralların düz dille özeti sayfada görünsün. Örneğin kapora için: "Satıcı vazgeçerse ya da gelmezse 2× geri alırsın." Kiralama için: "Ürünü iade edip onaylarsan ve sahibi itiraz etmezse depozito sana döner."
2. **`/offer/new`:** Şablon seçimi (4 şablon), tutar, süreler (demo için saniye cinsinden), isteğe bağlı hakem.
3. **DemoRent (`/demo/rent`):** Eski DemoEstate'in yerine. Uydurma bir ekipman kiralama sitesi: kamera, laptop. Aynı widget, `rental` şablonu. **Öncelik: DemoAuto ve durum sayfası tam çalıştıktan sonra.**
4. **Arayüz dili:** Hedef kullanıcı kripto bilmiyor. "Wallet" yerine mümkün olan yerlerde "account" kullan, tutarları PLN karşılığıyla göster ("demo rate: 1 USDC ≈ 1 PLN").
5. Gerçek marka adı veya logosu kullanılmayacak (bu kural değişmedi).

---

## 7. README (jüri repoya bakıyor)

README'ye şu başlıkları ekle ya da güncelle:
- **Who it's for:** Birincil kullanıcı, Polonya'da ilan sitelerinden tanımadığı birine kapora (zadatek) ödeyen kişiler ve satıcıları. İkincil kullanıcı, widget'ı kendi sitesine ekleyen ilan platformları.
- **Design rationale:** Hangi finansal ilişki yeniden tasarlandı, aracı kimdi, aracı kalkınca ne değişiyor. Metin için güncel brief'in Bölüm 1.1'ine bak.
- **Where the intermediary disappears:** `settle.rs` / `payout` ve onu çağıran instruction'ların dosya yolları.
- **What is where:** Klasör yapısı ve her klasörün görevi.
- **Program ID, test USDC mint adresi, kurulum ve çalıştırma adımları.**
- **Permissions:** Hangi instruction'ı kim çağırabilir; programda admin yetkisi yok.
- **Limitations:** Bilinen kısıtlar (dürüstçe). Superteam bunu değerli buluyor.
- **Credits / External resources.**
- **Decisions:** Belirsizlikte verilen kararlar.

---

## 8. En son (teslimden önce)

- Final deploy'dan sonra upgrade yetkisini kaldır: `solana program set-upgrade-authority <PROGRAM_ID> --final`. Bunu **sadece her şey çalışıyorsa** yap; sonrasında program değiştirilemez. Kaldırmadıysan README'de dürüstçe belirt.
- İki demo cüzdanını test SOL ve test USDC ile fonla. Demoda kullanılacak hesapları hazır duruma getir.
- Demo kaydını al (yedek, en fazla 3 dakika). Bu kayıt aynı zamanda teslim için zorunlu video olarak kullanılabilir.

---

## 9. Kontrol listesi (bitti mi?)

- [ ] Eski isimler kodda kalmadı (`grep -ri "buyer\|seller\|legal_rule\|vertical\|DemoEstate"` boş dönüyor; README'deki düz metin hariç)
- [ ] `anchor build` ve `anchor test` geçiyor, yeni testler dahil
- [ ] Program devnet'te, IDL ve SDK güncel
- [ ] DemoAuto'da kapora akışı baştan sona canlı çalışıyor, Explorer linkleri görünüyor
- [ ] "Satıcı kayboldu → süre doldu → herhangi biri sonucu uygular" senaryosu canlı çalışıyor
- [ ] Kimlik emaneti kodu kaldırıldı
- [ ] README güncel (Bölüm 7)
- [ ] (Vakit varsa) DemoRent çalışıyor
