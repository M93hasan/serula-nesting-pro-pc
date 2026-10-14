# Serula Nesting Pro PC

Windows masaüstü sürümü.

Bu repo, Serula Nesting Pro'nun PC kabuğunu içerir. Uygulama masaüstünde ayrı bir Windows penceresi olarak açılır ve canlı Serula sürümünü kullanır.

## Güncelleme modeli

Ana kaynak:

- https://github.com/M93hasan/nesting

Canlı uygulama:

- https://serula.site

Web tarafında yayınlanan güncellemeler PC uygulamasına yeni EXE kurulmadan yansır. PC kabuğu veya Windows paketleme yapısı değiştiğinde yeni EXE üretilir.

## Otomatik CorelDRAW / RDWorks köprüsü (PC v0.1.1)

Yeni Windows kurulum paketi Serula Bridge v1.1'i içerir (`desktop/bridge/`), internetten ek kurulum betiği indirmeyi gerektirmez.

- PC programı açıldığında Windows için `SetupBundledBridge.ps1` otomatik başlar.
- Köprü kullanıcı dizinine (`%LOCALAPPDATA%\\SerulaBridge`) kurulur ve `127.0.0.1:43842` bağlantısında çalışır.
- İlk kullanımda Windows, localhost URL rezervasyonu için **bir kez yönetici onayı** isteyebilir.
- Oturum açılışında otomatik başlatma kısayolu oluşturulur. Daha sonra PC uygulamasını kapatsanız da köprü çalışabilir.
- Elle yeniden başlatmak veya onarmak için kurulu dosyalar içinde `resources/serula-bridge/Serula-Kur.cmd` bulunur.
- Sağlık kontrolü: http://127.0.0.1:43842/health (`version=1.1`).
- Kurulum günlüğü: `%LOCALAPPDATA%\\SerulaBridge\\installation.log`.
- Köprü CorelDRAW'a COM ile aktarır, RDWorks için odak kontrollü arayüz otomasyonu kullanır; RDWorks'te çizimin gerçekten açıldığını kontrol edin.
- Admin panelinde CorelDRAW/RDWorks aktarım izinlerinin açık olması gerekir.

Bu köprü mevcut web uygulamasının API bilet doğrulaması ile çalışır; nesting yerleştirme motorunu değiştirmez. Windows dışındaki platformlarda kurulmaz.

## Yerel çalıştırma

```bash
npm install
npm run desktop:dev
```

## Windows kurulum dosyası

```bash
npm install
npm run dist:win
```

Çıktı `release/` klasöründe oluşur.
