# Kapora Protocol — Proje Brief'i ve Geliştirme Talimatı

> Bu doküman, projeyi hiç bilmeyen bir geliştiricinin (ya da AI ajanının) iskeleti kurup geliştirmeye başlayabilmesi için yazıldı. Önce tamamını oku, sonra **Bölüm 14: İlk görevler** kısmından başla.

---

## 1. Bağlam

- **Etkinlik:** HackYeah 2026 (Kraków, 3–4 Ekim 2026). 24 saatlik hackathon. Projeyi **tek kişi** (solo) geliştiriyor, kodlamada AI ajanından destek alıyor.
- **Görev:** *Finance Without Intermediaries*. Partner: **Superteam PL** (Solana ekosistemi topluluğu).
- **Ödül:** 11.300 PLN. **Teslim dili:** Lehçe veya İngilizce. Biz **İngilizce** teslim edeceğiz: README, arayüz metinleri ve kod yorumları İngilizce olacak.
- **Resmi görev metni (aynen):**

> "Imagine a transaction with someone you don't know. No history, no reputation, no way to go after them if they disappear with your money.
> Blockchain makes this irrelevant: the terms execute themselves, regardless of what the other party wants. Put this capability to use in an application."

- **Kesinleşenler (Superteam'in resmi PDF'leri):**
  - Çözüm **Solana** üzerinde çalışmalı. **Devnet yeterli**, mainnet ve gerçek para beklenmiyor.
  - **Teslim son tarihi: 4 Ekim 2026, saat 23:00.** Bu tarihten sonra yapılan değişiklikler değerlendirilmez.
  - Kod ve fikri haklar bizde kalır. Sadece değerlendirme süresince repo **public** olmalı.
- **Öncelik sırası:** Bu dokümanda Superteam kurallarıyla (Bölüm 1.1) çelişen bir şey varsa **Bölüm 1.1 geçerlidir.**

### 1.1 Superteam kuralları ve değerlendirme (resmi, önceliklidir)

Kaynak: `RULES_Finance_Without_Intermediaries.pdf` ve `CRITERIA_Finance_Without_Intermediaries_PL_ENG.pdf`.

**Görev (Superteam'in ifadesiyle):** Bugün güvenilir bir aracı gerektiren bir finansal ilişkiyi seç ve aracıya gerek kalmayacak şekilde yeniden tasarla. İşlemin şartları ağda çalışan bir programa yazılsın, herkes için aynı şekilde otomatik işlesin ve **tek taraflı değiştirilemesin.** Superteam'in kendi örnek listesinde escrow, freelancer–müşteri ödemeleri ve koşullu iadeli bağış kampanyaları açıkça geçiyor. Yani konumuz tam beklentinin içinde. Aynı sebeple rakiplerde benzer fikirler olacak; fark, çalışan demoda ve gerekçenin kalitesinde çıkacak.

**En kritik teknik kural:** *"The logic that replaces the intermediary must live in the on-chain program. If your backend enforces the transaction terms, the intermediary has not disappeared; it has simply become you."*
- Bizim tasarımda **parayı ve sonucu belirleyen her kural Anchor programında.** Zincir dışı parçalar (hash servisi, veritabanı, widget) sadece kolaylık sağlar; parayı hareket ettiremez ve sonucu değiştiremez.
- Kimlik emaneti gibi zincir dışı "güven" özellikleri bu yüzden MVP'den çıkarıldı (Bölüm 11).

**Uygulamanın "tamam" sayılması için (zorunlu):**
1. En az **bir tam kullanım senaryosu**: kullanıcı girişinden tamamlanmış işleme kadar.
2. **Aracının gereksiz hale geldiği an** gösterilebilmeli. Projenin kalbi bu. Bizde bu an: süre dolduğunda **herhangi birinin** `claim_after_deadline` çağırıp programın parayı kurala göre dağıtması, ya da iki onayla paranın kendiliğinden çözülmesi.
3. Sunum sırasında **canlı** çalışmalı, sadece kayıt yetmez. Kayıt sadece yedek.
4. Arayüz kaba olabilir: **"Her şeyin çalıştığı basit bir uygulama, altında hiçbir şey olmayan cilalı bir tasarımdan iyidir."**

**Hedef kullanıcı açıkça adlandırılmalı.** Bizim tercihimiz:
- **Birincil kullanıcı:** "Polonya'da ilan sitelerinden araç ya da ev bulup tanımadığı birine kapora (zadatek) ödeyen kişiler ve onların satıcıları." Kripto bilmezler. Bu yüzden arayüz düz dille konuşur ve teknik katmanı gizler: "cüzdan" yerine "hesap", tutarlar PLN karşılığıyla.
- **İkincil kullanıcı (dağıtım kanalı):** Bileşeni widget ile kendi sitesine ekleyen ilan platformları.
- Bu seçim README'de, açıklamada ve sunumda **açıkça** yazılmalı.

**Tasarım gerekçesi (design rationale) zorunlu.** Kısaca şu üç soruya cevap verir:
- *Hangi finansal ilişki yeniden tasarlandı?* Tanımadığın birine işlem tamamlanmadan önce ödenen kapora/ön ödeme.
- *Aracı kimdi?* Bugün ya hiç kimse yok (IBAN ile doğrudan karşı tarafa, güvence sıfır) ya da pahalı aracılar var: mahkeme (kapora kuralını uygulatmak için), noter emaneti, platformun kendi ödeme koruması.
- *Aracı kalkınca ne değişiyor?* Kural (vazgeçen kaybeder, satıcı vazgeçerse iki kat) mahkemesiz ve anında uygulanır. Para hiçbir tarafın eline geçmeden programda bekler. Ücret yok, kimse işlemi bloklayamaz.

**Değerlendirme kriterleri:**

| Kriter | Ağırlık | Bizim için ne demek |
|---|---|---|
| Relevance to the challenge | %30 | Aracı gerçekten programda ortadan kalkıyor mu? Bölüm 6'daki tasarım. |
| Completeness and functionality | %25 | Tam akış canlı çalışıyor mu? **Kapsam büyütmek yerine çalışan akış.** |
| Idea and choice of problem | %20 | Kapora dolandırıcılığı ve kanundaki kuralın uygulanamaması. |
| Implementation potential | %15 | Widget ve şablonlar, vizyon (Bölüm 2.1). |
| Originality | %10 | Karşılıklı teminat, kanuni kuralın kodlanması. |

- Değerlendirme iki aşamalı: Önce en az 3 mentor HackTribe'daki teslimi puanlar, sonra finalistler jüriye **canlı** sunum yapar.
- Ödül alabilmek için ilk aşamada **puanların en az %50'si** gerekiyor.
- **Değerlendirilmeyenler:** Saldırı dayanıklılığı, denetim (audit), tasarım kalitesi ve test kapsamı. Kısıtlarını dürüstçe söylemek, yokmuş gibi davranmaktan daha değerli bulunuyor.
- Jüri repoya sunumdan önce ve sonra bakıyor; **on-chain programın demoda gösterileni yapıp yapmadığını** kontrol ediyor. README'de "ne nerede" net olmalı.

**Canlı demo beklentisi:**
- Kullanıcı gelir, cüzdan bağlar, işlem yapar, sonucu görür.
- **Ağda onaylanmış işlem** Solana Explorer'da gösterilir. Arayüzde her işlemden sonra **"View on Solana Explorer"** linki olmalı.
- **İki cüzdan** önceden test SOL ve test USDC ile hazır olmalı, hesaplar demoya uygun durumda beklemeli.
- Faucet ya da internet sorununa karşı demo kaydı yedekte tutulmalı.

**Jürinin soracağı sorular ve hazır cevaplarımız:**

| Soru | Cevap |
|---|---|
| Aracı kodun tam olarak neresinde ortadan kalkıyor? | `settle.rs` içindeki `payout` fonksiyonu ve onu çağıran `confirm_complete`, `withdraw`, `claim_after_deadline` instruction'ları. Para vault PDA'sında duruyor ve sadece bu kurallarla çıkabiliyor. |
| Taraflardan biri işlemin ortasında kaybolursa? Para nerede, kim geri alabilir? | Para vault PDA'sında. Süre dolunca **herkes** `claim_after_deadline` çağırabilir. Program kaybolan tarafı "gelmedi" sayar ve parayı kurala göre dağıtır. Kalan tarafın kimseye ihtiyacı yok. |
| Kim hangi işlemi yapabilir? Siz yazar olarak deploy sonrası bir şey değiştirebilir misiniz? | Programda admin yetkisi veya admin instruction'ı **yok.** Her instruction'ın kimin tarafından çağrılabileceği tabloda yazılı (Bölüm 6.2). Final deploy'dan sonra programın upgrade yetkisi kaldırılır (`solana program set-upgrade-authority <PROGRAM_ID> --final`), böylece biz de değiştiremeyiz. Yetki kaldırılmadıysa bunu dürüstçe söyle. |
| Hakem bir aracı değil mi? | Hakem **isteğe bağlı** ve işlem başında iki taraf tarafından kabul edilir. Ana senaryo (kapora) hakemsiz çalışır. Hakem parayı **sadece iki taraf arasında bölebilir**, kendine alamaz. Süresinde karar vermezse herkes kendi parasını otomatik geri alır. |
| Neden blockchain, neden normal bir veritabanı değil? | Veritabanında parayı ve kuralı veritabanının sahibi kontrol eder; o da yeni bir aracı olur. Burada para hiçbir tarafın ve bizim kontrolümüzde değil. Kural herkesin okuyabildiği ve kimsenin tek başına değiştiremediği bir programda. |
| Bir haftanız daha olsa ne yapardınız? | Kargo onaylı satın alma, çok aşamalı freelance ödemeleri, gerçek bir platformla pilot entegrasyon, e-posta ile giriş ve gömülü cüzdan (Bölüm 2.1). |

**Hazır kaynaklar (Superteam'in önerdikleri):**
- Superteam'in **dev container**'ı: `github.com/matzayonc/solana-live-course-2026`. Rust, Solana CLI ve Anchor hazır gelir; VS Code veya GitHub Codespaces ile açılır. **Kurulum için önce bunu kullan.**
- Teori materyalleri: `matzayonc.github.io/stpl-bootcamp`.
- Dokümantasyon: `solana.com/docs`, `anchor-lang.com/docs`, `book.anchor-lang.com`.
- Kurulum sorun çıkarırsa Solana Playground ile tarayıcıdan derleme ve deploy yapılabilir.
- Frontend için `@solana/kit` veya `@solana/web3.js`, cüzdan için Wallet Adapter öneriliyor. SPL Token kullanımı serbest.
- Mentorlar hackathon boyunca Superteam standında. Telegram: @matzayonc, @matjanisz.

---

## 2. Ürün özeti

**Kapora Protocol** (çalışma adı): **Her sektöre ve her siteye takılabilen tek bir güven bileşeni.** Tanımadığın biriyle yapılan her işlemde para bir aracıya değil, kuralları baştan belli olan bir akıllı sözleşmeye kilitlenir ve sonuç kendiliğinden uygulanır.

Bileşen tek bir program ve tek bir widget'tan oluşur. Sektörler birer **şablondur**; aynı kod, farklı parametreler (Bölüm 4.1). Hackathon'da hazır gelen dört şablon:
- **Kapora:** Araç, emlak ya da pahalı ürün alırken ön ödeme. **Ana hikâye budur**, ve kanundaki kapora kuralını kodla uygular.
- **P2P kiralama:** Kamera, laptop ya da araba kiralarken depozito.
- **Freelance:** Tek teslimli iş için ücret.
- **P2P alışveriş:** OLX/Craigslist tarzı ikinci el alışveriş.

**Tek cümle:** *"Kaybolabilirsin, ama paranla değil."* (İngilizcesi: *"You can disappear — but not with my money."*)

### Çözdüğü sorun (ana hikâye: kapora)
- Araç, ev ya da pahalı bir ürün alırken, alıcı tanımadığı satıcıya işlem tamamlanmadan önce kapora öder.
- Sahte ilan açıp kapora toplayan ve sonra kaybolan dolandırıcılar yaygın.
- Kanun kapora kuralını tanımlıyor ama küçük tutarlar için kimse mahkemeye gitmiyor:
  - **Polonya, Kodeks cywilny md. 394, "zadatek":** Kaporayı veren vazgeçerse kapora karşı tarafta kalır. Alan taraf vazgeçerse iki katını iade eder.
  - **Türkiye, Borçlar Kanunu'ndaki "bağlanma parası":** Benzer mantık. *Hukuki teyit gerekiyor.*
- IBAN ile gönderilen kapora doğrudan karşı tarafa gider. Sorunun kendisi bu.

### Çözümün altı parçası
1. **Karşılıklı teminat:** Alıcı kaporayı kilitler. Satıcı da teminat kilitler (zadatek kuralında kapora ile eşit tutar). Dolandırıcı kendi parasını kilitlemek zorunda kaldığı için sisteme girmez.
2. **Ceza ve hukuk kuralları:** `Forfeit` (vazgeçen ya da ses çıkarmayan taraf kilitlediği parayı kaybeder) ve `Refund` (herkes kendi parasını geri alır). Polonya'daki `Zadatek` ve `Zaliczka` bunların hukuki etiketleridir. Sektör ve ülke şablonları bu kuralların parametreli halleridir.
3. **İki onaylı tamamlanma:** İki taraf da "tamamlandı" onayı verince para çözülür. Bir taraf onaylar ve diğeri süresi içinde itiraz etmezse, onay veren haklı sayılır. Zincir dış dünyayı göremediği için "iş teslim edildi" ya da "ürün iade edildi" bilgisi böyle belirlenir.
4. **Davranış izi:** Zincirde kişinin kimliği değil, davranışı tutulur: tamamlanan, vazgeçilen, gelinmeyen işlemler ve kaybedilen itirazlar.
5. **Gizlilik katmanı (GDPR uyumlu, "Umami mantığı"):** Kişisel veri zincire yazılmaz. Belgelerin sadece tuzlu hash'i zincirde tutulur. Platform istatistikleri anonim ve toplu tutulur.
6. **Kimlik emaneti (sadece vizyon, MVP'de yok):** Büyük tutarlarda kimlik zincir dışında şifreli saklanır, sadece hakem dolandırıcılık kararı verirse açılır. Zincir dışı bir güven mekanizması olduğu için Superteam'in "kurallar programda olmalı" şartı gereği MVP'ye alınmadı (Bölüm 1.1).

### 2.1 Uzun vadeli vizyon

Amaç, her sektöre ve her siteye takılabilen, ödeme sağlayıcılarına benzer bir **aracısız güven bileşeni.** Bu uzun vadeli bir konumlandırma; hackathon kapsamında lisans gibi konular yok.

| Aşama | Ürün | Gereken ek parça |
|---|---|---|
| **1. Hackathon (MVP)** | Tek program + widget; şablonlar: kapora, P2P kiralama, freelance (tek teslim), P2P alışveriş | Yok, hepsi aynı kod (Bölüm 4.1) |
| 2 | Kargolu alışverişte otomatik onay | Kargo verisi onaylayıcısı (attester) ve inceleme süresi |
| 3 | Çok aşamalı freelance / hizmet ödemeleri | Aşama dizisi (`DealKind::Milestones`) |
| 4 | Dijital varlık takası | Gerekmiyor; para ve varlık aynı işlemde el değiştirir |
| 5 | Olaya bağlı ödeme (örn. parametrik sigorta: uçuş rötarında otomatik tazminat) | Dış veri kaynağı (oracle) |
| 6 | Herhangi bir site için ödeme API'si | Hesap paneli, webhook'lar, ücret modeli |

**Bilinçli olarak kapsam dışı:** Bahis / tahmin piyasası. Polonya'da bahis sıkı düzenlemeye tabi, ve ürünü "güvenli ödeme" hikâyesinden uzaklaştırır.

Pitch'te bu tablo **tek bir vizyon slaytı** olarak gösterilir. Demoda ise aynı programla **iki farklı şablon** canlı çalıştırılır (Bölüm 13).

**Kodda karşılığı:** Tek bir `Deal` hesabı (Bölüm 6.1). Şablonlar sadece parametre farkıdır. Yeni bir mekanik (aşamalar, attester) gerektiğinde yeni bir `kind` eklenir.

---

## 3. Zincir içi ve dışı veri ayrımı (kesin kural)

| Zincirde (Solana) | Zincir dışında (silinebilir, Postgres/Supabase) |
|---|---|
| Kapora ve teminat (test USDC, vault'ta) | İsim, e-posta, telefon, kimlik |
| Taraflar (cüzdan adresi), tutarlar, süreler, hukuk kuralı, durum | İlan detayları, fotoğraflar, belgeler |
| İlan ve kanıtların **tuzlu SHA-256 hash'i** | Hash'lerin tuzları (silinince hash hiçbir şeye bağlanamaz) |
| Davranış sayaçları (`Profile`) | Cüzdan ↔ kişi eşleşmesi |
| Platform bazlı anonim toplu sayaçlar (`PlatformStats`) | Şifreli kimlik emaneti (kripto-silme ile silinebilir) |

**Zincire asla yazılmayacaklar:** isim, e-posta, telefon, adres, plaka, ilan metni, serbest metin.

---

## 4. Ekonomik kurallar

**Roller (kodda genel isimler):**
- `payer`: Ana tutarı kilitleyen taraf. Kapora'da alıcı, kiralamada kiracı, freelance'ta müşteri, alışverişte alıcı.
- `payee`: Teklifi oluşturan karşı taraf. Kapora'da satıcı, kiralamada ürün sahibi, freelance'ta freelancer, alışverişte satıcı.
- Dokümanın Türkçe metinlerinde "alıcı" = `payer`, "satıcı" = `payee` anlamında kullanılır.

**Tanımlar:**
- `D` = payer'ın kilitlediği tutar (kapora / depozito / ücret / fiyat)
- `S` = payee'nin teminatı (0 olabilir)
- `P` = `D + S` (vault'taki toplam)

**Parametreler:**
- `penalty: Forfeit | Refund`: Vazgeçen ya da süresi içinde ses çıkarmayan tarafa ne olur?
  - `Forfeit`: Kusurlu taraf kilitlediği parayı kaybeder.
  - `Refund`: Herkes kendi parasını geri alır.
- `on_complete: ToPayee | ToPayer`: İşlem başarıyla tamamlanınca `D` kime gider? Kapora, freelance ve alışverişte payee'ye; kiralamada depozito payer'a geri döner. `S` her zaman payee'ye döner.
- `legal_label: None | Zadatek | Zaliczka | TrBaglanma`: Sadece etiket ve kısıt amaçlı. Ödeme mantığını değiştirmez, ama aşağıdaki kısıtları zorlar.

**Kısıtlar (`create_offer` içinde kontrol edilir):**
- `legal_label == Zadatek` ise `penalty == Forfeit`, `S == D` ve `on_complete == ToPayee` olmalı. "İki kat iade" kuralı ancak böyle sağlanır.
- `legal_label == Zaliczka` ise `penalty == Refund` olmalı.
- `D > 0`, `S >= 0`.

### Sonuçlar ve ödemeler

"Kusurlu taraf" = vazgeçen (`*Withdrew`) ya da süre dolduğunda onay vermemiş olan taraf (`*NoShow`).

| Sonuç (`Outcome`) | Ne zaman | Forfeit: payer'a / payee'ye | Refund: payer'a / payee'ye |
|---|---|---|---|
| `Completed` | İki taraf da onayladı | `on_complete=ToPayee`: 0 / P<br>`on_complete=ToPayer`: D / S | aynı |
| `PayerWithdrew` | Payer `withdraw` çağırdı | 0 / P | D / S |
| `PayeeWithdrew` | Payee `withdraw` çağırdı | P / 0 | D / S |
| `PayerNoShow` | Süre doldu, sadece payee onaylamış | 0 / P | D / S |
| `PayeeNoShow` | Süre doldu, sadece payer onaylamış | P / 0 | D / S |
| `Expired` | Süre doldu, kimse onaylamamış | D / S | D / S |
| `Cancelled` | Henüz payer yokken payee iptal etti ya da rezervasyon süresi doldu | — / S | — / S |
| `Resolved` | Hakem kararı | `P * payer_bps / 10000` / kalanı | aynı |
| `DisputeTimeout` | Hakem süresinde karar vermedi | D / S | D / S |

**Notlar:**
- Kapora'da `Completed` durumunda kapora satıcıya geçer, çünkü satış bedelinin bir parçasıdır. Kalan bedel zincir dışında ödenir.
- MVP'de protokol ücreti yok. Ücret mantığını şimdilik yazma.
- Yuvarlama artığı (bps bölmesinden kalan) payee'ye gider. Toplam her zaman tam olarak `P` olmalı.

### 4.1 Şablonlar (aynı kod, farklı parametreler)

Şablonlar **zincir dışında** (widget/SDK'da) tanımlanır ve `create_offer` parametrelerini doldurur. Zincirde sadece `template` etiketi saklanır.

| Şablon (`template`) | payer / payee | D | S | penalty | on_complete | legal_label | Hakem | Onay butonlarının etiketleri |
|---|---|---|---|---|---|---|---|---|
| `Deposit` (kapora) | alıcı / satıcı | kapora | = D | Forfeit | ToPayee | Zadatek (PL) / TrBaglanma (TR) | opsiyonel | ikisi de: "Deal completed" |
| `Rental` (P2P kiralama) | kiracı / ürün sahibi | depozito | 0 (opsiyonel) | Forfeit | **ToPayer** | None | önerilir (opt-in) | payer: "I returned the item", payee: "Item returned in good condition" |
| `Freelance` (tek teslim) | müşteri / freelancer | ücret | 0 (opsiyonel) | Forfeit | ToPayee | None | önerilir (opt-in) | payee: "Work delivered", payer: "I accept the work" |
| `Purchase` (P2P alışveriş) | alıcı / satıcı | fiyat | 0 (opsiyonel) | Forfeit | ToPayee | None | önerilir (opt-in) | payee: "Item handed over / sent", payer: "Item received" |

**Şablonların davranışı (UI'da düz dille açıklanacak):**
- **Rental:** Kiracı iade ettiğini onaylar. Sahip süresi içinde itiraz etmezse depozito kiracıya döner. Sahip hasar iddia ediyorsa itiraz açar ve hakem karar verir. Kiracı ürünü iade etmez ve onay vermezse depozito sahibe geçer.
- **Freelance:** Freelancer teslim ettiğini onaylar. Müşteri süresi içinde itiraz etmezse ödeme otomatik olarak freelancer'a geçer. Böylece müşteri parayı geri alamaz, freelancer da ödeme garanti edilmeden çalışmak zorunda kalmaz. Müşteri iptal etmek isterse UI `withdraw` yerine itirazı önerir, çünkü `Forfeit` kuralında müşterinin vazgeçmesi ücreti kaybettirir.
- **Purchase:** Satıcı teslim ettiğini onaylar. Alıcı süresi içinde itiraz etmezse ödeme satıcıya geçer.
- **Hakem kuralları:** Hakem her zaman **isteğe bağlıdır** ve işlem başında teklifte yazılıdır; payer rezerve ederek kabul etmiş olur. Hakem parayı sadece iki taraf arasında bölebilir (`payer_bps`), kendine alamaz. Süresinde karar vermezse `expire_dispute` ile herkes kendi parasını geri alır. Ana demo (`Deposit`) **hakemsiz** çalışır. Kiralama, freelance ve alışveriş için widget hakem eklemeyi önerir ama zorlamaz.
- Hakem tanımlı değilse anlaşmazlık durumunda tek mekanizma süreler ve ceza kuralıdır. Bu, UI'da açıkça yazılır.

---

## 5. Durum makinesi

```
Offered ──reserve──▶ Reserved ──(iki onay)──▶ Settled(Completed)
   │                   │
   │cancel / süre      ├─withdraw──────────▶ Settled(PayerWithdrew | PayeeWithdrew)
   ▼                   ├─claim_after_deadline▶ Settled(PayerNoShow | PayeeNoShow | Expired)
Settled(Cancelled)     └─dispute──▶ Disputed ──resolve──────▶ Settled(Resolved)
                                       └──expire_dispute─▶ Settled(DisputeTimeout)
```

**Süreler.** Hepsi saniye cinsinden parametre olarak verilir. Demoda 30 gün yerine 60 saniye kullanılabilmeli.
- `reserve_deadline = created_at + reserve_window_secs`: Alıcı bu süre içinde gelmezse teklif iptal edilebilir.
- `complete_deadline = reserved_at + complete_window_secs`: Taraflar bu süre içinde onay vermeli.
- `grace_secs`: Son tarihten sonra, `claim_after_deadline` açılmadan önce itiraz için tanınan ek süre.
- `dispute_deadline = disputed_at + arbiter_window_secs`: Hakem bu süre içinde karar vermezse `expire_dispute` çağrılabilir.

**Kurallar:**
- `withdraw` sadece `Reserved` durumunda ve **iki onay tamamlanmadan önce** çağrılabilir. Bir taraf onay verdikten sonra fikrini değiştirebilir; onayı yok sayılır ve `withdraw` uygulanır.
- `dispute`, `Reserved` durumunda `complete_deadline + grace_secs` dolmadan çağrılabilir. Sadece hakem tanımlıysa (`arbiter != Pubkey::default()`).
- `claim_after_deadline`, `Reserved` durumunda ve `now > complete_deadline + grace_secs` iken herkes tarafından çağrılabilir.

---

## 6. Solana programı (Anchor)

**Program adı:** `kapora`
**Token:** Klasik SPL Token programı. Devnet'te kendi oluşturduğumuz bir **test USDC mint'i** (6 ondalık).

### 6.1 Hesaplar ve PDA seed'leri

**Genişletilebilirlik notu:** Hesap bilinçli olarak `Reservation` değil, genel bir isimle `Deal` olarak adlandırıldı. Uzun vadede satın alma, takas ve hizmet ödemeleri de aynı yapıya `kind` olarak eklenecek (Bölüm 2.1). MVP'de **sadece `DealKind::Standard`** (tek seferde çözülen anlaşma) uygulanır; dört şablonun hepsi bu `kind` ile çalışır. Diğer `kind` değerleri enum'a yazılmaz; `create_offer` bilinmeyen bir `kind` için `UnsupportedKind` hatası döner. `settle` içindeki ödeme hesaplaması `kind`'e göre dallanacak şekilde yazılsın: `match deal.kind { DealKind::Standard => payout_standard(...) }`.

**`Deal`** — seeds: `["deal", payee, offer_id.to_le_bytes()]`
```
kind: DealKind             // MVP: sadece Standard
payee: Pubkey
payer: Pubkey              // reserve'e kadar Pubkey::default()
arbiter: Pubkey            // default = hakem yok, itiraz kapalı
platform: Pubkey           // entegrasyon yapan platformun kimliği (istatistik için)
mint: Pubkey
offer_id: u64
payer_amount: u64          // D
payee_stake: u64          // S
penalty: Penalty           // Forfeit | Refund
on_complete: OnComplete    // ToPayee | ToPayer
legal_label: LegalLabel    // None | Zadatek | Zaliczka | TrBaglanma (etiket + kısıt)
template: u8               // 0=Deposit, 1=Rental, 2=Freelance, 3=Purchase (sadece etiket)
listing_hash: [u8; 32]     // tuzlu SHA-256, tuz zincir dışında
evidence_hash: [u8; 32]    // itirazda gönderilen kanıt hash'i (yoksa sıfır)
reserve_window_secs: i64
complete_window_secs: i64
grace_secs: i64
arbiter_window_secs: i64
created_at: i64
reserved_at: i64
complete_deadline: i64
dispute_deadline: i64
payer_confirmed: bool
payee_confirmed: bool
status: Status             // Offered | Reserved | Disputed | Settled
outcome: Outcome           // Settled olduğunda dolu, öncesinde None
bump: u8
vault_bump: u8
```

**`Vault`** — seeds: `["vault", deal]`. Bir SPL token hesabıdır, `authority = deal` PDA'sı.

**`Profile`** — seeds: `["profile", wallet]`. `init_if_needed` ile oluşturulur.
```
wallet: Pubkey
completed: u32
withdrew: u32
no_show: u32
disputes_lost: u32
volume_completed: u64
bump: u8
```

**`PlatformStats`** — seeds: `["stats", platform]`. `init_if_needed`. Anonim toplu sayaçlardır, Umami mantığıyla çalışır.
```
platform: Pubkey
offers: u64
reserved: u64
completed: u64
payer_withdrew: u64
payee_withdrew: u64
no_show: u64
expired: u64
cancelled: u64
disputed: u64
resolved: u64
volume_completed: u64
bump: u8
```

### 6.2 Instruction'lar

| Instruction | İmzalayan | Ön koşul | Etki |
|---|---|---|---|
| `create_offer(offer_id, payer_amount, payee_stake, penalty, on_complete, legal_label, template, listing_hash, reserve_window_secs, complete_window_secs, grace_secs, arbiter_window_secs, arbiter, platform)` | satıcı | `payer_amount > 0`. Bölüm 4'teki `legal_label` kısıtları. Tüm süreler > 0. | `Deal` (`kind = Standard`) ve `Vault` oluşur, `S` vault'a aktarılır. `status = Offered`. `stats.offers += 1` |
| `cancel_offer()` | satıcı (her zaman) **veya** herkes (`now > reserve_deadline` ise) | `Offered` | `S` satıcıya döner. `outcome = Cancelled`. `stats.cancelled += 1` |
| `reserve()` | alıcı | `Offered`, `now <= reserve_deadline`, `payer != payee` | `D` vault'a aktarılır. `payer` set edilir, `reserved_at` ve `complete_deadline` hesaplanır. `status = Reserved`. `stats.reserved += 1` |
| `confirm_complete()` | alıcı veya satıcı | `Reserved`, `now <= complete_deadline + grace_secs` | İlgili onay bayrağı `true` olur. İkisi de `true` ise ödeme yapılır, `outcome = Completed` |
| `withdraw()` | alıcı veya satıcı | `Reserved`, iki onay henüz tamamlanmamış | `PayerWithdrew` veya `PayeeWithdrew` sonucuna göre ödeme |
| `claim_after_deadline()` | herkes | `Reserved`, `now > complete_deadline + grace_secs` | Onay bayraklarına göre `PayerNoShow`, `PayeeNoShow` veya `Expired` |
| `open_dispute(evidence_hash)` | alıcı veya satıcı | `Reserved`, hakem tanımlı, `now <= complete_deadline + grace_secs` | `status = Disputed`, `dispute_deadline` hesaplanır. `stats.disputed += 1` |
| `resolve(payer_bps, fault)` | hakem | `Disputed`, `payer_bps <= 10000` | Oransal ödeme, `outcome = Resolved`. `fault` (Payer \| Payee \| None) ilgili profilin `disputes_lost` sayacını artırır |
| `expire_dispute()` | herkes | `Disputed`, `now > dispute_deadline` | `outcome = DisputeTimeout`, iki taraf da kendi parasını geri alır |

**Ödeme mekanizması:**
- Tek bir dahili fonksiyon kullanılır: `settle(outcome)`.
  1. Bölüm 4'teki tabloya göre `to_payer` ve `to_payee` hesaplanır.
  2. `to_payer + to_payee == P` olduğu doğrulanır.
  3. Vault'tan PDA imzasıyla (`signer seeds`) CPI transferleri yapılır.
  4. Vault kapatılır, rent satıcıya döner.
  5. `status = Settled` yapılır.
  6. `Profile` ve `PlatformStats` sayaçları güncellenir.
  7. `Settled` event'i yayınlanır.
- `Deal` hesabı **kapatılmaz**, arayüz geçmişi okuyabilsin diye durur.

**Alıcı tarafındaki token hesapları:** Hesaplar `associated_token` ile `init_if_needed` olarak açılır. Hesap açılış maliyetini (payer) çağıran taraf öder.

**Profil güncellemeleri:**
- `Completed`: iki taraf için `completed += 1` ve `volume_completed += D`.
- `*Withdrew`: vazgeçen tarafın `withdrew += 1`.
- `*NoShow`: gelmeyen tarafın `no_show += 1`.
- `Expired`: iki tarafın da `no_show += 1`.
- `Resolved`: `fault` olarak belirtilen tarafın `disputes_lost += 1`.

### 6.3 Event'ler
`OfferCreated`, `OfferCancelled`, `Reserved`, `Confirmed { by }`, `DisputeOpened { by, evidence_hash }`, `Settled { outcome, to_payer, to_payee }`.

### 6.4 Hata kodları (örnek)
`InvalidAmount`, `StakeMustEqualDeposit`, `InvalidLegalParams`, `InvalidWindow`, `InvalidStatus`, `NotParty`, `NotArbiter`, `NoArbiter`, `DeadlinePassed`, `DeadlineNotReached`, `SelfDeal`, `UnsupportedKind`, `AlreadyConfirmed`, `InvalidBps`, `MathOverflow`, `MintMismatch`.

### 6.5 Güvenlik gereksinimleri
- Her hesap ilişkisini `has_one` ve `constraint` ile doğrula: `payee`, `payer`, `arbiter`, `mint`, `vault`.
- Her instruction'ın başında `status` kontrolü yap.
- Tüm aritmetikte `checked_*` kullan. bps hesabını `u128` ile yap.
- Vault'un `mint`'i ile `deal.mint` eşleşmeli. Alıcı ve satıcının token hesaplarının `mint`'i de kontrol edilmeli.
- `settle` en fazla bir kez çalışabilmeli: `Settled` durumundan çıkış yok.
- `resolve` sadece `arbiter` imzasıyla çalışmalı. `arbiter == default` ise `open_dispute` reddedilmeli.
- Zaman için `Clock::get()?.unix_timestamp` kullan.

### 6.6 Testler (zorunlu)
Testler TypeScript ile yazılır (Anchor test veya LiteSVM / solana-bankrun ile **saat ileri sarma**). En az şu senaryolar:
1. Mutlu senaryo: offer → reserve → iki onay → `Completed`. Bakiyeler doğru, profiller güncellenmiş.
2. Zadatek, alıcı vazgeçer: satıcı `P` alır.
3. Zadatek, satıcı vazgeçer: alıcı `P` (= 2D) alır.
4. Zaliczka, satıcı vazgeçer: alıcı `D`, satıcı `S` alır.
5. Sadece alıcı onaylar, süre dolar: `PayeeNoShow`.
6. Kimse onaylamaz: `Expired`.
7. Alıcı gelmez, rezervasyon süresi dolar: herkes `cancel_offer` çağırabilir.
8. İtiraz, hakem %70/%30 karar verir: bakiyeler ve `disputes_lost` sayacı doğru.
9. İtiraz, hakem sessiz kalır: `DisputeTimeout`.
10. **Rental:** iki onay → depozito payer'a, `S` payee'ye döner (`on_complete = ToPayer`).
11. **Freelance:** sadece payee onaylar, payer süresi içinde ses çıkarmaz → `PayerNoShow`, payee `D` alır.
12. **Refund kuralı:** payee vazgeçer → payer `D`, payee `S` alır.
13. `legal_label` kısıt ihlalleri reddedilir: Zadatek + Refund, Zadatek + `S != D`, Zadatek + ToPayer, Zaliczka + Forfeit.
14. Negatif testler: yanlış imzacı, yanlış durum, kendine rezervasyon, iki kez `settle`, son tarihten önce `claim`, hakemsiz itiraz.

---

## 7. Zincir dışı servisler

**Veritabanı (Supabase veya Postgres) tabloları:**
- `users(id, email, wallet, created_at)`: Cüzdan ↔ kişi eşleşmesi. **Silinebilir.**
- `listings(id, platform, template, title, price, images, salt, listing_hash)`: İlan detayları. Tuz burada tutulur.
- `evidence(id, deal, uploader, file_url, salt, hash)`: İtiraz kanıtları.
- `identity_escrow`: **MVP kapsamında değil** (sadece vizyon, Bölüm 2 ve 11). Tabloyu oluşturma.

**Hash servisi** (`/api/hash`): `sha256(salt || canonical_json(data))` döner. Tuz sunucuda üretilir ve zincire gitmez.

**İstatistik:** `/stats` sayfası zincirdeki `PlatformStats` hesabını okur. Kişi bazlı hiçbir veri göstermez.

---

## 8. Entegrasyon katmanı

**TypeScript SDK** (`/sdk`):
- Anchor IDL'den üretilen istemcinin üzerinde ince bir katman.
- Fonksiyonlar: `createOffer()`, `cancelOffer()`, `reserve()`, `confirm()`, `withdraw()`, `claimAfterDeadline()`, `openDispute()`, `resolve()`, `expireDispute()`, `getDeal()`, `getProfile()`, `getPlatformStats()`.
- Ayrıca PDA hesaplama yardımcıları.

**Gömülebilir buton** (`/widget`): Tek bir script dosyası.
```html
<script src="https://<app>/widget.js"
        data-platform="<PLATFORM_PUBKEY>"
        data-listing-id="abc123"
        data-amount="2000"
        data-template="deposit"></script>
```
Butona tıklanınca uygulamadaki `/d/new?...` sayfası modal ya da yeni sekmede açılır.

**Kapora linki:** `/d/<deal_pubkey>` sayfası WhatsApp veya mesaj ile paylaşılabilir. *Vakit kalırsa:* Solana Action / Blink.

---

## 9. Frontend (`/app`, Next.js + TypeScript)

**Teknolojiler:** `@solana/wallet-adapter` (Phantom, devnet), Anchor TS istemcisi, Tailwind.

**Sayfalar:**
- `/demo/auto` ve `/demo/auto/[id]`: **Uydurma** bir araç ilan sitesi ("DemoAuto"). İlan sayfasında widget butonu bulunur.
- `/demo/rent` ve `/demo/rent/[id]`: **Uydurma** bir ekipman kiralama sitesi ("DemoRent": kamera, laptop). Aynı widget, `Rental` şablonu. Bu site, bileşenin farklı bir sektöre aynı kodla takıldığını gösterir.
- `/offer/new`: Payee teklif oluşturur. Şablon seçilir (kapora, kiralama, freelance, alışveriş); tutar ve kurallar şablondan gelir, gerekirse düzenlenir.
- `/d/[deal]`: İki tarafın ortak durum sayfası.
  - Zaman çizelgesi (timeline)
  - Geri sayımlar
  - Butonlar: Rezerve et, Tamamlandı, Vazgeç, İtiraz et, Süre doldu, sonucu uygula
  - Kuralların düz dilde açıklaması, örneğin: "Satıcı vazgeçerse 2× geri alırsın"
- `/profile/[wallet]`: Davranış izi. Sadece sayaçlar gösterilir, kimlik yok.
- `/stats`: Platform bazlı anonim istatistikler.
- `/arbiter`: Açık itirazların listesi, kanıt linkleri, karar formu.
- `/dev/faucet`: Test USDC basma butonu. Sadece devnet'te çalışır.

**Kurallar:**
- Gerçek marka adı veya logosu **kullanılmayacak** (Sahibinden, OLX, Otomoto, Otodom). Pitch'te sadece örnek olarak anılacaklar.
- Arayüz metinleri **İngilizce**.
- Tutarlar PLN karşılığıyla gösterilir. Test USDC, demo için 1 USDC ≈ 1 PLN gibi basit bir varsayımla çevrilir ve ekranda "demo kur" olarak açıkça belirtilir.

---

## 10. Repo yapısı

```
kapora/
├── Anchor.toml
├── programs/kapora/src/
│   ├── lib.rs
│   ├── state.rs          // Deal, DealKind, Profile, PlatformStats, enum'lar
│   ├── errors.rs
│   ├── events.rs
│   ├── settle.rs         // ödeme tablosu + transfer
│   └── instructions/     // her instruction ayrı dosya
├── tests/                // TS testleri
├── sdk/                  // TS SDK
├── app/                  // Next.js (demo siteleri, durum sayfası, stats, arbiter)
├── widget/               // gömülebilir script
├── scripts/              // devnet: mint oluştur, cüzdan fonla, demo verisi
└── README.md             // kurulum, mimari, gizlilik bölümü, demo adımları
```

**Ortam:** Rust (stable), Solana CLI (Agave), `avm` ile Anchor. Node 20+ ve pnpm. Kullandığın sürümleri `README.md`'ye ve `Anchor.toml`'a **sabitle**.

---

## 11. Kapsam

**Mutlaka bitmeli (Superteam'in "tamam" tanımı, Bölüm 1.1):**
- Program: Bölüm 6'daki tüm instruction'lar ve 6.6'daki testler (testler değerlendirilmiyor ama geliştirme güvencesi için gerekli; zaman daralırsa 1–9 öncelikli)
- Devnet'e deploy
- Test USDC scriptleri
- SDK
- Bir demo sitesi (DemoAuto, `Deposit` şablonu) ve widget.
- İkinci site (DemoRent, `Rental` şablonu) kuvvetle önerilir, çünkü "her sektöre takılır" iddiasını kanıtlayan şey bu. Zaman daralırsa kesilebilir.
- `/d/[id]` durum sayfası, her işlemden sonra **Solana Explorer linki** ile
- Demo akışları: tamamlanma, vazgeçme ve **kaybolan taraf** (`claim_after_deadline`)
- README: hedef kullanıcı, tasarım gerekçesi, "ne nerede", program ID, kurulum
- İki demo cüzdanı (test SOL ve test USDC ile fonlanmış) ve demo kaydı (yedek)

**Vakit kalırsa:**
- Hakem arayüzü
- `/stats` ve `/profile`
- Blink

**Yapılmayacak:**
- Gerçek KYC ve kimlik emaneti (mock dahil; zincir dışı "güven" özelliği olduğu için Bölüm 1.1'deki kuralla çelişir, sadece vizyonda anlatılır)
- Gerçek platform entegrasyonu
- Mainnet
- Protokol ücreti
- Upgrade/governance (final deploy'dan sonra upgrade yetkisi kaldırılır)
- Mobil uygulama

---

## 12. Çalışma sırası (solo)

Proje tek kişiyle yapıldığı için iş paralel değil, **sırayla** ilerler. Her adım bitmeden bir sonrakine geçme; her adımın sonunda çalışan bir şey olsun.

1. **Program ve testler** (Bölüm 6). En kritik parça.
2. **Devnet'e deploy** ve test USDC scriptleri.
3. **SDK.**
4. **`/d/[id]` durum sayfası:** Cüzdan bağlantısı ve tüm butonlar.
5. **Bir demo sitesi + widget** (DemoAuto). İkinci site (DemoRent) aynı widget'la sadece veri farkıdır, en sona bırakılabilir.
6. **Teslim materyalleri:** 10 slayt PDF, **en fazla 3 dakikalık public video (zorunlu)**, tasarım gerekçesi içeren açıklama, public repo (Bölüm 16).
7. **Vakit kalırsa:** `/stats`, `/profile`, hakem arayüzü, Blink.

**Kapsam kuralı:** Zaman daralırsa listenin sonundan başlayarak kes. 1–4 ve 6 kesilmez.

**Saat saat plan:**

| Saat | Hedef |
|---|---|
| T+3 | `create_offer` ve `reserve` devnet'te çalışıyor |
| T+8 | Tüm program ve testler hazır |
| T+12 | Durum sayfası ve DemoAuto + widget ile mutlu senaryo çalışıyor |
| T+16 | Vazgeçme senaryosu, DemoRent; vakit varsa profil ve istatistikler |
| T+18 | Yeni özellik eklemeyi durdurma (feature freeze) |

---

## 13. Demo senaryosu (3 dakika)

1. **Sorun:** Sahte ilan ve kapora dolandırıcılığı hikâyesi.
2. **DemoAuto:** Kapora verilir. Satıcı ekranında "Ödeme güvende" görünür. Devirde iki onay verilir, para çözülür, iki profil de güncellenir.
3. **"Aracının kalktığı an":** İkinci ilanda satıcı ortadan kaybolur. Süre dolunca alıcı (ya da herhangi biri) `claim_after_deadline` çağırır, program parayı kurala göre dağıtır. Solana Explorer'da işlem gösterilir.
4. **DemoAuto'da üçüncü ilan (vakit varsa):** Satıcı vazgeçer, alıcı otomatik olarak **2× geri alır**, satıcının profiline "withdrew" yazılır. Süreler demo modunda 60 saniyedir.
5. **DemoRent (vakit varsa):** Aynı widget, aynı program, farklı sektör. Kamera kiralanır, kiracı iade eder, depozito otomatik geri döner. Mesaj: 'Tek bileşen, her sektör.'
6. **Gizlilik slaytı:** Zincirde ne var, zincir dışında ne var.
7. **Kapanış:** Vizyon slaytı (Bölüm 2.1) ve "One component — every marketplace, every sector, every country."

---

## 14. İlk görevler (ajan buradan başlasın)

1. **İskelet:**
   - Ortam için önce Superteam'in dev container'ını kullan: `github.com/matzayonc/solana-live-course-2026`. Rust, Solana CLI ve Anchor hazır gelir.
   - `anchor init kapora` ile projeyi başlat ve Bölüm 10'daki klasör yapısını kur.
   - Ortamın sürümlerini README'ye yaz.
2. **State ve iskelet kodu:**
   - `state.rs`, `errors.rs` ve `events.rs` dosyalarını Bölüm 6'ya göre yaz.
   - Tüm instruction'ları imzaları ve `Accounts` struct'larıyla oluştur. Gövdeler `todo!()` olarak kalabilir.
   - Kod derlenmeli (`anchor build`).
3. **Ödeme mantığı:** `settle.rs` dosyasında Bölüm 4'teki tabloyu saf bir Rust fonksiyonu olarak yaz: `fn payout(penalty, on_complete, outcome, D, S, bps) -> (to_payer, to_payee)`. Her tablo satırı için birim testi ekle.
4. **Instruction gövdeleri:** Bu sırayla yaz: `create_offer`, `reserve`, `confirm_complete`, `withdraw`, `claim_after_deadline`, `cancel_offer`, `open_dispute`, `resolve`, `expire_dispute`.
5. **Testler:** Bölüm 6.6'daki senaryoları TS ile yaz ve hepsini geçir.
6. **Devnet:**
   - Devnet'e deploy et.
   - `scripts/` altına test USDC mint'i oluşturan ve demo cüzdanlarını fonlayan scriptleri yaz.
   - Program ID'yi ve mint adresini README'ye yaz.
7. **SDK iskeleti:** Bölüm 8'deki fonksiyonlar ve PDA yardımcıları.

**Tamamlanma tanımı:**
- `anchor build` ve `anchor test` hatasız çalışıyor.
- Program devnet'te.
- SDK ile bir script üzerinden mutlu senaryo baştan sona çalışıyor.

**Dış kaynaklar:** Kullanılan her şablon, kütüphane, örnek kod ve dış kaynak README'de "Credits / External resources" başlığı altında açıkça listelenmeli. Bu HackYeah kuralıdır (Bölüm 16).

**Belirsizlik olursa:** Bu dokümandaki kurallara uy. Doküman bir konuda sessizse en basit ve güvenli seçeneği seç, `README.md` içindeki "Decisions" başlığı altına not düş.

---

## 15. Açık sorular (sahada mentorlara sorulacak)

Zincir, devnet, kriterler ve teslim şartları resmi PDF'lerle netleşti (Bölüm 1.1). Kalanlar:
1. Fikre ilk tepkileri ne? Escrow'a dayanan bir projeyi nasıl değerlendiriyorlar?
2. Final sunumunun süresi ne kadar?
3. Kuraldaki "en erken 3 Ekim saat 23:00'te başlanmış olmalı" ifadesi bir yazım hatası mı (muhtemelen 11:00)?
4. Ödül dağılımı: Kuralda toplam 3.000 USD yazıyor, ama dereceler 1.500 / 1.000 / 500 **PLN** olarak verilmiş. Muhtemelen USD olacak.

**Hukuki not:** Zadatek ve bağlanma parası kurallarının yorumu, ve kimlik emaneti ile kişisel veri işlemenin yasal dayanağı gerçek bir ürün için hukukçuya teyit ettirilmeli. Hackathon kapsamında bunlar tasarım varsayımıdır.

---

## 16. Teslim şartları

> **Superteam'in kendi şartları SSS'den önce gelir.** Superteam'e göre teslimde şunlar **zorunlu**:
> - Proje başlığı ve **tasarım gerekçesini içeren detaylı açıklama**
> - PDF sunum (en fazla 10 slayt)
> - **Public bir linkte, en fazla 3 dakikalık video** (SSS'deki "60 saniye, isteğe bağlı" kuralı bu görev için geçerli değil)
> - **Kod reposu** (değerlendirme süresince public)
> - Takım adı ve üye listesi (solo için tek kişi)
> - Dil: İngilizce veya Lehçe. Biz İngilizce kullanıyoruz.
> - **Son tarih: 4 Ekim 2026, 23:00.**
>
> İsteğe bağlı: ekran görüntüleri, demo linkleri, grafik materyaller.
>
> Aşağıdaki bölüm HackYeah'ın genel SSS'sinden. Superteam şartlarıyla çelişen yerlerde Superteam geçerlidir.

**Genel kurallar:**
- Tüm görev detayları etkinliğin başında açıklanır.
- Önceden hazırlanmış ya da dış kaynaklı her şey (kod, repo, araç, tasarım) sunumda ve kodda **açıkça belirtilmeli.**
- Ücretli dış kaynak kullanmak değerlendirmede avantaj sağlamaz.
- Aynı projeyi birden fazla kategoriye göndermek önerilmiyor.
- Bazı partner görevleri, ödül kazanılırsa fikri mülkiyet devri isteyebilir. Görev kurallarını kontrol et.

**Teslim platformu ve son tarih:**
- Proje **HackTribe** platformuna yüklenir, ama partner farklı bir platform isteyebilir.
- SSS'ye göre yükleme için Discord ID'si isteniyor.
- **Son tarih:** 4 Ekim 2026 (Pazar), saat 23:00. Superteam kurallarıyla teyit edildi.
- Proje erken yüklenip son tarihe kadar düzenlenebilir. **İlk iskelet hazır olunca erkenden bir taslak yükle.**
- Oylama başladıktan sonra proje bilgileri değiştirilemez.

**HackTribe'a yüklenecekler:**

| Alan | Zorunlu mu | Kural |
|---|---|---|
| Kategori | Evet | Finance Without Intermediaries |
| Proje başlığı | Evet | İngilizce, **en fazla 5 kelime** |
| Açıklama | Evet | İngilizce, **en fazla 500 kelime**, katılımcının adı, soyadı ve e-postası dahil. Önerilen format: sorun, çözüm, nasıl çalışır (yaklaşık 3 paragraf). |
| Görsel galerisi | Evet | En az 1 görsel (ekran görüntüleri) |
| Sunum | Evet | İngilizce, PDF (veya PDF + PPTX), **en fazla 10 slayt** |
| Video | **Evet (Superteam)** | İngilizce, **en fazla 3 dakika**, public link |
| Demo linki | Hayır | Giriş bilgileri verilmeli |
| Repo linki | **Evet (Superteam)** | Tek repo, modüller ayrı klasörlerde, jüri erişebilmeli |
| Açılış talimatları | Hayır | Jürinin projeyi hızlıca çalıştırması için |

**Final:**
- Jüri her görevden en iyi projeleri seçer ve finalistleri Discord'da ve HackTribe'da duyurur.
- Finalistler sırayla jüriye canlı sunum (pitch) yapar.

**Değerlendirme:**
- Partner görevlerinde kriterler görevin kendi kurallarındadır.
- Açık görevlerde kriterler şöyledir; partner kuralı yoksa referans olarak kullan:
  - Idea & Innovation: %30
  - Relation to Category: %20
  - Practical Applicability: %20
  - Design: %20
  - Completeness: %10

**Bu proje için yapılacaklar:**
- [ ] Repo **public** olsun (Superteam şartı).
- [ ] Açıklamada ve README'de hedef kullanıcı ve tasarım gerekçesi yazılsın (Bölüm 1.1).
- [ ] Final deploy sonrası upgrade yetkisi kaldırılsın ya da kaldırılmadığı dürüstçe belirtilsin.
- [ ] README'de "Credits / External resources" bölümü olsun.
- [ ] 10 slaytlık İngilizce PDF sunum hazırlansın.
- [ ] En fazla 3 dakikalık İngilizce demo videosu çekilsin ve public bir linke yüklensin (**zorunlu**). Canlı demo için de yedek olarak kullanılır.
- [ ] Demo linki devnet'te çalışsın, cüzdan kurulumu açıklansın.
- [ ] Proje başlığı en fazla 5 kelime olsun. Öneri: *"Kapora: Trustless Deposits for Marketplaces"*.
