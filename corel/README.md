# Serula Nesting for CorelDRAW — Offline

Bu sürüm **tamamen CorelDRAW içinde** çalışır.

- İnternet gerekmez.
- Serula web sitesi gerekmez.
- Serula PC uygulaması gerekmez.
- Harici EXE gerekmez.
- WinAPI / 32-bit / 64-bit Declare kullanılmaz.
- Makro CorelDRAW'un kendi VBA ve Shape/ShapeRange API'lerini kullanır.

## Hedef sürümler

Makro, CorelDRAW X7 döneminde bulunan temel VBA API'leri üzerine kurulmuştur ve güncel CorelDRAW sürümlerinde de bulunan aynı API'leri kullanır. Bu nedenle eski ve yeni CorelDRAW kurulumlarında geniş uyumluluk hedeflenir.

## Ne yapar?

1. CorelDRAW'da seçili her **üst nesneyi** bir parça kabul eder.
2. Parçaların ölçülerini değiştirmez.
3. Ayarlara göre 0° veya 0/90° döndürür.
4. Yeni bir Corel sayfası açar.
5. Parçaları Bottom-Left tabanlı yerleşimle dizer.
6. Rulo modunda kullanılan uzunluğa göre sayfa boyunu ayarlar.
7. Plaka modunda sığmayan parçaları otomatik olarak 2., 3. ve sonraki sayfalara geçirir.
8. Başlangıç köşesi LB / RB / LT / RT seçilebilir.
9. Orijinal çizimi silmez; nesting için kopya üretir.

## Önemli

Bir ayakkabı parçasının dış konturu, iç delikleri, çizgileri veya yazıları birlikte hareket edecekse bunları CorelDRAW'da **grup** yapın. Makro her seçili üst nesneyi tek parça olarak taşır/döndürür; grup içindeki detaylar bozulmaz.

## Makrolar

### Serula_Ayarlar

Şunları Corel içinde ayarlar ve hatırlar:

- Rulo / plaka
- Malzeme genişliği
- Plaka uzunluğu
- Parça aralığı
- Margin
- Dönüş modu
- Başlangıç köşesi

Varsayılan parça aralığı: **0.3 mm**

Varsayılan margin: **5 mm**

### Serula_Nesting

Seçili parçaları yeni Corel sayfasında yerleştirir.

### Serula_Bilgi

Kurulu macro sürümünü gösterir.

## Kurulum

1. CorelDRAW'da Macro Manager / Visual Basic Editor'u açın.
2. GlobalMacros veya kendi GMS projenize yeni Module ekleyin.
3. `SerulaNesting.bas` dosyasını Import edin.
4. İlk kullanımda `Serula_Ayarlar` çalıştırın.
5. İsterseniz `Serula_Nesting` komutunu Corel toolbar'a tek tuş olarak ekleyin.

Corel sürümüne göre menü adı **Tools > Macros**, **Macro Manager**, **Scripts** veya **Visual Basic** olarak görünebilir.

## Nesting motoru notu

Bu ilk tamamen-Corel sürümünde yerleşim güvenliği için parçaların Corel bounding box'ları kullanılır. Bu nedenle çakışma üretmez; ancak web Serula'daki gerçek içbükey/NFP motoru kadar sıkı fire doldurmaz. Sonraki aşamada Corel-içi motor gerçek kontur çarpışmasıyla geliştirilebilir.
