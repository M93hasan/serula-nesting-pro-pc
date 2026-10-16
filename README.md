# Serula Nesting Pro PC — Hibrit çevrimiçi / çevrimdışı

Windows için **Serula Nesting Pro PC v0.1.15**. Aynı kurulumda **canlı web sürümü** ve **yerel offline sürüm** bulunur. Ana web deposu [M93hasan/nesting](https://github.com/M93hasan/nesting) ve nesting algoritması değiştirilmemiştir.

## Otomatik çalışma

- Program açılırken doğrudan **https://serula.site** erişimini denetler. Site ulaşılabiliyorsa gerçek online sürümü açar: mevcut web hesabı, bulut geçmişi, canlı destek ve web yetkileri oradadır.
- İnternet yoksa veya site erişilemiyorsa paket içindeki **React arayüzü + Rust/WASM yerleşim motoru** yerel Windows bağlantısında çalışır. DXF / SVG / PLT içe alma, rulo/plaka nesting hesaplama ve DXF dışa aktarma sunucuya bağlı değildir.
- Açıkken bağlantıyı yaklaşık **12 saniyede bir** kontrol eder. İki ardışık başarısız testte çevrimdışı sürüme geçer; iki ardışık başarılı testte online dönüşü değerlendirir. Zayıf Wi-Fi'de gereksiz sürekli geçişi azaltır.
- İnternet geri geldiğinde **çevrimdışı değişiklik yapılmadıysa** otomatik olarak online sürüme döner. **Yerel değişiklikler varsa**, sessizce online hesaba geçmek ya da buluttaki projeyi ezmek yerine kullanıcıya seçim sunar.
- İki görünümün pencereleri birbirinden ayrıdır; görünmeyen online oturum kapatılmaz. Böylece geçici bağlantı kaybında çevrimiçi sayfanın RAM'deki durumunu silmekten kaçınılır. Yine de ağ kesintisi sırasında sunucu işlemleri başarısız olabilir; kritik projelerin ayrıca kopyası tutulmalıdır.
- Üst menüde **Serula → Çevrimiçi aç / Çevrimdışı aç / Bağlantıyı kontrol et** bulunur. Kısayollar Ctrl+Shift+O ve Ctrl+Shift+L.

## Projelerin korunması ve eşitleme sınırları

Online hesap ve offline bilgisayar kayıtları **ayrı saklanır**. Offline kayıtları, çevrimiçi hesaba **otomatik gönderilmez**. Bu yüzden çevrimdışı bir projeyi web hesabına taşımak için proje dosyasını dışa aktarıp online sürümde açarak kaydetmek gerekir. Kullanıcı onay vermedikçe çevrimdışı içerikle bulut projesinin üzerine yazılmaz.

- Offline modundaki son proje diskte `offline-data/autosave.json` dosyasında, son 50 DXF çıktısı `offline-data/exports/` klasöründe tutulur. DXF geçmişindeki proje kopyaları da burada saklanır.
- Online görünümdeki son proje Serula'nın tarayıcı kurtarma deposunda bulunuyorsa çevrimdışına geçerken kopyası yerel moda aktarılır. Çakışma varsa önceki offline projenin yedeği `offline-data/backups/` içine konur. Son online kurtarma ayrıca `offline-data/last-online-recovery.json` olarak saklanır.
- Web arayüzü kendi kurtarma kaydını üretmemişse online projenin otomatik olarak offline moda taşınması garanti değildir. **İki modda aynı proje kendiliğinden senkronize olmuş sayılmaz.**
- Offline kayıtlardan sonra bağlantı geri geldiğinde online geçiş onayı istenir; yerel dosyalar korunur. Web sürümünü yeniden açınca farklı bir projenin görünmesi mümkündür.
- Yerel klasör, Windows'ta genellikle `%APPDATA%\serula-nesting-pro-pc\offline-data` altındadır. Kesin yol Electron userData dizinine bağlıdır. **Yardım → Yerel kayıt klasörü** seçeneği dosyaları açar.

## Seçili butonların rengi (v0.1.11)

0°, 0°/180° ve Her yöne izinli dönüş seçeneklerinde ve diğer seçilebilir düğmelerde **aktif seçim açık mavi/derin mavi gradyan, beyaz yazı ve belirgin kenarlıkla** gösterilir. Aktif olmayan seçimler nötr bırakılır; buton ebatları, yerleşim ve click işlevleri değiştirilmez.

Bu görsel değişiklik **yalnızca Windows PC uygulamasının online ve offline pencerelerinde** Electron stil katmanı üzerinden uygulanır. Web deposuna veya tarayıcıda açılan serula.site sitesinin dosyalarına müdahale edilmemiştir.

## Online / offline özellikler

| Özellik | İnternet olduğunda | İnternet yokken |
| --- | --- | --- |
| DXF / SVG / PLT içe alma | Canlı web | Kurulum içindeki yerel motor |
| Rulo ve plaka yerleştirme | Canlı web WASM | Paketlenmiş WASM |
| DXF dışa aktarma | Web yetkisine bağlı | Yerel olarak serbest |
| Proje / çıktı geçmişi | Web hesabı ve bulut | Windows yerel kayıt |
| Kullanıcı girişi, admin ve canlı destek | Desteklenir | Kullanılamaz |
| CorelDRAW aktarma köprüsü | Yetki ve çalışan Windows köprüsü gerekir | Sunucu bileti doğrulaması olmadığından otomatik aktarım kullanılamaz; DXF dosyasını elle içe alın |

Offline motorunun sürümü kurulum paketiyle gelir; web sitesi güncellense bile kurulu offline motor yeni paket yüklenmeden güncellenmez.

## Web–PC sürüm eşitlemesi (0.1.15)

- PC paketi yalnızca **web ve PC sürümü eşleşiyorsa** hazırlanır; aksi halde derleme durur.
- Çevrimdışı motorun kaynak GitHub commit'i, paketteki `serula-build.json` dosyasına yazılır.
- **Yardım → PC / Web sürüm bilgisi** ile paket içindeki sürüm ve kaynak commit görülebilir.
- Windows yayın hattı, her gece web reposunun güncel durumunu kontrol eder; son yayımlanan paketten farklıysa yeniden derler.
- Online sürüm canlı siteyi açar; offline sürüm ancak yeni EXE kurulduğunda güncellenir. Çevrimdışı projeler otomatik olarak buluta taşınmaz.

**RDWorks otomatik aktarımı bu sürümde kaldırılmıştır.**

## Windows kurulumu

[**Serula Nesting Pro PC indirme sayfası**](https://github.com/M93hasan/serula-nesting-pro-pc/releases/latest)

**Hibrit sürüm etiketi: pc-v0.1.15.** pc-v0.1.6 sadece offline sürümdü; yeni sürüm kurulduğunda varsayılan olarak bağlantı durumuna göre seçim yapılır.

Kurulumdan sonra üç test önerilir: (1) internet açıkken hesabınla canlı web'e gir; (2) bağlantıyı kes, otomatik offline geçişte DXF içe alıp nesting ve export yap; (3) internet geldiğinde offline değişikliklerin korunmasına dair seçimi kontrol et. Sonrasında programı yeniden açıp offline geçmişi incele.

## Geliştirme ve derleme

Node.js 22 gereklidir. PC deposunu ve ana web kaynağını ayrı klasörlerde saklayın:

    git clone https://github.com/M93hasan/serula-nesting-pro-pc.git
    cd serula-nesting-pro-pc
    git clone https://github.com/M93hasan/nesting.git web-source
    npm install
    npm ci --prefix web-source/web
    npm run offline:test
    npm run dist:win

Derleme `release/Serula-Nesting-Pro-PC-Setup.exe` dosyasını üretir. GitHub Actions iki depoyu ayrı indirir, geçici web kaynağında sadece PC offline kabuğuna özgü başlangıç ve kurtarma değişikliklerini uygular, web deposunu değiştirmez. Paket yapımı internet gerektirebilir; kurulmuş PC programı offline çalışır.

**Not:** Web projesindeki WASM parmak izi mevcut ikili paketlerle eşleşmiyorsa PC derlemesi kaynak motora müdahale etmeden dört önceden üretilmiş WASM paketini korur. Bu upstream eşleşme sorunu ayrı takip edilmelidir.


**Doğrudan aktarım:** Yalnızca CorelDRAW desteklenir; RDWorks aktarımı sistemden kaldırılmıştır.

## Makine profili ve çift kafa (0.1.15)

Yeni kullanıcılar ilk girişte makine kafa sayısı (tek / çift), malzeme türü (rulo / plaka), gerçek kesim eni ve plaka kesim boyunu seçer. Hesaplarına kaydolan ayarlar **Ayarlarım** bölümünden düzenlenebilir. Çift kafalı modda nesting fiziksel genişliğin yarısı kullanılarak hesaplanır (örn. **1400 mm → 700 mm**). İkinci kafa bölgesi görsel referanstır, DXF'ye iki kez kesim yaptıracak kopya eklenmez. Gerçek ikinci kafa X ofseti lazer makinesinde ayrıca kontrol edilmeli ve ilk üretim öncesi boş kesim testi yapılmalıdır.

Windows PC uygulamasında internet varken çevrimiçi kullanıcı profili açılır; internet yokken çevrimdışı proje ve makinaya ait proje ayarları yerel kalır. 0.1.15 PC paketi yeni web/WASM kodlarını içerir. **CorelDRAW Bridge 1.6** sürümü sadece `corel` hedefini kabul eder.
