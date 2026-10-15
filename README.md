# Serula Nesting Pro PC (Windows) — Çevrimdışı

Bu depo **Serula Nesting Pro'nun bağımsız Windows sürümüdür**. PC sürümü artık serula.site adresini açan bir tarayıcı kabuğu değildir. React arayüzü, DXF işleme kodu ve önceden derlenmiş Rust/WebAssembly Sparrow yerleşim motoru kurulum paketinin içindedir.

## PC v0.1.6

- **İnternet gerektirmez:** Program açılışı, DXF / SVG / PLT içe aktarma, rulo/plaka nesting hesaplama ve DXF indirme aynı bilgisayarda yapılır.
- **Hesap girişi gerekmez:** Çevrimdışı kullanım için sunucu oturumu, kredi veya çevrimiçi DXF onayı beklenmez.
- **Projeler bilgisayara kaydedilir:** Son proje offline-data/autosave.json olarak; DXF geçmişi ve karşılık gelen proje JSON'ları yerel dosyalar olarak saklanır. Son **50** DXF çıktısı geçmişte tutulur.
- **Yerleşim motoruna dokunulmaz:** Windows paketi M93hasan/nesting kaynağını derleme anında ayrı olarak alır; yalnızca PC'ye özel giriş ve çevrimdışı veri erişim katmanını hazırlar. Web deposunun kaynak dosyaları **değiştirilmez**.
- **İnternetli web özellikleri çevrimdışı değildir:** Bulut senkronizasyonu, web hesabı, canlı destek, admin paneli ve sunucu bileti doğrulayan CorelDRAW/RDWorks aktarım köprüsü offline PC'de kullanılamaz. DXF'yi indirip CorelDRAW veya RDWorks içinde normal **İçe Aktar** yoluyla açabilirsiniz.
- **Güncelleme şekli:** Çevrimdışı PC sürümünün güncellenmesi için yeni kurulum paketi gerekir. Web sitesinin sonraki değişiklikleri kurulu EXE'ye otomatik yansımaz.

## İndirme ve kullanım

[**Windows kurulum dosyası — Releases**](https://github.com/M93hasan/serula-nesting-pro-pc/releases/latest)

Yeni offline sürümün sürüm etiketi **pc-v0.1.6** olmalıdır. Önceki pc-v0.1.5 ve daha eski kurulumlar canlı serula.site sitesini açabilir; bunlar offline sürüm değildir.

İnterneti kapatarak test: programı açın; bir DXF içe aktarın, nesting çalıştırın, DXF çıktısını kaydedin, programı kapatıp yeniden açın ve **Geçmiş** kaydını kontrol edin.

## Verilerin saklandığı yer

Windows'ta genel olarak:

    %APPDATA%\serula-nesting-pro-pc\offline-data\

Kesin konum Electron app.getPath('userData')/offline-data değeridir; işletim sistemi ve geçmiş kurulum yapılandırmasına göre değişebilir. Burada manifest.json, autosave.json ve exports/ klasörü vardır. Bu klasörün yedeğini almak, yerel proje ve çıktı geçmişini korur. Bu dosyalar buluta otomatik yüklenmez.

## Geliştirme ve kurulum paketi üretme

Node.js 22 ve Windows için:

1. Bu PC deposunu indirin.
2. Web kaynağını web-source/ altına M93hasan/nesting olarak yerleştirin (örn. git clone https://github.com/M93hasan/nesting.git web-source) veya SERULA_WEB_DIR ortam değişkeninde web klasörü yolunu tanımlayın.
3. Bağımlılıkları kurun:

       npm install
       npm ci --prefix web-source/web

4. Test ve derleme:

       npm run offline:test
       npm run desktop:dev
       npm run dist:win

Kurulum dosyası release/Serula-Nesting-Pro-PC-Setup.exe altında oluşur. GitHub Actions, PC ve web kaynaklarını ayrı checkout adımlarıyla alır ve offline derlemeyi Windows üzerinde yapar.

npm run offline:prepare, web kaynağının **geçici kopyası** üstüne çevrimdışı PC giriş dosyasını ve yerel kayıt etiketlerini uygular. Ardından tip kontrolü / mevcut dört WASM ikili dosyasının varlık kontrolü / Vite üretim derlemesi çalışır ve offline-web/ dosyalarını üretir. Web deposundaki prebuilt.sha256 parmak izi güncel kaynakla uyuşmadığı için PC derlemesi mevcut WASM ikili dosyalarını değiştirmeden kullanır; bu uyumsuzluk ayrıca giderilmelidir. Derleme için internet veya önceden indirilmiş bağımlılıklar gerekebilir; **kurulmuş program için gerekmez**.

## Güvenlik ve mimari

- Electron yalnızca 127.0.0.1 adresinde rastgele bağlantı noktasına bağlanan Node HTTP sunucusunu açar; siteye bağlanmaz ve dış ağ isteklerini engeller.
- Yerel API, rastgele üretilmiş HttpOnly, SameSite=Strict oturum çerezi ile korunur. Windows dosyaları web içeriklerine doğrudan açılmaz.
- Cross-Origin-Opener-Policy ve Cross-Origin-Embedder-Policy üstbilgileri, destekleyen bilgisayarlarda WASM worker/SharedArrayBuffer kullanımı için eklenmiştir.
- Nesting geometri, dönüş, rulo/plaka, DXF varlık koruma ve hesaplama işleyişi web kaynağıyla aynıdır.
- Lazer üretiminde dosyayı CorelDRAW veya RDWorks'e aldıktan sonra parça adedi, gerçek ölçüler ve kesim katmanlarını kontrol edin.

**Web projesi:** https://github.com/M93hasan/nesting

**Mevcut Windows köprüsü:** desktop/bridge/ altında muhafaza edilir; çevrimdışı modda otomatik kurulmaz, çünkü sunucu bileti doğrulaması internete bağlıdır.
