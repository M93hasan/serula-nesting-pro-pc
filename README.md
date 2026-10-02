# Serula Nesting Pro PC

Windows masaüstü sürümü.

Bu repo, Serula Nesting Pro'nun PC kabuğunu içerir. Uygulama masaüstünde ayrı bir Windows penceresi olarak açılır ve canlı Serula sürümünü kullanır.

## Güncelleme modeli

Ana kaynak:

- https://github.com/M93hasan/nesting

Canlı uygulama:

- https://serula.site

Web tarafında yayınlanan güncellemeler PC uygulamasına yeni EXE kurulmadan yansır. PC kabuğu veya Windows paketleme yapısı değiştiğinde yeni EXE üretilir.

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
